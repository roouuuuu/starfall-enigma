import { createClient } from "@libsql/client";
import { createRequire } from "node:module";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const { PRODUCTS } = require("../src/catalog.js");

// Next loads .env.local automatically; this script does not run through Next,
// so load it here without overriding variables that were set in the shell.
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || match[1].startsWith("#")) continue;
    let value = match[2].trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
}

loadEnv(".env.local");

const url = process.env.TURSO_DATABASE_URL ?? "file:data/starfall.sqlite";
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;
const reset = process.argv.includes("--reset");

const db = createClient({ url, authToken });

const schema = fs.readFileSync("src/schema.sql", "utf8").replace(/^PRAGMA .*$/gim, "");
await db.executeMultiple(schema);

const defaults = {
  exchange_rate: "16350",
  brand_email: "concierge@starfallenigma.com",
  support_phone: "+62 21 5000 1947",
  announcement_en: "Complimentary worldwide delivery · Duties included",
  announcement_id: "Pengiriman gratis ke seluruh dunia · Termasuk bea masuk",
  free_shipping_threshold: "0",
  promo_code: "STARFALL10",
  promo_percent: "10",
  low_stock_threshold: "3",
  admin_setup_complete: "0"
};
for (const [key, value] of Object.entries(defaults)) {
  await db.execute({
    sql: "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
    args: [key, value]
  });
}

const socialStamp = new Date().toISOString();
for (const [platform, href, label] of [
  ["instagram", "https://www.instagram.com/", "Instagram"],
  ["tiktok", "https://www.tiktok.com/", "TikTok"],
  ["shopee", "https://shopee.co.id/", "Shopee"]
]) {
  await db.execute({
    sql: `INSERT OR IGNORE INTO social_links (platform, url, label, active, updated_at)
          VALUES (?, ?, ?, 1, ?)`,
    args: [platform, href, label, socialStamp]
  });
}

const existing = await db.execute("SELECT COUNT(*) AS count FROM products");
const existingProducts = Number(existing.rows[0][0]);

if (existingProducts > 0 && !reset) {
  console.log(`Database already has ${existingProducts} products. Nothing changed.`);
  console.log("Use --reset to rebuild the catalogue before any order exists.");
  process.exit(0);
}

if (reset) {
  const orders = await db.execute("SELECT COUNT(*) AS count FROM orders");
  if (Number(orders.rows[0][0]) > 0) {
    console.error("Refusing to reset: orders already exist. Reset a fresh database instead.");
    process.exit(1);
  }
  await db.executeMultiple(`
    DELETE FROM order_items;
    DELETE FROM inventory_movements;
    DELETE FROM wishlists;
    DELETE FROM variants;
    DELETE FROM products;
  `);
}

// Same deterministic stock rule as scripts/seed.js so a Turso seed and a local
// seed produce identical variants and inventory.
function stockFor(slug, label, productIndex, variantIndex, variantTotal) {
  let hash = 2166136261;
  const input = `${slug}:${label}`;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const value = Math.abs(hash);
  if (variantTotal > 1 && variantIndex === 0 && (productIndex % 17 === 0 || productIndex % 29 === 0)) return 0;
  if (productIndex % 11 === 0) return 1 + (value % 3);
  return 4 + (value % 16);
}

const now = new Date().toISOString();
const tx = await db.transaction("write");
let productCount = 0;
let variantCount = 0;
let units = 0;

try {
  for (const [productIndex, product] of PRODUCTS.entries()) {
    const createdAt = new Date(Date.now() - productIndex * 36 * 60 * 60 * 1000).toISOString();
    const inserted = await tx.execute({
      sql: `INSERT INTO products (
        slug, sku, name, category, collection, price_usd_cents, material, finish,
        description_en, description_id, details_en, details_id, care_en, care_id,
        badge, featured, new_arrival, bestseller, image_a, image_b, art, published, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      args: [
        product.slug,
        product.sku,
        product.name,
        product.category,
        product.collection,
        product.priceCents,
        product.materialEn,
        product.finishEn,
        product.descriptionEn,
        product.descriptionId,
        JSON.stringify(product.detailsEn),
        JSON.stringify(product.detailsId),
        product.careEn,
        product.careId,
        product.badge ?? "",
        product.featured ? 1 : 0,
        product.newArrival ? 1 : 0,
        product.bestseller ? 1 : 0,
        product.imageA,
        product.imageB,
        product.art ?? "",
        createdAt
      ]
    });
    const productId = Number(inserted.lastInsertRowid);
    productCount += 1;

    for (const [variantIndex, variant] of product.variants.entries()) {
      const stock = stockFor(product.slug, variant.label, productIndex, variantIndex, product.variants.length);
      const variantRow = await tx.execute({
        sql: `INSERT INTO variants (product_id, sku, label, price_delta_cents, stock, low_stock_threshold)
              VALUES (?, ?, ?, ?, ?, 3)`,
        args: [productId, variant.sku, variant.label, variant.priceDeltaCents, stock]
      });
      units += stock;
      variantCount += 1;
      await tx.execute({
        sql: `INSERT INTO inventory_movements (
          variant_id, product_id, type, qty_change, stock_after, reference, supplier, note,
          unit_cost_idr, created_by, created_at
        ) VALUES (?, ?, 'opening', ?, ?, 'Stok awal', '', 'Seed inventaris awal', 0, NULL, ?)`,
        args: [Number(variantRow.lastInsertRowid), productId, stock, stock, now]
      });
    }
  }

  await tx.execute({
    sql: `INSERT INTO settings (key, value) VALUES ('catalog_seeded_at', ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    args: [now]
  });
  await tx.execute({
    sql: `INSERT INTO settings (key, value) VALUES ('catalog_product_count', ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    args: [String(productCount)]
  });

  await tx.commit();
} catch (error) {
  await tx.rollback();
  throw error;
}

console.log(`Seeded ${productCount} products, ${variantCount} variants and ${units} opening stock units.`);
console.log(`Target: ${url.startsWith("file:") ? url : "remote Turso database"}`);
console.log("Admin is not seeded. Run the admin /setup flow after deployment.");
