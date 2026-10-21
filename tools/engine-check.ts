/**
 * Headless sanity check for the clip engine.
 *
 *   npm run engine:check
 *
 * It exercises every transcript format, every length preset, and asserts the
 * invariants the UI relies on. Add a case here whenever you change scoring.
 */

import assert from 'node:assert/strict';
import { generateClips, parseTranscript } from '../src/core';
import type { Clip, GenerateOptions, ParsedTranscript } from '../src/core';
import { SAMPLE_TRANSCRIPT } from '../src/data/sample';

const SRT = `1
00:00:00,000 --> 00:00:03,200
Nobody tells you this about cold showers.

2
00:00:03,200 --> 00:00:07,800
Eighteen months ago I was waking up at eleven a.m.
every single day.

3
00:00:07,800 --> 00:00:11,400
My energy was terrible and I blamed everything else.

4
00:00:11,400 --> 00:00:16,000
So I started taking a cold shower every morning for thirty days.

5
00:00:16,000 --> 00:00:20,500
The first week was brutal. I hated it. I wanted to quit.

6
00:00:20,500 --> 00:00:25,000
But by day ten something changed. I was awake before my alarm.

7
00:00:25,000 --> 00:00:29,400
The reason is not the cold. It is the fact that you
voluntarily do something uncomfortable before you have to.

8
00:00:29,400 --> 00:00:34,000
That one decision sets the tone for every hard thing later in the day.

9
00:00:34,000 --> 00:00:38,600
So if you only do one thing this week, make it the thing you are avoiding.

10
00:00:38,600 --> 00:00:42,000
Your future self is watching.`;

const VTT = `WEBVTT

00:00:00.000 --> 00:00:04.000
Most people think motivation comes first.

00:00:04.000 --> 00:00:09.000
It doesn't. Action comes first, and motivation follows action.

00:00:09.000 --> 00:00:14.000
I tested this for ninety days and tracked my energy every morning.

00:00:14.000 --> 00:00:19.000
The result was that the days I moved first were rated forty percent higher.

00:00:19.000 --> 00:00:25.000
So the fix is embarrassingly simple: do the smallest version before you feel ready.`;

const TIMESTAMPED = `0:00 So there's one thing about money nobody explains to you.
0:05 Everyone thinks you need more income. That's not the problem.
0:11 The problem is that your expenses grow to match whatever you earn.
0:18 I tracked every dollar for a year and the data was embarrassing.
0:24 My income went up sixty percent and my savings stayed exactly the same.
0:31 The reason is lifestyle creep, and it happens silently.
0:37 So the fix is to automate the transfer on payday before you see the money.
0:45 That single change took my savings rate from four percent to thirty percent.
0:52 Do it once and you'll never think about it again.`;

const longEnough = (t: ParsedTranscript) => t.sentences.length > 2;

function baseOptions(overrides: Partial<GenerateOptions> = {}): GenerateOptions {
  return {
    niche: 'business',
    length: 'medium',
    count: 4,
    handle: '@hookline',
    ctaKeyword: 'PLAYBOOK',
    ...overrides,
  };
}

function checkClips(clips: Clip[], transcript: ParsedTranscript, label: string) {
  assert.ok(clips.length > 0, `${label}: expected at least one clip`);
  for (const clip of clips) {
    assert.ok(clip.hook.trim().length > 10, `${label}: clip ${clip.rank} has no hook`);
    assert.ok(clip.payoff.trim().length > 0, `${label}: clip ${clip.rank} has no payoff`);
    assert.ok(clip.score.total >= 0 && clip.score.total <= 100, `${label}: score out of range`);
    assert.ok(clip.start >= 0 && clip.end > clip.start, `${label}: bad timing`);
    assert.ok(clip.end <= transcript.duration + 1, `${label}: clip runs past the transcript`);
    assert.ok(clip.duration > 5, `${label}: clip too short`);
    assert.ok(clip.beats.some((b) => b.kind === 'hook'), `${label}: no hook beat`);
    assert.ok(clip.hashtags.every((h) => h.startsWith('#')), `${label}: bad hashtag`);
    assert.ok(clip.cta.length > 0, `${label}: no CTA`);
    assert.ok(clip.caption.includes(clip.hook.split('\n')[0].slice(0, 12)), `${label}: caption missing hook`);
    assert.ok(clip.reasons.length > 0, `${label}: no reasons`);
    assert.ok(clip.editNotes.length > 0, `${label}: no edit notes`);
  }
  // Ranking must be descending by score.
  for (let i = 1; i < clips.length; i += 1) {
    assert.ok(clips[i - 1].score.total >= clips[i].score.total, `${label}: ranking not sorted`);
  }
  // No two clips should cover the same seconds.
  const sorted = [...clips].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i += 1) {
    assert.ok(sorted[i].start >= sorted[i - 1].end - 1, `${label}: clips overlap`);
  }
}

