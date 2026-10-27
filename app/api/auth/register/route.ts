import { NextRequest, NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { getRequestContext } from "@/lib/context";
import { AppError, handle } from "@/lib/http";
import { applySessionCookie, mergeWishlist, requireCsrf, rotateSession, type SiteUser } from "@/lib/auth";
import { cleanText, hashPassword, isEmail, normalizeEmail, publicUser } from "@/lib/utils";

function validateAccountInput(body: Record<string, any>, lang: string) {
  const email = normalizeEmail(body.email);
  const firstName = cleanText(body.firstName, 80);
  const lastName = cleanText(body.lastName, 80);
  const password = String(body.password || "");
  const id = lang === "id";
  if (!firstName) throw new AppError(422, id ? "Masukkan nama depan Anda." : "Please enter your first name.", "first_name");
  if (!isEmail(email)) throw new AppError(422, id ? "Masukkan alamat email yang valid." : "Please enter a valid email address.", "email");
  if (password.length < 8) throw new AppError(422, id ? "Kata sandi minimal 8 karakter." : "Password must be at least 8 characters.", "password");
  if (password.length > 200) throw new AppError(422, id ? "Kata sandi terlalu panjang." : "Password is too long.", "password");
  if (body.confirmPassword !== undefined && password !== String(body.confirmPassword)) {
    throw new AppError(422, id ? "Konfirmasi kata sandi tidak cocok." : "Passwords do not match.", "confirm_password");
  }
  return { email, firstName, lastName, password };
}

export const POST = handle(async (req: NextRequest) => {
  await requireCsrf(req);
  const ctx = await getRequestContext(req);
  const body = await req.json().catch(() => ({}));
  const data = validateAccountInput(body, ctx.lang);

  const existing = await get("SELECT id FROM users WHERE email = ?", [data.email]);
  if (existing) {
    throw new AppError(409, ctx.lang === "id" ? "Akun dengan email ini sudah terdaftar." : "An account with this email already exists.", "email_taken");
  }

  const now = new Date().toISOString();
  const result = await run(
    `INSERT INTO users (email, password_hash, first_name, last_name, phone, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, '', 'customer', ?, ?)`,
    [data.email, hashPassword(data.password), data.firstName, data.lastName, now, now]
  );
  const userId = Number(result.lastInsertRowid);

  await mergeWishlist(userId, body?.wishlistProductIds);
  if (body?.subscribe) {
    await run(
      "INSERT OR IGNORE INTO newsletter_subscribers (email, locale, created_at) VALUES (?, ?, ?)",
      [data.email, String(body?.lang || ctx.lang) === "id" ? "id" : "en", now]
    );
  }

  const session = await rotateSession(req, userId);
  await run(
    `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail, created_at)
     VALUES (?, 'auth.register', 'user', ?, '', ?)`,
    [userId, String(userId), now]
  );

  const user = await get<SiteUser>("SELECT * FROM users WHERE id = ?", [userId]);
  const response = NextResponse.json({ ok: true, user: publicUser(user), redirect: "/account" }, { status: 201 });
  applySessionCookie(response, session.raw);
  return response;
});
