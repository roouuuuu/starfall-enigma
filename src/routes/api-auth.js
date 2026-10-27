'use strict';

const express = require('express');
const {
  AppError,
  cleanText,
  normalizeEmail,
  isEmail,
  safeRedirect,
  publicUser
} = require('../utils');
const {
  hashPassword,
  verifyPassword,
  rotateSessionForUser,
  createSession,
  setSessionCookie,
  deleteSessionByHash,
  getAdminCount,
  loginRateLimiter,
  setupRateLimiter
} = require('../auth');

const router = express.Router();

function adminOrLang(req) {
  return String(req.body?.lang || req.lang || 'en') === 'id' || req.path.includes('/admin') || req.path === '/setup';
}

function msg(req, en, id) {
  return adminOrLang(req) ? id : en;
}

function mergeWishlist(db, userId, ids) {
  if (!Array.isArray(ids) || !ids.length) return;
  const cleanIds = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))].slice(0, 100);
  if (!cleanIds.length) return;
  const placeholders = cleanIds.map(() => '?').join(',');
  const existing = db.prepare(`SELECT id FROM products WHERE id IN (${placeholders}) AND published = 1`).all(...cleanIds);
  const insert = db.prepare('INSERT OR IGNORE INTO wishlists (user_id, product_id, created_at) VALUES (?, ?, ?)');
  const now = new Date().toISOString();
  for (const row of existing) insert.run(userId, Number(row.id), now);
}

function validateAccountInput(req, input, { requirePassword = true } = {}) {
  const email = normalizeEmail(input.email);
  const firstName = cleanText(input.firstName, 80);
  const lastName = cleanText(input.lastName, 80);
  const password = String(input.password || '');
  if (!firstName) throw new AppError(422, msg(req, 'Please enter your first name.', 'Masukkan nama depan Anda.'), 'first_name');
  if (!isEmail(email)) throw new AppError(422, msg(req, 'Please enter a valid email address.', 'Masukkan alamat email yang valid.'), 'email');
  if (requirePassword && password.length < 8) {
    throw new AppError(422, msg(req, 'Password must be at least 8 characters.', 'Kata sandi minimal 8 karakter.'), 'password');
  }
  if (requirePassword && password.length > 200) {
    throw new AppError(422, msg(req, 'Password is too long.', 'Kata sandi terlalu panjang.'), 'password');
  }
  if (requirePassword && input.confirmPassword !== undefined && password !== String(input.confirmPassword)) {
    throw new AppError(422, msg(req, 'Passwords do not match.', 'Konfirmasi kata sandi tidak cocok.'), 'confirm_password');
  }
  return { email, firstName, lastName, password };
}

function makeLoginHandler(forceAdmin) {
  const limiter = loginRateLimiter();
  return [
    limiter,
    (req, res, next) => {
      try {
        const db = req.app.get('db');
        const email = normalizeEmail(req.body?.email);
        const password = String(req.body?.password || '');
        if (!isEmail(email) || !password) {
          throw new AppError(401, msg(req, 'Email or password is incorrect.', 'Email atau kata sandi salah.'), 'invalid_credentials');
        }
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (!user || !verifyPassword(password, user.password_hash)) {
          throw new AppError(401, msg(req, 'Email or password is incorrect.', 'Email atau kata sandi salah.'), 'invalid_credentials');
        }
        if (forceAdmin && user.role !== 'admin') {
          throw new AppError(403, 'Akun ini bukan administrator.', 'admin_required');
        }
        if (forceAdmin && getAdminCount(db) === 0) {
          throw new AppError(403, 'Belum ada administrator. Jalankan setup terlebih dahulu.', 'setup_required');
        }
        rotateSessionForUser(db, req, res, Number(user.id));
        mergeWishlist(db, Number(user.id), req.body?.wishlistProductIds);
        db.prepare(
          `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail, created_at)
           VALUES (?, 'auth.login', 'user', ?, ?, ?)`
        ).run(Number(user.id), String(user.id), JSON.stringify({ area: forceAdmin ? 'admin' : 'storefront' }), new Date().toISOString());
        const requestedNext = safeRedirect(req.body?.next, '');
        const redirect = forceAdmin
          ? '/admin'
          : (user.role === 'admin' && !requestedNext ? '/admin' : requestedNext || '/account');
        return res.json({
          ok: true,
          user: publicUser(user),
          redirect
        });
      } catch (error) {
        return next(error);
      }
    }
  ];
}

