/**
 * Headless UI smoke test (jsdom + real React DOM).
 *
 *   npm run ui:smoke
 *
 * Renders the actual app, runs a generation, opens a clip, swaps a hook and
 * forces an AI-provider failure to prove the fallback path works. This is the
 * cheapest way to catch a blank screen before shipping an APK.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function fail(message: string): never {
  console.error(`\n✘ ${message}`);
  process.exit(1);
}

function expectText(haystack: string, needle: string, label: string) {
  if (!haystack.includes(needle)) {
    fail(`${label}: expected to find "${needle}" in the rendered app`);
  }
}

async function main() {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true,
  });

  // Expose the DOM globals before React/ReactDOM are imported.
  const g = globalThis as unknown as Record<string, unknown>;
  const define = (key: string, value: unknown) => {
    Object.defineProperty(g, key, { value, configurable: true, writable: true });
  };
  define('window', dom.window);
  define('document', dom.window.document);
  define('navigator', dom.window.navigator);
  define('localStorage', dom.window.localStorage);
  define('HTMLElement', dom.window.HTMLElement);
  define('Node', dom.window.Node);
  define('Event', dom.window.Event);
  define('MouseEvent', dom.window.MouseEvent);
  define('getComputedStyle', dom.window.getComputedStyle);
  g.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0);
  g.cancelAnimationFrame = (id: number) => clearTimeout(id);
  g.IS_REACT_ACT_ENVIRONMENT = true;

  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  // React 18.3+ exposes act directly; the test-utils copy is deprecated.
  const act: (fn: () => void | Promise<void>) => Promise<void> =
    (React as unknown as { act?: typeof act }).act ?? (async (fn) => { await fn(); });
  const { default: App } = await import('../src/App');
  const { useApp } = await import('../src/state/store');
  const { SAMPLE_TRANSCRIPT } = await import('../src/data/sample');

  const root = createRoot(dom.window.document.getElementById('root')!);
  const bodyText = () => dom.window.document.body.textContent ?? '';

  await act(async () => {
    root.render(React.createElement(App));
  });

  // --- Create screen ------------------------------------------------------
  expectText(bodyText(), 'Long video in.', 'create screen');
  expectText(bodyText(), 'Generate clips', 'create screen');
  console.log('✓ app boots on the Create screen');

  // --- Generate -----------------------------------------------------------
  await act(async () => {
    useApp.getState().setTranscript(SAMPLE_TRANSCRIPT);
  });
  await act(async () => {
    await useApp.getState().generate();
  });

  const result = useApp.getState().result;
  if (!result || result.clips.length === 0) fail('generate() produced no clips');
  console.log(`✓ generated ${result.clips.length} clips (top score ${result.clips[0].score.total})`);

  expectText(bodyText(), 'Your clips', 'clips screen');
  expectText(bodyText(), 'Export all', 'clips screen');
  console.log('✓ clips screen renders the list');

  // --- Open a clip card ---------------------------------------------------
  const card = dom.window.document.querySelector('.clip-card');
  if (!card) fail('no clip card rendered');
  await act(async () => {
    card.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  });
  const detail = bodyText();
  expectText(detail, 'Hook · first 2 seconds', 'clip detail');
  expectText(detail, 'On-screen beat sheet', 'clip detail');
  expectText(detail, 'Score breakdown', 'clip detail');
  expectText(detail, 'Comment bait', 'clip detail');
  console.log('✓ clip detail sheet opens with the full breakdown');

  // --- Swap a hook --------------------------------------------------------
  const alts = dom.window.document.querySelectorAll('.alt-hook');
  const clipsWithAlternatives = result.clips.filter((c) => c.hooks.length > 1);
  if (alts.length && clipsWithAlternatives.length) {
    const target = clipsWithAlternatives[0];
    const alt = target.hooks.find((h) => h !== target.hook)!;
    await act(async () => {
      (alts[0] as HTMLElement).click();
    });
    const updated = useApp.getState().result?.clips.find((c) => c.id === target.id);
    if (updated && updated.hook !== alt && updated.hook === target.hook) {
      fail('tapping an alternative hook did not change it');
    }
    console.log('✓ alternative hook applies');
  } else {
    console.log('· no alternative hooks in this set (skipped)');
  }

  // --- Close --------------------------------------------------------------
  await act(async () => {
    (dom.window.document.querySelector('.sheet-head .btn') as HTMLElement)?.click();
  });
  if (bodyText().includes('Score breakdown')) fail('clip sheet did not close');
  console.log('✓ clip sheet closes');

  // --- Settings -----------------------------------------------------------
  await act(async () => {
    useApp.getState().setTab('settings');
  });
  expectText(bodyText(), 'AI engine', 'settings');
  expectText(bodyText(), 'How clips are chosen', 'settings');
  console.log('✓ settings screen renders');

  // --- AI failure falls back ---------------------------------------------
  await act(async () => {
    useApp.getState().setAi({ enabled: true, baseUrl: 'http://127.0.0.1:9/v1', model: 'nope', apiKey: 'k' });
    useApp.getState().setTranscript(SAMPLE_TRANSCRIPT);
  });
  await act(async () => {
    await useApp.getState().generate();
  });
  const afterFailure = useApp.getState();
  if (!afterFailure.result || afterFailure.result.clips.length === 0) {
    fail('AI failure lost the clips instead of falling back to the local engine');
  }
  if (!afterFailure.engineNotice) fail('AI failure produced no notice for the user');
  console.log(`✓ unreachable AI provider falls back to the offline engine (${afterFailure.result.clips.length} clips)`);

  // --- Clearing -----------------------------------------------------------
  await act(async () => {
    useApp.getState().clearAll();
  });
  expectText(bodyText(), 'Long video in.', 'after clear');
  console.log('✓ clear-all returns to a clean create screen');

  // --- Bundle sanity (the file the APK actually ships) --------------------
  try {
    const html = readFileSync(resolve('dist/index.html'), 'utf8');
    if (!html.includes('assets/')) fail('dist/index.html does not reference built assets');
    console.log('✓ dist/index.html looks correct');
  } catch {
    console.log('· dist/ not built yet (run npm run build) — skipped bundle check');
  }

  await act(async () => {
    root.unmount();
  });

  console.log('\nAll UI smoke checks passed.');

  // jsdom keeps timers/handles alive; exit explicitly so CI does not hang.
  process.exit(0);
}

main().catch((error) => {
  fail(error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error));
});
