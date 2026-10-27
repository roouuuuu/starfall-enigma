import { NextRequest, NextResponse } from "next/server";
import { all, get, run, transaction } from "@/lib/db";
import { getRequestContext } from "@/lib/context";
import { requireAuth, requireUserAndCsrf } from "@/lib/auth";
import { AppError, handle } from "@/lib/http";
import { cleanText } from "@/lib/utils";

export const GET = handle(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const addresses = await all(
    "SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC",
    [Number(user.id)]
  );
  return NextResponse.json({ ok: true, addresses });
});

export const POST = handle(async (req: NextRequest) => {
  const user = await requireUserAndCsrf(req);
  const ctx = await getRequestContext(req);
  const body = await req.json().catch(() => ({}));

  const countRow = await get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM addresses WHERE user_id = ?",
    [Number(user.id)]
  );
  const count = Number(countRow?.count ?? 0);
  if (count >= 20) {
    throw new AppError(422, ctx.lang === "id" ? "Batas alamat telah tercapai." : "You have reached the address limit.", "limit");
  }

  const address1 = cleanText(body?.address1, 200);
  const city = cleanText(body?.city, 100);
  const postalCode = cleanText(body?.postalCode, 20);
  if (!address1 || !city || !postalCode) {
    throw new AppError(422, ctx.lang === "id" ? "Alamat, kota, dan kode pos wajib diisi." : "Address, city and postal code are required.", "validation");
  }

  const firstName = cleanText(body?.firstName, 80) || user.first_name;
  const lastName = cleanText(body?.lastName, 80) || user.last_name || "";
  const label = cleanText(body?.label, 40) || "Rumah";
  const isDefault = body?.isDefault ? 1 : (count === 0 ? 1 : 0);
  const now = new Date().toISOString();
  const userId = Number(user.id);

  const addressId = await transaction(async (tx) => {
    if (isDefault) {
      await run("UPDATE addresses SET is_default = 0 WHERE user_id = ?", [userId], tx);
    }
    const result = await run(
      `INSERT INTO addresses (
        user_id, label, first_name, last_name, phone, address1, address2,
        city, region, postal_code, country, is_default, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        label,
        firstName,
        lastName,
        cleanText(body?.phone, 40) || user.phone || "",
        address1,
        cleanText(body?.address2, 200),
        city,
        cleanText(body?.region, 100),
        postalCode,
        cleanText(body?.country, 80) || "Indonesia",
        isDefault,
        now
      ],
      tx
    );
    const id = Number(result.lastInsertRowid);
    await run(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail, created_at)
       VALUES (?, 'account.address_added', 'address', ?, '', ?)`,
      [userId, String(id), now],
      tx
    );
    return id;
  });

  return NextResponse.json({ ok: true, addressId }, { status: 201 });
});
