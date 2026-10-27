import { NextRequest, NextResponse } from "next/server";
import { get, run, transaction } from "@/lib/db";
import { requireUserAndCsrf } from "@/lib/auth";
import { AppError, handle } from "@/lib/http";

export const DELETE = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireUserAndCsrf(req);
    const addressId = Number((await params).id);
    const userId = Number(user.id);

    const address = await get<{ id: number; is_default: number }>(
      "SELECT id, is_default FROM addresses WHERE id = ? AND user_id = ?",
      [addressId, userId]
    );
    if (!address) throw new AppError(404, "Alamat tidak ditemukan.", "not_found");

    await transaction(async (tx) => {
      await run("DELETE FROM addresses WHERE id = ?", [Number(address.id)], tx);
      if (address.is_default) {
        const nextAddress = await get<{ id: number }>(
          "SELECT id FROM addresses WHERE user_id = ? ORDER BY id DESC LIMIT 1",
          [userId],
          tx
        );
        if (nextAddress) {
          await run("UPDATE addresses SET is_default = 1 WHERE id = ?", [Number(nextAddress.id)], tx);
        }
      }
      await run(
        `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail, created_at)
         VALUES (?, 'account.address_deleted', 'address', ?, '', ?)`,
        [userId, String(address.id), new Date().toISOString()],
        tx
      );
    });

    return NextResponse.json({ ok: true });
  }
);
