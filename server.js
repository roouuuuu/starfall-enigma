'use strict';

const http = require('node:http');
const next = require('next');

const { createApp } = require('./src/server');
const { SESSION_COOKIE, SESSION_TTL_MS, createSession } = require('./src/auth');
const { parseCookies, hashToken, cookie, appendCookie } = require('./src/utils');

const PORT = Number(process.env.PORT || 3000);
const dev = process.env.NODE_ENV !== 'production';

// Storefront routes that Next.js owns. Everything else — the admin workspace,
// /api/*, /css, /js and /assets — is still served by the Express app.
// Add a path here when its EJS page has been ported.
const NEXT_PATHS = [/^\/$/];

const SESSION_COOKIE_OPTIONS = {
  name: SESSION_COOKIE,
  httpOnly: true,
  sameSite: 'Lax',
  secure: process.env.COOKIE_SECURE === '1',
  maxAge: SESSION_TTL_MS,
  path: '/'
};

function isNextPath(pathname) {
  if (pathname.startsWith('/_next') || pathname.startsWith('/__nextjs')) return true;
  return NEXT_PATHS.some((pattern) => pattern.test(pathname));
}

function isDocumentRequest(req) {
  if (req.method !== 'GET') return false;
  if (String(req.url || '').includes('_rsc=')) return false;
  const pathname = String(req.url || '/').split('?')[0];
  if (pathname.startsWith('/_next') || pathname.startsWith('/__nextjs')) return false;
  const accept = String(req.headers.accept || '');
  return accept.includes('text/html') || accept === '*/*' || accept === '';
}

/**
 * Express creates a session on the first page view, and the storefront scripts
 * send that session's CSRF token back on every mutation. Next renders pages
 * before the Express chain runs, so the cookie and token are bootstrapped here
 * and handed to the render through request headers.
 */
function ensureSession(req, res, db) {
  const cookies = parseCookies(req.headers.cookie || '');
  let raw = cookies[SESSION_COOKIE] || '';
  let session = raw
    ? db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(hashToken(raw))
    : null;

  if (session && new Date(session.expires_at).getTime() <= Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(session.token_hash);
    session = null;
    raw = '';
  }

  if (!session) {
    const created = createSession(db, null);
    raw = created.raw;
    if (!res.headersSent) appendCookie(res, cookie(raw, SESSION_COOKIE_OPTIONS));
    const existing = String(req.headers.cookie || '');
    req.headers.cookie = existing
      ? `${existing}; ${SESSION_COOKIE}=${encodeURIComponent(raw)}`
      : `${SESSION_COOKIE}=${encodeURIComponent(raw)}`;
  }
}

async function main() {
  const expressApp = createApp();
  const db = expressApp.get('db');
  const adminBase = expressApp.get('adminBase');

  const nextApp = next({ dev, dir: __dirname });
  await nextApp.prepare();
  const handle = nextApp.getRequestHandler();

  const server = http.createServer((req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(String(req.url || '/').split('?')[0]);
    } catch (_) {
      pathname = '/';
    }

    if (isNextPath(pathname)) {
      if (isDocumentRequest(req)) ensureSession(req, res, db);
      req.headers['x-se-path'] = pathname;
      req.headers['x-se-url'] = String(req.url || '/');
      return handle(req, res);
    }

    return expressApp(req, res);
  });

  server.listen(PORT, () => {
    const adminCount = Number(db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get().count);
    console.log(`\nSTARFALL ENIGMA — http://localhost:${PORT}`);
    console.log('Storefront: Next.js · Admin: Express');
    console.log('Admin URL is private. /admin and /setup always answer 404.');
    if (adminCount === 0) console.log(`First-run setup: http://localhost:${PORT}${adminBase}/setup\n`);
    else console.log(`Admin: http://localhost:${PORT}${adminBase}\n`);
  });

  const cleanupTimer = setInterval(() => {
    try { require('./src/auth').cleanupSessions(db); } catch (_) { /* noop */ }
  }, 6 * 60 * 60 * 1000);
  cleanupTimer.unref();

  const shutdown = () => {
    const liveReload = expressApp.get('liveReload');
    if (liveReload) liveReload.close();
    clearInterval(cleanupTimer);
    server.close(() => {
      nextApp.close().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return server;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { main, isNextPath };