router.post('/auth/login', makeLoginHandler(false));
router.post('/admin/login', makeLoginHandler(true));

router.post('/auth/register', (req, res, next) => {
  try {
    const db = req.app.get('db');
    const data = validateAccountInput(req, req.body || {});
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(data.email);
    if (existing) {
      throw new AppError(409, msg(req, 'An account with this email already exists.', 'Akun dengan email ini sudah terdaftar.'), 'email_taken');
    }
    const now = new Date().toISOString();
    const result = db.prepare(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, '', 'customer', ?, ?)`
    ).run(data.email, hashPassword(data.password), data.firstName, data.lastName, now, now);
    const userId = Number(result.lastInsertRowid);
    mergeWishlist(db, userId, req.body?.wishlistProductIds);
    if (req.body?.subscribe) {
      db.prepare('INSERT OR IGNORE INTO newsletter_subscribers (email, locale, created_at) VALUES (?, ?, ?)')
        .run(data.email, String(req.body?.lang || req.lang || 'en') === 'id' ? 'id' : 'en', now);
    }
    rotateSessionForUser(db, req, res, userId);
    db.prepare(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail, created_at)
       VALUES (?, 'auth.register', 'user', ?, '', ?)`
    ).run(userId, String(userId), now);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    return res.status(201).json({ ok: true, user: publicUser(user), redirect: '/account' });
  } catch (error) {
    return next(error);
  }
});

router.post('/auth/logout', (req, res, next) => {
  try {
    const db = req.app.get('db');
    const userId = req.user?.id || null;
    if (userId) {
      db.prepare(
        `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail, created_at)
         VALUES (?, 'auth.logout', 'user', ?, '', ?)`
      ).run(userId, String(userId), new Date().toISOString());
    }
    deleteSessionByHash(db, req.sessionTokenHash);
    const guest = createSession(db, null);
    setSessionCookie(res, guest.raw);
    return res.json({ ok: true, redirect: '/' });
  } catch (error) {
    return next(error);
  }
});

router.post('/setup', setupRateLimiter(), (req, res, next) => {
  try {
    const db = req.app.get('db');
    if (getAdminCount(db) > 0) {
      throw new AppError(403, 'Setup administrator sudah selesai. Silakan masuk.', 'setup_complete');
    }
    const data = validateAccountInput(req, req.body || {});
    const password = String(req.body?.password || '');
    if (password.length < 10) {
      throw new AppError(422, 'Kata sandi administrator minimal 10 karakter.', 'password');
    }
    const now = new Date().toISOString();
    let userId;
    db.exec('BEGIN IMMEDIATE');
    try {
      if (getAdminCount(db) > 0) throw new AppError(403, 'Setup administrator sudah selesai.', 'setup_complete');
      const result = db.prepare(
        `INSERT INTO users (email, password_hash, first_name, last_name, phone, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, '', 'admin', ?, ?)`
      ).run(data.email, hashPassword(password), data.firstName, data.lastName, now, now);
      userId = Number(result.lastInsertRowid);
      db.prepare(
        `INSERT INTO settings (key, value) VALUES ('admin_setup_complete', '1')
         ON CONFLICT(key) DO UPDATE SET value = '1'`
      ).run();
      db.prepare(
        `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail, created_at)
         VALUES (?, 'admin.setup', 'user', ?, ?, ?)`
      ).run(userId, String(userId), JSON.stringify({ email: data.email }), now);
      db.exec('COMMIT');
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch (_) { /* noop */ }
      throw error;
    }
    rotateSessionForUser(db, req, res, userId);
    return res.status(201).json({ ok: true, redirect: '/admin' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
