'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const Database = require('libsql');

const { getDb, closeDb } = require('../../src/db');
const { dumpDatabase } = require('../../src/sql-dump');

const dir = process.argv[2];
if (!dir) throw new Error('usage: node sql-dump-roundtrip.js <temp-dir>');

const sourcePath = path.join(dir, 'source.sqlite');
const restorePath = path.join(dir, 'restore.sqlite');
const source = getDb(sourcePath);

source.prepare(
  `INSERT INTO settings (key, value) VALUES (?, ?)
   ON CONFLICT(key) DO UPDATE SET value = excluded.value`
).run('dump_test', "O'Reilly\nsecond line");

const dump = dumpDatabase(source);
assert.match(dump, /^PRAGMA foreign_keys=OFF;/);
assert.match(dump, /\nBEGIN TRANSACTION;\n/);
assert.match(dump, /O''Reilly/);

const restored = new Database(restorePath);
restored.exec(dump);

const value = restored.prepare('SELECT value FROM settings WHERE key = ?').get('dump_test');
assert.equal(value.value, "O'Reilly\nsecond line");

const tables = source
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
  .all()
  .map((row) => row.name);
assert.ok(tables.length > 0);
for (const table of tables) {
  const expected = source.prepare(`SELECT COUNT(*) AS count FROM "${table}"`).get().count;
  const actual = restored.prepare(`SELECT COUNT(*) AS count FROM "${table}"`).get().count;
  assert.equal(actual, expected, `row count for ${table}`);
}

restored.close();
closeDb();
console.log(JSON.stringify({ tables: tables.length, bytes: dump.length }));
