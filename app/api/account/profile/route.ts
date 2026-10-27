import { NextRequest, NextResponse } from "next/server";
import { run } from "@/lib/db";
import { getRequestContext } from "@/lib/context";
import { requireUserAndCsrf, type SiteUser } from "@/lib/auth";
import { AppError, handle } from "@/lib/http";
import { cleanText } from "@/lib/utils";

export const POST = handle(async (req: NextRequest) => {
  const user = await requireUserAndCsrf(req);
  const ctx = await getRequestContext(req);
  const body = await req.json().catch(() => ({}));

  const firstName = cleanText(body?.firstName, 80);
  const lastName = cleanText(body?.lastName, 80);
  const phone = cleanText(body?.phone, 40);
  if (!firstName) {
    throw new AppError(422, ctx.lang === "id" ? "Nama depan wajib diisi." : "First name is required.", "validation");
  }

  const now = new Date().toISOString();
  await run(
    "UPDATE users SET first_name = ?, last_name = ?, phone = ?, updated_at = ? WHERE id = ?",
    [firstName, lastName, phone, now, Number(user.id)]
  );
  await run(
    `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail, created_at)
     VALUES (?, 'account.profile_updated', 'user', ?, '', ?)`,
    [Number(user.id), String(user.id), now]
  );

  const updated: SiteUser = {
    ...user,
    first_name: firstName,
    last_name: lastName,
    phone
  };

  return NextResponse.json({
    ok: true,
    user: {
      id: Number(updated.id),
      email: updated.email,
      first_name: updated.first_name,
      last_name: updated.last_name,
      phone: updated.phone,
      role: updated.role,
      created_at: updated.created_at
    }
  });
});
