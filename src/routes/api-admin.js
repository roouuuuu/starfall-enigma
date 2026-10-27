'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const {
  AppError,
  cleanText,
  cleanMultiline,
  isEmail,
  normalizeEmail,
  isDateOnly,
  dateOnly,
  shiftDateOnly,
  businessDayStart,
  businessDayEnd,
  pagination,
  moneyIdr,
  csvRow,
  isValidHttpUrl
} = require('../utils');
const { requireAdmin, rotateSessionForUser, hashPassword, verifyPassword } = require('../auth');
const { getSettings, setSetting, ROOT } = require('../db');
const { serializeOrder, updateOrderStatus, cancelOrder, createManualOrder, CHANNELS } = require('../order-service');

const router = express.Router();
router.use(requireAdmin);
router.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  next();
});

function dbOf(req) {
  return req.app.get('db');
}

function getRange(query) {
  const today = dateOnly();
  const defaultFrom = `${today.slice(0, 7)}-01`;
  const defaultTo = today;
  let from = isDateOnly(query.from) ? String(query.from) : defaultFrom;
  let to = isDateOnly(query.to) ? String(query.to) : defaultTo;
  if (from > to) [from, to] = [to, from];
  return { from, to };
}

function adminDateRangeLabel(from, to) {
  return { from, to };
}

