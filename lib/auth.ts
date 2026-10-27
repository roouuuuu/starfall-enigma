import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { all, get, run, nowIso } from "@/lib/db";
import { AppError } from "@/lib/http";
import { hashToken, token } from "@/lib/utils";

export const SESSION_COOKIE = "se_session";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const SECURE_COOKIE = process.env.COOKIE_SECURE === "1";

export type SiteUser = {
  id: number;
  email: string;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  role: string;
  created_at: string;
  password_hash?: string;
};

type SessionRow = {
  token_hash: string;
  user_id: number | null;
  csrf_token: string;
  created_at: string;
  expires_at: string;
};

export async function loadSession(req: NextRequest) {
  const raw = req.cookies.get(SESSION_COOKIE)?.value || "";
  if (!raw) return { session: null as SessionRow | null, user: null as SiteUser | null, raw: "" };

  const hash = hashToken(raw);
  const session = await get<SessionRow>("SELECT * FROM sessions WHERE token_hash = ?", [hash]);
  if (!session) return { session: null, user: null, raw: "" };

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await run("DELETE FROM sessions WHERE token_hash = ?", [session.token_hash]);
    return { session: null, user: null, raw: "" };
  }

  const user = session.user_id
    ? await get<SiteUser>("SELECT * FROM users WHERE id = ?", [Number(session.user_id)])
    : null;

  return { session, user: user || null, raw };
}

export async function requireAuth(req: NextRequest) {
  const { user } = await loadSession(req);
  if (!user) {
    throw new AppError(401, "Please sign in to continue.", "auth_required");
  }
  return user;
}

export async function requireCsrf(req: NextRequest) {
  const { session } = await loadSession(req);
  if (!session) {
    throw new AppError(419, "Your session expired. Refresh and try again.", "csrf");
  }
  const received = String(req.headers.get("x-csrf-token") || "");
  const expected = String(session.csrf_token || "");
  if (!received || received.length !== expected.length) {
    throw new AppError(419, "Invalid security token. Refresh and try again.", "csrf");
  }
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (!timingSafeEqual(a, b)) {
    throw new AppError(419, "Invalid security token. Refresh and try again.", "csrf");
  }
  return session;
}

// Auth + CSRF in one round trip for authenticated mutations.
export async function requireUserAndCsrf(req: NextRequest) {
  const { user } = await loadSession(req);
  if (!user) {
    throw new AppError(401, "Please sign in to continue.", "auth_required");
  }
  await requireCsrf(req);
  return user;
}

export async function createSession(userId: number | null) {
  const raw = token(32);
  const csrfToken = token(32);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
  const hash = hashToken(raw);
  await run(
    `INSERT INTO sessions (token_hash, user_id, csrf_token, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [hash, userId, csrfToken, now.toISOString(), expires.toISOString()]
  );
  return { raw, hash, csrfToken };
}

export async function rotateSession(req: NextRequest, userId: number) {
  const { session } = await loadSession(req);
  if (session) {
    await run("DELETE FROM sessions WHERE token_hash = ?", [session.token_hash]);
  }
  return createSession(userId);
}

export function applySessionCookie(response: NextResponse, raw: string, maxAge = SESSION_TTL_SECONDS) {
  response.cookies.set(SESSION_COOKIE, raw, {
    httpOnly: true,
    sameSite: "lax",
    secure: SECURE_COOKIE,
    path: "/",
    maxAge
  });
}

export async function mergeWishlist(userId: number, ids: unknown) {
  if (!Array.isArray(ids) || !ids.length) return;
  const cleanIds = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))].slice(0, 100);
  if (!cleanIds.length) return;
  const placeholders = cleanIds.map(() => "?").join(",");
  const existing = await all<{ id: number }>(
    `SELECT id FROM products WHERE id IN (${placeholders}) AND published = 1`,
    cleanIds
  );
  const now = nowIso();
  for (const row of existing) {
    await run(
      "INSERT OR IGNORE INTO wishlists (user_id, product_id, created_at) VALUES (?, ?, ?)",
      [userId, Number(row.id), now]
    );
  }
}

export async function getAdminBase() {
  const fromEnv = String(process.env.ADMIN_SLUG || "").trim().toLowerCase();
  if (fromEnv) return `/${fromEnv}`;
  const row = await get<{ value: string }>("SELECT value FROM settings WHERE key = 'admin_slug'");
  return row?.value ? `/${row.value}` : "/account";
}
