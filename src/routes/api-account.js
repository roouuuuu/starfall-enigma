'use strict';

const express = require('express');
const {
  AppError,
  cleanText,
  isEmail,
  normalizeEmail,
  getClientIp
} = require('../utils');
const { requireAuth, rotateSessionForUser, hashPassword, verifyPassword } = require('../auth');
const { createWebsiteOrder } = require('../order-service');
const { getSettings } = require('../db');

const router = express.Router();

function localized(req, en, id) {
  return req.lang === 'id' ? id : en;
}

router.post('/orders', (req, res, next) => {
  try {
    const db = req.app.get('db');
    const settings = getSettings(db);
    const result = createWebsiteOrder(db, {
      user: req.user,
      sessionHash: req.sessionTokenHash || '',
      input: req.body || {},
      settings
    });
    return res.status(201).json({
      ok: true,
      order: {
        number: result.orderNumber,
        totalCents: result.totalCents,
        totalIdr: result.totalIdr,
        currency: result.currency,
        discountCents: result.discountCents,
        subtotalCents: result.subtotalCents,
        email: result.email,
        createdAt: result.createdAt
      },
      redirect: `/order/${encodeURIComponent(result.orderNumber)}?placed=1`
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/account/profile', requireAuth, (req, res, next) => {
  try {
    const db = req.app.get('db');
    const firstName = cleanText(req.body?.firstName, 80);
    const lastName = cleanText(req.body?.lastName, 80);
    const phone = cleanText(req.body?.phone, 40);
    if (!firstName) throw new AppError(422, localized(req, 'First name is required.', 'Nama depan wajib diisi.'), 'validation');
    const now = new Date().toISOString();
    db.prepare('UPDATE users SET first_name = ?, last_name = ?, phone = ?, updated_at = ? WHERE id = ?')
      .run(firstName, lastName, phone, now, Number(req.user.id));
    db.prepare(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail, created_at)
       VALUES (?, 'account.profile_updated', 'user', ?, '', ?)`
    ).run(Number(req.user.id), String(req.user.id), now);
    return res.json({
      ok: true,
      user: {
        id: Number(req.user.id),
        email: req.user.email,
        first_name: firstName,
        last_name: lastName,
        phone,
        role: req.user.role,
        created_at: req.user.created_at
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/account/password', requireAuth, (req, res, next) => {
  try {
    const db = req.app.get('db');
    const current = String(req.body?.currentPassword || '');
    const nextPassword = String(req.body?.newPassword || '');
    const confirm = String(req.body?.confirmPassword || '');
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.user.id));
    if (!user || !verifyPassword(current, user.password_hash)) {
      throw new AppError(422, localized(req, 'Current password is incorrect.', 'Kata sandi saat ini salah.'), 'invalid_password');
    }
    if (nextPassword.length < 8) {
      throw new AppError(422, localized(req, 'New password must be at least 8 characters.', 'Kata sandi baru minimal 8 karakter.'), 'password');
    }
    if (nextPassword !== confirm) {
      throw new AppError(422, localized(req, 'Passwords do not match.', 'Konfirmasi kata sandi tidak cocok.'), 'confirm_password');
    }
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(hashPassword(nextPassword), new Date().toISOString(), Number(req.user.id));
    const newSession = rotateSessionForUser(db, req, res, Number(req.user.id));
    return res.json({ ok: true, csrfToken: newSession.csrfToken });
  } catch (error) {
    return next(error);
  }
});

router.get('/account/addresses', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const addresses = db.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC').all(Number(req.user.id));
  res.json({ ok: true, addresses });
});

router.post('/account/addresses', requireAuth, (req, res, next) => {
  try {
    const db = req.app.get('db');
    const count = Number(db.prepare('SELECT COUNT(*) AS count FROM addresses WHERE user_id = ?').get(Number(req.user.id)).count);
    if (count >= 20) throw new AppError(422, localized(req, 'You have reached the address limit.', 'Batas alamat telah tercapai.'), 'limit');
    const address1 = cleanText(req.body?.address1, 200);
    const city = cleanText(req.body?.city, 100);
    const postalCode = cleanText(req.body?.postalCode, 20);
    if (!address1 || !city || !postalCode) {
      throw new AppError(422, localized(req, 'Address, city and postal code are required.', 'Alamat, kota, dan kode pos wajib diisi.'), 'validation');
    }
    const firstName = cleanText(req.body?.firstName, 80) || req.user.first_name;
    const lastName = cleanText(req.body?.lastName, 80) || req.user.last_name;
    const label = cleanText(req.body?.label, 40) || 'Rumah';
    const isDefault = req.body?.isDefault ? 1 : (count === 0 ? 1 : 0);
    const now = new Date().toISOString();
    db.exec('BEGIN IMMEDIATE');
    try {
      if (isDefault) db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(Number(req.user.id));
      const result = db.prepare(
        `INSERT INTO addresses (
          user_id, label, first_name, last_name, phone, address1, address2,
          city, region, postal_code, country, is_default, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        Number(req.user.id),
        label,
        firstName,
        lastName,
        cleanText(req.body?.phone, 40) || req.user.phone || '',
        address1,
        cleanText(req.body?.address2, 200),
        city,
        cleanText(req.body?.region, 100),
        postalCode,
        cleanText(req.body?.country, 80) || 'Indonesia',
        isDefault,
        now
      );
      db.prepare(
        `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail, created_at)
         VALUES (?, 'account.address_added', 'address', ?, '', ?)`
      ).run(Number(req.user.id), String(result.lastInsertRowid), now);
      db.exec('COMMIT');
      return res.status(201).json({ ok: true, addressId: Number(result.lastInsertRowid) });
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch (_) { /* noop */ }
      throw error;
    }
  } catch (error) {
    return next(error);
  }
});

router.post('/account/addresses/:id/default', requireAuth, (req, res, next) => {
  try {
    const db = req.app.get('db');
    const address = db.prepare('SELECT id FROM addresses WHERE id = ? AND user_id = ?').get(Number(req.params.id), Number(req.user.id));
    if (!address) throw new AppError(404, 'Alamat tidak ditemukan.', 'not_found');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(Number(req.user.id));
      db.prepare('UPDATE addresses SET is_default = 1 WHERE id = ?').run(Number(address.id));
      db.exec('COMMIT');
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch (_) { /* noop */ }
      throw error;
    }
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

router.delete('/account/addresses/:id', requireAuth, (req, res, next) => {
  try {
    const db = req.app.get('db');
    const address = db.prepare('SELECT id, is_default FROM addresses WHERE id = ? AND user_id = ?').get(Number(req.params.id), Number(req.user.id));
    if (!address) throw new AppError(404, 'Alamat tidak ditemukan.', 'not_found');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('DELETE FROM addresses WHERE id = ?').run(Number(address.id));
      if (address.is_default) {
        const nextAddress = db.prepare('SELECT id FROM addresses WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(Number(req.user.id));
        if (nextAddress) db.prepare('UPDATE addresses SET is_default = 1 WHERE id = ?').run(Number(nextAddress.id));
      }
      db.prepare(
        `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail, created_at)
         VALUES (?, 'account.address_deleted', 'address', ?, '', ?)`
      ).run(Number(req.user.id), String(address.id), new Date().toISOString());
      db.exec('COMMIT');
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch (_) { /* noop */ }
      throw error;
    }
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
