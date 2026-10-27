'use strict';

const { PRODUCTS } = require('../src/catalog');
const {
  getDb,
  resetDb,
  transaction,
  nowIso,
  setSetting
} = require('../src/db');

const reset = process.argv.includes('--reset');
const db = reset ? resetDb() : getDb();

const existing = db.prepare('SELECT COUNT(*) AS count FROM products').get();
if (existing.count > 0 && !reset) {
  console.log(`Database already seeded with ${existing.count} products. Use "npm run seed:reset" to rebuild.`);
  process.exit(0);
}

function stockFor(slug, label, productIndex, variantIndex, variantTotal) {
  let hash = 2166136261;
  const input = `${slug}:${label}`;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const value = Math.abs(hash);
  // Keep a few individual variants sold out, but never an entire product,
  // so every piece in the archive can still be purchased.
  if (variantTotal > 1 && variantIndex === 0 && (productIndex % 17 === 0 || productIndex % 29 === 0)) return 0;
  if (productIndex % 11 === 0) return 1 + (value % 3);
  return 4 + (value % 16);
}

const now = nowIso();
const insertProduct = db.prepare(`
  INSERT INTO products (
    slug, sku, name, category, collection, price_usd_cents, material, finish,
    description_en, description_id, details_en, details_id, care_en, care_id,
    badge, featured, new_arrival, bestseller, image_a, image_b, art, published, created_at
  ) VALUES (
    @slug, @sku, @name, @category, @collection, @price, @material, @finish,
    @description_en, @description_id, @details_en, @details_id, @care_en, @care_id,
    @badge, @featured, @new_arrival, @bestseller, @image_a, @image_b, @art, 1, @created_at
  )
`);
const insertVariant = db.prepare(`
  INSERT INTO variants (product_id, sku, label, price_delta_cents, stock, low_stock_threshold)
  VALUES (?, ?, ?, ?, ?, 3)
`);
const insertMovement = db.prepare(`
  INSERT INTO inventory_movements (
    variant_id, product_id, type, qty_change, stock_after, reference, supplier, note,
    unit_cost_idr, created_by, created_at
  ) VALUES (?, ?, 'opening', ?, ?, 'Stok awal', '', 'Seed inventaris awal', 0, NULL, ?)
`);

let productCount = 0;
let variantCount = 0;
let units = 0;

transaction(db, () => {
  const clear = reset ? false : true;
  if (!clear) {
    // A reset creates a brand-new DB, so there is nothing else to clear.
  }

  PRODUCTS.forEach((product, productIndex) => {
    const createdAt = new Date(Date.now() - productIndex * 36 * 60 * 60 * 1000).toISOString();
    const result = insertProduct.run({
      slug: product.slug,
      sku: product.sku,
      name: product.name,
      category: product.category,
      collection: product.collection,
      price: product.priceCents,
      material: product.materialEn,
      finish: product.finishEn,
      description_en: product.descriptionEn,
      description_id: product.descriptionId,
      details_en: JSON.stringify(product.detailsEn),
      details_id: JSON.stringify(product.detailsId),
      care_en: product.careEn,
      care_id: product.careId,
      badge: product.badge,
      featured: product.featured ? 1 : 0,
      new_arrival: product.newArrival,
      bestseller: product.bestseller,
      image_a: product.imageA,
      image_b: product.imageB,
      art: product.art,
      created_at: createdAt
    });
    const productId = Number(result.lastInsertRowid);
    productCount += 1;
    product.variants.forEach((variant, variantIndex) => {
      const stock = stockFor(product.slug, variant.label, productIndex, variantIndex, product.variants.length);
      const inserted = insertVariant.run(
        productId,
        variant.sku,
        variant.label,
        variant.priceDeltaCents,
        stock
      );
      units += stock;
      variantCount += 1;
      insertMovement.run(
        Number(inserted.lastInsertRowid),
        productId,
        stock,
        stock,
        now
      );
    });
  });

  setSetting(db, 'catalog_seeded_at', now);
  setSetting(db, 'catalog_product_count', String(productCount));
});

console.log(`Seeded ${productCount} products, ${variantCount} variants and ${units} opening stock units.`);
console.log('Admin is not seeded by default. Start the server and visit /setup to create the first admin.');
