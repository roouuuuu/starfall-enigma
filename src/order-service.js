'use strict';

const {
  AppError,
  cleanText,
  cleanMultiline,
  isEmail,
  normalizeEmail,
  moneyIdr,
  dateOnly
} = require('./utils');
const { resolveCartItems } = require('./catalog-service');

const CHANNELS = {
  website: { label: 'Website', category: 'Penjualan Online', payment: 'Demo checkout' },
  instagram: { label: 'Instagram', category: 'Penjualan Instagram', payment: 'Transfer / e-wallet' },
  tiktok: { label: 'TikTok', category: 'Penjualan TikTok', payment: 'Transfer / e-wallet' },
  shopee: { label: 'Shopee', category: 'Penjualan Shopee', payment: 'Shopee' },
  offline: { label: 'Offline', category: 'Penjualan Offline', payment: 'Tunai / transfer' }
};

function createOrderNumber(db) {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const random = require('crypto').randomBytes(3).toString('hex').toUpperCase();
    const number = `SE-${date}-${random}`;
    const exists = db.prepare('SELECT 1 FROM orders WHERE order_number = ?').get(number);
    if (!exists) return number;
  }
  return `SE-${date}-${Date.now().toString(36).toUpperCase()}`;
}

function getPromo(settings, suppliedCode) {
  const code = cleanText(suppliedCode, 30).toUpperCase();
  if (!code) return { valid: false, discountCents: 0, code: '', percent: 0 };
  const expected = String(settings.promo_code || '').trim().toUpperCase();
  const percent = Number(settings.promo_percent || 0);
  const valid = Boolean(expected) && code === expected && percent > 0;
  return { valid, discountCents: 0, code: valid ? code : '', percent: valid ? Math.min(percent, 100) : 0 };
}

function calculateDiscount(subtotalCents, promo) {
  if (!promo.valid || !promo.percent) return 0;
  return Math.round(subtotalCents * (promo.percent / 100));
}

function validateWebsiteOrder(input) {
  const errors = {};
  const email = normalizeEmail(input?.email);
  if (!isEmail(email)) errors.email = 'Masukkan alamat email yang valid.';
  const firstName = cleanText(input?.firstName, 80);
  const lastName = cleanText(input?.lastName, 80);
  if (!firstName) errors.firstName = 'Nama depan wajib diisi.';
  const phone = cleanText(input?.phone, 40);
  if (phone.replace(/\D/g, '').length < 6) errors.phone = 'Nomor telepon belum valid.';
  const address1 = cleanText(input?.address1, 200);
  if (!address1) errors.address1 = 'Alamat wajib diisi.';
  const city = cleanText(input?.city, 100);
  if (!city) errors.city = 'Kota wajib diisi.';
  const postalCode = cleanText(input?.postalCode, 20);
  if (!postalCode) errors.postalCode = 'Kode pos wajib diisi.';
  const country = cleanText(input?.country, 80) || 'Indonesia';
  const region = cleanText(input?.region, 100);
  const items = Array.isArray(input?.items) ? input.items : [];
  if (!items.length) errors.items = 'Tas Anda kosong.';
  if (Object.keys(errors).length) {
    throw new AppError(422, Object.values(errors)[0], 'validation');
  }
  return {
    email,
    firstName,
    lastName,
    phone,
    address1,
    address2: cleanText(input?.address2, 200),
    city,
    region,
    postalCode,
    country,
    note: cleanMultiline(input?.note, 500),
    items,
    promoCode: cleanText(input?.promoCode, 30),
    currency: input?.currency === 'IDR' ? 'IDR' : 'USD'
  };
}

