import { CATEGORY_LIST, COLLECTIONS, MATERIALS, FINISHES } from "@/src/catalog";
import { all, get, type Executor } from "@/lib/db";
import { clamp, formatMoney, pagination } from "@/lib/utils";

type Row = Record<string, any>;

const categoryById: Record<string, any> = Object.fromEntries(CATEGORY_LIST.map((category: any) => [category.id, category]));
const collectionById: Record<string, any> = Object.fromEntries(COLLECTIONS.map((collection: any) => [collection.id, collection]));
const materialById: Record<string, any> = Object.fromEntries(Object.entries(MATERIALS).map(([key, value]: [string, any]) => [value.en, { key, ...value }]));
const finishById: Record<string, any> = Object.fromEntries(Object.entries(FINISHES).map(([key, value]: [string, any]) => [value.en, { key, ...value }]));

function localizeCategory(id: string, lang: string) {
  const category = categoryById[id];
  if (!category) return id;
  return lang === "id" ? category.label_id : category.label_en;
}

function localizeCollection(id: string, lang: string) {
  const collection = collectionById[id];
  return collection ? collection.label : id;
}

function localizeMaterial(value: string, lang: string) {
  const material = materialById[value];
  if (!material) return value;
  return lang === "id" ? material.id : material.en;
}

function localizeFinish(value: string, lang: string) {
  const finish = finishById[value];
  if (!finish) return value;
  return lang === "id" ? finish.id : finish.en;
}

function badgeLabel(badge: string, lang: string) {
  if (badge === "new") return lang === "id" ? "Baru" : "New";
  if (badge === "bestseller") return lang === "id" ? "Terlaris" : "Bestseller";
  return "";
}

export async function getVariants(productIds: number[], ex?: Executor) {
  const map = new Map<number, Row[]>();
  if (!productIds.length) return map;
  const placeholders = productIds.map(() => "?").join(",");
  const rows = await all<Row>(
    `SELECT id, product_id, sku, label, price_delta_cents, stock, low_stock_threshold
     FROM variants
     WHERE product_id IN (${placeholders})
     ORDER BY product_id ASC, id ASC`,
    productIds,
    ex
  );
  for (const row of rows) {
    const id = Number(row.product_id);
    if (!map.has(id)) map.set(id, []);
    map.get(id)!.push(row);
  }
  return map;
}