function mapOrderRow(row) {
  return {
    id: Number(row.id),
    number: row.order_number,
    status: row.status,
    channel: row.channel,
    currency: row.currency,
    customerName: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
    email: row.email,
    totalIdr: Number(row.total_idr),
    totalUsdCents: Number(row.total_usd_cents),
    exchangeRate: Number(row.exchange_rate),
    itemCount: Number(row.item_count || 0),
    units: Number(row.units || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function listOrderRows(db, where, params, limit, offset) {
  return db.prepare(
    `SELECT o.*,
       (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
       (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) AS units
     FROM orders o
     ${where ? `WHERE ${where}` : ''}
     ORDER BY o.created_at DESC
     LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);
}

router.get('/dashboard', (req, res) => {
  const db = dbOf(req);
  const { from, to } = getRange(req.query);
  const finance = db.prepare(
    `SELECT type, COALESCE(SUM(amount_idr), 0) AS total
     FROM finance_entries
     WHERE entry_date BETWEEN ? AND ?
     GROUP BY type`
  ).all(from, to);
  const income = Number(finance.find((row) => row.type === 'income')?.total || 0);
  const expense = Number(finance.find((row) => row.type === 'expense')?.total || 0);
  const startIso = businessDayStart(from);
  const endIso = businessDayEnd(to);
  const statusRows = db.prepare(
    `SELECT status, COUNT(*) AS count, COALESCE(SUM(total_idr), 0) AS total
     FROM orders
     WHERE created_at >= ? AND created_at < ?
     GROUP BY status`
  ).all(startIso, endIso);
  const statusCounts = Object.fromEntries(statusRows.map((row) => [row.status, Number(row.count)]));
  const orderCount = statusRows.reduce((sum, row) => sum + Number(row.count), 0);
  const paidOrders = statusRows.filter((row) => row.status !== 'cancelled').reduce((sum, row) => sum + Number(row.count), 0);
  const unitsSold = Number(db.prepare(
    `SELECT COALESCE(SUM(oi.quantity), 0) AS units
     FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE o.status != 'cancelled' AND o.created_at >= ? AND o.created_at < ?`
  ).get(startIso, endIso).units);
  const stockSummary = db.prepare(
    `SELECT
       COUNT(*) AS variants,
       COALESCE(SUM(stock), 0) AS units,
       COALESCE(SUM(CASE WHEN stock > 0 AND stock <= low_stock_threshold THEN 1 ELSE 0 END), 0) AS low,
       COALESCE(SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END), 0) AS out
     FROM variants`
  ).get();
  const customers = Number(db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'customer'").get().count);
  const subscribers = Number(db.prepare('SELECT COUNT(*) AS count FROM newsletter_subscribers').get().count);
  const socialClicks = Number(db.prepare(
    "SELECT COUNT(*) AS count FROM social_clicks WHERE clicked_at >= ?"
  ).get(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()).count);
  const openOrders = Number(db.prepare(
    "SELECT COUNT(*) AS count FROM orders WHERE status IN ('paid', 'processing', 'shipped')"
  ).get().count);

  const today = dateOnly();
  const chartFrom = shiftDateOnly(today, -13);
  const chartRows = db.prepare(
    `SELECT entry_date, type, COALESCE(SUM(amount_idr), 0) AS total
     FROM finance_entries
     WHERE entry_date BETWEEN ? AND ?
     GROUP BY entry_date, type`
  ).all(chartFrom, today);
  const chartMap = new Map();
  for (const row of chartRows) {
    if (!chartMap.has(row.entry_date)) chartMap.set(row.entry_date, { income: 0, expense: 0 });
    chartMap.get(row.entry_date)[row.type] = Number(row.total);
  }
  const chart = [];
  for (let i = 0; i < 14; i += 1) {
    const key = shiftDateOnly(chartFrom, i);
    const values = chartMap.get(key) || { income: 0, expense: 0 };
    chart.push({ date: key, income: values.income, expense: values.expense, net: values.income - values.expense });
  }

  const recentOrders = listOrderRows(db, '', [], 6, 0).map(mapOrderRow);
  const lowStock = db.prepare(
    `SELECT v.id AS variant_id, v.sku, v.label, v.stock, v.low_stock_threshold,
       p.id AS product_id, p.name, p.slug, p.image_a, p.category
     FROM variants v JOIN products p ON p.id = v.product_id
     WHERE v.stock <= v.low_stock_threshold
     ORDER BY v.stock ASC, p.name ASC
     LIMIT 8`
  ).all().map((row) => ({
    variantId: Number(row.variant_id),
    sku: row.sku,
    label: row.label,
    stock: Number(row.stock),
    threshold: Number(row.low_stock_threshold),
    productId: Number(row.product_id),
    name: row.name,
    slug: row.slug,
    image: row.image_a,
    category: row.category
  }));
  const channels = db.prepare(
    `SELECT channel, COUNT(*) AS orders, COALESCE(SUM(total_idr), 0) AS revenue
     FROM orders
     WHERE status != 'cancelled' AND created_at >= ? AND created_at < ?
     GROUP BY channel
     ORDER BY revenue DESC`
  ).all(startIso, endIso).map((row) => ({
    channel: row.channel,
    orders: Number(row.orders),
    revenue: Number(row.revenue)
  }));
  const financeCategories = db.prepare(
    `SELECT type, category, COALESCE(SUM(amount_idr), 0) AS total
     FROM finance_entries
     WHERE entry_date BETWEEN ? AND ?
     GROUP BY type, category
     ORDER BY total DESC`
  ).all(from, to).map((row) => ({
    type: row.type,
    category: row.category,
    total: Number(row.total)
  }));

  res.json({
    ok: true,
    period: adminDateRangeLabel(from, to),
    summary: {
      income,
      expense,
      net: income - expense,
      orderCount,
      paidOrders,
      openOrders,
      unitsSold,
      customers,
      subscribers,
      socialClicks,
      variants: Number(stockSummary.variants),
      stockUnits: Number(stockSummary.units),
      lowStock: Number(stockSummary.low),
      outOfStock: Number(stockSummary.out)
    },
    statusCounts,
    chart,
    recentOrders,
    lowStock,
    channels,
    financeCategories,
    exchangeRate: Number(getSettings(db).exchange_rate || 0)
  });
});

router.get('/orders', (req, res) => {
  const db = dbOf(req);
  const { page, limit, offset } = pagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const where = [];
  const params = [];
  const status = String(req.query.status || '');
  if (['paid', 'processing', 'shipped', 'completed', 'cancelled'].includes(status)) {
    where.push('o.status = ?');
    params.push(status);
  }
  const channel = String(req.query.channel || '');
  if (CHANNELS[channel] && channel !== 'website') {
    where.push('o.channel = ?');
    params.push(channel);
  } else if (channel === 'website') {
    where.push('o.channel = ?');
    params.push('website');
  }
  const search = cleanText(req.query.search, 120);
  if (search) {
    const like = `%${search}%`;
    where.push('(o.order_number LIKE ? OR o.email LIKE ? OR o.first_name LIKE ? OR o.last_name LIKE ?)');
    params.push(like, like, like, like);
  }
  const from = isDateOnly(req.query.from) ? String(req.query.from) : '';
  const to = isDateOnly(req.query.to) ? String(req.query.to) : '';
  if (from) { where.push('o.created_at >= ?'); params.push(businessDayStart(from)); }
  if (to) { where.push('o.created_at < ?'); params.push(businessDayEnd(to)); }
  const whereSql = where.length ? where.join(' AND ') : '';
  const total = Number(db.prepare(`SELECT COUNT(*) AS count FROM orders o ${whereSql ? `WHERE ${whereSql}` : ''}`).get(...params).count);
  const orders = listOrderRows(db, whereSql, params, limit, offset).map(mapOrderRow);
  res.json({
    ok: true,
    orders,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit))
  });
});

router.get('/orders/:id', (req, res, next) => {
  try {
    const db = dbOf(req);
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id));
    if (!order) throw new AppError(404, 'Pesanan tidak ditemukan.', 'not_found');
    const serialized = serializeOrder(db, order);
    serialized.financeEntries = db.prepare(
      'SELECT id, type, amount_idr, category, description, entry_date FROM finance_entries WHERE order_id = ? ORDER BY id DESC'
    ).all(order.id).map((row) => ({
      id: Number(row.id),
      type: row.type,
      amountIdr: Number(row.amount_idr),
      category: row.category,
      description: row.description,
      entryDate: row.entry_date
    }));
    res.json({ ok: true, order: serialized });
  } catch (error) {
    next(error);
  }
});

router.patch('/orders/:id/status', (req, res, next) => {
  try {
    const db = dbOf(req);
    const status = cleanText(req.body?.status, 30);
    const result = status === 'cancelled'
      ? cancelOrder(db, { orderId: req.params.id, admin: req.user, reason: cleanText(req.body?.reason, 400) })
      : updateOrderStatus(db, { orderId: req.params.id, status, admin: req.user });
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

router.post('/orders/manual', (req, res, next) => {
  try {
    const db = dbOf(req);
    const settings = getSettings(db);
    const result = createManualOrder(db, { admin: req.user, input: req.body || {}, settings });
    res.status(201).json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

router.get('/catalog', (req, res) => {
  const db = dbOf(req);
  const products = db.prepare(
    `SELECT p.id, p.slug, p.name, p.category, p.collection, p.image_a, p.price_usd_cents
     FROM products p WHERE p.published = 1 ORDER BY p.name ASC`
  ).all();
  const variants = db.prepare(
    `SELECT id, product_id, sku, label, stock, price_delta_cents
     FROM variants ORDER BY id ASC`
  ).all();
  const byProduct = new Map();
  for (const variant of variants) {
    if (!byProduct.has(Number(variant.product_id))) byProduct.set(Number(variant.product_id), []);
    byProduct.get(Number(variant.product_id)).push({
      id: Number(variant.id),
      sku: variant.sku,
      label: variant.label,
      stock: Number(variant.stock),
      priceCents: Number(variant.price_delta_cents)
    });
  }
  res.json({
    ok: true,
    products: products.map((product) => ({
      id: Number(product.id),
      slug: product.slug,
      name: product.name,
      category: product.category,
      collection: product.collection,
      image: product.image_a,
      priceCents: Number(product.price_usd_cents),
      variants: byProduct.get(Number(product.id)) || []
    })),
    exchangeRate: Number(getSettings(db).exchange_rate || 0)
  });
});

router.get('/inventory', (req, res) => {
  const db = dbOf(req);
  const { page, limit, offset } = pagination(req.query, { defaultLimit: 25, maxLimit: 100 });
  const where = [];
  const params = [];
  const filter = String(req.query.filter || 'all');
  if (filter === 'low') where.push('v.stock > 0 AND v.stock <= v.low_stock_threshold');
  if (filter === 'out') where.push('v.stock = 0');
  const search = cleanText(req.query.search, 120);
  if (search) {
    const like = `%${search}%`;
    where.push('(p.name LIKE ? OR p.sku LIKE ? OR v.sku LIKE ? OR v.label LIKE ?)');
    params.push(like, like, like, like);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = Number(db.prepare(
    `SELECT COUNT(*) AS count FROM variants v JOIN products p ON p.id = v.product_id ${whereSql}`
  ).get(...params).count);
  const items = db.prepare(
    `SELECT v.id AS variant_id, v.sku, v.label, v.stock, v.low_stock_threshold,
       v.price_delta_cents, p.id AS product_id, p.name, p.slug, p.image_a, p.category, p.price_usd_cents
     FROM variants v JOIN products p ON p.id = v.product_id
     ${whereSql}
     ORDER BY v.stock ASC, p.name ASC, v.id ASC
     LIMIT ? OFFSET ?`
  ).all(...params, limit, offset).map((row) => ({
    variantId: Number(row.variant_id),
    sku: row.sku,
    label: row.label,
    stock: Number(row.stock),
    threshold: Number(row.low_stock_threshold),
    productId: Number(row.product_id),
    name: row.name,
    slug: row.slug,
    image: row.image_a,
    category: row.category,
    priceCents: Number(row.price_usd_cents) + Number(row.price_delta_cents)
  }));
  const summary = db.prepare(
    `SELECT COUNT(*) AS variants, COALESCE(SUM(stock), 0) AS units,
       COALESCE(SUM(CASE WHEN stock > 0 AND stock <= low_stock_threshold THEN 1 ELSE 0 END), 0) AS low,
       COALESCE(SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END), 0) AS out
     FROM variants`
  ).get();
  res.json({
    ok: true,
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    summary: {
      variants: Number(summary.variants),
      units: Number(summary.units),
      low: Number(summary.low),
      out: Number(summary.out)
    }
  });
});

router.get('/inventory/movements', (req, res) => {
  const db = dbOf(req);
  const { page, limit, offset } = pagination(req.query, { defaultLimit: 25, maxLimit: 100 });
  const where = [];
  const params = [];
  const search = cleanText(req.query.search, 120);
  if (search) {
    const like = `%${search}%`;
    where.push('(p.name LIKE ? OR v.sku LIKE ? OR m.reference LIKE ? OR m.note LIKE ? OR m.supplier LIKE ?)');
    params.push(like, like, like, like, like);
  }
  const type = String(req.query.type || '');
  if (['opening', 'in', 'sale', 'return', 'adjustment'].includes(type)) {
    where.push('m.type = ?');
    params.push(type);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = Number(db.prepare(
    `SELECT COUNT(*) AS count FROM inventory_movements m
     JOIN variants v ON v.id = m.variant_id JOIN products p ON p.id = m.product_id
     ${whereSql}`
  ).get(...params).count);
  const movements = db.prepare(
    `SELECT m.*, p.name, p.slug, v.label, v.sku AS variant_sku, u.first_name AS admin_name
     FROM inventory_movements m
     JOIN variants v ON v.id = m.variant_id
     JOIN products p ON p.id = m.product_id
     LEFT JOIN users u ON u.id = m.created_by
     ${whereSql}
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT ? OFFSET ?`
  ).all(...params, limit, offset).map((row) => ({
    id: Number(row.id),
    variantId: Number(row.variant_id),
    productId: Number(row.product_id),
    name: row.name,
    slug: row.slug,
    label: row.label,
    sku: row.variant_sku,
    type: row.type,
    qtyChange: Number(row.qty_change),
    stockAfter: Number(row.stock_after),
    reference: row.reference,
    supplier: row.supplier,
    note: row.note,
    unitCostIdr: Number(row.unit_cost_idr),
    createdBy: row.admin_name || '',
    createdAt: row.created_at
  }));
  res.json({
    ok: true,
    movements,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit))
  });
});

router.post('/inventory/stock', (req, res, next) => {
  try {
    const db = dbOf(req);
    const variantId = Number(req.body?.variantId);
    const action = String(req.body?.action || 'receive');
    const supplier = cleanText(req.body?.supplier, 120);
    const note = cleanMultiline(req.body?.note, 300);
    const unitCostIdr = Math.max(0, Math.round(Number(req.body?.unitCostIdr) || 0));
    const recordExpense = Boolean(req.body?.recordExpense);
    if (!Number.isInteger(variantId) || variantId <= 0) {
      throw new AppError(422, 'Varian produk tidak valid.', 'validation');
    }
    const variant = db.prepare(
      `SELECT v.*, p.name, p.image_a FROM variants v JOIN products p ON p.id = v.product_id WHERE v.id = ?`
    ).get(variantId);
    if (!variant) throw new AppError(404, 'Varian produk tidak ditemukan.', 'not_found');
    let delta;
    let quantity = 0;
    if (action === 'receive') {
      quantity = Math.round(Number(req.body?.quantity));
      if (!Number.isFinite(quantity) || quantity < 1 || quantity > 100000) {
        throw new AppError(422, 'Jumlah stok masuk tidak valid.', 'validation');
      }
      delta = quantity;
    } else if (action === 'set') {
      const newStock = Math.round(Number(req.body?.quantity));
      if (!Number.isInteger(newStock) || newStock < 0 || newStock > 100000) {
        throw new AppError(422, 'Jumlah stok baru tidak valid.', 'validation');
      }
      delta = newStock - Number(variant.stock);
      if (delta === 0) throw new AppError(422, 'Stok baru sama dengan stok saat ini.', 'no_change');
    } else {
      throw new AppError(422, 'Aksi stok tidak valid.', 'validation');
    }
    if (recordExpense && action === 'receive' && (!unitCostIdr || unitCostIdr <= 0)) {
      throw new AppError(422, 'Isi biaya satuan untuk mencatat pengeluaran pembelian.', 'validation');
    }
    const now = new Date().toISOString();
    let financeAmount = 0;
    db.exec('BEGIN IMMEDIATE');
    try {
      const updated = db.prepare('UPDATE variants SET stock = stock + ? WHERE id = ?').run(delta, variantId);
      if (Number(updated.changes) !== 1) throw new AppError(500, 'Stok gagal diperbarui.', 'stock_update');
      const newStock = Number(db.prepare('SELECT stock FROM variants WHERE id = ?').get(variantId).stock);
      if (newStock < 0) throw new AppError(409, 'Stok tidak boleh negatif.', 'stock_negative');
      db.prepare(
        `INSERT INTO inventory_movements (
          variant_id, product_id, type, qty_change, stock_after, reference, supplier, note,
          unit_cost_idr, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        variantId,
        Number(variant.product_id),
        action === 'receive' ? 'in' : 'adjustment',
        delta,
        newStock,
        action === 'receive' ? 'Penerimaan stok' : 'Penyesuaian manual',
        supplier,
        note,
        unitCostIdr,
        Number(req.user.id),
        now
      );
      if (recordExpense && action === 'receive') {
        financeAmount = Math.max(0, Math.round(quantity * unitCostIdr));
        if (financeAmount > 0) {
          db.prepare(
            `INSERT INTO finance_entries (
              type, amount_idr, category, source, payment_method, description, note,
              entry_date, order_id, created_by, is_manual, created_at
            ) VALUES ('expense', ?, 'Pembelian Stok', ?, 'Transfer', ?, ?, ?, NULL, ?, 0, ?)`
          ).run(
            financeAmount,
            supplier || 'Supplier stok',
            `Pembelian ${variant.name} (${variant.label}) × ${quantity}`,
            note,
            dateOnly(),
            Number(req.user.id),
            now
          );
        }
      }
      db.prepare(
        `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail, created_at)
         VALUES (?, ?, 'variant', ?, ?, ?)`
      ).run(
        Number(req.user.id),
        action === 'receive' ? 'inventory.received' : 'inventory.adjusted',
        String(variantId),
        JSON.stringify({ delta, newStock, supplier, unitCostIdr, recordExpense, financeAmount }),
        now
      );
      db.exec('COMMIT');
      return res.json({ ok: true, variantId, newStock, delta, financeAmount });
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch (_) { /* noop */ }
      throw error;
    }
  } catch (error) {
    return next(error);
  }
});

