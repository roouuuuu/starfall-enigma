'use strict';

const {
  CATEGORY_LIST,
  COLLECTIONS,
  MATERIALS,
  FINISHES
} = require('./catalog');
const { formatMoney, parseJson, clamp, pagination } = require('./utils');

const categoryById = Object.fromEntries(CATEGORY_LIST.map((category) => [category.id, category]));
const collectionById = Object.fromEntries(COLLECTIONS.map((collection) => [collection.id, collection]));
const materialById = Object.fromEntries(Object.entries(MATERIALS).map(([key, value]) => [value.en, { key, ...value }]));
const finishById = Object.fromEntries(Object.entries(FINISHES).map(([key, value]) => [value.en, { key, ...value }]));

function localizeCategory(id, lang) {
  const category = categoryById[id];
  if (!category) return id;
  return lang === 'id' ? category.label_id : category.label_en;
}

function localizeCollection(id, lang) {
  const collection = collectionById[id];
  return collection ? collection.label : id;
}

function localizeMaterial(value, lang) {
  const material = materialById[value];
  if (!material) return value;
  return lang === 'id' ? material.id : material.en;
}

function localizeFinish(value, lang) {
  const finish = finishById[value];
  if (!finish) return value;
  return lang === 'id' ? finish.id : finish.en;
}

function badgeLabel(badge, lang) {
  if (badge === 'new') return lang === 'id' ? 'Baru' : 'New';
  if (badge === 'bestseller') return lang === 'id' ? 'Terlaris' : 'Bestseller';
  return '';
}

