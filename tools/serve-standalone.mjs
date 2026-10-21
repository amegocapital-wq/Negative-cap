#!/usr/bin/env node
/**
 * Hookline — dependency-free static server.
 *
 *   npm run serve                        → http://0.0.0.0:5173
 *   PORT=8080 npm run serve
 *
 * Serves the self-contained `Hookline.html`. No node_modules, no build step, no
 * network calls, nothing to install — so the preview works even in a fresh
 * sandbox where dependencies have not been installed yet.
 */

import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
/** The built app lives in ../standalone (only generated files there). */
const APP_DIR = join(HERE, '..', 'standalone');
const PORT = Number(process.env.PORT ?? 5173);
const HOST = process.env.HOST ?? '0.0.0.0';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

const CANDIDATES = ['Hookline.html', 'index.html'];

function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const safe = normalize(clean).replace(/^(\.\.[/\\])+/, '');
  if (safe === '/' || safe === '' || safe === '.') {
    for (const name of CANDIDATES) {
      try {
        const full = join(APP_DIR, name);
        if (statSync(full).isFile()) return full;
      } catch {
        /* try next */
      }
    }
    return null;
  }
  const full = join(APP_DIR, safe);
  try {
    return statSync(full).isFile() ? full : null;
  } catch {
    return null;
  }
}

const server = createServer((req, res) => {
  // Permissive headers: the sandbox preview is embedded in an iframe.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, app: 'Hookline', mode: 'standalone' }));
    return;
  }

  const file = resolveFile(req.url ?? '/');
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 — not found. The app lives at /\n');
    return;
  }

  try {
    const body = readFileSync(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': body.length,
    });
    res.end(req.method === 'HEAD' ? undefined : body);
    console.log(`${req.method} ${req.url} → 200 ${(body.length / 1024).toFixed(0)}kB`);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`500 — ${error.message}\n`);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\nHookline (standalone) listening on http://${HOST}:${PORT}`);
  console.log(`  serving ${APP_DIR}/index.html — no dependencies required\n`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
