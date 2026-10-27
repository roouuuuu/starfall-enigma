import { NextRequest, NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { getRequestContext } from "@/lib/context";
import { AppError, handle } from "@/lib/http";
import {
  applySessionCookie,
  getAdminBase,
  mergeWishlist,
  requireCsrf,
  rotateSession,
  type SiteUser
} from "@/lib/auth";
import { isEmail, normalizeEmail, publicUser, safeRedirect, verifyPassword } from "@/lib/utils";

export const POST = handle(async (req: NextRequest) => {
  await requireCsrf(req);
  const ctx = await getRequestContext(req);
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body?.email);
  const password = String(body?.password || "");

  if (!isEmail(email) || !password) {
    throw new AppError(401, ctx.lang === "id" ? "Email atau kata sandi salah." : "Email or password is incorrect.", "invalid_credentials");
  }

  const user = await get<SiteUser & { password_hash: string }>(
    "SELECT * FROM users WHERE email = ?",
    [email]
  );
  if (!user || !verifyPassword(password, user.password_hash)) {
    throw new AppError(401, ctx.lang === "id" ? "Email atau kata sandi salah." : "Email or password is incorrect.", "invalid_credentials");
  }

  const session = await rotateSession(req, Number(user.id));
  await mergeWishlist(Number(user.id), body?.wishlistProductIds);
  await run(
    `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail, created_at)
     VALUES (?, 'auth.login', 'user', ?, ?, ?)`,
    [Number(user.id), String(user.id), JSON.stringify({ area: "storefront" }), new Date().toISOString()]
  );

  const requestedNext = safeRedirect(body?.next, "");
  const adminBase = await getAdminBase();
  const redirect = user.role === "admin" && !requestedNext
    ? adminBase
    : requestedNext || "/account";

  const response = NextResponse.json({ ok: true, user: publicUser(user), redirect });
  applySessionCookie(response, session.raw);
  return response;
});
