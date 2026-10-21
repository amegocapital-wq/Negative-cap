/**
 * The clip engine.
 *
 *   sentences ──▶ candidate windows ──▶ feature scores ──▶ ranked, de-duped clips
 *                                                     └──▶ hook / caption / beat sheet
 *
 * It is fully deterministic and offline. Tune behaviour in `scoring.ts`
 * (what makes a clip good), `hooks.ts` (how hooks read) and here (how clips are
 * cut). `docs/EXTENDING.md` walks through each knob.
 */

import { VISUAL_MAP } from './lexicon';
import {
  buildCaption,
  buildCtas,
  buildHashtags,
  buildHooks,
  buildTitle,
  stripFillers,
} from './hooks';
import {
  clamp,
  countMatches,
  extractKeywords,
  extractTopic,
  findFillerPhrases,
  hasExplicitNumber,
  hasNumber,
  isContrarian,
  isListy,
  isQuestion,
  isStory,
  scoreClarity,
  scoreEmotion,
  scoreEnergy,
  scoreHook,
  scoreLoop,
  scorePayoff,
  scoreStructure,
  similarity,
} from './scoring';
import { formatTime, parseTranscript } from './transcript';
import type {
  Clip,
  ClipBeat,
  ClipLength,
  ClipResult,
  GenerateOptions,
  LengthPreset,
  ParsedTranscript,
  ScoreBreakdown,
  Sentence,
  Settings,
} from './types';

export const LENGTH_PRESETS: Record<ClipLength, LengthPreset> = {
  short: {
    id: 'short',
    label: 'Punchy',
    detail: '15–25s · loops & one-liners',
    min: 14,
    max: 26,
    ideal: 20,
  },
  medium: {
    id: 'medium',
    label: 'Standard',
    detail: '25–45s · hook + story + payoff',
    min: 24,
    max: 46,
    ideal: 33,
  },
  long: {
    id: 'long',
    label: 'Deep cut',
    detail: '45–60s · mini-lessons',
    min: 42,
    max: 62,
    ideal: 52,
  },
};

/** Weighting of each score dimension in the final ranking. Must sum to 1. */
export const SCORE_WEIGHTS = {
  hook: 0.28,
  payoff: 0.18,
  clarity: 0.14,
  energy: 0.12,
  emotion: 0.1,
  structure: 0.1,
  loop: 0.08,
} as const;

/** Everything on a clip that is computed before the explanatory fields. */
type ClipCore = Omit<Clip, 'editNotes' | 'reasons' | 'visuals'>;

