'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('libsql');

// process.cwd() keeps this module working when Next bundles it, because a
// bundled __dirname no longer points at the repository.
const ROOT = path.resolve(process.env.STARFALL_ROOT || process.cwd());
const DEFAULT_DB_PATH = path.join(ROOT, 'data', 'starfall.sqlite');
let instance = null;
let instanceKey = null;

function normalizeFileUrl(value) {
  const raw = String(value).slice('file:'.length);
  if (!raw) return DEFAULT_DB_PATH;
  if (path.isAbsolute(raw)) return raw;
  return path.resolve(ROOT, raw);
}

/**
 * DB_PATH always wins, which keeps tests and isolated demos on their own file.
 * Without it, a libsql:// URL (or any remote URL) selects Turso; a file: URL
 * or no URL at all selects the local SQLite file.
 */
function resolveTarget(dbPath = process.env.DB_PATH) {
  if (dbPath) {
    const target = path.resolve(ROOT, dbPath);
    return { kind: 'file', path: target, key: `file:${target}` };
  }

  const url = String(process.env.TURSO_DATABASE_URL || '').trim();
  if (url.startsWith('file:')) {
    const target = normalizeFileUrl(url);
    return { kind: 'file', path: target, key: `file:${target}` };
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
    return {
      kind: 'remote',
      url,
      authToken: process.env.TURSO_AUTH_TOKEN || undefined,
      key: `remote:${url}`
    };
  }

  return { kind: 'file', path: DEFAULT_DB_PATH, key: `file:${DEFAULT_DB_PATH}` };
}

function resolveDbPath(dbPath = process.env.DB_PATH) {
  return resolveTarget(dbPath).kind === 'file'
    ? resolveTarget(dbPath).path
    : DEFAULT_DB_PATH;
}

function nowIso() {
  return new Date().toISOString();
}

// libsql exposes a better-sqlite3-style API but adds an enumerable _metadata
// field to rows and rejects booleans. Normalise both so the Express admin and
// the existing JSON/CSV endpoints behave exactly like node:sqlite did.
function normalizeValue(value) {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function normalizeArgs(args) {
  if (
    args.length === 1 &&
    args[0] &&
    typeof args[0] === 'object' &&
    !Array.isArray(args[0]) &&
    !Buffer.isBuffer(args[0]) &&
    !(args[0] instanceof Date)
  ) {
    return [Object.fromEntries(Object.entries(args[0]).map(([key, value]) => [key, normalizeValue(value)]))];
  }
  return args.map(normalizeValue);
}

function cleanRow(row) {
  if (row && typeof row === 'object' && '_metadata' in row) delete row._metadata;
  return row;
}

function wrapDatabase(db, target) {
  const prepare = db.prepare.bind(db);
  db.prepare = (sql) => {
    const statement = prepare(sql);
    const get = statement.get.bind(statement);
    const all = statement.all.bind(statement);
    const run = statement.run.bind(statement);

    statement.get = (...args) => cleanRow(get(...normalizeArgs(args)));
    statement.all = (...args) => all(...normalizeArgs(args)).map(cleanRow);
    statement.run = (...args) => {
      const result = run(...normalizeArgs(args));
      if (result && typeof result === 'object') {
        delete result.duration;
        delete result._metadata;
      }
      return result;
    };
    return statement;
  };

  Object.defineProperty(db, '__seRemote', { value: target.kind === 'remote' });
  return db;
}

function openDatabase(target) {
  if (target.kind === 'remote') {
    return wrapDatabase(
      new Database(target.url, { authToken: target.authToken }),
      target
    );
  }

  fs.mkdirSync(path.dirname(target.path), { recursive: true });
  const db = new Database(target.path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  return wrapDatabase(db, target);
}

function applySchema(db, target) {
  let schema = fs.readFileSync(path.join(ROOT, 'src', 'schema.sql'), 'utf8');
  if (target.kind === 'remote') {
    // Turso manages journaling and foreign keys; PRAGMA writes are local-only.
    schema = schema.replace(/^PRAGMA .*$/gim, '');
  }
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
  const target = resolveTarget(dbPath);
  if (!instance || instanceKey !== target.key) {
    if (instance) {
      try { instance.close(); } catch (_) { /* noop */ }
    }
    instance = openDatabase(target);
    instanceKey = target.key;
    applySchema(instance, target);
    seedDefaults(instance);
  }
  return instance;
}

function closeDb() {
  if (instance) {
    try { instance.close(); } catch (_) { /* noop */ }
  }
  instance = null;
  instanceKey = null;
}

function resetDb(dbPath) {
  const target = resolveTarget(dbPath);
  if (target.kind === 'remote') {
    throw new Error('Cannot reset a remote libSQL database from this script.');
  }
  closeDb();
  if (fs.existsSync(target.path)) fs.unlinkSync(target.path);
  for (const suffix of ['-wal', '-shm']) {
    const sidecar = target.path + suffix;
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
  if (db.__seRemote && typeof db.transaction === 'function') {
    return db.transaction(fn)();
  }
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

function isRemote(db) {
  return Boolean(db && db.__seRemote);
}

module.exports = {
  ROOT,
  getDb,
  closeDb,
  resetDb,
  getSettings,
  setSetting,
  transaction,
  audit,
  nowIso,
  nextNumber,
  resolveDbPath,
  resolveTarget,
  isRemote
};
