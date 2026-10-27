'use strict';

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_DB_PATH = path.join(ROOT, 'data', 'starfall.sqlite');
let instance = null;
let instancePath = null;

function resolveDbPath(dbPath = process.env.DB_PATH) {
  return dbPath ? path.resolve(ROOT, dbPath) : DEFAULT_DB_PATH;
}

function nowIso() {
  return new Date().toISOString();
}

function openDatabase(dbPath) {
  const target = resolveDbPath(dbPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const db = new DatabaseSync(target);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  return db;
}

function applySchema(db) {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
}

function seedDefaults(db) {
  const stamp = nowIso();
  const defaults = {
    exchange_rate: '16350',
    brand_email: 'concierge@starfallenigma.com',
    support_phone: '+62 21 5000 1947',
    announcement_en: 'Complimentary worldwide delivery · Duties included',
    announcement_id: 'Pengiriman gratis ke seluruh dunia · Termasuk bea masuk',
    free_shipping_threshold: '0',
    promo_code: 'STARFALL10',
    promo_percent: '10',
    low_stock_threshold: '3',
    admin_setup_complete: '0'
  };

  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(defaults)) insertSetting.run(key, value);

  const insertSocial = db.prepare(
    `INSERT OR IGNORE INTO social_links (platform, url, label, active, updated_at)
     VALUES (?, ?, ?, 1, ?)`
  );
  insertSocial.run('instagram', 'https://www.instagram.com/', 'Instagram', stamp);
  insertSocial.run('tiktok', 'https://www.tiktok.com/', 'TikTok', stamp);
  insertSocial.run('shopee', 'https://shopee.co.id/', 'Shopee', stamp);
}

function getDb(dbPath) {
  const target = resolveDbPath(dbPath);
  if (!instance || instancePath !== target) {
    if (instance) {
      try { instance.close(); } catch (_) { /* noop */ }
    }
    instance = openDatabase(target);
    instancePath = target;
    applySchema(instance);
    seedDefaults(instance);
  }
  return instance;
}

function resetDb(dbPath) {
  const target = resolveDbPath(dbPath);
  if (instance) {
    try { instance.close(); } catch (_) { /* noop */ }
    instance = null;
    instancePath = null;
  }
  if (fs.existsSync(target)) fs.unlinkSync(target);
  for (const suffix of ['-wal', '-shm']) {
    const sidecar = target + suffix;
    if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
  }
  return getDb(dbPath);
}

function getSettings(db) {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

function setSetting(db, key, value) {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, String(value));
}

function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch (_) { /* noop */ }
    throw error;
  }
}

function audit(db, userId, action, entity, entityId, detail = '') {
  db.prepare(
    `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId || null, action, entity, String(entityId || ''), detail, nowIso());
}

function nextNumber(db, prefix) {
  const row = db.prepare('SELECT COUNT(*) AS count FROM orders').get();
  const sequence = String(Number(row.count) + 1).padStart(5, '0');
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${date}-${sequence}${random}`;
}

module.exports = {
  ROOT,
  getDb,
  resetDb,
  getSettings,
  setSetting,
  transaction,
  audit,
  nowIso,
  nextNumber,
  resolveDbPath
};
