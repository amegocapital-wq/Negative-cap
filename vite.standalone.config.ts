import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

/**
 * Standalone build.
 *
 * Produces ONE file — `standalone/Hookline.html` — with the JS and CSS inlined
 * as a classic (non-module) script. It has no external requests at all, so it:
 *
 *   • opens by double-click from a phone's file manager (no server, no CORS issue)
 *   • can be hosted anywhere (any static host, a USB stick, an email attachment)
 *   • does not depend on this repo, node_modules, or a dev server
 *
 * Run with `npm run build:standalone`.
 */

const OUT_DIR = resolve('standalone');
const OUT_FILE = resolve(OUT_DIR, 'Hookline.html');

/** Inline the emitted bundle + stylesheet into a single self-contained HTML. */
function inlineSingleFile(): Plugin {
  return {
    name: 'hookline-inline-single-file',
    apply: 'build',
    closeBundle() {
      const distIndex = resolve('dist/index.html');
      if (!existsSync(distIndex)) return;

      let html = readFileSync(distIndex, 'utf8');

      const cssMatch = html.match(/<link[^>]+href="\.?\/?(assets\/[^"]+\.css)"[^>]*>/);
      if (cssMatch) {
        const cssPath = resolve('dist', cssMatch[1]);
        const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : '';
        // NOTE: use a function replacer — `$&`, `$1`, `$\`` inside the payload
        // would otherwise be interpreted as replacement patterns and corrupt it.
        const cssBlock = `<style>\n${css}\n</style>`;
        html = html.replace(cssMatch[0], () => cssBlock);
      }

      const jsMatch = html.match(/<script[^>]+src="\.?\/?(assets\/[^"]+\.js)"[^>]*><\/script>/);
      if (jsMatch) {
        const jsPath = resolve('dist', jsMatch[1]);
        const js = existsSync(jsPath) ? readFileSync(jsPath, 'utf8') : '';
        // Escape any accidental </script> inside string literals.
        const safe = js.replace(/<\/script>/gi, () => '<\\/script>');
        // A classic script in <head> runs before #root exists (module scripts
        // are deferred, classic ones are not). Inject it at the end of <body>.
        html = html.replace(jsMatch[0], () => '');
        const inlineScript = `<script>\n${safe}\n</script>`;
        html = html.replace('</body>', () => `  ${inlineScript}\n  </body>`);
      }

      // No module preload / crossorigin leftovers.
      html = html.replace(/<link[^>]+rel="modulepreload"[^>]*>/g, '');
      html = html.replace(/ crossorigin/g, '');
      html = html.replace(
        '<meta name="theme-color" content="#07070b" />',
        [
          '<meta name="theme-color" content="#07070b" />',
          '<meta name="apple-mobile-web-app-capable" content="yes" />',
          '<meta name="apple-mobile-web-app-title" content="Hookline" />',
          '<meta name="mobile-web-app-capable" content="yes" />',
          '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 64 64\'%3E%3Crect width=\'64\' height=\'64\' rx=\'14\' fill=\'%23c8ff4d\'/%3E%3Ctext x=\'32\' y=\'45\' font-size=\'38\' font-family=\'sans-serif\' font-weight=\'700\' text-anchor=\'middle\' fill=\'%2307070b\'%3EH%3C/text%3E%3C/svg%3E" />',
          '<!-- Hookline — standalone single-file build. No network requests, no dependencies. -->',
        ].join('\n    ')
      );

      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(OUT_FILE, html, 'utf8');
      const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
      // eslint-disable-next-line no-console
      console.log(`\n  standalone/Hookline.html  ${kb} kB  (single file, zero external requests)`);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), inlineSingleFile()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2018',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    modulePreload: false,
    rollupOptions: {
      output: {
        // Everything in one chunk so it can be inlined into the HTML.
        inlineDynamicImports: true,
        format: 'iife',
        entryFileNames: 'assets/app.js',
        assetFileNames: 'assets/app.[ext]',
      },
    },
  },
});

// Keep the unused import warning-free for older vite versions.
void rmSync;
