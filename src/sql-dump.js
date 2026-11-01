'use strict';

function quoteIdent(name) {
  return `"${String(name).replaceAll('"', '""')}"`;
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Uint8Array) return `X'${Buffer.from(value).toString('hex')}'`;
  if (value instanceof ArrayBuffer) return `X'${Buffer.from(value).toString('hex')}'`;
  return `'${String(value).replaceAll("'", "''")}'`;
}

/**
 * Produce a portable SQL dump. Turso has no local file to VACUUM INTO, so a
 * remote admin backup uses this instead of the local .sqlite snapshot.
 */
function dumpDatabase(db) {
  const objects = db.prepare(
    `SELECT type, name, sql FROM sqlite_master
     WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
     ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'trigger' THEN 2 ELSE 3 END, name`
  ).all();
  const tables = objects.filter((object) => object.type === 'table').map((object) => object.name);
  const lines = ['PRAGMA foreign_keys=OFF;', 'BEGIN TRANSACTION;'];

  for (const object of objects) {
    lines.push(`${String(object.sql).trim()};`);
  }
  for (const table of tables) {
    const rows = db.prepare(`SELECT * FROM ${quoteIdent(table)}`).all();
    for (const row of rows) {
      const columns = Object.keys(row);
      lines.push(
        `INSERT INTO ${quoteIdent(table)} (${columns.map(quoteIdent).join(', ')}) ` +
        `VALUES (${columns.map((column) => sqlLiteral(row[column])).join(', ')});`
      );
    }
  }

  lines.push('COMMIT;');
  return `${lines.join('\n')}\n`;
}

module.exports = { dumpDatabase, quoteIdent, sqlLiteral };
