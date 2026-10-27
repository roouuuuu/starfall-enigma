'use strict';

const {
  parseCookies,
  appendCookie,
  cookie,
  token,
  hashToken,
  hashPassword,
  verifyPassword,
  publicUser,
  AppError
} = require('./utils');

const SESSION_COOKIE = 'se_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_SECURE = process.env.COOKIE_SECURE === '1';
const SESSION_COOKIE_OPTIONS = {
  name: SESSION_COOKIE,
  httpOnly: true,
  sameSite: 'Lax',
  secure: SESSION_SECURE,
  maxAge: SESSION_TTL_MS,
  path: '/'
};

function getAdminCount(db) {
  return Number(db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get().count);
}

function createSession(db, userId = null) {
  const raw = token(32);
  const csrfToken = token(32);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_MS);
  db.prepare(
    `INSERT INTO sessions (token_hash, user_id, csrf_token, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(hashToken(raw), userId, csrfToken, now.toISOString(), expires.toISOString());
  return { raw, hash: hashToken(raw), csrfToken, expires };
}

function setSessionCookie(res, raw) {
  appendCookie(res, cookie(raw, SESSION_COOKIE_OPTIONS));
}

function clearSessionCookie(res) {
  appendCookie(res, cookie('', { ...SESSION_COOKIE_OPTIONS, maxAge: 0 }));
}

function deleteSessionByHash(db, hash) {
  if (hash) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash);
}

function cleanupSessions(db) {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());
}

function getSessionUser(db, session) {
  if (!session?.user_id) return null;
  // Never attach authentication secrets to req.user or view locals.
  const row = db.prepare(
    'SELECT id, email, first_name, last_name, phone, role, created_at FROM users WHERE id = ?'
  ).get(Number(session.user_id));
  return row || null;
}

function createSessionForUser(db, res, userId) {
  const session = createSession(db, userId);
  setSessionCookie(res, session.raw);
  return session;
}

function rotateSessionForUser(db, req, res, userId) {
  deleteSessionByHash(db, req.sessionTokenHash);
  const session = createSession(db, userId);
  setSessionCookie(res, session.raw);
  return session;
}

function wantsJson(req) {
  const route = String(req.originalUrl || req.url || '').split('?')[0];
  return route === '/api'
    || route.startsWith('/api/')
    || String(req.get('accept') || '').includes('application/json');
}

function sessionMiddleware(db) {
  return function attachSession(req, res, next) {
    try {
      const cookies = parseCookies(req.headers.cookie || '');
      let raw = cookies[SESSION_COOKIE] || '';
      let session = raw ? db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(hashToken(raw)) : null;
      const now = Date.now();

      if (session && new Date(session.expires_at).getTime() <= now) {
        deleteSessionByHash(db, session.token_hash);
        session = null;
        raw = '';
      }

      if (!raw || !session) {
        const created = createSession(db, null);
        raw = created.raw;
        session = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(created.hash);
        setSessionCookie(res, raw);
      }

      const user = getSessionUser(db, session);
      if (session.user_id && !user) {
        deleteSessionByHash(db, session.token_hash);
        const created = createSession(db, null);
        raw = created.raw;
        session = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(created.hash);
        setSessionCookie(res, raw);
      }

      req.session = session;
      req.sessionTokenRaw = raw;
      req.sessionTokenHash = session.token_hash;
      req.csrfToken = session.csrf_token;
      req.user = user;
      res.locals.user = publicUser(user);
      res.locals.isAdmin = Boolean(user && user.role === 'admin');
      res.locals.csrfToken = session.csrf_token;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function requireAuth(req, res, next) {
  if (req.user) return next();
  if (wantsJson(req)) return next(new AppError(401, 'Please sign in to continue.', 'auth_required'));
  const nextUrl = encodeURIComponent(req.originalUrl || '/account');
  return res.redirect(`/login?next=${nextUrl}`);
}

function requireAdmin(req, res, next) {
  if (req.user?.role === 'admin') return next();
  if (wantsJson(req)) return next(new AppError(req.user ? 403 : 401, 'Administrator access required.', 'admin_required'));
  const adminBase = req.app.get('adminBase') || '/admin';
  if (getAdminCount(req.app.get('db')) === 0) return res.redirect(`${adminBase}/setup`);
  return res.redirect(`${adminBase}/login`);
}

function csrfProtection() {
  return function checkCsrf(req, res, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    if (!req.session) return next(new AppError(419, 'Your session expired. Refresh and try again.', 'csrf'));
    const received = String(req.get('x-csrf-token') || req.body?._csrf || '');
    const expected = String(req.session.csrf_token || '');
    if (!received || received.length !== expected.length) {
      return next(new AppError(419, 'Invalid security token. Refresh and try again.', 'csrf'));
    }
    const a = Buffer.from(received);
    const b = Buffer.from(expected);
    const { timingSafeEqual } = require('crypto');
    if (!timingSafeEqual(a, b)) {
      return next(new AppError(419, 'Invalid security token. Refresh and try again.', 'csrf'));
    }
    return next();
  };
}

function loginRateLimiter() {
  const { createRateLimiter } = require('./utils');
  return createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 12,
    key: (req) => `${req.ip || 'ip'}:${String(req.body?.email || '').toLowerCase().slice(0, 100)}`
  });
}

function setupRateLimiter() {
  const { createRateLimiter } = require('./utils');
  return createRateLimiter({ windowMs: 30 * 60 * 1000, max: 8, key: (req) => req.ip });
}

module.exports = {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  getAdminCount,
  createSession,
  createSessionForUser,
  rotateSessionForUser,
  setSessionCookie,
  deleteSessionByHash,
  clearSessionCookie,
  cleanupSessions,
  sessionMiddleware,
  requireAuth,
  requireAdmin,
  csrfProtection,
  wantsJson,
  loginRateLimiter,
  setupRateLimiter,
  hashPassword,
  verifyPassword
};
