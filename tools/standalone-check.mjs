/**
 * Verifies the standalone single-file build ACTUALLY RUNS.
 *
 *   node tools/standalone-check.mjs
 *
 * Loads `standalone/Hookline.html` in jsdom with scripts enabled (no network
 * access at all), then drives the real UI: sample transcript → Generate clips →
 * open a clip → read the breakdown. This is the same bundle the APK ships and
 * the same file you can open from a phone's file manager, so if this passes the
 * app genuinely boots.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const fail = (message) => {
  console.error(`\n✘ ${message}`);
  process.exit(1);
};

const FILE = resolve('standalone/Hookline.html');
if (!existsSync(FILE)) {
  fail('standalone/Hookline.html is missing — run: npm run build:standalone');
}

const html = readFileSync(FILE, 'utf8');
const sizeKb = Math.round(Buffer.byteLength(html) / 1024);

// 1. Must be self-contained: no external script/link/iframe/img requests.
const externalRefs = [...html.matchAll(/<(?:script|link|iframe|img)\b[^>]*(?:src|href)="([^"]+)"/gi)]
  .map((m) => m[1])
  .filter((url) => !url.startsWith('data:') && !url.startsWith('#'));

if (externalRefs.length) {
  fail(`standalone build still references external files: ${externalRefs.slice(0, 4).join(', ')}`);
}
console.log(`✓ self-contained (${sizeKb} kB, 0 external references)`);

// 2. Must not be a module script (module scripts fail from file:// in some WebViews).
if (/<script[^>]+type="module"/i.test(html)) fail('bundle is still a module script');
console.log('✓ classic script (works from file:// and inside the Android WebView)');

// 3. Must not contain the corrupted-replacement artefacts we hit before.
if (html.includes('assets/app.js">')) fail('inliner corrupted the bundle (replacement-token bug)');
console.log('✓ bundle integrity OK (no replacement-token corruption)');

const { JSDOM, VirtualConsole } = await import('jsdom');
const problems = [];
const console_ = new VirtualConsole();
console_.on('jsdomError', (e) => problems.push(`jsdomError: ${e.message}`));
console_.on('error', (...args) => problems.push(`console.error: ${args.join(' ')}`));

const dom = new JSDOM(html, {
  url: 'http://localhost/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: console_,
  resources: undefined, // never fetch anything
});

const { window } = dom;
const doc = window.document;
const text = () => (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
const wait = (ms = 120) => new Promise((r) => window.setTimeout(r, ms));
const click = async (element) => {
  element.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await wait();
};

await wait(400);

// 4. App must actually boot.
const root = doc.getElementById('root');
if (!root || root.children.length === 0) {
  fail(`app did not render (root children: ${root?.children.length ?? 'missing'})`);
}
if (!text().includes('Long video in.')) fail('create screen did not render');
if (!problems.length) console.log('✓ app boots with no runtime errors');
else fail(`runtime errors:\n${problems.slice(0, 5).join('\n')}`);

// 5. Load the sample transcript.
const sampleButton = [...doc.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Sample');
if (!sampleButton) fail('the "Sample" button is missing');
await click(sampleButton);
if (!/\d+ words/.test(text())) fail('sample transcript did not load into the textarea');
console.log('✓ sample transcript loads');

// 6. Generate clips — the whole engine, in the real bundle.
const generate = [...doc.querySelectorAll('button')].find((b) => /Generate clips/.test(b.textContent ?? ''));
if (!generate) fail('the "Generate clips" button is missing');
await click(generate);
await wait(600);

if (!text().includes('Your clips')) fail('generation did not reach the clips screen');
const cards = doc.querySelectorAll('.clip-card');
if (cards.length === 0) fail('no clip cards rendered');
console.log(`✓ generated ${cards.length} clips from the real bundle`);

// 7. Open a clip and confirm the breakdown renders.
await click(cards[0]);
const detail = text();
for (const section of ['Hook · first 2 seconds', 'On-screen beat sheet', 'Comment bait', 'Edit notes']) {
  if (!detail.includes(section)) fail(`clip detail is missing "${section}"`);
}
console.log('✓ clip detail renders hook, beats, CTA and edit notes');

if (problems.length) fail(`runtime errors after interaction:\n${problems.slice(0, 5).join('\n')}`);

console.log('\nAll standalone checks passed — this file runs with zero network and zero dependencies.');
process.exit(0);
