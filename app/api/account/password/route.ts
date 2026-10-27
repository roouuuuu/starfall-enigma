import { NextRequest, NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { getRequestContext } from "@/lib/context";
import {
  applySessionCookie,
  requireUserAndCsrf,
  rotateSession,
  type SiteUser
} from "@/lib/auth";
import { AppError, handle } from "@/lib/http";
import { hashPassword, verifyPassword } from "@/lib/utils";

export const POST = handle(async (req: NextRequest) => {
  const user = await requireUserAndCsrf(req);
  const ctx = await getRequestContext(req);
  const body = await req.json().catch(() => ({}));

  const current = String(body?.currentPassword || "");
  const nextPassword = String(body?.newPassword || "");
  const confirm = String(body?.confirmPassword || "");
  const row = await get<SiteUser & { password_hash: string }>("SELECT * FROM users WHERE id = ?", [Number(user.id)]);

  if (!row || !verifyPassword(current, row.password_hash)) {
    throw new AppError(422, ctx.lang === "id" ? "Kata sandi saat ini salah." : "Current password is incorrect.", "invalid_password");
  }
  if (nextPassword.length < 8) {
    throw new AppError(422, ctx.lang === "id" ? "Kata sandi baru minimal 8 karakter." : "New password must be at least 8 characters.", "password");
  }
  if (nextPassword !== confirm) {
    throw new AppError(422, ctx.lang === "id" ? "Konfirmasi kata sandi tidak cocok." : "Passwords do not match.", "confirm_password");
  }

  await run(
    "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
    [hashPassword(nextPassword), new Date().toISOString(), Number(user.id)]
  );

  const session = await rotateSession(req, Number(user.id));
  const response = NextResponse.json({ ok: true, csrfToken: session.csrfToken });
  applySessionCookie(response, session.raw);
  return response;
});