function toVariant(row: Row, basePriceCents: number) {
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

export function toProductCard(row: Row, variants: Row[] | undefined, lang = "en") {
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
    priceLabel: formatMoney(minVariantPrice, "USD", 1),
    hasPriceRange: maxVariantPrice > minVariantPrice,
    imageA: row.image_a,
    imageB: row.image_b,
    badge: row.badge || "",
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

function addInFilter(where: string[], params: any[], column: string, values: string[]) {
  if (!values.length) return;
  where.push(`${column} IN (${values.map(() => "?").join(",")})`);
  params.push(...values);
}

export async function listProducts(query: Record<string, any> = {}, lang = "en", ex?: Executor) {
  const { page, limit, offset } = pagination(query, { defaultLimit: 12, maxLimit: 48 });
  const where = ["p.published = 1"];
  const params: any[] = [];
  const having: string[] = [];

  const categories = String(query.category || "").split(",").map((s) => s.trim()).filter(Boolean);
  addInFilter(where, params, "p.category", categories.filter((category) => categoryById[category]));

  const collections = String(query.collection || "").split(",").map((s) => s.trim()).filter(Boolean);
  addInFilter(where, params, "p.collection", collections.filter((collection) => collectionById[collection]));

  if (query.material && materialById[String(query.material)]) {
    where.push("p.material = ?");
    params.push(String(query.material));
  }

  if (query.search && String(query.search).trim()) {
    const term = `%${String(query.search).trim().slice(0, 100)}%`;
    where.push("(p.name LIKE ? OR p.description_en LIKE ? OR p.description_id LIKE ? OR p.category LIKE ? OR p.collection LIKE ? OR p.material LIKE ?)");
    params.push(term, term, term, term, term, term);
  }

  if (query.size && String(query.size).trim()) {
    where.push("EXISTS (SELECT 1 FROM variants sv WHERE sv.product_id = p.id AND sv.label = ? AND sv.stock > 0)");
    params.push(String(query.size).trim());
  }

  const priceCurrency = query.currency === "IDR" ? "IDR" : "USD";
  const rate = Number(query.rate || 0) || 16000;
  const toCents = (value: number) => (priceCurrency === "IDR"
    ? Math.round((Number(value) / rate) * 100)
    : Math.round(Number(value) * 100));
  const minPrice = Number(query.minPrice);
  const maxPrice = Number(query.maxPrice);
  if (Number.isFinite(minPrice) && minPrice > 0) {
    where.push("p.price_usd_cents >= ?");
    params.push(toCents(minPrice));
  }
  if (Number.isFinite(maxPrice) && maxPrice > 0) {
    where.push("p.price_usd_cents <= ?");
    params.push(toCents(maxPrice));
  }

  if (query.featured === "1") where.push("p.featured = 1");
  if (query.new === "1") where.push("p.new_arrival = 1");

  const availability = String(query.availability || "");
  if (availability === "in") having.push("total_stock > 0");
  if (availability === "out") having.push("total_stock = 0");
  if (availability === "low") having.push("total_stock > 0 AND total_stock <= 8");

  let order = "p.featured DESC, p.new_arrival DESC, p.created_at DESC";
  const sort = String(query.sort || "featured");
  if (sort === "newest") order = "p.new_arrival DESC, p.created_at DESC";
  if (sort === "price_asc") order = "min_price ASC, p.name ASC";
  if (sort === "price_desc") order = "max_price DESC, p.name ASC";
  if (sort === "name") order = "p.name ASC";

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const havingSql = having.length ? `HAVING ${having.join(" AND ")}` : "";
  const base = `
    FROM products p
    LEFT JOIN variants v ON v.product_id = p.id
    ${whereSql}
    GROUP BY p.id
    ${havingSql}
  `;

  const totalRow = await get<{ count: number }>(
    `SELECT COUNT(*) AS count FROM (SELECT p.id, COALESCE(SUM(v.stock), 0) AS total_stock ${base})`,
    params,
    ex
  );
  const total = Number(totalRow?.count ?? 0);

  const rows = await all<Row>(
    `SELECT p.*,
       MIN(p.price_usd_cents + v.price_delta_cents) AS min_price,
       MAX(p.price_usd_cents + v.price_delta_cents) AS max_price,
       COALESCE(SUM(v.stock), 0) AS total_stock,
       COUNT(v.id) AS variant_count
     ${base}
     ORDER BY ${order}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
    ex
  );

  const variantMap = await getVariants(rows.map((row) => Number(row.id)), ex);
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

export async function getFacets(lang = "en", ex?: Executor) {
  const categoryRows = await all<Row>(
    "SELECT category, COUNT(*) AS count FROM products WHERE published = 1 GROUP BY category",
    [],
    ex
  );
  const collectionRows = await all<Row>(
    "SELECT collection, COUNT(*) AS count FROM products WHERE published = 1 GROUP BY collection",
    [],
    ex
  );
  const materialRows = await all<Row>(
    "SELECT material, COUNT(*) AS count FROM products WHERE published = 1 GROUP BY material ORDER BY material",
    [],
    ex
  );
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

export async function resolveCartItems(items: any, ex?: Executor) {
  if (!Array.isArray(items) || !items.length) return { items: [], subtotalCents: 0 };
  const clean: Array<{ variantId: number; quantity: number }> = [];
  const seen = new Set<number>();
  for (const raw of items.slice(0, 30)) {
    const variantId = Number(raw.variantId || raw.id);
    const quantity = clamp(Number.parseInt(raw.quantity, 10) || 0, 1, 10);
    if (!Number.isInteger(variantId) || variantId <= 0 || seen.has(variantId)) continue;
    seen.add(variantId);
    clean.push({ variantId, quantity });
  }
  if (!clean.length) return { items: [], subtotalCents: 0 };

  const placeholders = clean.map(() => "?").join(",");
  const rows = await all<Row>(
    `SELECT v.id AS variant_id, v.label, v.stock, v.price_delta_cents, p.id AS product_id,
       p.slug, p.name, p.price_usd_cents, p.image_a, p.image_b, p.category, p.collection
     FROM variants v JOIN products p ON p.id = v.product_id
     WHERE v.id IN (${placeholders}) AND p.published = 1`,
    clean.map((row) => row.variantId),
    ex
  );
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
