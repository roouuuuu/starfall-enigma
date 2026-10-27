'use strict';

const express = require('express');
const {
  AppError,
  cleanText,
  normalizeEmail,
  isEmail,
  createRateLimiter,
  moneyIdr,
  dateOnly
} = require('../utils');
const { listProducts, getFacets, resolveCartItems, toProductCard, getVariants } = require('../catalog-service');
const { getPromo, calculateDiscount } = require('../order-service');
const { requireAuth } = require('../auth');

const router = express.Router();
const newsletterLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 8 });

router.get('/products', (req, res) => {
  const db = req.app.get('db');
  const result = listProducts(
    db,
    { ...req.query, currency: req.currency, rate: req.exchangeRate },
    req.lang
  );
  const payload = {
    ok: true,
    ...result,
    currency: req.currency,
    exchangeRate: req.exchangeRate
  };
  if (req.query.facets === '1') payload.facets = getFacets(db, req.lang);
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.json(payload);
});

router.post('/promo', (req, res, next) => {
  try {
    const db = req.app.get('db');
    const settings = req.app.get('settings') || {};
    const supplied = cleanText(req.body?.code, 30);
    if (!supplied) throw new AppError(422, req.lang === 'id' ? 'Masukkan kode promo.' : 'Enter a promo code.', 'promo_invalid');
    const promo = getPromo(settings, supplied);
    const subtotal = Math.max(0, Math.round(Number(req.body?.subtotalCents) || 0));
    if (!promo.valid) {
      throw new AppError(400, req.lang === 'id' ? 'Kode promo tidak valid.' : 'That promo code is not valid.', 'promo_invalid');
    }
    const discountCents = calculateDiscount(subtotal, promo);
    return res.json({
      ok: true,
      code: promo.code,
      percent: promo.percent,
      discountCents,
      discountIdr: moneyIdr(discountCents, Number(settings.exchange_rate || req.exchangeRate))
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/cart/resolve', (req, res, next) => {
  try {
    const db = req.app.get('db');
    const result = resolveCartItems(db, req.body?.items);
    return res.json({
      ok: true,
      items: result.items,
      subtotalCents: result.subtotalCents,
      count: result.items.reduce((sum, item) => sum + item.quantity, 0)
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/newsletter', newsletterLimiter, (req, res, next) => {
  try {
    if (req.body?.company || req.body?.website) return res.json({ ok: true });
    const db = req.app.get('db');
    const email = normalizeEmail(req.body?.email);
    if (!isEmail(email)) {
      throw new AppError(422, req.lang === 'id' ? 'Masukkan alamat email yang valid.' : 'Please enter a valid email address.', 'email');
    }
    const locale = String(req.body?.lang || req.lang) === 'id' ? 'id' : 'en';
    db.prepare('INSERT OR IGNORE INTO newsletter_subscribers (email, locale, created_at) VALUES (?, ?, ?)')
      .run(email, locale, new Date().toISOString());
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

function wishlistResponse(db, userId, lang) {
  const rows = db.prepare(
    `SELECT p.*, w.created_at AS wished_at
     FROM wishlists w JOIN products p ON p.id = w.product_id
     WHERE w.user_id = ? AND p.published = 1
     ORDER BY w.created_at DESC`
  ).all(Number(userId));
  const variantMap = getVariants(db, rows.map((row) => Number(row.id)));
  const items = rows.map((row) => toProductCard(row, variantMap.get(Number(row.id)) || [], lang));
  return { items, ids: items.map((item) => item.id) };
}

router.get('/wishlist', requireAuth, (req, res) => {
  const db = req.app.get('db');
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true, ...wishlistResponse(db, req.user.id, req.lang) });
});

router.post('/wishlist', requireAuth, (req, res, next) => {
  try {
    const db = req.app.get('db');
    const productId = Number(req.body?.productId);
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new AppError(422, 'Produk tidak valid.', 'validation');
    }
    const product = db.prepare('SELECT id FROM products WHERE id = ? AND published = 1').get(productId);
    if (!product) throw new AppError(404, 'Produk tidak ditemukan.', 'not_found');
    db.prepare('INSERT OR IGNORE INTO wishlists (user_id, product_id, created_at) VALUES (?, ?, ?)')
      .run(Number(req.user.id), productId, new Date().toISOString());
    return res.json({ ok: true, ...wishlistResponse(db, req.user.id, req.lang) });
  } catch (error) {
    return next(error);
  }
});

router.delete('/wishlist/:productId', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const productId = Number(req.params.productId);
  if (Number.isInteger(productId)) {
    db.prepare('DELETE FROM wishlists WHERE user_id = ? AND product_id = ?').run(Number(req.user.id), productId);
  }
  return res.json({ ok: true, ...wishlistResponse(db, req.user.id, req.lang) });
});

module.exports = router;