function insertFinance(db, {
  type,
  amountIdr,
  category,
  source = '',
  paymentMethod = '',
  description,
  note = '',
  entryDate,
  orderId = null,
  createdBy = null,
  isManual = 0
}) {
  if (!Number.isFinite(Number(amountIdr)) || Number(amountIdr) <= 0) return null;
  return db.prepare(
    `INSERT INTO finance_entries (
      type, amount_idr, category, source, payment_method, description, note,
      entry_date, order_id, created_by, is_manual, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    type,
    Math.round(Number(amountIdr)),
    category,
    source,
    paymentMethod,
    cleanText(description, 250),
    cleanText(note, 500),
    entryDate || dateOnly(),
    orderId,
    createdBy,
    isManual,
    new Date().toISOString()
  );
}

function createWebsiteOrder(db, { user = null, sessionHash = '', input = {}, settings = {} }) {
  const data = validateWebsiteOrder(input);
  const rate = Number(settings.exchange_rate || 0) || 16000;
  const promo = getPromo(settings, data.promoCode);
  if (data.promoCode && !promo.valid) {
    throw new AppError(400, 'Kode promo tidak valid.', 'promo_invalid');
  }

  const orderNumber = createOrderNumber(db);
  const createdBy = user?.role === 'admin' ? user.id : null;

  db.exec('BEGIN IMMEDIATE');
  try {
    const resolved = resolveCartItems(db, data.items);
    if (!resolved.items.length) throw new AppError(422, 'Tas Anda kosong.', 'cart_empty');
    if (resolved.items.some((item) => !item.available)) {
      throw new AppError(409, 'Satu atau beberapa karya tidak lagi tersedia dalam jumlah yang diminta.', 'stock');
    }
    const subtotal = resolved.items.reduce((sum, item) => sum + item.lineTotalCents, 0);
    const discount = calculateDiscount(subtotal, promo);
    const total = Math.max(0, subtotal - discount);
    const totalIdr = moneyIdr(total, rate);
    const now = new Date().toISOString();

    const orderInsert = db.prepare(
      `INSERT INTO orders (
        order_number, user_id, session_hash, email, first_name, last_name, phone,
        address1, address2, city, region, postal_code, country, channel, status,
        currency, exchange_rate, subtotal_usd_cents, discount_usd_cents, total_usd_cents,
        total_idr, promo_code, note, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'website', 'paid', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      orderNumber,
      user?.id || null,
      sessionHash || '',
      data.email,
      data.firstName,
      data.lastName,
      data.phone,
      data.address1,
      data.address2,
      data.city,
      data.region,
      data.postalCode,
      data.country,
      data.currency,
      rate,
      subtotal,
      discount,
      total,
      totalIdr,
      promo.code,
      data.note,
      createdBy,
      now,
      now
    );
    const orderId = Number(orderInsert.lastInsertRowid);

    const insertItem = db.prepare(
      `INSERT INTO order_items (
        order_id, product_id, variant_id, product_name, variant_label,
        unit_price_usd_cents, quantity, total_usd_cents
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const getStock = db.prepare('SELECT stock, product_id FROM variants WHERE id = ?');
    const decrement = db.prepare('UPDATE variants SET stock = stock - ? WHERE id = ? AND stock >= ?');
    const insertMovement = db.prepare(
      `INSERT INTO inventory_movements (
        variant_id, product_id, type, qty_change, stock_after, reference, supplier, note,
        unit_cost_idr, created_by, created_at
      ) VALUES (?, ?, 'sale', ?, ?, ?, '', 'Pesanan online', 0, ?, ?)`
    );

    for (const item of resolved.items) {
      insertItem.run(
        orderId,
        item.productId,
        item.variantId,
        item.name,
        item.label,
        item.priceCents,
        item.quantity,
        item.lineTotalCents
      );
      const stockRow = getStock.get(item.variantId);
      const changes = decrement.run(item.quantity, item.variantId, item.quantity);
      if (Number(changes.changes) !== 1) {
        throw new AppError(409, `Stok ${item.name} (${item.label}) tidak mencukupi.`, 'stock');
      }
      insertMovement.run(
        item.variantId,
        item.productId,
        -item.quantity,
        Number(stockRow.stock) - item.quantity,
        orderNumber,
        createdBy,
        now
      );
    }

    insertFinance(db, {
      type: 'income',
      amountIdr: totalIdr,
      category: CHANNELS.website.category,
      source: 'Website',
      paymentMethod: CHANNELS.website.payment,
      description: `Pesanan ${orderNumber} · ${data.firstName} ${data.lastName}`.trim(),
      note: data.promoCode ? `Promo ${promo.code}` : '',
      entryDate: dateOnly(),
      orderId,
      createdBy,
      isManual: 0
    });

    db.prepare(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail, created_at)
       VALUES (?, 'order.created', 'order', ?, ?, ?)`
    ).run(createdBy, String(orderId), JSON.stringify({ orderNumber, total, currency: data.currency }), now);

    db.exec('COMMIT');
    return {
      id: orderId,
      orderNumber,
      subtotalCents: subtotal,
      discountCents: discount,
      totalCents: total,
      totalIdr,
      currency: data.currency,
      exchangeRate: rate,
      promo: promo.valid ? promo.code : '',
      items: resolved.items,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      createdAt: now
    };
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch (_) { /* noop */ }
    throw error;
  }
}