const results: string[] = [];

// ---- parsing -------------------------------------------------------------
const srt = parseTranscript(SRT);
assert.equal(srt.format, 'srt');
assert.ok(srt.hasTiming, 'SRT should keep timings');
assert.ok(longEnough(srt));
assert.ok(srt.duration > 30 && srt.duration < 60, `SRT duration ${srt.duration}`);
results.push(`SRT parsed: ${srt.sentences.length} sentences, ${srt.duration}s, ${srt.wpm} wpm`);

const vtt = parseTranscript(VTT);
assert.equal(vtt.format, 'vtt');
assert.ok(vtt.sentences.length >= 5);
results.push(`VTT parsed: ${vtt.sentences.length} sentences`);

const stamped = parseTranscript(TIMESTAMPED);
assert.equal(stamped.format, 'timestamped-text');
assert.ok(stamped.hasTiming);
assert.ok(stamped.duration > 50);
results.push(`Timestamped text parsed: ${stamped.sentences.length} sentences, ${stamped.duration}s`);

const plain = parseTranscript(SAMPLE_TRANSCRIPT);
assert.equal(plain.format, 'plain-text');
assert.ok(plain.wordCount > 650, `sample word count ${plain.wordCount}`);
assert.ok(plain.warnings.length > 0, 'plain text should warn about estimated timings');
results.push(`Plain text parsed: ${plain.sentences.length} sentences, ${plain.wordCount} words, ${Math.round(plain.duration)}s estimated`);

const empty = parseTranscript('   ');
assert.equal(empty.sentences.length, 0);
results.push('Empty input handled');

// ---- generation ---------------------------------------------------------
for (const [label, parsed] of [
  ['SRT', srt],
  ['VTT', vtt],
  ['Timestamped', stamped],
  ['Plain', plain],
] as const) {
  for (const length of ['short', 'medium', 'long'] as const) {
    const result = generateClips(parsed, baseOptions({ length, count: 4 }));
    checkClips(result.clips, parsed, `${label}/${length}`);
    results.push(`${label}/${length}: ${result.clips.length} clips, top score ${result.clips[0].score.total}`);
  }
}

const dense = generateClips(plain, baseOptions({ count: 8, length: 'long' }));
assert.ok(dense.clips.length <= 8);
assert.ok(dense.clips.length >= 3, 'long transcript should yield 3+ clips');
results.push(`Dense request: ${dense.clips.length} clips`);

const keywordCta = generateClips(srt, baseOptions({ ctaKeyword: 'MORNING', count: 2 }));
assert.ok(keywordCta.clips.some((c) => c.cta.includes('MORNING')), 'keyword CTA should be used');
results.push('Keyword CTA applied');

const noKeyword = generateClips(srt, baseOptions({ ctaKeyword: '', count: 2 }));
assert.ok(noKeyword.clips.every((c) => !c.cta.includes('{keyword}')));
results.push('Empty keyword handled');

const tiny = generateClips('This is a very short transcript. It has only two sentences.', baseOptions());
assert.ok(tiny.clips.length >= 0);
results.push(`Tiny transcript: ${tiny.clips.length} clips`);

// ---- determinism --------------------------------------------------------
const a = generateClips(plain, baseOptions());
const b = generateClips(plain, baseOptions());
assert.deepEqual(
  a.clips.map((c) => [c.start, c.end, c.hook, c.score.total]),
  b.clips.map((c) => [c.start, c.end, c.hook, c.score.total])
);
results.push('Engine is deterministic');

// ---- showcase -----------------------------------------------------------
const best = generateClips(plain, baseOptions({ count: 3, length: 'medium' })).clips[0];
console.log('\n--- sample top clip ---');
console.log(`score ${best.score.total} · ${best.start}s–${best.end}s (${Math.round(best.duration)}s)`);
console.log(`hook:  ${best.hook}`);
console.log(`payoff: ${best.payoff}`);
console.log(`cta:   ${best.cta}`);
console.log(`why:   ${best.reasons[0]}`);

console.log('\n--- checks ---');
for (const line of results) console.log(`✓ ${line}`);
console.log(`\nAll ${results.length} checks passed.`);