function getVariants(db, productIds) {
  if (!productIds.length) return new Map();
  const placeholders = productIds.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT id, product_id, sku, label, price_delta_cents, stock, low_stock_threshold
     FROM variants
     WHERE product_id IN (${placeholders})
     ORDER BY product_id ASC, id ASC`
  ).all(...productIds);
  const map = new Map();
  for (const row of rows) {
    if (!map.has(Number(row.product_id))) map.set(Number(row.product_id), []);
    map.get(Number(row.product_id)).push(row);
  }
  return map;
}

function toVariant(row, basePriceCents) {
  return {
    id: Number(row.id),
    sku: row.sku,
    label: row.label,
    priceCents: Number(basePriceCents) + Number(row.price_delta_cents),
    priceDeltaCents: Number(row.price_delta_cents),
    stock: Number(row.stock),
    lowStockThreshold: Number(row.low_stock_threshold),
    available: Number(row.stock) > 0
  };
}

function toProductCard(row, variants, lang = 'en') {
  const mapped = (variants || []).map((variant) => toVariant(variant, row.min_price ?? row.price_usd_cents));
  const available = mapped.filter((variant) => variant.available);
  const totalStock = mapped.reduce((sum, variant) => sum + variant.stock, 0);
  const minVariantPrice = mapped.length
    ? Math.min(...mapped.map((variant) => Number(row.price_usd_cents) + variant.priceDeltaCents))
    : Number(row.price_usd_cents);
  const maxVariantPrice = mapped.length
    ? Math.max(...mapped.map((variant) => Number(row.price_usd_cents) + variant.priceDeltaCents))
    : Number(row.price_usd_cents);
  const firstAvailable = available.find((variant) => variant.stock > 0) || mapped[0] || null;
  return {
    id: Number(row.id),
    slug: row.slug,
    name: row.name,
    category: row.category,
    categoryLabel: localizeCategory(row.category, lang),
    collection: row.collection,
    collectionLabel: localizeCollection(row.collection, lang),
    material: row.material,
    materialLabel: localizeMaterial(row.material, lang),
    finish: row.finish,
    finishLabel: localizeFinish(row.finish, lang),
    priceCents: minVariantPrice,
    maxPriceCents: maxVariantPrice,
    priceLabel: formatMoney(minVariantPrice, 'USD', 1),
    hasPriceRange: maxVariantPrice > minVariantPrice,
    imageA: row.image_a,
    imageB: row.image_b,
    badge: row.badge || '',
    badgeLabel: badgeLabel(row.badge, lang),
    featured: Boolean(row.featured),
    newArrival: Boolean(row.new_arrival),
    bestseller: Boolean(row.bestseller),
    totalStock,
    lowStock: totalStock > 0 && totalStock <= 8,
    soldOut: totalStock <= 0,
    variants: mapped,
    defaultVariant: firstAvailable,
    url: `/product/${row.slug}`
  };
}

function serializeProduct(row, variants, lang = 'en') {
  const card = toProductCard(row, variants, lang);
  return {
    ...card,
    description: lang === 'id' ? row.description_id : row.description_en,
    details: parseJson(lang === 'id' ? row.details_id : row.details_en, []),
    care: lang === 'id' ? row.care_id : row.care_en,
    sku: row.sku,
    categoryIntro: lang === 'id' ? categoryById[row.category]?.description_id : categoryById[row.category]?.description_en,
    createdAt: row.created_at
  };
}

function getProductBySlug(db, slug, lang = 'en') {
  const row = db.prepare('SELECT * FROM products WHERE slug = ? AND published = 1').get(String(slug));
  if (!row) return null;
  const variantMap = getVariants(db, [Number(row.id)]);
  const variants = variantMap.get(Number(row.id)) || [];
  const maxBase = row.price_usd_cents;
  return {
    row,
    product: serializeProduct(row, variants.map((variant) => ({ ...variant, price_base: maxBase })), lang)
  };
}

function getProductById(db, id, lang = 'en') {
  const row = db.prepare('SELECT * FROM products WHERE id = ? AND published = 1').get(Number(id));
  if (!row) return null;
  const variantMap = getVariants(db, [Number(row.id)]);
  return serializeProduct(row, variantMap.get(Number(row.id)) || [], lang);
}

function getRelatedProducts(db, product, lang = 'en', limit = 4) {
  const rows = db.prepare(
    `SELECT p.*,
       MIN(p.price_usd_cents + v.price_delta_cents) AS min_price,
       MAX(p.price_usd_cents + v.price_delta_cents) AS max_price,
       COALESCE(SUM(v.stock), 0) AS total_stock
     FROM products p
     LEFT JOIN variants v ON v.product_id = p.id
     WHERE p.published = 1 AND p.category = ? AND p.id != ?
     GROUP BY p.id
     ORDER BY p.featured DESC, p.created_at DESC
     LIMIT ?`
  ).all(product.category, product.id, limit);
  if (rows.length < limit) {
    const remaining = limit - rows.length;
    const excludeIds = [product.id, ...rows.map((row) => row.id)];
    const fill = db.prepare(
      `SELECT p.*,
         MIN(p.price_usd_cents + v.price_delta_cents) AS min_price,
         MAX(p.price_usd_cents + v.price_delta_cents) AS max_price,
         COALESCE(SUM(v.stock), 0) AS total_stock
       FROM products p
       LEFT JOIN variants v ON v.product_id = p.id
       WHERE p.published = 1 AND p.id NOT IN (${excludeIds.map(() => '?').join(',')})
       GROUP BY p.id
       ORDER BY p.featured DESC, p.created_at DESC
       LIMIT ?`
    ).all(...excludeIds, remaining);
    rows.push(...fill);
  }
  const variantMap = getVariants(db, rows.map((row) => Number(row.id)));
  return rows.map((row) => toProductCard(row, variantMap.get(Number(row.id)) || [], lang));
}

function getFeatured(db, lang = 'en', limit = 4, mode = 'featured') {
  let order = 'p.featured DESC, p.created_at DESC';
  let extra = '';
  if (mode === 'new') {
    order = 'p.new_arrival DESC, p.created_at DESC';
    extra = 'AND p.new_arrival = 1';
  } else if (mode === 'bestseller') {
    order = 'p.bestseller DESC, p.created_at DESC';
    extra = 'AND p.bestseller = 1';
  } else if (mode === 'featured') {
    extra = 'AND p.featured = 1';
  }
  let rows = db.prepare(
    `SELECT p.*,
       MIN(p.price_usd_cents + v.price_delta_cents) AS min_price,
       MAX(p.price_usd_cents + v.price_delta_cents) AS max_price,
       COALESCE(SUM(v.stock), 0) AS total_stock
     FROM products p
     LEFT JOIN variants v ON v.product_id = p.id
     WHERE p.published = 1 ${extra}
     GROUP BY p.id
     ORDER BY ${order}
     LIMIT ?`
  ).all(limit);
  if (rows.length < limit) {
    const exclude = rows.map((row) => row.id);
    const placeholders = exclude.length ? `AND p.id NOT IN (${exclude.map(() => '?').join(',')})` : '';
    const fillRows = db.prepare(
      `SELECT p.*,
         MIN(p.price_usd_cents + v.price_delta_cents) AS min_price,
         MAX(p.price_usd_cents + v.price_delta_cents) AS max_price,
         COALESCE(SUM(v.stock), 0) AS total_stock
       FROM products p
       LEFT JOIN variants v ON v.product_id = p.id
       WHERE p.published = 1 ${placeholders}
       GROUP BY p.id
       ORDER BY p.created_at ASC
       LIMIT ?`
    ).all(...exclude, limit - rows.length);
    rows = [...rows, ...fillRows];
  }
  const variantMap = getVariants(db, rows.map((row) => Number(row.id)));
  return rows.map((row) => toProductCard(row, variantMap.get(Number(row.id)) || [], lang));
}

function addInFilter(where, params, column, values) {
  if (!values.length) return;
  where.push(`${column} IN (${values.map(() => '?').join(',')})`);
  params.push(...values);
}

function listProducts(db, query = {}, lang = 'en') {
  const { page, limit, offset } = pagination(query, { defaultLimit: 12, maxLimit: 48 });
  const where = ['p.published = 1'];
  const params = [];
  const having = [];

  const categories = String(query.category || '').split(',').map((s) => s.trim()).filter(Boolean);
  const validCategories = categories.filter((category) => categoryById[category]);
  addInFilter(where, params, 'p.category', validCategories);

  const collections = String(query.collection || '').split(',').map((s) => s.trim()).filter(Boolean);
  const validCollections = collections.filter((collection) => collectionById[collection]);
  addInFilter(where, params, 'p.collection', validCollections);

  if (query.material && materialById[String(query.material)]) {
    where.push('p.material = ?');
    params.push(String(query.material));
  }

  if (query.search && String(query.search).trim()) {
    const term = `%${String(query.search).trim().slice(0, 100)}%`;
    where.push('(p.name LIKE ? OR p.description_en LIKE ? OR p.description_id LIKE ? OR p.category LIKE ? OR p.collection LIKE ? OR p.material LIKE ?)');
    params.push(term, term, term, term, term, term);
  }

  if (query.size && String(query.size).trim()) {
    where.push('EXISTS (SELECT 1 FROM variants sv WHERE sv.product_id = p.id AND sv.label = ? AND sv.stock > 0)');
    params.push(String(query.size).trim());
  }

  const priceCurrency = query.currency === 'IDR' ? 'IDR' : 'USD';
  const rate = Number(query.rate || 0) || 16000;
  const toCents = (value) => (priceCurrency === 'IDR'
    ? Math.round((Number(value) / rate) * 100)
    : Math.round(Number(value) * 100));
  const minPrice = Number(query.minPrice);
  const maxPrice = Number(query.maxPrice);
  if (Number.isFinite(minPrice) && minPrice > 0) {
    where.push('p.price_usd_cents >= ?');
    params.push(toCents(minPrice));
  }
  if (Number.isFinite(maxPrice) && maxPrice > 0) {
    where.push('p.price_usd_cents <= ?');
    params.push(toCents(maxPrice));
  }

  if (query.featured === '1') where.push('p.featured = 1');
  if (query.new === '1') where.push('p.new_arrival = 1');

  const availability = String(query.availability || '');
  if (availability === 'in') having.push('total_stock > 0');
  if (availability === 'out') having.push('total_stock = 0');
  if (availability === 'low') having.push('total_stock > 0 AND total_stock <= 8');

  let order = 'p.featured DESC, p.new_arrival DESC, p.created_at DESC';
  const sort = String(query.sort || 'featured');
  if (sort === 'newest') order = 'p.new_arrival DESC, p.created_at DESC';
  if (sort === 'price_asc') order = 'min_price ASC, p.name ASC';
  if (sort === 'price_desc') order = 'max_price DESC, p.name ASC';
  if (sort === 'name') order = 'p.name ASC';

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const havingSql = having.length ? `HAVING ${having.join(' AND ')}` : '';
  const base = `
    FROM products p
    LEFT JOIN variants v ON v.product_id = p.id
    ${whereSql}
    GROUP BY p.id
    ${havingSql}
  `;
  const total = Number(db.prepare(`SELECT COUNT(*) AS count FROM (SELECT p.id, COALESCE(SUM(v.stock), 0) AS total_stock ${base})`).get(...params).count);
  const rows = db.prepare(
    `SELECT p.*,
       MIN(p.price_usd_cents + v.price_delta_cents) AS min_price,
       MAX(p.price_usd_cents + v.price_delta_cents) AS max_price,
       COALESCE(SUM(v.stock), 0) AS total_stock,
       COUNT(v.id) AS variant_count
     ${base}
     ORDER BY ${order}
     LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  const variantMap = getVariants(db, rows.map((row) => Number(row.id)));
  const items = rows.map((row) => toProductCard(row, variantMap.get(Number(row.id)) || [], lang));

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    hasMore: page * limit < total
  };
}