function financeWhere(query) {
  const { from, to } = getRange(query);
  const where = ['f.entry_date BETWEEN ? AND ?'];
  const params = [from, to];
  const type = String(query.type || '');
  if (type === 'income' || type === 'expense') {
    where.push('f.type = ?');
    params.push(type);
  }
  const search = cleanText(query.search, 120);
  if (search) {
    const like = `%${search}%`;
    where.push('(f.description LIKE ? OR f.category LIKE ? OR f.source LIKE ? OR f.note LIKE ?)');
    params.push(like, like, like, like);
  }
  return { from, to, whereSql: where.join(' AND '), params };
}

router.get('/finance', (req, res) => {
  const db = dbOf(req);
  const { page, limit, offset } = pagination(req.query, { defaultLimit: 25, maxLimit: 100 });
  const { from, to, whereSql, params } = financeWhere(req.query);
  const summaryRows = db.prepare(
    `SELECT type, COALESCE(SUM(amount_idr), 0) AS total
     FROM finance_entries f WHERE ${whereSql} GROUP BY type`
  ).all(...params);
  const income = Number(summaryRows.find((row) => row.type === 'income')?.total || 0);
  const expense = Number(summaryRows.find((row) => row.type === 'expense')?.total || 0);
  const total = Number(db.prepare(`SELECT COUNT(*) AS count FROM finance_entries f WHERE ${whereSql}`).get(...params).count);
  const entries = db.prepare(
    `SELECT f.*, o.order_number
     FROM finance_entries f LEFT JOIN orders o ON o.id = f.order_id
     WHERE ${whereSql}
     ORDER BY f.entry_date DESC, f.id DESC
     LIMIT ? OFFSET ?`
  ).all(...params, limit, offset).map((row) => ({
    id: Number(row.id),
    type: row.type,
    amountIdr: Number(row.amount_idr),
    category: row.category,
    source: row.source,
    paymentMethod: row.payment_method,
    description: row.description,
    note: row.note,
    entryDate: row.entry_date,
    orderId: row.order_id ? Number(row.order_id) : null,
    orderNumber: row.order_number || '',
    isManual: Boolean(row.is_manual),
    createdAt: row.created_at
  }));
  const byCategory = db.prepare(
    `SELECT type, category, COALESCE(SUM(amount_idr), 0) AS total
     FROM finance_entries f WHERE ${whereSql}
     GROUP BY type, category ORDER BY total DESC`
  ).all(...params).map((row) => ({ type: row.type, category: row.category, total: Number(row.total) }));
  const categories = db.prepare('SELECT DISTINCT category FROM finance_entries ORDER BY category ASC').all().map((row) => row.category);
  res.json({
    ok: true,
    period: { from, to },
    summary: { income, expense, net: income - expense },
    entries,
    byCategory,
    categories,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit))
  });
});

