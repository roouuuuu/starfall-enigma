'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Development-only live reload.
 *
 * Watches the template, style and script folders and pushes a small event to
 * every connected browser over Server-Sent Events:
 *   { type: 'css', path: '/css/storefront.css' }  -> swap that stylesheet in place
 *   { type: 'full' }                              -> reload the page
 *
 * Never mounted when NODE_ENV=production.
 */

const ROUTE = '/__dev/reload';
const PUBLIC_PREFIX = 'public/';

function classify(relativePath) {
  const posix = relativePath.split(path.sep).join('/');
  if (posix.startsWith(PUBLIC_PREFIX) && posix.endsWith('.css')) {
    return { type: 'css', path: `/${posix.slice(PUBLIC_PREFIX.length)}` };
  }
  return { type: 'full' };
}

function mountLiveReload(app, options = {}) {
  const root = options.root || path.join(__dirname, '..');
  const watchDirs = options.watchDirs || ['public', 'views'];
  const clients = new Set();
  let timer = null;
  let pending = null;

  app.get(ROUTE, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.write('retry: 1000\n\n');

    clients.add(res);
    req.on('close', () => clients.delete(res));
  });

  const heartbeat = setInterval(() => {
    for (const client of clients) {
      try { client.write(': ping\n\n'); } catch (_) { clients.delete(client); }
    }
  }, 25000);
  heartbeat.unref();

  function broadcast(payload) {
    const frame = `data: ${JSON.stringify(payload)}\n\n`;
    for (const client of clients) {
      try { client.write(frame); } catch (_) { clients.delete(client); }
    }
  }

  const watchers = [];
  for (const dir of watchDirs) {
    const target = path.join(root, dir);
    if (!fs.existsSync(target)) continue;
    try {
      const watcher = fs.watch(target, { recursive: true }, (_event, filename) => {
        if (!filename) return;
        const relative = path.join(dir, String(filename));
        // Ignore editor noise so a save does not fire twice.
        if (/(^|[\\/])(\.|~)|\.(swp|tmp|log)$|~$/.test(relative)) return;
        pending = classify(relative);
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          timer = null;
          const payload = pending;
          pending = null;
          broadcast(payload || { type: 'full' });
        }, 120);
      });
      watcher.on('error', () => { /* keep serving, just stop watching */ });
      watchers.push(watcher);
    } catch (_) {
      // Some platforms cannot watch recursively; skip quietly.
    }
  }

  // Watchers live for the process lifetime in dev; close() lets a caller shut
  // them down explicitly (tests, graceful shutdown).
  return { route: ROUTE, close() {
    clearInterval(heartbeat);
    for (const watcher of watchers) {
      try { watcher.close(); } catch (_) { /* noop */ }
    }
    for (const client of clients) {
      try { client.end(); } catch (_) { /* noop */ }
    }
    clients.clear();
  } };
}

module.exports = { mountLiveReload, ROUTE };
