/**
 * Transcript ingestion.
 *
 * Accepts SRT, WebVTT, timestamped text ("0:12 some words") and raw pasted
 * prose (YouTube "show transcript" dumps, auto-caption exports, scripts).
 * Timing is restored sentence-by-sentence; when no timestamps exist we
 * estimate them from words-per-minute so clips still get usable cut points.
 */

import type { Cue, ParsedTranscript, Sentence } from './types';

/** Fallback speaking rate used when a transcript has no timestamps. */
export const DEFAULT_WPM = 155;

/** Sentences shorter than this many words get merged into their neighbour. */
const MIN_SENTENCE_WORDS = 3;

/** Captions usually break mid-sentence; keep chunks a sane length. */
const MAX_CHUNK_CHARS = 240;

const TIMESTAMP = /(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?/;

function toSeconds(match: RegExpMatchArray): number {
  const h = match[1] ? parseInt(match[1], 10) : 0;
  const m = parseInt(match[2], 10);
  const s = parseInt(match[3], 10);
  const ms = match[4] ? parseInt(match[4].padEnd(3, '0'), 10) : 0;
  return h * 3600 + m * 60 + s + ms / 1000;
}

/** Remove caption artefacts that would pollute the text. */
export function cleanLine(line: string): string {
  return line
    .replace(/<[^>]*>/g, ' ') // inline VTT tags
    .replace(/\{\\[^}]*\}/g, ' ') // ASS/SSA overrides
    .replace(/^\s*>>\s*/, '') // speaker change marker
    .replace(/^\s*[-–—]\s*/, '')
    .replace(/\[(music|applause|laughter|silence)[^\]]*\]/gi, ' ')
    .replace(/\((music|applause|laughter|silence)[^)]*\)/gi, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectFormat(raw: string): ParsedTranscript['format'] {
  if (/^\uFEFF?WEBVTT/i.test(raw.trim())) return 'vtt';
  if (/^\d+\s*\r?\n\s*\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->/m.test(raw)) return 'srt';
  if (/\d\s*-->\s*\d/.test(raw) && /\d{2}:\d{2}/.test(raw)) return 'srt';
  if (/(^|\n)\s*[\[(]?\d{1,2}:\d{2}(:\d{2})?[\])]?\s+\S/m.test(raw)) return 'timestamped-text';
  return 'plain-text';
}

/**
 * Parse the `start --> end` caption block style (SRT and WebVTT).
 * Each block's text lines are joined and attached to the cue timing.
 */
function parseCaptionBlocks(raw: string): Cue[] {
  const cues: Cue[] = [];
  const blocks = raw.replace(/\r\n/g, '\n').split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const timeIndex = lines.findIndex((l) => l.includes('-->'));
    if (timeIndex === -1) continue;
    const [rawStart, rawEndRaw] = lines[timeIndex].split('-->');
    const startMatch = rawStart.match(TIMESTAMP);
    const endMatch = (rawEndRaw || '').match(TIMESTAMP);
    if (!startMatch) continue;
    const text = cleanLine(lines.slice(timeIndex + 1).join(' '));
    if (!text) continue;
    const start = toSeconds(startMatch);
    const end = endMatch ? toSeconds(endMatch) : start + estimateCueDuration(text);
    cues.push({ start, end: Math.max(end, start + 0.4), text });
  }
  return cues;
}

/**
 * Parse lines that start with a timestamp:
 *   `0:12 some words` · `[00:12:34] some words` · `(1:02) some words`
 */
function parseTimestampedLines(raw: string): Cue[] {
  const cues: Cue[] = [];
  for (const line of raw.replace(/\r\n/g, '\n').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^[\[(]?((?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?)[\])]?\s*(?:-->.*?)?\s+(.*)$/);
    if (!match) continue;
    const stamp = match[1].match(TIMESTAMP);
    if (!stamp) continue;
    const text = cleanLine(match[2]);
    if (!text) continue;
    cues.push({ start: toSeconds(stamp), end: -1, text });
  }
  return cues;
}

function estimateCueDuration(text: string, wpm = DEFAULT_WPM): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1.2, (words / wpm) * 60);
}