router.post('/finance', (req, res, next) => {
  try {
    const db = dbOf(req);
    const type = String(req.body?.type || '');
    if (!['income', 'expense'].includes(type)) throw new AppError(422, 'Jenis transaksi tidak valid.', 'validation');
    const amountIdr = Math.round(Number(req.body?.amountIdr));
    if (!Number.isFinite(amountIdr) || amountIdr <= 0 || amountIdr > 100000000000) {
      throw new AppError(422, 'Nominal transaksi tidak valid.', 'validation');
    }
    const category = cleanText(req.body?.category, 80);
    if (!category) throw new AppError(422, 'Kategori wajib diisi.', 'validation');
    const description = cleanText(req.body?.description, 250);
    if (!description) throw new AppError(422, 'Deskripsi wajib diisi.', 'validation');
    const entryDate = isDateOnly(req.body?.entryDate) ? String(req.body.entryDate) : dateOnly();
    const source = cleanText(req.body?.source, 80);
    const paymentMethod = cleanText(req.body?.paymentMethod, 80);
    const note = cleanMultiline(req.body?.note, 500);
    const now = new Date().toISOString();
    const result = db.prepare(
      `INSERT INTO finance_entries (
        type, amount_idr, category, source, payment_method, description, note,
        entry_date, order_id, created_by, is_manual, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 1, ?)`
    ).run(type, amountIdr, category, source, paymentMethod, description, note, entryDate, Number(req.user.id), now);
    db.prepare(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail, created_at)
       VALUES (?, 'finance.created', 'finance', ?, ?, ?)`
    ).run(Number(req.user.id), String(result.lastInsertRowid), JSON.stringify({ type, amountIdr, category }), now);
    res.status(201).json({ ok: true, id: Number(result.lastInsertRowid) });
  } catch (error) {
    next(error);
  }
});

router.put('/finance/:id', (req, res, next) => {
  try {
    const db = dbOf(req);
    const entry = db.prepare('SELECT * FROM finance_entries WHERE id = ?').get(Number(req.params.id));
    if (!entry) throw new AppError(404, 'Transaksi tidak ditemukan.', 'not_found');
    if (!entry.is_manual || entry.order_id) throw new AppError(409, 'Transaksi otomatis terkait pesanan tidak dapat diedit.', 'locked');
    const type = String(req.body?.type || '');
    if (!['income', 'expense'].includes(type)) throw new AppError(422, 'Jenis transaksi tidak valid.', 'validation');
    const amountIdr = Math.round(Number(req.body?.amountIdr));
    if (!Number.isFinite(amountIdr) || amountIdr <= 0 || amountIdr > 100000000000) {
      throw new AppError(422, 'Nominal transaksi tidak valid.', 'validation');
    }
    const category = cleanText(req.body?.category, 80);
    const description = cleanText(req.body?.description, 250);
    if (!category || !description) throw new AppError(422, 'Kategori dan deskripsi wajib diisi.', 'validation');
    const entryDate = isDateOnly(req.body?.entryDate) ? String(req.body.entryDate) : entry.entry_date;
    db.prepare(
      `UPDATE finance_entries SET type = ?, amount_idr = ?, category = ?, source = ?,
       payment_method = ?, description = ?, note = ?, entry_date = ? WHERE id = ?`
    ).run(
      type,
      amountIdr,
      category,
      cleanText(req.body?.source, 80),
      cleanText(req.body?.paymentMethod, 80),
      description,
      cleanMultiline(req.body?.note, 500),
      entryDate,
      entry.id
    );
    db.prepare(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail, created_at)
       VALUES (?, 'finance.updated', 'finance', ?, ?, ?)`
    ).run(Number(req.user.id), String(entry.id), JSON.stringify({ type, amountIdr, category }), new Date().toISOString());
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/finance/:id', (req, res, next) => {
  try {
    const db = dbOf(req);
    const entry = db.prepare('SELECT * FROM finance_entries WHERE id = ?').get(Number(req.params.id));
    if (!entry) throw new AppError(404, 'Transaksi tidak ditemukan.', 'not_found');
    if (!entry.is_manual || entry.order_id) throw new AppError(409, 'Transaksi otomatis terkait pesanan tidak dapat dihapus.', 'locked');
    db.prepare('DELETE FROM finance_entries WHERE id = ?').run(entry.id);
    db.prepare(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail, created_at)
       VALUES (?, 'finance.deleted', 'finance', ?, ?, ?)`
    ).run(Number(req.user.id), String(entry.id), JSON.stringify({ amountIdr: Number(entry.amount_idr), category: entry.category }), new Date().toISOString());
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get('/finance/export', (req, res) => {
  const db = dbOf(req);
  const { from, to } = getRange(req.query);
  const where = ['f.entry_date BETWEEN ? AND ?'];
  const params = [from, to];
  const type = String(req.query.type || '');
  if (type === 'income' || type === 'expense') { where.push('f.type = ?'); params.push(type); }
  const search = cleanText(req.query.search, 120);
  if (search) {
    const like = `%${search}%`;
    where.push('(f.description LIKE ? OR f.category LIKE ? OR f.source LIKE ? OR f.note LIKE ?)');
    params.push(like, like, like, like);
  }
  const rows = db.prepare(
    `SELECT f.*, o.order_number FROM finance_entries f
     LEFT JOIN orders o ON o.id = f.order_id
     WHERE ${where.join(' AND ')}
     ORDER BY f.entry_date ASC, f.id ASC LIMIT 20000`
  ).all(...params);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="starfall-finance-${from}-${to}.csv"`);
  res.write('\ufeff');
  res.write(csvRow(['ID', 'Tanggal', 'Jenis', 'Nominal IDR', 'Kategori', 'Sumber', 'Metode', 'Deskripsi', 'Catatan', 'Pesanan', 'Manual']));
  for (const row of rows) {
    res.write(csvRow([
      row.id,
      row.entry_date,
      row.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      row.amount_idr,
      row.category,
      row.source,
      row.payment_method,
      row.description,
      row.note,
      row.order_number || '',
      row.is_manual ? 'Ya' : 'Tidak'
    ]));
  }
  res.end();
});

