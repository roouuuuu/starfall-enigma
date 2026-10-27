'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const {
  ROOT,
  createSeededDatabase,
  removeTempDir
} = require('./helpers');

const CATEGORY_COUNTS = {
  outerwear: 8,
  tailoring: 8,
  knitwear: 8,
  dresses: 8,
  tops: 8,
  trousers: 8,
  skirts: 8,
  denim: 8,
  loungewear: 8
};

let temp;
let db;

before(() => {
  temp = createSeededDatabase();
  db = new DatabaseSync(temp.dbPath, { readOnly: true });
});

after(() => {
  if (db) db.close();
  if (temp) removeTempDir(temp.dir);
});

test('seed contains the exact catalogue and stock variant counts', () => {
  const products = db.prepare('SELECT * FROM products ORDER BY id').all();
  const variants = db.prepare('SELECT * FROM variants ORDER BY id').all();
  assert.equal(products.length, 72);
  assert.equal(variants.length, 360);

  const counts = Object.fromEntries(
    db.prepare('SELECT category, COUNT(*) AS count FROM products GROUP BY category').all()
      .map((row) => [row.category, Number(row.count)])
  );
  assert.deepEqual(counts, CATEGORY_COUNTS);

  const admins = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get();
  assert.equal(Number(admins.count), 0, 'the production seed must not contain an administrator');
  const setup = db.prepare("SELECT value FROM settings WHERE key = 'admin_setup_complete'").get();
  assert.equal(setup.value, '0');
});

test('every product is complete and at least partly purchasable', () => {
  const products = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM variants v WHERE v.product_id = p.id) AS variant_count,
      (SELECT COALESCE(SUM(v.stock), 0) FROM variants v WHERE v.product_id = p.id) AS total_stock
    FROM products p ORDER BY p.id
  `).all();
  const forbiddenCopy = /lorem\s+ipsum|todo|placeholder text|coming soon/i;

  for (const product of products) {
    assert.ok(product.name.trim(), `product ${product.id} is missing a name`);
    assert.ok(product.slug.trim() && product.sku.trim(), `product ${product.id} is missing identifiers`);
    assert.ok(Number(product.price_usd_cents) > 0, `${product.slug} has an invalid price`);
    assert.ok(product.description_en.trim().length >= 40, `${product.slug} has a short EN description`);
    assert.ok(product.description_id.trim().length >= 40, `${product.slug} has a short ID description`);
    assert.notEqual(product.description_en, product.description_id, `${product.slug} needs distinct bilingual copy`);
    assert.ok(!forbiddenCopy.test(`${product.description_en} ${product.description_id}`), `${product.slug} contains placeholder copy`);

    const detailsEn = JSON.parse(product.details_en);
    const detailsId = JSON.parse(product.details_id);
    assert.ok(Array.isArray(detailsEn) && detailsEn.length >= 2, `${product.slug} needs EN detail bullets`);
    assert.ok(Array.isArray(detailsId) && detailsId.length >= 2, `${product.slug} needs ID detail bullets`);
    assert.ok(product.care_en.trim() && product.care_id.trim(), `${product.slug} is missing care copy`);
    assert.ok(Number(product.variant_count) >= 1, `${product.slug} has no variants`);
    assert.ok(Number(product.total_stock) > 0, `${product.slug} is entirely sold out`);
    assert.match(product.image_a, /^\/assets\/img\/products\/.+\.svg$/);
    assert.match(product.image_b, /^\/assets\/img\/products\/.+\.svg$/);
  }

  const invalidStocks = db.prepare(`
    SELECT id, sku, stock FROM variants
    WHERE typeof(stock) != 'integer' OR stock < 0
  `).all();
  assert.deepEqual(invalidStocks, []);
});

test('all 144 original SVG packshots exist and are self-contained', () => {
  const products = db.prepare('SELECT slug, image_a, image_b FROM products ORDER BY id').all();
  const references = products.flatMap((product) => [product.image_a, product.image_b]);
  assert.equal(references.length, 144);
  assert.equal(new Set(references).size, 144, 'each product needs two distinct packshots');

  const productDir = path.join(ROOT, 'public', 'assets', 'img', 'products');
  const files = fs.readdirSync(productDir).filter((file) => file.endsWith('.svg'));
  assert.equal(files.length, 144);

  for (const reference of references) {
    const filePath = path.join(ROOT, 'public', ...reference.split('/'));
    assert.ok(fs.existsSync(filePath), `missing packshot ${reference}`);
    const svg = fs.readFileSync(filePath, 'utf8');
    assert.ok(fs.statSync(filePath).size > 1000, `packshot ${reference} is suspiciously small`);
    assert.match(svg, /<svg[\s>]/, `packshot ${reference} is not SVG`);
    assert.match(svg, /<title[\s>]/, `packshot ${reference} has no accessible title`);
    assert.doesNotMatch(svg, /https?:\/\/(?!www\.w3\.org)/i, `packshot ${reference} loads a remote resource`);
  }
});

test('exactly 9 credited local editorial photographs are present', () => {
  const editorialDir = path.join(ROOT, 'public', 'assets', 'img', 'editorial');
  const photos = fs.readdirSync(editorialDir).filter((file) => /\.(jpg|jpeg)$/i.test(file));
  assert.equal(photos.length, 9);
  for (const photo of photos) {
    const filePath = path.join(editorialDir, photo);
    assert.ok(fs.statSync(filePath).size > 20_000, `editorial photo ${photo} is too small`);
  }

  const content = require('../src/content');
  assert.equal(content.CREDITS.en.photos.length, 9);
  assert.equal(content.CREDITS.id.photos.length, 9);
  const sources = content.CREDITS.en.photos.map(([, url]) => url);
  assert.equal(new Set(sources).size, 9);
  assert.ok(sources.every((url) => /^https:\/\/www\.pexels\.com\/photo\/\d+\/$/.test(url)));
});

test('local brand fonts and seed settings are ready for first run', () => {
  const fontsCss = fs.readFileSync(path.join(ROOT, 'public', 'assets', 'fonts', 'fonts.css'), 'utf8');
  for (const family of ['Cinzel', 'Cormorant Garamond', 'Jost']) {
    assert.match(fontsCss, new RegExp(family.replace(' ', '\\s*')), `${family} is not declared`);
  }
  const woffFiles = fs.readdirSync(path.join(ROOT, 'public', 'assets', 'fonts', 'files'))
    .filter((file) => file.endsWith('.woff2'));
  assert.ok(woffFiles.length >= 6);
  assert.doesNotMatch(fontsCss, /https?:\/\//i, 'font CSS must not depend on a remote font host');

  const settings = Object.fromEntries(
    db.prepare('SELECT key, value FROM settings').all().map((row) => [row.key, row.value])
  );
  assert.equal(settings.exchange_rate, '16350');
  assert.equal(settings.promo_code, 'STARFALL10');
  assert.equal(settings.promo_percent, '10');
  assert.ok(settings.brand_email.includes('@'));
  for (const [key, value] of Object.entries(settings)) {
    assert.equal(typeof value, 'string', `setting ${key} must be stored as text`);
  }
});