function createManualOrder(db, { admin, input = {}, settings = {} }) {
  const channel = cleanText(input.channel, 30).toLowerCase();
  if (!CHANNELS[channel] || channel === 'website') {
    throw new AppError(422, 'Pilih kanal penjualan manual yang valid.', 'validation');
  }
  const rawItems = Array.isArray(input.items) ? input.items : [];
  if (!rawItems.length) throw new AppError(422, 'Tambahkan minimal satu produk.', 'validation');
  if (rawItems.length > 20) throw new AppError(422, 'Terlalu banyak baris dalam satu penjualan.', 'validation');
  const customerName = cleanText(input.customerName, 120) || 'Pelanggan manual';
  const customerEmail = normalizeEmail(input.customerEmail);
  if (customerEmail && !isEmail(customerEmail)) throw new AppError(422, 'Email pelanggan tidak valid.', 'validation');
  const note = cleanMultiline(input.note, 500);
  const rate = Number(settings.exchange_rate || 0) || 16000;
  const now = new Date().toISOString();
  const orderNumber = createOrderNumber(db);

  db.exec('BEGIN IMMEDIATE');
  try {
    const resolved = [];
    const getVariant = db.prepare(
      `SELECT v.id, v.product_id, v.label, v.stock, v.price_delta_cents,
         p.name, p.slug, p.price_usd_cents
       FROM variants v JOIN products p ON p.id = v.product_id
       WHERE v.id = ? AND p.published = 1`
    );
    for (const row of rawItems) {
      const variantId = Number(row.variantId);
      const quantity = Math.max(1, Math.min(20, Number.parseInt(row.quantity, 10) || 0));
      const variant = getVariant.get(variantId);
      if (!variant) throw new AppError(422, 'Produk manual tidak ditemukan.', 'validation');
      if (Number(variant.stock) < quantity) {
        throw new AppError(409, `Stok ${variant.name} (${variant.label}) tidak mencukupi.`, 'stock');
      }
      const retailIdr = moneyIdr(Number(variant.price_usd_cents) + Number(variant.price_delta_cents), rate);
      const suppliedPrice = row.unitPriceIdr === '' || row.unitPriceIdr == null
        ? retailIdr
        : Math.round(Number(row.unitPriceIdr));
      if (!Number.isFinite(suppliedPrice) || suppliedPrice < 0) {
        throw new AppError(422, 'Harga satuan manual tidak valid.', 'validation');
      }
      const unitPriceIdr = Math.max(0, suppliedPrice);
      resolved.push({
        variantId: Number(variant.id),
        productId: Number(variant.product_id),
        name: variant.name,
        slug: variant.slug,
        label: variant.label,
        quantity,
        stock: Number(variant.stock),
        unitPriceIdr,
        lineTotalIdr: unitPriceIdr * quantity,
        unitPriceUsdCents: Math.round((unitPriceIdr / rate) * 100),
        lineTotalUsdCents: Math.round(((unitPriceIdr * quantity) / rate) * 100)
      });
    }
    const subtotalIdr = resolved.reduce((sum, item) => sum + item.lineTotalIdr, 0);
    if (subtotalIdr <= 0) throw new AppError(422, 'Total penjualan harus lebih dari nol.', 'validation');
    const totalUsdCents = Math.round((subtotalIdr / rate) * 100);
    const [firstName, ...restName] = customerName.split(/\s+/);
    const lastName = restName.join(' ');
    const channelMeta = CHANNELS[channel];

    const result = db.prepare(
      `INSERT INTO orders (
        order_number, user_id, session_hash, email, first_name, last_name, phone,
        address1, address2, city, region, postal_code, country, channel, status,
        currency, exchange_rate, subtotal_usd_cents, discount_usd_cents, total_usd_cents,
        total_idr, promo_code, note, created_by, created_at, updated_at
      ) VALUES (?, NULL, '', ?, ?, ?, '', 'Penjualan manual', '', ?, '', '-', 'Indonesia', ?, 'completed',
        'IDR', ?, ?, 0, ?, ?, '', ?, ?, ?, ?)`
    ).run(
      orderNumber,
      customerEmail || 'manual@starfallenigma.local',
      firstName || 'Pelanggan',
      lastName,
      channelMeta.label,
      channel,
      rate,
      totalUsdCents,
      totalUsdCents,
      subtotalIdr,
      note,
      admin?.id || null,
      now,
      now
    );
    const orderId = Number(result.lastInsertRowid);
    const insertItem = db.prepare(
      `INSERT INTO order_items (
        order_id, product_id, variant_id, product_name, variant_label,
        unit_price_usd_cents, quantity, total_usd_cents
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const selectStock = db.prepare('SELECT stock FROM variants WHERE id = ?');
    const updateStock = db.prepare('UPDATE variants SET stock = stock - ? WHERE id = ? AND stock >= ?');
    const movement = db.prepare(
      `INSERT INTO inventory_movements (
        variant_id, product_id, type, qty_change, stock_after, reference, supplier, note,
        unit_cost_idr, created_by, created_at
      ) VALUES (?, ?, 'sale', ?, ?, ?, '', ?, 0, ?, ?)`
    );
    for (const item of resolved) {
      insertItem.run(
        orderId,
        item.productId,
        item.variantId,
        item.name,
        item.label,
        item.unitPriceUsdCents,
        item.quantity,
        item.lineTotalUsdCents
      );
      const stockRow = selectStock.get(item.variantId);
      const updated = updateStock.run(item.quantity, item.variantId, item.quantity);
      if (Number(updated.changes) !== 1) throw new AppError(409, 'Stok berubah selama transaksi. Coba lagi.', 'stock');
      movement.run(
        item.variantId,
        item.productId,
        -item.quantity,
        Number(stockRow.stock) - item.quantity,
        orderNumber,
        `Penjualan manual via ${channelMeta.label}`,
        admin?.id || null,
        now
      );
    }
    insertFinance(db, {
      type: 'income',
      amountIdr: subtotalIdr,
      category: channelMeta.category,
      source: channelMeta.label,
      paymentMethod: channelMeta.payment,
      description: `Penjualan ${orderNumber} · ${customerName}`,
      note,
      entryDate: dateOnly(),
      orderId,
      createdBy: admin?.id || null,
      isManual: 0
    });
    db.prepare(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail, created_at)
       VALUES (?, 'order.manual_created', 'order', ?, ?, ?)`
    ).run(admin?.id || null, String(orderId), JSON.stringify({ orderNumber, channel, totalIdr: subtotalIdr }), now);
    db.exec('COMMIT');
    return {
      id: orderId,
      orderNumber,
      channel,
      totalIdr: subtotalIdr,
      items: resolved,
      createdAt: now
    };
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch (_) { /* noop */ }
    throw error;
  }
}

