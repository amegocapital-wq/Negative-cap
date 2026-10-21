/**
 * Optional AI hook-writing engine.
 *
 * The app works fully offline. If the user points it at an OpenAI-compatible
 * endpoint (OpenAI, OpenRouter, Groq, a local Ollama on their own machine, ...)
 * it will ask that model to pick and write the clips instead, then merge the
 * result back into the same `Clip` shape the UI already understands.
 *
 * Design notes:
 *  - The provider never sees anything except the transcript the user pasted.
 *  - Responses are validated hard: bad ranges are discarded, missing fields are
 *    filled from the local engine, so a flaky model can't break the screen.
 */

import { clipFromRange, recomputeTotal } from './engine';
import { LENGTH_PRESETS } from './engine';
import type { AiConfig, Clip, GenerateOptions, Niche, ParsedTranscript } from './types';
import { formatTime } from './transcript';

export interface ProviderPreset {
  id: string;
  label: string;
  baseUrl: string;
  model: string;
  note: string;
}

export const AI_PRESETS: ProviderPreset[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    note: 'Paste an OpenAI key.',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini',
    note: 'One key, many models.',
  },
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    note: 'Fast + free tier.',
  },
  {
    id: 'ollama',
    label: 'Local (Ollama)',
    baseUrl: 'http://10.0.2.2:11434/v1',
    model: 'llama3.1',
    note: 'No cost. 10.0.2.2 reaches your computer from the emulator.',
  },
];

export const DEFAULT_AI: AiConfig = {
  enabled: false,
  baseUrl: AI_PRESETS[0].baseUrl,
  model: AI_PRESETS[0].model,
  apiKey: '',
};

export class AiError extends Error {
  constructor(message: string, readonly hint?: string) {
    super(message);
    this.name = 'AiError';
  }
}

const SYSTEM_PROMPT = `You are Hookline, a short-form video editor who has grown multiple accounts past 1M followers.
You receive a transcript of a long-form video and cut it into standalone vertical clips (Shorts / Reels / TikToks).

Rules for every clip:
1. HOOK (first 1-3 seconds): a curiosity gap, a bold claim, a question, or the payoff stated up front. Never open with "so", "and", "in this video", a greeting, or backstory.
2. BODY: one single idea, self-contained. A cold viewer with no context must understand it.
3. PAYOFF: the loop must close inside the clip — the promise in the hook must be resolved. No "link in bio" baiting, no "part 2" cliffhangers.
4. RETENTION: prefer clips that can loop (last line flows into the hook) and clips with concrete numbers, contrast or a named mistake.
5. ENGAGEMENT: one CTA that invites a comment, a save or a share. Never ask for a like.
6. Quote the speaker's actual words for the body and payoff. You may rewrite only the hook sentence.
7. Never invent facts, numbers or claims that are not in the transcript.

Output STRICT JSON only, no markdown fences, no commentary:
{"clips":[{"start":12.4,"end":48.2,"hook":"...","payoff":"...","body":["...","..."],"title":"...","caption":"...","cta":"...","hookAlternatives":["...","..."],"hashtags":["#tag"],"why":"one sentence on why this clip retains"}]}
start/end are seconds from the beginning of the video and must match real transcript timings.`;

function lengthWords(length: GenerateOptions['length']): string {
  const preset = LENGTH_PRESETS[length];
  return `${preset.min}-${preset.max} seconds (aim for ${preset.ideal}s)`;
}

