/**
 * Hook, CTA, caption and title writing.
 *
 * The local engine is *extractive*: it reuses the creator's own words and only
 * wraps them in proven short-form frames, so it never puts claims in their
 * mouth. `buildHooks` returns a ranked list — the UI lets the user tap through
 * alternatives.
 */

import { CTA_TEMPLATES, FILLERS, NICHE_AUDIENCE, NICHE_HASHTAGS } from './lexicon';
import { countMatches, extractKeywords, isContrarian, scoreHook, words } from './scoring';
import type { Niche } from './types';

export interface HookContext {
  opener: string;
  payoff: string;
  body: string;
  topic: string;
  niche: Niche;
  hasList: boolean;
  ctaKeyword: string;
}

const MAX_HOOK_WORDS = 18;
const MAX_HOOK_CHARS = 96;

const LEADING_NOISE = /^(so|and|but|okay|ok|yeah|well|um|uh|erm|like|now|right|honestly|basically|i mean|you know)[,\s]+/i;

/** Openers that can never carry a hook on their own. */
const SUBORDINATE = /^(when|if|because|after|while|since|although|though|as|before|once|unless|even though|so that|in order|that's why|which|where|instead of|rather than|until)\b/i;

/** Discourse junk that makes a payoff line unusable as a cold open. */
const PAYOFF_JUNK = /^(so|and|but|now|okay|well|yeah|alright|right|anyway|also|then|plus|let me|i want to|i wanna|i just)\b[,:\s]*/i;

function capitalise(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function ensurePunctuation(text: string): string {
  const trimmed = text.trim().replace(/[,;:\s]+$/, '');
  if (!trimmed) return trimmed;
  return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

const DANGLING_END = /\s+(a|an|the|of|to|and|or|but|is|are|was|were|it|that|this|with|for|in|on|at|by|as|if|so|because|not|i|you|we|they|he|she)$/i;

/**
 * Trim to a word/clause budget without cutting mid-phrase.
 * Truncated hooks get an ellipsis so they read as intentional.
 */
export function trimToHook(text: string, maxWords = MAX_HOOK_WORDS): string {
  let clean = text
    .replace(/\s+/g, ' ')
    .replace(/^[-–—•]\s*/, '')
    .trim();
  while (LEADING_NOISE.test(clean)) clean = clean.replace(LEADING_NOISE, '');

  if (clean.length <= MAX_HOOK_CHARS && words(clean).length <= maxWords) return clean;

  let window = clean.split(' ').slice(0, maxWords).join(' ');
  if (window.length > MAX_HOOK_CHARS) {
    window = window.slice(0, MAX_HOOK_CHARS);
    window = window.slice(0, Math.max(0, window.lastIndexOf(' ')));
  }

  // Prefer ending on a clause boundary if it costs less than half the window.
  const boundaries = [...window.matchAll(/[,;:—]/g)]
    .map((m) => m.index ?? -1)
    .filter((i) => i >= window.length * 0.45);
  if (boundaries.length) window = window.slice(0, boundaries[boundaries.length - 1]);

  window = window.replace(/[\s,;:—]+$/, '');
  while (DANGLING_END.test(window)) window = window.replace(DANGLING_END, '');
  if (!window) return clean.split(' ').slice(0, maxWords).join(' ');

  return /[.!?…]$/.test(window) ? window : `${window}…`;
}

/** Clean up the creator's own opening sentence so it can sit on screen. */
export function cleanOpener(text: string): string {
  let clean = trimToHook(text);
  clean = clean.replace(/\b(um|uh|erm|like,|you know,?)\s*/gi, '');
  clean = clean.replace(/\s+/g, ' ').trim();
  return ensurePunctuation(capitalise(clean));
}

function lowerFirst(text: string): string {
  if (!text) return text;
  // Don't lowercase acronyms or proper nouns that look intentional.
  if (/^[A-Z]{2,}/.test(text)) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** A clause we can safely wrap in a frame without breaking grammar. */
function isDeclarative(text: string): boolean {
  const t = text.trim();
  if (!t || SUBORDINATE.test(t)) return false;
  if (!/\b(is|are|was|were|will|would|can|should|means|makes|costs|takes|gets|has|have|needs|turns|becomes|happens|works|fails)\b/i.test(t)) {
    return /\b\w+(ed|s)\b/i.test(t); // crude verb check for "people get X wrong"
  }
  return true;
}

/** Strip filler so a quoted line reads tight on screen. */
function tight(text: string): string {
  return stripFillers(text).replace(/\s+/g, ' ').trim();
}

/** Turn a payoff line into a reveal-first hook ("The real answer: …"). */
export function revealHook(payoff: string): string {
  let core = tight(payoff)
    .replace(PAYOFF_JUNK, '')
    .replace(/^(here'?s? the thing|the thing is|the truth is)[:,]?\s*/i, '')
    .replace(/^if you take one thing (away )?from this[:,]?\s*/i, '')
    .replace(/^if you remember nothing else[:,]?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  core = trimToHook(core, 16).replace(/[.!?…]$/, '').trim();
  if (!core || core.length < 18) return '';
  // Don't stack frames on the creator's own frame ("nobody tells you: nobody tells you …").
  if (/\b(nobody|no one)\b.*\b(tells|talks)\b/i.test(core)) return '';
  if (/^here'?s? the (thing|part)/i.test(core)) return '';
  if (/:.*:/.test(core)) return '';
  if (!isDeclarative(core) && !/^(you|most people|nobody|everyone|people)\b/i.test(core)) return '';

  const lowered = lowerFirst(core);
  if (/^(you|most people|everyone|nobody|people|founders)\b/i.test(core)) {
    return ensurePunctuation(`The thing nobody tells you: ${lowered}`);
  }
  if (/^(it|this|that|they|there)\b/i.test(core)) {
    return ensurePunctuation(`Here's the part nobody explains: ${lowered}`);
  }
  return ensurePunctuation(`The real answer: ${lowered}`);
}

/**
 * Reframe a flat statement as a question. Only fires on patterns that stay
 * grammatical, because a broken hook is worse than no hook.
 */
export function questionHook(opener: string): string {
  const core = trimToHook(opener, 14)
    .replace(/\b(um|uh|erm)\b/gi, '')
    .replace(/[.!?…]+$/, '')
    .trim();
  if (!core || core.length < 22) return '';
  if (SUBORDINATE.test(core)) return '';

  // "You will almost always underpay your first ten hires"
  const youStatement = core.match(/^you\s+(?:will|would|can|should|have to|need to|are|were|'ll|'re)\s+(.+)$/i);
  if (youStatement) {
    const rest = youStatement[1]
      .replace(/\b(always|almost always|basically|really|just|probably)\s+/gi, '')
      .replace(/\byour\b/gi, 'their')
      .replace(/\byou\b/gi, 'they')
      .trim();
    if (rest.length > 14) return ensurePunctuation(`Why do so many people ${lowerFirst(rest)}`);
  }

  // "Most people get hiring wrong" / "Everyone thinks motivation comes first"
  const peopleStatement = core.match(/^(?:most people|everyone|people|founders|creators)\s+(?:will |always |think |believe |get |keep |try to )?(.+)$/i);
  if (peopleStatement) {
    const rest = peopleStatement[1].replace(/\btheir\b/gi, 'their').trim();
    if (rest.length > 14) return ensurePunctuation(`Why do so many people ${lowerFirst(rest)}`);
  }

  return '';
}

function topicFrames(topic: string, niche: Niche, contrarian: boolean): string[] {
  const audience = NICHE_AUDIENCE[niche] || NICHE_AUDIENCE.general;
  const t = topic.trim();
  if (t.length < 4) return [];
  const frames = [
    `Nobody talks about this side of ${t}.`,
    `${capitalise(audience)} get ${t} wrong. Here's the fix.`,
    `This is the ${t} advice that actually works.`,
  ];
  return contrarian ? [frames[1], frames[0], frames[2]] : frames;
}

/**
 * Ranked hook options. The first entry is the recommended one.
 * Candidates are scored with the same hook model used by the clip engine, then
 * lightly penalised for length so on-screen text stays readable.
 */
export function buildHooks(ctx: HookContext): string[] {
  const opener = cleanOpener(ctx.opener);
  const candidates: string[] = [];

  // 1. The creator's own words, tightened. Always the safest option.
  if (opener && !SUBORDINATE.test(opener)) candidates.push(opener);

  // 2. Reveal-first: lead with the payoff, then replay the setup.
  if (ctx.payoff) {
    const reveal = revealHook(ctx.payoff);
    if (reveal && reveal !== opener) candidates.push(reveal);
  }

  // 3. Reframe a flat statement as a question — cheapest curiosity gap.
  const question = questionHook(ctx.opener);
  if (question) candidates.push(question);

  // 4. Topic frames, only when the extracted topic is a real phrase.
  for (const frame of topicFrames(ctx.topic, ctx.niche, isContrarian(ctx.body))) {
    candidates.push(frame);
  }

  // 5. If the opener is unusable, fall back to the payoff directly.
  if (!candidates.length && ctx.payoff) {
    const direct = ensurePunctuation(capitalise(trimToHook(tight(ctx.payoff), 14)));
    if (direct.length > 18) candidates.push(direct);
  }

  // Dedupe, drop junk, then rank.
  const seen = new Set<string>();
  const unique = candidates.filter((c) => {
    const key = c.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').trim();
    if (!key || key.length < 18 || seen.has(key)) return false;
    if (/^nobody talks about this side of this/i.test(c)) return false;
    seen.add(key);
    return true;
  });

  const ranked = unique
    .map((text, index) => {
      let score = scoreHook(text);
      if (text === opener) score += 6; // prefer the creator's own words
      if (words(text).length > 20) score -= 6;
      if (text.length > MAX_HOOK_CHARS) score -= 10;
      if (/nobody talks about this side of|advice that actually works/i.test(text)) score -= 8;
      return { text, score: score - index * 0.35 };
    })
    .sort((a, b) => b.score - a.score)
    .map((c) => c.text);

  return ranked.length ? ranked.slice(0, 4) : ['Here is the part nobody talks about.'];
}

/** Pick comment-bait CTAs appropriate to the clip's content. */
export function buildCtas(ctx: {
  body: string;
  keyword: string;
  contrarian: boolean;
  hasList: boolean;
  isStory: boolean;
  hasQuestion: boolean;
}): string[] {
  const picks: string[] = [];
  if (ctx.keyword) {
    picks.push(CTA_TEMPLATES.keyword[0].replace('{keyword}', ctx.keyword.toUpperCase()));
    picks.push(CTA_TEMPLATES.keyword[2].replace('{keyword}', ctx.keyword.toUpperCase()));
  }
  if (ctx.contrarian) picks.push(CTA_TEMPLATES.controversial[0], CTA_TEMPLATES.controversial[2]);
  if (ctx.hasList) picks.push(CTA_TEMPLATES.list[0], CTA_TEMPLATES.list[1]);
  if (ctx.hasQuestion) picks.push(CTA_TEMPLATES.question[0]);
  if (ctx.isStory) picks.push(CTA_TEMPLATES.story[0]);
  picks.push(CTA_TEMPLATES.question[1], CTA_TEMPLATES.list[1]);

  const seen = new Set<string>();
  return picks.filter((p) => {
    if (seen.has(p)) return false;
    seen.add(p);
    return true;
  }).slice(0, 3);
}

/** Caption under the post: hook line + value + CTA, capped for the feed. */
export function buildCaption(hook: string, body: string[], cta: string, maxChars = 220): string {
  const hookLine = hook.length > 130 ? trimSentence(hook, 130) : hook;
  const valueLine = trimSentence(
    body
      .slice(0, 2)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim(),
    120
  );

  const full = [hookLine, valueLine, cta].filter(Boolean).join('\n');
  if (full.length <= maxChars) return full;

  // Too long for the feed: drop the value line, keep hook + CTA.
  return [hookLine, cta].filter(Boolean).join('\n');
}

function trimSentence(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (lastStop > maxChars * 0.5) return cut.slice(0, lastStop + 1);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

/** Hashtags: niche tags + keywords lifted from the clip + platform staples. */
export function buildHashtags(
  niche: Niche,
  text: string,
  topic: string,
  handle: string
): string[] {
  const base = NICHE_HASHTAGS[niche] || NICHE_HASHTAGS.general;
  const keywords = extractKeywords(text, 4)
    .map((k) => k.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((k) => k.length > 3)
    .map((k) => `#${k}`);
  const topicTag = topic.replace(/[^a-zA-Z0-9_]/g, '');
  const brand = handle.replace(/^@/, '').replace(/[^a-zA-Z0-9_]/g, '');
  const tags = [...base, ...(topicTag.length > 3 ? [`#${topicTag}`] : []), ...keywords, '#fyp'];
  if (brand) tags.push(`#${brand}`);

  const seen = new Set<string>();
  return tags
    .filter((tag) => {
      const key = tag.toLowerCase();
      if (key === '#fyp' && niche === 'finance') return true; // keep finance discoverable
      if (seen.has(key)) return false;
      seen.add(key);
      return tag.length > 4;
    })
    .slice(0, 8);
}

/** Short feed title (TikTok/Reels "cover text" style). */
export function buildTitle(hook: string): string {
  const clean = hook.replace(/\s+/g, ' ').trim();
  if (clean.length <= 58) return clean.replace(/[.!?…]$/, '');
  const cut = clean.slice(0, 58);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

/** Remove filler phrases so on-screen text reads tight. */
export function stripFillers(text: string): string {
  let out = text;
  for (const filler of FILLERS) {
    const re = new RegExp(`\\b${filler}\\b[,]?\\s*`, 'gi');
    out = out.replace(re, '');
  }
  return out
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s*[,.;]\s*/, '')
    .trim();
}

/** Count how many strong hook signals a hook has (used for "why this works"). */
export function hookSignalCount(text: string): number {
  return countMatches(text, [
    'why',
    'how',
    'nobody',
    'most people',
    'secret',
    'truth',
    'mistake',
    'wrong',
    'stop',
    'never',
    'you',
    'actually',
  ]);
}