function getFacets(db, lang = 'en') {
  const categoryRows = db.prepare(
    `SELECT category, COUNT(*) AS count FROM products WHERE published = 1 GROUP BY category`
  ).all();
  const collectionRows = db.prepare(
    `SELECT collection, COUNT(*) AS count FROM products WHERE published = 1 GROUP BY collection`
  ).all();
  const materialRows = db.prepare(
    `SELECT material, COUNT(*) AS count FROM products WHERE published = 1 GROUP BY material ORDER BY material`
  ).all();
  return {
    categories: categoryRows.map((row) => ({
      id: row.category,
      label: localizeCategory(row.category, lang),
      count: Number(row.count)
    })),
    collections: collectionRows.map((row) => ({
      id: row.collection,
      label: localizeCollection(row.collection, lang),
      count: Number(row.count)
    })),
    materials: materialRows.map((row) => ({
      value: row.material,
      label: localizeMaterial(row.material, lang),
      count: Number(row.count)
    }))
  };
}

function getShopMeta(categoryId = '', lang = 'en') {
  if (categoryId && categoryById[categoryId]) {
    const category = categoryById[categoryId];
    return {
      id: category.id,
      title: lang === 'id' ? category.label_id : category.label_en,
      intro: lang === 'id' ? category.description_id : category.description_en,
      image: category.image
    };
  }
  return {
    id: '',
    title: lang === 'id' ? 'Koleksi' : 'The Collection',
    intro: lang === 'id'
      ? 'Seluruh karya dalam arsip Starfall Enigma, dari tailoring terstruktur hingga sutra washed dan denim mentah.'
      : 'Every piece in the Starfall Enigma archive, from structured tailoring to washed silk and raw denim.',
    image: '/assets/img/editorial/model-03.jpg'
  };
}