/**
 * Fill in end times for cues that only carried a start stamp, and repair
 * overlapping/duplicated cues (very common in auto-captions).
 */
function normaliseCues(cues: Cue[], wpm: number): Cue[] {
  const out: Cue[] = [];
  for (let i = 0; i < cues.length; i += 1) {
    const cue = cues[i];
    const next = cues[i + 1];
    let end = cue.end;
    if (!end || end <= 0) {
      end = next ? Math.max(cue.start + 0.6, next.start) : cue.start + estimateCueDuration(cue.text, wpm);
    }
    if (end <= cue.start) end = cue.start + estimateCueDuration(cue.text, wpm);

    // Skip rolling-caption duplicates: same text as the previous cue.
    const prev = out[out.length - 1];
    if (prev && prev.text === cue.text) {
      prev.end = Math.max(prev.end, end);
      continue;
    }
    // Merge cues whose text is a superset of the previous (YouTube rolling cues).
    if (prev && cue.text.startsWith(prev.text) && cue.text.length - prev.text.length < 60) {
      prev.text = cue.text;
      prev.end = end;
      continue;
    }
    out.push({ start: cue.start, end, text: cue.text });
  }
  return out;
}

/** Split a block of prose into sentences, tolerating missing punctuation. */
export function splitSentences(text: string): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];

  // Insert breaks after .!? followed by a capital, and where ASR forgot
  // punctuation but a new thought clearly starts.
  const punctuated = cleaned
    .replace(/([.!?…])\s+(?=["'“(]?[A-Z0-9])/g, '$1\n')
    .replace(/([.!?…]["'”])\s+/g, '$1\n');

  let pieces = punctuated
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  // No punctuation at all → break on cue-ish lengths so windows stay usable.
  if (pieces.length === 1 && cleaned.split(/\s+/).length > 60 && !/[.!?]/.test(cleaned)) {
    pieces = chunkByLength(cleaned);
  }

  return pieces.flatMap((piece) =>
    piece.length > MAX_CHUNK_CHARS ? chunkByLength(piece) : [piece]
  );
}

/** Break text on clause boundaries into readable chunks. */
function chunkByLength(text: string, maxWords = 32): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let current: string[] = [];
  for (const word of words) {
    current.push(word);
    const endsClean = /[,;:]$/.test(word);
    if (current.length >= maxWords && endsClean) {
      chunks.push(current.join(' '));
      current = [];
    } else if (current.length >= maxWords + 12) {
      chunks.push(current.join(' '));
      current = [];
    }
  }
  if (current.length) chunks.push(current.join(' '));
  return chunks;
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Build sentences with timings distributed proportionally inside each cue. */
function sentencesFromCues(cues: Cue[]): Sentence[] {
  const raw: Array<{ text: string; start: number; end: number }> = [];

  for (const cue of cues) {
    const parts = splitSentences(cue.text);
    if (!parts.length) continue;
    const totalChars = parts.reduce((sum, p) => sum + p.length, 0) || 1;
    let cursor = cue.start;
    for (const part of parts) {
      const share = (part.length / totalChars) * (cue.end - cue.start);
      const end = cursor + Math.max(0.5, share);
      raw.push({ text: part, start: cursor, end });
      cursor = end;
    }
  }

  // Merge stray micro-sentences into the previous sentence.
  const merged: Array<{ text: string; start: number; end: number }> = [];
  for (const item of raw) {
    const prev = merged[merged.length - 1];
    if (prev && wordCount(item.text) < MIN_SENTENCE_WORDS) {
      prev.text = `${prev.text} ${item.text}`.trim();
      prev.end = item.end;
      continue;
    }
    if (
      prev &&
      !/[.!?…]$/.test(prev.text) &&
      prev.text.length + item.text.length < 200 &&
      item.start - prev.end < 0.15
    ) {
      prev.text = `${prev.text} ${item.text}`.trim();
      prev.end = item.end;
      continue;
    }
    merged.push({ ...item });
  }

  return merged.map((item, index) => ({
    id: index,
    text: item.text.replace(/\s+/g, ' ').trim(),
    start: round(item.start),
    end: round(item.end),
    words: wordCount(item.text),
  }));
}

/** Assign sequential timings to a plain-text transcript. */
function sentencesFromPlainText(text: string, wpm: number): Sentence[] {
  const sentences = splitSentences(text);
  const perWord = 60 / wpm;
  let cursor = 0;
  return sentences.map((sentence, index) => {
    const words = wordCount(sentence);
    const duration = Math.max(0.8, words * perWord);
    const start = cursor;
    cursor += duration;
    return {
      id: index,
      text: sentence,
      start: round(start),
      end: round(cursor),
      words,
    };
  });
}

function measureWpm(sentences: Sentence[]): number {
  const words = sentences.reduce((sum, s) => sum + s.words, 0);
  const span = sentences.length ? sentences[sentences.length - 1].end - sentences[0].start : 0;
  if (!span || !words) return DEFAULT_WPM;
  const wpm = (words / span) * 60;
  // Clamp absurd values caused by broken timestamps.
  return Math.round(Math.min(260, Math.max(80, wpm)));
}

export const EMPTY_TRANSCRIPT: ParsedTranscript = {
  sentences: [],
  hasTiming: false,
  duration: 0,
  wordCount: 0,
  wpm: DEFAULT_WPM,
  format: 'plain-text',
  warnings: [],
};

/**
 * Parse any supported transcript format into timed sentences.
 * Never throws — bad input simply produces an empty transcript with warnings.
 */
export function parseTranscript(input: string): ParsedTranscript {
  const raw = (input || '').replace(/\u00a0/g, ' ').trim();
  if (!raw) return { ...EMPTY_TRANSCRIPT, warnings: ['Paste a transcript to get started.'] };

  const format = detectFormat(raw);
  const warnings: string[] = [];

  let cues: Cue[] = [];
  if (format === 'srt' || format === 'vtt') {
    cues = parseCaptionBlocks(raw);
    if (!cues.length) warnings.push('No caption cues found — treating this as plain text.');
  } else if (format === 'timestamped-text') {
    cues = parseTimestampedLines(raw);
    if (!cues.length) warnings.push('Timestamps looked incomplete — treating this as plain text.');
  }

  let sentences: Sentence[];
  let hasTiming = cues.length > 0;
  let wpm = DEFAULT_WPM;

  if (cues.length) {
    cues = normaliseCues(cues, DEFAULT_WPM);
    const measured = measureWpm(
      cues.map((c, i) => ({ id: i, text: c.text, start: c.start, end: c.end, words: wordCount(c.text) }))
    );
    wpm = measured;
    // Spread start stamps over the following cue so long gaps don't inflate clips.
    for (let i = 0; i < cues.length - 1; i += 1) {
      const gap = cues[i + 1].start - cues[i].end;
      if (gap > 12) {
        const expected = estimateCueDuration(cues[i].text, wpm);
        cues[i].end = Math.min(cues[i + 1].start, Math.max(cues[i].end, cues[i].start + Math.min(expected, 8)));
      }
    }
    sentences = sentencesFromCues(cues);
  } else {
    const plain = cleanLine(raw.replace(/^WEBVTT.*$/gim, '').replace(/^\d+$/gm, ''));
    sentences = sentencesFromPlainText(plain, DEFAULT_WPM);
    hasTiming = false;
    wpm = DEFAULT_WPM;
    warnings.push(`No timestamps found — cut points are estimated at ${DEFAULT_WPM} words per minute.`);
  }

  if (!sentences.length) {
    return { ...EMPTY_TRANSCRIPT, format, warnings: ['Could not read any sentences from that input.'] };
  }

  const wordTotal = sentences.reduce((sum, s) => sum + s.words, 0);
  const duration = sentences[sentences.length - 1].end;

  if (duration < 45) warnings.push('That transcript is quite short — clips will be sparse.');
  if (wordTotal < 120) warnings.push('Under 120 words: there may only be one usable clip.');

  return {
    sentences,
    hasTiming,
    duration: round(duration),
    wordCount: wordTotal,
    wpm,
    format,
    warnings,
  };
}

/** mm:ss (or h:mm:ss) for display. */
export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}