export function buildUserPrompt(
  transcript: ParsedTranscript,
  opts: GenerateOptions,
  maxChars = 14000
): string {
  const withTimes = transcript.sentences
    .map((s) => `[${formatTime(s.start)}] ${s.text}`)
    .join('\n');

  // Long videos: keep a representative slice so the request stays affordable.
  const body =
    withTimes.length > maxChars
      ? `${withTimes.slice(0, maxChars)}\n… [transcript truncated to fit]`
      : withTimes;

  return [
    `Niche: ${opts.niche}`,
    `Target clip length: ${lengthWords(opts.length)}`,
    `Number of clips: ${opts.count}`,
    opts.handle ? `Creator handle: ${opts.handle}` : '',
    opts.ctaKeyword ? `Comment-bait keyword to offer: ${opts.ctaKeyword}` : '',
    '',
    'Transcript (timestamps in [h:mm:ss] before each line):',
    body,
    '',
    `Return exactly ${opts.count} clips, best first, as strict JSON.`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Strip ```json fences and pull the first JSON object/array out of a reply. */
export function extractJson(raw: string): unknown {
  const text = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(text);
  } catch {
    // Fall through to bracket scanning.
  }
  const start = text.search(/[[{]/);
  if (start === -1) throw new AiError('The model did not return JSON.', 'Try again or switch models.');
  const openChar = text[start];
  const closeChar = openChar === '[' ? ']' : '}';
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === openChar) depth += 1;
    else if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          break;
        }
      }
    }
  }
  throw new AiError('Could not parse the model response as JSON.');
}

interface RawAiClip {
  start?: number;
  end?: number;
  hook?: string;
  payoff?: string;
  body?: string[];
  title?: string;
  caption?: string;
  cta?: string;
  hookAlternatives?: string[];
  hashtags?: string[];
  why?: string;
}

/** Turn a validated AI payload into Clip objects with local scoring. */
export function mergeAiClips(
  payload: unknown,
  transcript: ParsedTranscript,
  opts: GenerateOptions
): Clip[] {
  const container = payload as { clips?: RawAiClip[] } | RawAiClip[];
  const list = Array.isArray(container) ? container : container?.clips;
  if (!Array.isArray(list) || !list.length) {
    throw new AiError('The model returned no clips.');
  }

  const clips: Clip[] = [];
  list.forEach((raw, index) => {
    const start = Number(raw.start);
    const end = Number(raw.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return;
    if (end <= start + 3) return;
    if (start < 0 || start > transcript.duration) return;

    const clip = clipFromRange(
      transcript,
      opts,
      Math.max(0, start),
      Math.min(transcript.duration, end),
      index + 1
    );
    if (!clip) return;

    const hook = typeof raw.hook === 'string' ? raw.hook.trim() : '';
    const payoff = typeof raw.payoff === 'string' ? raw.payoff.trim() : '';
    const body = Array.isArray(raw.body) ? raw.body.filter((b) => typeof b === 'string' && b.trim()) : [];
    const hashtags = Array.isArray(raw.hashtags)
      ? raw.hashtags.filter((h) => typeof h === 'string' && h.startsWith('#'))
      : [];

    const overrides: Partial<Clip> = {};
    if (hook) {
      overrides.hook = hook;
      overrides.hooks = [hook, ...(raw.hookAlternatives || []).filter((h) => typeof h === 'string' && h.trim())]
        .filter((h, i, arr) => arr.indexOf(h) === i)
        .slice(0, 4);
    }
    if (payoff) overrides.payoff = payoff;
    if (body.length) overrides.body = body;
    if (typeof raw.title === 'string' && raw.title.trim()) overrides.title = raw.title.trim();
    if (typeof raw.caption === 'string' && raw.caption.trim()) overrides.caption = raw.caption.trim();
    if (typeof raw.cta === 'string' && raw.cta.trim()) {
      overrides.cta = raw.cta.trim();
      overrides.ctas = [raw.cta.trim(), ...clip.ctas].filter((c, i, arr) => arr.indexOf(c) === i).slice(0, 3);
    }
    if (hashtags.length) overrides.hashtags = hashtags.slice(0, 8);
    if (typeof raw.why === 'string' && raw.why.trim()) overrides.reasons = [raw.why.trim()];

    const merged = clipFromRange(
      transcript,
      opts,
      Math.max(0, start),
      Math.min(transcript.duration, end),
      index + 1,
      overrides
    );
    if (merged) clips.push({ ...merged, score: { ...merged.score, total: recomputeTotal(merged.score) } });
  });

  if (!clips.length) throw new AiError('The model returned clips that did not match the transcript.');
  return clips.sort((a, b) => b.score.total - a.score.total).map((c, i) => ({ ...c, rank: i + 1 }));
}

/** Call an OpenAI-compatible /chat/completions endpoint. */
export async function requestAiClips(
  transcript: ParsedTranscript,
  opts: GenerateOptions,
  config: AiConfig,
  signal?: AbortSignal
): Promise<Clip[]> {
  const baseUrl = config.baseUrl.replace(/\/+$/, '');
  if (!baseUrl) throw new AiError('No API endpoint configured.', 'Open Settings → AI engine.');
  if (!config.model) throw new AiError('No model configured.', 'Open Settings → AI engine.');
  if (!config.apiKey && !/localhost|127\.0\.0\.1|10\.0\.2\.2|0\.0\.0\.0/.test(baseUrl)) {
    throw new AiError('This provider needs an API key.', 'Add it in Settings → AI engine.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.7,
        max_tokens: 2400,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(transcript, opts) },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new AiError(
        `Provider returned ${response.status}.`,
        detail.slice(0, 220) || 'Check the model name, key and endpoint in Settings.'
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new AiError('Empty response from the provider.');

    return mergeAiClips(extractJson(content), transcript, opts);
  } catch (error) {
    if (error instanceof AiError) throw error;
    if ((error as Error).name === 'AbortError') {
      throw new AiError('The request timed out.', 'Try a smaller transcript or a faster model.');
    }
    throw new AiError(
      'Could not reach the AI provider.',
      'Check the endpoint URL, your connection, and that the app has network access.'
    );
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
  }
}

export const NICHE_LABELS: Record<Niche, string> = {
  general: 'General',
  education: 'Education',
  business: 'Business',
  finance: 'Money',
  tech: 'Tech / AI',
  fitness: 'Fitness',
  motivation: 'Motivation',
  comedy: 'Comedy',
};

/**
 * Cheap connectivity check for the Settings screen: does the endpoint answer
 * with a model list? Never sends the transcript.
 */
export async function testAiConnection(config: AiConfig): Promise<string> {
  const baseUrl = config.baseUrl.replace(/\/+$/, '');
  if (!baseUrl) throw new AiError('Add an endpoint URL first.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${baseUrl}/models`, {
      headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : undefined,
      signal: controller.signal,
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new AiError('Endpoint reachable, but the API key was rejected.');
      }
      throw new AiError(`Endpoint reachable, but returned ${response.status}.`);
    }
    const data = (await response.json().catch(() => ({}))) as { data?: Array<{ id?: string }> };
    const count = Array.isArray(data.data) ? data.data.length : 0;
    const hasModel = data.data?.some((m) => m.id === config.model);
    if (count && !hasModel) {
      return `Connected · ${count} models available · “${config.model}” not in the list`;
    }
    return count ? `Connected · ${count} models available` : 'Connected';
  } catch (error) {
    if (error instanceof AiError) throw error;
    if ((error as Error).name === 'AbortError') throw new AiError('The endpoint timed out.');
    throw new AiError('Could not reach that endpoint.', 'Check the URL and your connection.');
  } finally {
    clearTimeout(timeout);
  }
}