function resolveCartItems(db, items) {
  if (!Array.isArray(items) || !items.length) return { items: [], subtotalCents: 0 };
  const clean = [];
  const seen = new Set();
  for (const raw of items.slice(0, 30)) {
    const variantId = Number(raw.variantId || raw.id);
    const quantity = clamp(Number.parseInt(raw.quantity, 10) || 0, 1, 10);
    if (!Number.isInteger(variantId) || variantId <= 0 || seen.has(variantId)) continue;
    seen.add(variantId);
    clean.push({ variantId, quantity });
  }
  if (!clean.length) return { items: [], subtotalCents: 0 };
  const placeholders = clean.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT v.id AS variant_id, v.label, v.stock, v.price_delta_cents, p.id AS product_id,
       p.slug, p.name, p.price_usd_cents, p.image_a, p.image_b, p.category, p.collection
     FROM variants v JOIN products p ON p.id = v.product_id
     WHERE v.id IN (${placeholders}) AND p.published = 1`
  ).all(...clean.map((row) => row.variantId));
  const byId = new Map(rows.map((row) => [Number(row.variant_id), row]));
  const result = [];
  for (const item of clean) {
    const row = byId.get(item.variantId);
    if (!row) continue;
    const priceCents = Number(row.price_usd_cents) + Number(row.price_delta_cents);
    result.push({
      variantId: Number(row.variant_id),
      productId: Number(row.product_id),
      slug: row.slug,
      name: row.name,
      label: row.label,
      priceCents,
      image: row.image_a,
      imageAlt: row.image_b,
      stock: Number(row.stock),
      quantity: item.quantity,
      lineTotalCents: priceCents * item.quantity,
      available: Number(row.stock) >= item.quantity,
      category: row.category,
      collection: row.collection
    });
  }
  return {
    items: result,
    subtotalCents: result.reduce((sum, item) => sum + item.lineTotalCents, 0)
  };
}

module.exports = {
  categoryById,
  collectionById,
  localizeCategory,
  localizeCollection,
  localizeMaterial,
  localizeFinish,
  badgeLabel,
  toProductCard,
  serializeProduct,
  getProductBySlug,
  getProductById,
  getRelatedProducts,
  getFeatured,
  listProducts,
  getFacets,
  getShopMeta,
  resolveCartItems,
  getVariants
};
