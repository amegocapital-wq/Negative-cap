/**
 * Shared domain types for Hookline.
 *
 * Everything in `src/core` is framework-free and unit-testable with plain Node
 * (see `tools/engine-check.ts`). UI code should only depend on these types.
 */

export type Niche =
  | 'general'
  | 'education'
  | 'business'
  | 'finance'
  | 'tech'
  | 'fitness'
  | 'motivation'
  | 'comedy';

export type ClipLength = 'short' | 'medium' | 'long';

export type EngineMode = 'local' | 'ai';

/** A raw subtitle/caption cue. Times are in seconds. */
export interface Cue {
  start: number;
  end: number;
  text: string;
}

/** One sentence of the transcript, with restored timing. */
export interface Sentence {
  id: number;
  text: string;
  start: number;
  end: number;
  words: number;
}

export interface ParsedTranscript {
  /** Sentences in chronological order. */
  sentences: Sentence[];
  /** True when the source contained real timestamps, false when we estimated. */
  hasTiming: boolean;
  /** Total runtime in seconds. */
  duration: number;
  wordCount: number;
  /** Words per minute measured over the real timings (or the estimate used). */
  wpm: number;
  format: 'srt' | 'vtt' | 'timestamped-text' | 'plain-text';
  /** Anything the parser wants to tell the user (dropped tags, etc.). */
  warnings: string[];
}

export interface ScoreBreakdown {
  /** How strongly the opening grabs attention. */
  hook: number;
  /** Does the clip resolve / land a conclusion? */
  payoff: number;
  /** Understandable without the rest of the video? */
  clarity: number;
  /** Delivery energy, pace, density. */
  energy: number;
  /** Emotional charge. */
  emotion: number;
  /** Visible structure: a question, a list, a number, a contrast. */
  structure: number;
  /** Can it seamlessly loop back to the start? */
  loop: number;
  /** Weighted 0-100 result. */
  total: number;
}

export interface ClipBeat {
  /** Seconds from the start of the clip. */
  at: number;
  text: string;
  kind: 'hook' | 'body' | 'payoff' | 'cta';
}

export interface Clip {
  id: string;
  rank: number;
  /** Absolute timestamp in the source video (seconds). */
  start: number;
  end: number;
  duration: number;
  /** Verbatim transcript lines used by this clip. */
  source: Sentence[];
  excerpt: string;
  /** The recommended opening line (first 2-3 seconds). */
  hook: string;
  /** Alternative openings the user can swap in. */
  hooks: string[];
  /** The line that pays off the hook. */
  payoff: string;
  /** Supporting lines between hook and payoff. */
  body: string[];
  /** Short on-screen text cards, timed from clip start. */
  beats: ClipBeat[];
  title: string;
  caption: string;
  hashtags: string[];
  cta: string;
  /** Secondary CTA variants (comment bait, save bait, share bait). */
  ctas: string[];
  score: ScoreBreakdown;
  /** Plain-language reasons this clip should work. */
  reasons: string[];
  /** Concrete editing instructions (cuts, zooms, b-roll). */
  editNotes: string[];
  /** Suggested b-roll / visual keywords. */
  visuals: string[];
  topic: string;
  keywords: string[];
  trimmedWords: string[];
  /** Estimated average words per minute inside the clip. */
  wpm: number;
}

export interface GenerateOptions {
  niche: Niche;
  length: ClipLength;
  count: number;
  /** Optional brand handle, e.g. "@yourhandle". */
  handle: string;
  /** Optional comment-bait keyword, e.g. "SYSTEM". */
  ctaKeyword: string;
}

export interface ClipResult {
  clips: Clip[];
  transcript: ParsedTranscript;
  options: GenerateOptions;
  createdAt: number;
  /** Which engine produced the clips. */
  engine: EngineMode;
}

export interface AiConfig {
  enabled: boolean;
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface Settings {
  niche: Niche;
  length: ClipLength;
  count: number;
  handle: string;
  ctaKeyword: string;
  ai: AiConfig;
}

export interface LengthPreset {
  id: ClipLength;
  label: string;
  detail: string;
  min: number;
  max: number;
  ideal: number;
}
