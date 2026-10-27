import path from "node:path";
import { createClient, type InArgs, type Transaction } from "@libsql/client";

const g = globalThis as unknown as { __db?: ReturnType<typeof createClient> };

// Tests and local runs point DB_PATH at an isolated file, so it wins over the
// Turso URL from .env.local. Without DB_PATH, libSQL talks to Turso (or the
// default local file) with the exact same code path.
function resolveUrl() {
  const explicit = process.env.DB_PATH;
  if (explicit) {
    const absolute = path.resolve(process.env.STARFALL_ROOT || process.cwd(), explicit);
    return `file:${absolute.split(path.sep).join("/")}`;
  }
  return process.env.TURSO_DATABASE_URL ?? "file:data/starfall.sqlite";
}

export const client =
  g.__db ??
  (g.__db = createClient({
    url: resolveUrl(),
    authToken: process.env.TURSO_AUTH_TOKEN,
  }));

type Row = Record<string, any>;
export type Executor = {
  execute: (s: { sql: string; args?: InArgs }) => Promise<any>;
};

export const nowIso = () => new Date().toISOString();

export async function all<T = Row>(sql: string, args: InArgs = [], ex: Executor = client): Promise<T[]> {
  const rs = await ex.execute({ sql, args });
  return rs.rows.map((r: any) =>
    Object.fromEntries(rs.columns.map((c: string, i: number) => [c, r[i]]))
  ) as T[];
}

export async function get<T = Row>(sql: string, args: InArgs = [], ex: Executor = client): Promise<T | undefined> {
  return (await all<T>(sql, args, ex))[0];
}

export async function run(sql: string, args: InArgs = [], ex: Executor = client) {
  const rs = await ex.execute({ sql, args });
  return {
    changes: rs.rowsAffected as number,
    lastInsertRowid: rs.lastInsertRowid != null ? Number(rs.lastInsertRowid) : 0,
  };
}

export async function transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  const tx = await client.transaction("write");
  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (e) {
    await tx.rollback();
    throw e;
  } finally {
    tx.close();
  }
}

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await all<{ key: string; value: string }>("SELECT key, value FROM settings");
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function setSetting(key: string, value: unknown, ex: Executor = client) {
  await run(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, String(value)],
    ex
  );
}

export async function audit(
  userId: number | null,
  action: string,
  entity: string,
  entityId: string | number = "",
  detail = "",
  ex: Executor = client
) {
  await run(
    `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, action, entity, String(entityId), detail, nowIso()],
    ex
  );
}

export async function nextNumber(prefix: string, ex: Executor = client) {
  const row = await get<{ count: number }>("SELECT COUNT(*) AS count FROM orders", [], ex);
  const seq = String(Number(row?.count ?? 0) + 1).padStart(5, "0");
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${date}-${seq}${rnd}`;
}