router.get('/social', (req, res) => {
  const db = dbOf(req);
  const links = db.prepare('SELECT * FROM social_links ORDER BY platform ASC').all().map((row) => ({
    platform: row.platform,
    label: row.label,
    url: row.url,
    active: Boolean(row.active),
    updatedAt: row.updated_at
  }));
  const clicks = db.prepare(
    `SELECT platform, COUNT(*) AS count
     FROM social_clicks WHERE clicked_at >= ? GROUP BY platform`
  ).all(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()).map((row) => ({
    platform: row.platform,
    count: Number(row.count)
  }));
  const totalClicks = Number(db.prepare('SELECT COUNT(*) AS count FROM social_clicks').get().count);
  const recentClicks = db.prepare(
    `SELECT c.*, u.email FROM social_clicks c LEFT JOIN users u ON u.id = c.user_id
     ORDER BY c.clicked_at DESC LIMIT 30`
  ).all().map((row) => ({
    id: Number(row.id),
    platform: row.platform,
    clickedAt: row.clicked_at,
    referrer: row.referrer,
    path: row.path,
    user: row.email || ''
  }));
  const chartFrom = shiftDateOnly(dateOnly(), -13);
  const clickRows = db.prepare(
    `SELECT clicked_at, platform FROM social_clicks WHERE clicked_at >= ?`
  ).all(businessDayStart(chartFrom));
  const chartMap = new Map();
  for (const row of clickRows) {
    const day = dateOnly(new Date(row.clicked_at));
    if (!chartMap.has(day)) chartMap.set(day, {});
    chartMap.get(day)[row.platform] = Number(chartMap.get(day)[row.platform] || 0) + 1;
  }
  const chart = [];
  for (let i = 0; i < 14; i += 1) {
    const day = shiftDateOnly(chartFrom, i);
    chart.push({ date: day, values: chartMap.get(day) || {} });
  }
  res.json({
    ok: true,
    links,
    clicks,
    totalClicks,
    recentClicks,
    chart,
    clickTrackingNote: 'Klik dicatat hanya saat pengunjung menekan tautan sosial. Tidak ada lalu lintas atau pembelian palsu.'
  });
});