interface Candidate {
  from: number;
  to: number;
  start: number;
  end: number;
  duration: number;
  sentences: Sentence[];
  score: ScoreBreakdown;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Sentences that should never open a clip on their own. */
function isJunkSentence(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (t.split(/\s+/).length < 5) return true;
  if (/^(>>|\[)/.test(t)) return true;
  if (/^(subscribe|like and subscribe|thanks for watching|see you next time)/i.test(t)) return true;
  if (/^(hi|hello|hey|what's up)( guys| everyone| everybody)?[,!.]?$/i.test(t)) return true;
  return false;
}

/**
 * Sliding windows that respect sentence boundaries.
 * Overlap is allowed here — de-duplication happens at selection time.
 */
function buildCandidates(sentences: Sentence[], preset: LengthPreset): Candidate[] {
  const candidates: Candidate[] = [];
  const maxSpan = preset.max * 1.15;

  for (let from = 0; from < sentences.length; from += 1) {
    if (isJunkSentence(sentences[from].text) && sentences.length > 6) continue;

    for (let to = from; to < sentences.length; to += 1) {
      const start = sentences[from].start;
      const end = sentences[to].end;
      const duration = end - start;
      if (duration > maxSpan) break;
      if (to - from < 1) continue; // at least two sentences
      if (duration < preset.min * 0.8) continue;

      const window = sentences.slice(from, to + 1);
      const text = window.map((s) => s.text).join(' ');
      const wpm = (window.reduce((sum, s) => sum + s.words, 0) / Math.max(1, duration)) * 60;
      const first = window[0].text;
      const last = window[window.length - 1].text;

      const hook = scoreHook(first);
      const payoff = scorePayoff(last);
      const clarity = Math.round(
        window.reduce((sum, s) => sum + scoreClarity(s.text), 0) / window.length
      );
      const energy = scoreEnergy(window, wpm);
      const emotion = scoreEmotion(text);
      const structure = scoreStructure(text);
      const loop = scoreLoop(first, last, last);

      const base =
        hook * SCORE_WEIGHTS.hook +
        payoff * SCORE_WEIGHTS.payoff +
        clarity * SCORE_WEIGHTS.clarity +
        energy * SCORE_WEIGHTS.energy +
        emotion * SCORE_WEIGHTS.emotion +
        structure * SCORE_WEIGHTS.structure +
        loop * SCORE_WEIGHTS.loop;

      // Duration fitness: sweet spot around the preset's ideal length.
      const drift = Math.abs(duration - preset.ideal) / preset.ideal;
      const durationFactor = clamp(1 - drift * 0.28, 0.72, 1);

      // Natural cut point: start right after a pause in the source audio.
      const previous = sentences[from - 1];
      const pauseBonus = previous && start - previous.end > 0.6 ? 3 : 0;

      const total = clamp(Math.round(base * durationFactor) + pauseBonus);

      candidates.push({
        from,
        to,
        start,
        end,
        duration,
        sentences: window,
        score: {
          hook,
          payoff,
          clarity,
          energy,
          emotion,
          structure,
          loop,
          total,
        },
      });
    }
  }

  return candidates;
}

/** Greedy selection: best score first, no overlaps, keep topics varied. */
function selectCandidates(candidates: Candidate[], count: number): Candidate[] {
  const sorted = [...candidates].sort((a, b) => b.score.total - a.score.total);
  const chosen: Candidate[] = [];
  const taken: Array<{ start: number; end: number }> = [];

  const overlaps = (c: Candidate) =>
    taken.some((t) => c.start < t.end + 1.2 && c.end > t.start - 1.2);

  const push = (c: Candidate) => {
    chosen.push(c);
    taken.push({ start: c.start, end: c.end });
  };

  // Pass 1: high score, non-overlapping, topic-diverse.
  for (const candidate of sorted) {
    if (chosen.length >= count) break;
    if (overlaps(candidate)) continue;
    const tooSimilar = chosen.some((c) =>
      similarity(c.sentences.map((s) => s.text).join(' '), candidate.sentences.map((s) => s.text).join(' ')) > 0.55
    );
    if (tooSimilar) continue;
    push(candidate);
  }

  // Pass 2: relax diversity if we still need clips.
  if (chosen.length < count) {
    for (const candidate of sorted) {
      if (chosen.length >= count) break;
      if (overlaps(candidate)) continue;
      push(candidate);
    }
  }

  // Pass 3: tiny transcript — allow overlap rather than return nothing.
  if (!chosen.length && sorted.length) push(sorted[0]);

  return chosen.sort((a, b) => a.start - b.start);
}

/** Short text cards for the edit (≤ 8 words each). */
function toBeatText(text: string, maxWords = 8): string {
  const clean = stripFillers(text).replace(/\s+/g, ' ').trim();
  const tokens = clean.split(' ');
  if (tokens.length <= maxWords) return clean.replace(/[.!?…]$/, '');
  const window = tokens.slice(0, maxWords).join(' ').replace(/[,;:]$/, '');
  return `${window}…`;
}

/** Split body sentences into 3-5 timed on-screen beats. */
function buildBeats(
  hook: string,
  body: string[],
  payoff: string,
  duration: number,
  wpm: number
): ClipBeat[] {
  const beats: ClipBeat[] = [{ at: 0, text: toBeatText(hook, 9), kind: 'hook' }];

  const source = body.length ? body : [payoff];
  const bodyBudget = Math.max(2, Math.round(duration * 0.7));
  const perBeat = bodyBudget / Math.max(1, source.length);
  source.forEach((line, i) => {
    beats.push({
      at: round(2 + i * perBeat),
      text: toBeatText(line, 8),
      kind: 'body',
    });
  });

  if (payoff) {
    beats.push({
      at: round(Math.max(2.5, duration - Math.min(6, (payoff.split(/\s+/).length / wpm) * 60 + 1))),
      text: toBeatText(payoff, 9),
      kind: 'payoff',
    });
  }

  return beats.sort((a, b) => a.at - b.at);
}

/** Concrete editing instructions for a clip. */
function buildEditNotes(
  clip: ClipCore,
  opts: GenerateOptions,
  transcript: ParsedTranscript
): string[] {
  const notes: string[] = [];
  const hookSeconds = Math.min(3.5, Math.max(2, (clip.hook.split(/\s+/).length / clip.wpm) * 60 + 0.6));
  notes.push(`Hook text on screen 0:00–${formatTime(hookSeconds)}. Cut everything before ${formatTime(clip.start)}.`);
  notes.push(`Subtitles: 2–4 words per line, highlight the key word in an accent colour.`);

  if (!isSameHook(clip.hook, clip.source[0].text)) {
    notes.push(
      `Cold-open with a separate hook read (or the line at ${formatTime(clip.start + clip.duration * 0.6)}), then cut back to the setup at ${formatTime(clip.start)}.`
    );
  }

  const numberSentence = clip.source.find((s) => hasNumber(s.text));
  if (numberSentence) {
    notes.push(`Add a stat card for the number in “${toBeatText(numberSentence.text, 6)}”.`);
  }

  if (clip.trimmedWords.length) {
    notes.push(`Trim filler: remove “${clip.trimmedWords.slice(0, 3).join('”, “')}”.`);
  }

  if (clip.score.loop >= 55) {
    notes.push('Loopable: end the last line flush against the first so the replay feels seamless.');
  }
  if (clip.score.emotion >= 60) {
    notes.push('Punch-in zoom (105–110%) on the most emotional word and hold for 1.5s.');
  }
  if (clip.score.energy < 50) {
    notes.push('Tighten pace: cut 8–12% of dead air between sentences.');
  }
  notes.push(`Post CTA: “${clip.cta}” as the last 2 seconds or as pinned comment.`);
  if (!transcript.hasTiming) {
    notes.push('No source timestamps — confirm these cut points in your editor before exporting.');
  }
  if (opts.length === 'short') {
    notes.push('Keep one idea only. If it needs a second idea, split it into another clip.');
  }
  return notes;
}

/** Human label for a total score, so the number is not read in isolation. */
export function scoreLabel(total: number): string {
  if (total >= 78) return 'Elite';
  if (total >= 64) return 'Strong';
  if (total >= 50) return 'Solid';
  return 'Okay';
}

/** Plain-language explanation of why the clip scores the way it does. */
function buildReasons(clip: ClipCore): string[] {
  const reasons: string[] = [];
  const first = clip.source[0]?.text || '';
  const last = clip.source[clip.source.length - 1]?.text || '';

  if (/\?\s*$/.test(clip.hook) || (isQuestion(clip.hook) && isQuestion(first))) {
    reasons.push('Opens with a question — the brain wants the answer before it scrolls.');
  }
  if (/\b(nobody|most people|everyone|no one)\b/i.test(first + clip.hook)) {
    reasons.push('Uses an “everyone vs. you” gap — instant insider feeling.');
  }
  if (isContrarian(first)) {
    reasons.push('Contrarian opening: disagreement is the cheapest engagement driver.');
  }
  if (hasExplicitNumber(first) || hasExplicitNumber(last)) {
    reasons.push('Specific numbers beat vague claims — they read as proof, not opinion.');
  }
  if (/\byou\b|\byour\b/i.test(clip.excerpt)) {
    reasons.push('Second-person language keeps the viewer inside the story.');
  }
  if (clip.score.payoff >= 55) {
    reasons.push('The payoff lands inside the clip, so it feels complete — no “wait for part 2”.');
  }
  if (clip.score.loop >= 55) {
    reasons.push('Loopable ending: replays stack up extra watch time.');
  }
  if (clip.wpm >= 140) {
    reasons.push(`Cut runs at ${Math.round(clip.wpm)} wpm — fast enough to feel urgent.`);
  }
  if (!isSameHook(clip.hook, first)) {
    reasons.push('Hook is a rewritten frame, so the first 2 seconds are pure curiosity with no setup.');
  }
  if (clip.score.clarity >= 70) {
    reasons.push('Self-contained: a cold viewer needs zero prior context.');
  }
  if (!reasons.length) reasons.push('Highest combined hook/payoff score in this transcript.');
  return reasons.slice(0, 5);
}

/** Roughly the same hook as the source line (allowing for trimming)? */
function isSameHook(hook: string, sourceLine: string): boolean {
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  const a = norm(hook);
  const b = norm(sourceLine);
  return a.startsWith(b.slice(0, 40)) || b.startsWith(a.slice(0, 40));
}

function buildVisuals(text: string): string[] {
  const found: string[] = [];
  for (const [pattern, description] of VISUAL_MAP) {
    if (pattern.test(text) && !found.includes(description)) found.push(description);
  }
  if (found.length < 2) found.push('Talking-head A-cam with punch-ins every 2–3 seconds');
  if (found.length < 3) found.push('Screen capture or text-on-screen animation for the key line');
  return found.slice(0, 4);
}

function makeClip(
  candidate: Candidate,
  rank: number,
  opts: GenerateOptions,
  transcript: ParsedTranscript
): Clip {
  const sentences = candidate.sentences;
  const excerpt = sentences.map((s) => s.text).join(' ');
  const chunkText = (from: number) => sentences.slice(from).map((s) => s.text).join(' ');

  const opener = sentences[0].text;
  const last = sentences[sentences.length - 1].text;
  // Payoff: the strongest ending among the final two sentences.
  const payoff =
    sentences.length > 2 && scorePayoff(sentences[sentences.length - 2].text) > scorePayoff(last) + 8
      ? sentences[sentences.length - 2].text
      : last;

  const topic = extractTopic(excerpt);
  const keywords = extractKeywords(excerpt, 6);
  const wpm = Math.round((sentences.reduce((sum, s) => sum + s.words, 0) / Math.max(1, candidate.duration)) * 60);

  const hooks = buildHooks({
    opener,
    payoff,
    body: chunkText(1),
    topic,
    niche: opts.niche,
    hasList: isListy(excerpt),
    ctaKeyword: opts.ctaKeyword,
  });
  const hook = hooks[0];
  // Rank on what the viewer actually sees, not just the source's first line.
  const hookScore = scoreHook(hook);

  const body = sentences
    .slice(1, sentences.length - 1)
    .map((s) => stripFillers(s.text))
    .filter(Boolean);

  const ctas = buildCtas({
    body: excerpt,
    keyword: opts.ctaKeyword,
    contrarian: isContrarian(excerpt),
    hasList: isListy(excerpt),
    isStory: isStory(excerpt),
    hasQuestion: isQuestion(excerpt),
  });
  const cta = ctas[0];

  const base: ClipCore = {
    id: `clip-${Date.now().toString(36)}-${rank}-${Math.round(candidate.start)}`,
    rank,
    start: round(candidate.start),
    end: round(candidate.end),
    duration: round(candidate.duration),
    source: sentences,
    excerpt,
    hook,
    hooks,
    payoff: stripFillers(payoff),
    body,
    beats: buildBeats(hook, body, stripFillers(payoff), candidate.duration, wpm || transcript.wpm),
    title: buildTitle(hook),
    caption: buildCaption(hook, body.length ? body : [payoff], cta),
    hashtags: buildHashtags(opts.niche, excerpt, topic, opts.handle),
    cta,
    ctas,
    score: { ...candidate.score, hook: hookScore, total: recomputeTotal({ ...candidate.score, hook: hookScore }) },
    topic,
    keywords,
    trimmedWords: findFillerPhrases(excerpt),
    wpm,
  };

  return {
    ...base,
    editNotes: buildEditNotes(base, opts, transcript),
    reasons: buildReasons(base),
    visuals: buildVisuals(excerpt),
  };
}

/** Main entry point: transcript text (or parsed) → ranked clips. */
export function generateClips(
  input: string | ParsedTranscript,
  opts: GenerateOptions
): ClipResult {
  const transcript = typeof input === 'string' ? parseTranscript(input) : input;
  const preset = LENGTH_PRESETS[opts.length] ?? LENGTH_PRESETS.medium;
  const createdAt = Date.now();

  if (!transcript.sentences.length) {
    return {
      clips: [],
      transcript,
      options: opts,
      createdAt,
      engine: 'local',
    };
  }

  let candidates = buildCandidates(transcript.sentences, preset);

  // Short source video: fall back to the next shorter preset before giving up.
  if (!candidates.length) {
    const fallbacks: ClipLength[] = ['medium', 'short'];
    for (const key of fallbacks) {
      if (key === opts.length) continue;
      candidates = buildCandidates(transcript.sentences, LENGTH_PRESETS[key]);
      if (candidates.length) break;
    }
  }

  // Still nothing (e.g. a 20-second video): offer the whole thing as one clip.
  if (!candidates.length) {
    const whole = wholeTranscriptCandidate(transcript.sentences);
    if (whole) candidates = [whole];
  }

  const selected = selectCandidates(candidates, Math.max(1, opts.count));
  const clips = selected
    .map((c, i) => makeClip(c, i + 1, opts, transcript))
    .sort((a, b) => b.score.total - a.score.total)
    .map((clip, i) => ({ ...clip, rank: i + 1 }));

  return { clips, transcript, options: opts, createdAt, engine: 'local' };
}

/** Convenience wrapper used by the UI. */
export function optionsFromSettings(settings: Settings): GenerateOptions {
  return {
    niche: settings.niche,
    length: settings.length,
    count: settings.count,
    handle: settings.handle,
    ctaKeyword: settings.ctaKeyword,
  };
}

/** Copiable script for a clip (hook → body → payoff → CTA). */
export function clipToScript(clip: Clip): string {
  const lines = [
    `HOOK (0:00–0:03)`,
    clip.hook,
    '',
    `BODY`,
    ...(clip.body.length ? clip.body : [clip.excerpt]),
    '',
    `PAYOFF`,
    clip.payoff,
    '',
    `CTA`,
    clip.cta,
    '',
    `CAPTION`,
    clip.caption,
    '',
    clip.hashtags.join(' '),
  ];
  return lines.join('\n');
}

/** Markdown bundle for all clips — handy for pasting into a doc. */
export function clipsToMarkdown(result: ClipResult): string {
  const date = new Date(result.createdAt).toLocaleString();
  const header = [
    `# Hookline clips`,
    ``,
    `Generated ${date} · ${result.options.niche} · ${result.options.length} clips · ${result.clips.length} found`,
    `Source: ${formatTime(0)}–${formatTime(result.transcript.duration)} (${result.transcript.wordCount} words)`,
    ``,
  ];
  const body = result.clips.map((clip) => {
    return [
      `## ${clip.rank}. ${clip.title}`,
      ``,
      `**Score ${clip.score.total}/100** · ${formatTime(clip.start)}–${formatTime(clip.end)} (${Math.round(clip.duration)}s)`,
      ``,
      `**Hook**`,
      `> ${clip.hook}`,
      ``,
      `**Body**`,
      ...(clip.body.length ? clip.body.map((line) => `- ${line}`) : [`- ${clip.excerpt}`]),
      ``,
      `**Payoff**`,
      `> ${clip.payoff}`,
      ``,
      `**CTA**`,
      `> ${clip.cta}`,
      ``,
      `**Caption**`,
      '```',
      clip.caption,
      '```',
      ``,
      `**Hashtags**: ${clip.hashtags.join(' ')}`,
      ``,
      `**Why it works**`,
      ...clip.reasons.map((r) => `- ${r}`),
      ``,
      `**Edit notes**`,
      ...clip.editNotes.map((n) => `- ${n}`),
      ``,
      `**Source excerpt**`,
      `> ${clip.excerpt}`,
      ``,
      '---',
      ``,
    ];
  });
  return [...header, ...body.flat()].join('\n');
}

/** Small helper for the transcript heat map in the UI. */
export function scoreDensity(transcript: ParsedTranscript, buckets = 60): number[] {
  if (!transcript.sentences.length) return [];
  const span = Math.max(1, transcript.duration);
  const values = new Array(buckets).fill(0);
  for (const sentence of transcript.sentences) {
    const index = Math.min(buckets - 1, Math.floor((sentence.start / span) * buckets));
    values[index] += scoreHook(sentence.text) + countMatches(sentence.text, ['why', 'how', 'nobody', 'secret']);
  }
  const max = Math.max(...values, 1);
  return values.map((v) => Math.round((v / max) * 100));
}


/** Fallback window covering the entire transcript. */
function wholeTranscriptCandidate(sentences: Sentence[]): Candidate | null {
  if (sentences.length < 2) return null;
  const start = sentences[0].start;
  const end = sentences[sentences.length - 1].end;
  const duration = end - start;
  if (duration < 6) return null;
  const text = sentences.map((s) => s.text).join(' ');
  const wpm = (sentences.reduce((sum, s) => sum + s.words, 0) / Math.max(1, duration)) * 60;
  const first = sentences[0].text;
  const last = sentences[sentences.length - 1].text;
  const score: ScoreBreakdown = {
    hook: scoreHook(first),
    payoff: scorePayoff(last),
    clarity: Math.round(sentences.reduce((sum, s) => sum + scoreClarity(s.text), 0) / sentences.length),
    energy: scoreEnergy(sentences, wpm),
    emotion: scoreEmotion(text),
    structure: scoreStructure(text),
    loop: scoreLoop(first, last, last),
    total: 0,
  };
  score.total = recomputeTotal(score);
  return {
    from: sentences[0].id,
    to: sentences[sentences.length - 1].id,
    start,
    end,
    duration,
    sentences,
    score,
  };
}

/** Recompute the weighted total after a hook/payoff edit. */
export function recomputeTotal(score: ScoreBreakdown): number {
  return clamp(
    Math.round(
      score.hook * SCORE_WEIGHTS.hook +
        score.payoff * SCORE_WEIGHTS.payoff +
        score.clarity * SCORE_WEIGHTS.clarity +
        score.energy * SCORE_WEIGHTS.energy +
        score.emotion * SCORE_WEIGHTS.emotion +
        score.structure * SCORE_WEIGHTS.structure +
        score.loop * SCORE_WEIGHTS.loop
    )
  );
}

/**
 * Build a clip from an arbitrary time range. Used by the AI engine (which
 * returns its own start/end/hook) and by "cut this section" style features.
 */
export function clipFromRange(
  transcript: ParsedTranscript,
  opts: GenerateOptions,
  start: number,
  end: number,
  rank = 1,
  overrides: Partial<Clip> = {}
): Clip | null {
  const sentences = transcript.sentences.filter((s) => s.end > start + 0.05 && s.start < end - 0.05);
  if (!sentences.length) return null;

  const a = sentences[0].start;
  const b = sentences[sentences.length - 1].end;
  const text = sentences.map((s) => s.text).join(' ');
  const wpm = Math.round((sentences.reduce((n, s) => n + s.words, 0) / Math.max(1, b - a)) * 60);

  const candidate: Candidate = {
    from: sentences[0].id,
    to: sentences[sentences.length - 1].id,
    start: a,
    end: b,
    duration: b - a,
    sentences,
    score: {
      hook: scoreHook(sentences[0].text),
      payoff: scorePayoff(sentences[sentences.length - 1].text),
      clarity: Math.round(sentences.reduce((n, s) => n + scoreClarity(s.text), 0) / sentences.length),
      energy: scoreEnergy(sentences, wpm),
      emotion: scoreEmotion(text),
      structure: scoreStructure(text),
      loop: scoreLoop(sentences[0].text, sentences[sentences.length - 1].text, sentences[sentences.length - 1].text),
      total: 0,
    },
  };

  const baseClip = makeClip(candidate, rank, opts, transcript);
  const merged: Clip = { ...baseClip, ...overrides };
  const score: ScoreBreakdown = {
    ...baseClip.score,
    hook: overrides.hook ? scoreHook(overrides.hook) : baseClip.score.hook,
  };
  score.total = recomputeTotal(score);

  return {
    ...merged,
    score,
    reasons: overrides.reasons?.length ? overrides.reasons : buildReasons({ ...merged, score }),
  };
}
