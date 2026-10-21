/**
 * Feature extraction + scoring.
 *
 * Every score is 0-100. The engine combines them into a weighted total; the UI
 * shows the breakdown so a creator can see *why* a clip was picked.
 */

import {
  ABSOLUTES,
  CONTRARIAN,
  CURIOSITY,
  EMOTION,
  EVIDENCE,
  FILLERS,
  LIST_MARKERS,
  PAYOFF,
  SECOND_PERSON,
  STAKES,
  STOPWORDS,
  STORY,
  WEAK_OPENERS,
} from './lexicon';
import type { Sentence } from './types';

const escapeRe = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const matchers = new Map<string[], RegExp[]>();

function getMatchers(list: string[]): RegExp[] {
  const cached = matchers.get(list);
  if (cached) return cached;
  const compiled = list.map(
    (term) =>
      new RegExp(
        `(^|[^a-z0-9])${term.split(/\s+/).map(escapeRe).join('\\s+')}($|[^a-z0-9])`,
        'i'
      )
  );
  matchers.set(list, compiled);
  return compiled;
}

export function words(text: string): string[] {
  return text.toLowerCase().replace(/[^\p{L}\p{N}'\s%]/gu, ' ').split(/\s+/).filter(Boolean);
}

/** Number of terms from `list` present in `text`. */
export function countMatches(text: string, list: string[]): number {
  let hits = 0;
  for (const re of getMatchers(list)) if (re.test(text)) hits += 1;
  return hits;
}

export function hasMatch(text: string, list: string[]): boolean {
  return getMatchers(list).some((re) => re.test(text));
}

/** Which terms from `list` appear in `text` (useful for explanations). */
export function matchedTerms(text: string, list: string[]): string[] {
  const out: string[] = [];
  const regexes = getMatchers(list);
  list.forEach((term, i) => {
    if (regexes[i].test(text)) out.push(term);
  });
  return out;
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

const DIMINISH = (hits: number, perHit: number, cap: number) =>
  Math.min(cap, hits * perHit);

const NUMBER_WORDS = new Set([
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'hundred', 'thousand',
  'million', 'billion', 'percent', 'half', 'double', 'triple', 'dozen', 'first', 'second',
  'third', 'fourth', 'fifth',
]);

/** Explicit digits / percentages — the kind of number worth a stat card. */
export function hasExplicitNumber(text: string): boolean {
  return /\d|\b(percent|thousand|million|billion|hundred)\b/i.test(text);
}

/** Does the text contain a spoken number? */
export function hasNumber(text: string): boolean {
  return /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|hundred|thousand|million|billion|percent|half|double|triple)\b/i.test(
    text
  );
}

export function isQuestion(text: string): boolean {
  return /\?/.test(text) || /^(why|how|what|when|where|who|which|should|could|would|do|does|did|is|are|can)\b/i.test(text.trim());
}

/** 0-100: how hard the first line of a clip works. */
export function scoreHook(text: string): number {
  const t = text.trim();
  const wc = words(t).length;
  let score = 18;

  if (isQuestion(t)) score += 16;
  if (hasNumber(t)) score += 11;
  score += DIMINISH(countMatches(t, CURIOSITY), 9, 22);
  score += DIMINISH(countMatches(t, CONTRARIAN), 10, 22);
  score += DIMINISH(countMatches(t, STAKES), 4, 12);
  score += DIMINISH(countMatches(t, EMOTION), 5, 12);
  score += DIMINISH(countMatches(t, SECOND_PERSON), 5, 10);
  score += DIMINISH(countMatches(t, ABSOLUTES), 3, 9);
  score += DIMINISH(countMatches(t, STORY), 4, 8);

  // Short, punchy openings land harder.
  if (wc <= 8) score += 8;
  else if (wc <= 14) score += 5;
  else if (wc > 28) score -= 12;

  const firstWord = (words(t)[0] || '').toLowerCase();
  if (WEAK_OPENERS.includes(firstWord)) score -= 12;
  if (hasMatch(t, FILLERS)) score -= 6;
  if (/^(so|and|but|because|um|uh)\b/i.test(t)) score -= 4;

  return clamp(Math.round(score));
}

/** 0-100: does this sentence land a conclusion? */
export function scorePayoff(text: string): number {
  const t = text.trim();
  let score = 14;
  score += DIMINISH(countMatches(t, PAYOFF), 13, 40);
  if (hasNumber(t)) score += 14;
  score += DIMINISH(countMatches(t, EVIDENCE), 8, 16);
  if (/\b(is|are|was|were|means|becomes|turns|makes)\b/i.test(t)) score += 8;
  if (isQuestion(t)) score -= 10;
  if (t.length < 25) score -= 6;
  if (WEAK_OPENERS.includes((words(t)[0] || '').toLowerCase())) score -= 5;
  return clamp(Math.round(score));
}

/** 0-100: can a stranger follow this with no other context? */
export function scoreClarity(text: string): number {
  const t = text.trim();
  const wc = words(t).length;
  let score = 70;

  const fillerHits = countMatches(t, FILLERS);
  score -= Math.min(24, fillerHits * 7);

  if (wc < 5) score -= 18;
  if (wc > 60) score -= 12;
  if (/\b(it|this|that|they|those|these)\b/i.test(t.slice(0, 24))) score -= 8;
  if (/\b(you know|i mean|sort of|kind of)\b/i.test(t)) score -= 6;
  if (/^[a-z]/.test(t)) score -= 4;
  if (hasNumber(t)) score += 5;
  if (hasMatch(t, SECOND_PERSON)) score += 5;

  return clamp(Math.round(score));
}

/** 0-100: delivery energy / density. */
export function scoreEnergy(sentences: Sentence[], wpm: number): number {
  const text = sentences.map((s) => s.text).join(' ');
  const wc = words(text).length;
  let score = 50;

  if (wpm >= 130 && wpm <= 200) score += 18;
  else if (wpm < 110) score -= 12;
  else if (wpm > 220) score -= 8;

  score += DIMINISH(countMatches(text, EMOTION), 5, 14);
  score += DIMINISH(countMatches(text, STAKES), 3, 10);
  if (/!/.test(text)) score += 6;
  if (/\?/.test(text)) score += 4;
  score -= Math.min(20, countMatches(text, FILLERS) * 4);
  if (wc > 0 && wc / Math.max(1, sentences.length) > 34) score -= 8;

  return clamp(Math.round(score));
}

/** 0-100: emotional charge across the clip. */
export function scoreEmotion(text: string): number {
  let score = 22;
  score += DIMINISH(countMatches(text, EMOTION), 13, 45);
  score += DIMINISH(countMatches(text, STAKES), 6, 20);
  score += DIMINISH(countMatches(text, CONTRARIAN), 6, 16);
  if (/!/.test(text)) score += 5;
  return clamp(Math.round(score));
}

/** 0-100: visible structure (question, list, number, contrast). */
export function scoreStructure(text: string): number {
  let score = 20;
  if (isQuestion(text)) score += 14;
  if (/\b(first|second|third)\b/i.test(text)) score += 16;
  score += DIMINISH(countMatches(text, LIST_MARKERS), 5, 16);
  if (hasNumber(text)) score += 12;
  if (/\b(but|however|instead|versus|vs|compared to)\b/i.test(text)) score += 8;
  if (/\b(because|so that|which means|that means)\b/i.test(text)) score += 6;
  return clamp(Math.round(score));
}

/**
 * 0-100: how well the clip closes (and therefore how well it replays).
 * A clip that ends on an unfinished thought leaks viewers at the loop point.
 */
export function scoreLoop(first: string, last: string, payoff: string): number {
  const tail = last.trim();
  let score = 32;

  // Landing a conclusion is what makes the replay feel intentional.
  score += Math.min(24, countMatches(tail, PAYOFF) * 12);
  if (/[.!?…]$/.test(tail)) score += 8;
  else score -= 10;
  if (/^(so|and|but|because|also|then|now|or)\b/i.test(tail)) score -= 14;
  if (/\b(stuff|things|whatever|or something)\b/i.test(tail)) score -= 8;

  // Echo: shared words between the opening and the close help the loop land.
  const a = new Set(words(first).filter((w) => w.length > 3 && !STOPWORDS.has(w)));
  const b = new Set(words(`${tail} ${payoff}`).filter((w) => w.length > 3 && !STOPWORDS.has(w)));
  if (a.size && b.size) {
    let overlap = 0;
    for (const w of a) if (b.has(w)) overlap += 1;
    score += (overlap / Math.min(a.size, b.size)) * 30;
  }

  return clamp(Math.round(score));
}

/** Content words, ranked by frequency × length, for topic/keyword extraction. */
export function extractKeywords(text: string, limit = 6): string[] {
  const tokens = words(text).filter((w) => w.length > 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
  const freq = new Map<string, number>();
  for (const token of tokens) freq.set(token, (freq.get(token) || 0) + 1);

  // Bigrams that repeat are usually the real topic ("cold showers", "index funds").
  const bigrams = new Map<string, number>();
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const key = `${tokens[i]} ${tokens[i + 1]}`;
    bigrams.set(key, (bigrams.get(key) || 0) + 1);
  }

  const scoredBigrams = [...bigrams.entries()]
    .filter(([, count]) => count > 1)
    .map(([term, count]) => ({ term, score: count * 2.4 }))
    .sort((x, y) => y.score - x.score)
    .slice(0, 2)
    .map((b) => b.term);

  const singles = [...freq.entries()]
    .sort((x, y) => y[1] - x[1] || y[0].length - x[0].length)
    .map(([term]) => term)
    .filter((term) => !scoredBigrams.some((b) => b.includes(term)))
    .slice(0, limit);

  return [...scoredBigrams, ...singles].slice(0, limit);
}

/**
 * Words that are too vague to name a topic. Keeping these out is what stops
 * hooks like "Nobody talks about this side of good."
 */
export const GENERIC_TOPICS = new Set([
  'good', 'bad', 'thing', 'things', 'people', 'person', 'time', 'times', 'room', 'test',
  'tests', 'work', 'works', 'job', 'jobs', 'stuff', 'point', 'points', 'part', 'parts',
  'lot', 'kind', 'sort', 'way', 'ways', 'many', 'most', 'less', 'more', 'other', 'another',
  'something', 'anything', 'everything', 'nothing', 'someone', 'anyone', 'everyone',
  'today', 'yesterday', 'tomorrow', 'year', 'years', 'day', 'days', 'week', 'weeks',
  'month', 'months', 'actual', 'entire', 'whole', 'single', 'different', 'important',
  'interesting', 'really', 'totally', 'obviously', 'basically', 'honestly', 'literally',
  'better', 'worse', 'great', 'easy', 'hard', 'correct', 'wrong', 'first', 'second',
  'money', 'business', 'video', 'channel', 'content', 'question', 'answer', 'number',
]);

/**
 * Pick a human-readable topic phrase ("cold showers", "index funds").
 * Returns '' when nothing repeats enough to be a real subject — callers must
 * handle that by skipping topic-based hooks.
 */
export function extractTopic(text: string): string {
  const tokens = words(text).filter(
    (w) =>
      w.length > 4 &&
      !STOPWORDS.has(w) &&
      !GENERIC_TOPICS.has(w) &&
      !/^\d+$/.test(w) &&
      !NUMBER_WORDS.has(w)
  );

  const bigrams = new Map<string, number>();
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const key = `${tokens[i]} ${tokens[i + 1]}`;
    bigrams.set(key, (bigrams.get(key) || 0) + 1);
  }
  const repeatedBigram = [...bigrams.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])[0];
  if (repeatedBigram) return repeatedBigram[0];

  const freq = new Map<string, number>();
  for (const token of tokens) freq.set(token, (freq.get(token) || 0) + 1);
  const repeatedWord = [...freq.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0];
  return repeatedWord ? repeatedWord[0] : '';
}

/** Jaccard similarity of content words — used to keep clips diverse. */
export function similarity(a: string, b: string): number {
  const setA = new Set(words(a).filter((w) => w.length > 3 && !STOPWORDS.has(w)));
  const setB = new Set(words(b).filter((w) => w.length > 3 && !STOPWORDS.has(w)));
  if (!setA.size || !setB.size) return 0;
  let shared = 0;
  for (const w of setA) if (setB.has(w)) shared += 1;
  return shared / (setA.size + setB.size - shared);
}

/** Filler phrases worth cutting from a clip. */
export function findFillerPhrases(text: string): string[] {
  return matchedTerms(text, FILLERS).filter((t) => t.length > 3);
}

/** Does this text read as a story beat? */
export function isStory(text: string): boolean {
  return hasMatch(text, STORY);
}

/** Does this text read as contrarian? */
export function isContrarian(text: string): boolean {
  return countMatches(text, CONTRARIAN) > 0;
}

/** Does this text contain a list? */
export function isListy(text: string): boolean {
  return /\b(first|second|third|one|two|three|steps?|ways?|things?|reasons?|rules?|mistakes?|tips?)\b/i.test(
    text
  );
}