router.put('/social', (req, res, next) => {
  try {
    const db = dbOf(req);
    const allowed = ['instagram', 'tiktok', 'shopee'];
    const input = req.body?.links;
    if (!input || typeof input !== 'object') throw new AppError(422, 'Data tautan sosial tidak valid.', 'validation');
    const now = new Date().toISOString();
    const updates = [];
    for (const platform of allowed) {
      if (!input[platform]) continue;
      const url = cleanText(input[platform].url, 500);
      const active = Boolean(input[platform].active);
      if (active && !isValidHttpUrl(url)) {
        throw new AppError(422, `URL ${platform} harus berupa tautan http(s) yang valid.`, 'validation');
      }
      if (url && !isValidHttpUrl(url)) {
        throw new AppError(422, `URL ${platform} tidak valid.`, 'validation');
      }
      updates.push({ platform, url, active: active ? 1 : 0 });
    }
    if (!updates.length) throw new AppError(422, 'Tidak ada tautan untuk disimpan.', 'validation');
    db.exec('BEGIN IMMEDIATE');
    try {
      const stmt = db.prepare('UPDATE social_links SET url = ?, active = ?, updated_at = ? WHERE platform = ?');
      for (const item of updates) stmt.run(item.url, item.active, now, item.platform);
      db.prepare(
        `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail, created_at)
         VALUES (?, 'social.updated', 'settings', 'social', ?, ?)`
      ).run(Number(req.user.id), JSON.stringify(updates), now);
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

router.get('/customers', (req, res) => {
  const db = dbOf(req);
  const { page, limit, offset } = pagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const search = cleanText(req.query.search, 120);
  const where = ["u.role = 'customer'"];
  const params = [];
  if (search) {
    const like = `%${search}%`;
    where.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
    params.push(like, like, like, like);
  }
  const whereSql = where.join(' AND ');
  const total = Number(db.prepare(`SELECT COUNT(*) AS count FROM users u WHERE ${whereSql}`).get(...params).count);
  const customers = db.prepare(
    `SELECT u.*,
       COUNT(o.id) AS order_count,
       COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN o.total_idr ELSE 0 END), 0) AS spend,
       MAX(o.created_at) AS last_order
     FROM users u LEFT JOIN orders o ON o.user_id = u.id
     WHERE ${whereSql}
     GROUP BY u.id
     ORDER BY u.created_at DESC
     LIMIT ? OFFSET ?`
  ).all(...params, limit, offset).map((row) => ({
    id: Number(row.id),
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    createdAt: row.created_at,
    orderCount: Number(row.order_count),
    spend: Number(row.spend),
    lastOrder: row.last_order
  }));
  const stats = db.prepare(
    `SELECT COUNT(*) AS total,
       COALESCE(SUM(CASE WHEN orders > 1 THEN 1 ELSE 0 END), 0) AS repeat
     FROM (SELECT u.id, COUNT(o.id) AS orders FROM users u LEFT JOIN orders o ON o.user_id = u.id AND o.status != 'cancelled' WHERE u.role = 'customer' GROUP BY u.id)`
  ).get();
  const subscribers = db.prepare('SELECT email, locale, created_at FROM newsletter_subscribers ORDER BY created_at DESC LIMIT 12').all();
  const subscriberCount = Number(db.prepare('SELECT COUNT(*) AS count FROM newsletter_subscribers').get().count);
  res.json({
    ok: true,
    customers,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    stats: {
      total: Number(stats.total),
      repeat: Number(stats.repeat),
      subscribers: subscriberCount
    },
    subscribers: subscribers.map((row) => ({ email: row.email, locale: row.locale, createdAt: row.created_at }))
  });
});

router.get('/settings', (req, res) => {
  const db = dbOf(req);
  const settings = getSettings(db);
  const data = {
    exchange_rate: settings.exchange_rate,
    brand_email: settings.brand_email,
    support_phone: settings.support_phone,
    announcement_en: settings.announcement_en,
    announcement_id: settings.announcement_id,
    promo_code: settings.promo_code,
    promo_percent: settings.promo_percent,
    low_stock_threshold: settings.low_stock_threshold,
    admin_setup_complete: settings.admin_setup_complete
  };
  const counts = db.prepare(
    `SELECT
       (SELECT COUNT(*) FROM products) AS products,
       (SELECT COUNT(*) FROM variants) AS variants,
       (SELECT COUNT(*) FROM orders) AS orders,
       (SELECT COUNT(*) FROM users WHERE role = 'admin') AS admins`
  ).get();
  res.json({
    ok: true,
    settings: data,
    counts: {
      products: Number(counts.products),
      variants: Number(counts.variants),
      orders: Number(counts.orders),
      admins: Number(counts.admins)
    },
    admin: {
      name: `${req.user.first_name} ${req.user.last_name}`.trim(),
      email: req.user.email
    }
  });
});

router.put('/settings', (req, res, next) => {
  try {
    const db = dbOf(req);
    const input = req.body || {};
    const rate = Number(input.exchange_rate);
    if (!Number.isFinite(rate) || rate < 1000 || rate > 100000) {
      throw new AppError(422, 'Nilai tukar harus antara 1.000 dan 100.000.', 'validation');
    }
    const email = normalizeEmail(input.brand_email);
    if (!isEmail(email)) throw new AppError(422, 'Email merek tidak valid.', 'validation');
    const promoCode = cleanText(input.promo_code, 30).toUpperCase();
    if (promoCode && !/^[A-Z0-9_-]{3,30}$/.test(promoCode)) {
      throw new AppError(422, 'Kode promo hanya boleh berisi huruf, angka, garis bawah, atau tanda hubung.', 'validation');
    }
    const promoPercent = Math.round(Number(input.promo_percent));
    if (!Number.isFinite(promoPercent) || promoPercent < 0 || promoPercent > 100) {
      throw new AppError(422, 'Persentase promo tidak valid.', 'validation');
    }
    const threshold = Math.round(Number(input.low_stock_threshold));
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1000) {
      throw new AppError(422, 'Ambang stok menipis tidak valid.', 'validation');
    }
    const settings = {
      exchange_rate: String(rate),
      brand_email: email,
      support_phone: cleanText(input.support_phone, 80),
      announcement_en: cleanText(input.announcement_en, 250),
      announcement_id: cleanText(input.announcement_id, 250),
      promo_code: promoCode,
      promo_percent: String(promoCode ? promoPercent : 0),
      low_stock_threshold: String(threshold)
    };
    const now = new Date().toISOString();
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const [key, value] of Object.entries(settings)) setSetting(db, key, value);
      db.prepare('UPDATE variants SET low_stock_threshold = ?').run(threshold);
      db.prepare(
        `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail, created_at)
         VALUES (?, 'settings.updated', 'settings', 'store', ?, ?)`
      ).run(Number(req.user.id), JSON.stringify(settings), now);
      db.exec('COMMIT');
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch (_) { /* noop */ }
      throw error;
    }
    req.app.set('settings', getSettings(db));
    return res.json({ ok: true, settings });
  } catch (error) {
    return next(error);
  }
});

router.post('/settings/password', (req, res, next) => {
  try {
    const db = dbOf(req);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.user.id));
    if (!user || !verifyPassword(String(req.body?.currentPassword || ''), user.password_hash)) {
      throw new AppError(422, 'Kata sandi saat ini salah.', 'invalid_password');
    }
    const password = String(req.body?.newPassword || '');
    if (password.length < 10) throw new AppError(422, 'Kata sandi baru minimal 10 karakter.', 'password');
    if (password !== String(req.body?.confirmPassword || '')) throw new AppError(422, 'Konfirmasi kata sandi tidak cocok.', 'password');
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(hashPassword(password), new Date().toISOString(), Number(req.user.id));
    const session = rotateSessionForUser(db, req, res, Number(req.user.id));
    db.prepare(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail, created_at)
       VALUES (?, 'admin.password_changed', 'user', ?, '', ?)`
    ).run(Number(req.user.id), String(req.user.id), new Date().toISOString());
    return res.json({ ok: true, csrfToken: session.csrfToken });
  } catch (error) {
    return next(error);
  }
});

router.get('/backup', (req, res, next) => {
  try {
    const db = dbOf(req);
    const dir = path.join(ROOT, 'data', 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `starfall-backup-${stamp}.sqlite`;
    const target = path.join(dir, filename);
    const escaped = target.replaceAll("'", "''");
    db.exec(`VACUUM INTO '${escaped}'`);
    db.prepare(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail, created_at)
       VALUES (?, 'database.backup', 'database', '', ?, ?)`
    ).run(Number(req.user.id), JSON.stringify({ filename }), new Date().toISOString());
    res.download(target, filename, (error) => {
      try { fs.unlinkSync(target); } catch (_) { /* noop */ }
      if (error && !res.headersSent) next(error);
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
