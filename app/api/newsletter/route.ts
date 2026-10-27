import { NextRequest, NextResponse } from "next/server";
import { run, nowIso } from "@/lib/db";
import { getRequestContext } from "@/lib/context";
import { AppError, handle } from "@/lib/http";
import { requireCsrf } from "@/lib/auth";
import { normalizeEmail, isEmail } from "@/lib/utils";

export const POST = handle(async (req: NextRequest) => {
  await requireCsrf(req);
  const ctx = await getRequestContext(req);
  const body = await req.json().catch(() => ({}));
  if (body?.company || body?.website) return NextResponse.json({ ok: true }); // honeypot
  const email = normalizeEmail(body?.email);
  if (!isEmail(email)) {
    throw new AppError(422, ctx.lang === "id" ? "Masukkan alamat email yang valid." : "Please enter a valid email address.", "email");
  }
  const locale = String(body?.lang || ctx.lang) === "id" ? "id" : "en";
  await run(
    "INSERT OR IGNORE INTO newsletter_subscribers (email, locale, created_at) VALUES (?, ?, ?)",
    [email, locale, nowIso()]
  );
  return NextResponse.json({ ok: true });
});