function cancelOrder(db, { orderId, admin, reason = '' }) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(orderId));
  if (!order) throw new AppError(404, 'Pesanan tidak ditemukan.', 'not_found');
  if (order.status === 'cancelled') throw new AppError(409, 'Pesanan sudah dibatalkan.', 'already_cancelled');
  const items = db.prepare(
    `SELECT oi.*, v.stock AS current_stock
     FROM order_items oi JOIN variants v ON v.id = oi.variant_id
     WHERE oi.order_id = ?`
  ).all(Number(orderId));
  const now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    const updateStock = db.prepare('UPDATE variants SET stock = stock + ? WHERE id = ?');
    const selectStock = db.prepare('SELECT stock FROM variants WHERE id = ?');
    const movement = db.prepare(
      `INSERT INTO inventory_movements (
        variant_id, product_id, type, qty_change, stock_after, reference, supplier, note,
        unit_cost_idr, created_by, created_at
      ) VALUES (?, ?, 'return', ?, ?, ?, '', ?, 0, ?, ?)`
    );
    for (const item of items) {
      updateStock.run(Number(item.quantity), Number(item.variant_id));
      const stock = Number(selectStock.get(Number(item.variant_id)).stock);
      movement.run(
        Number(item.variant_id),
        Number(item.product_id),
        Number(item.quantity),
        stock,
        order.order_number,
        reason ? `Pembatalan: ${cleanText(reason, 300)}` : 'Pesanan dibatalkan',
        admin?.id || null,
        now
      );
    }
    db.prepare("UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ?").run(now, Number(orderId));
    if (Number(order.total_idr) > 0) {
      insertFinance(db, {
        type: 'expense',
        amountIdr: Number(order.total_idr),
        category: 'Pembatalan Pesanan',
        source: order.channel,
        paymentMethod: 'Reversal',
        description: `Pembatalan ${order.order_number} · ${order.first_name} ${order.last_name}`.trim(),
        note: reason ? cleanText(reason, 400) : 'Stok dikembalikan, pemasukan dibalik.',
        entryDate: dateOnly(),
        orderId: Number(orderId),
        createdBy: admin?.id || null,
        isManual: 0
      });
    }
    db.prepare(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail, created_at)
       VALUES (?, 'order.cancelled', 'order', ?, ?, ?)`
    ).run(admin?.id || null, String(orderId), JSON.stringify({ reason: cleanText(reason, 300) }), now);
    db.exec('COMMIT');
    return { orderId: Number(orderId), orderNumber: order.order_number, status: 'cancelled' };
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch (_) { /* noop */ }
    throw error;
  }
}

function updateOrderStatus(db, { orderId, status, admin }) {
  const allowed = ['paid', 'processing', 'shipped', 'completed', 'cancelled'];
  if (!allowed.includes(status)) throw new AppError(422, 'Status pesanan tidak valid.', 'validation');
  if (status === 'cancelled') return cancelOrder(db, { orderId, admin, reason: 'Dibatalkan dari dashboard' });
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(orderId));
  if (!order) throw new AppError(404, 'Pesanan tidak ditemukan.', 'not_found');
  if (order.status === 'cancelled') throw new AppError(409, 'Pesanan yang dibatalkan tidak dapat diubah.', 'cancelled');
  const now = new Date().toISOString();
  db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').run(status, now, Number(orderId));
  db.prepare(
    `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail, created_at)
     VALUES (?, 'order.status_changed', 'order', ?, ?, ?)`
  ).run(admin?.id || null, String(orderId), JSON.stringify({ from: order.status, to: status }), now);
  return { orderId: Number(orderId), status };
}

function getOrderByNumber(db, number) {
  return db.prepare('SELECT * FROM orders WHERE order_number = ?').get(String(number));
}

function getOrderItems(db, orderId) {
  return db.prepare(
    `SELECT oi.*, p.slug, p.image_a
     FROM order_items oi JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ?
     ORDER BY oi.id ASC`
  ).all(Number(orderId));
}

function serializeOrder(db, order) {
  return {
    id: Number(order.id),
    number: order.order_number,
    status: order.status,
    channel: order.channel,
    currency: order.currency,
    exchangeRate: Number(order.exchange_rate),
    email: order.email,
    firstName: order.first_name,
    lastName: order.last_name,
    phone: order.phone,
    address1: order.address1,
    address2: order.address2,
    city: order.city,
    region: order.region,
    postalCode: order.postal_code,
    country: order.country,
    subtotalUsdCents: Number(order.subtotal_usd_cents),
    discountUsdCents: Number(order.discount_usd_cents),
    totalUsdCents: Number(order.total_usd_cents),
    totalIdr: Number(order.total_idr),
    promoCode: order.promo_code,
    note: order.note,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    items: getOrderItems(db, order.id).map((item) => ({
      id: Number(item.id),
      productId: Number(item.product_id),
      variantId: Number(item.variant_id),
      name: item.product_name,
      label: item.variant_label,
      slug: item.slug,
      image: item.image_a,
      unitPriceUsdCents: Number(item.unit_price_usd_cents),
      quantity: Number(item.quantity),
      totalUsdCents: Number(item.total_usd_cents)
    }))
  };
}

module.exports = {
  CHANNELS,
  getPromo,
  calculateDiscount,
  createWebsiteOrder,
  createManualOrder,
  cancelOrder,
  updateOrderStatus,
  getOrderByNumber,
  getOrderItems,
  serializeOrder
};
