import { NextRequest, NextResponse } from "next/server";
import { get, run, transaction } from "@/lib/db";
import { requireUserAndCsrf } from "@/lib/auth";
import { AppError, handle } from "@/lib/http";

export const POST = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireUserAndCsrf(req);
    const addressId = Number((await params).id);
    const userId = Number(user.id);

    const address = await get("SELECT id FROM addresses WHERE id = ? AND user_id = ?", [addressId, userId]);
    if (!address) throw new AppError(404, "Alamat tidak ditemukan.", "not_found");

    await transaction(async (tx) => {
      await run("UPDATE addresses SET is_default = 0 WHERE user_id = ?", [userId], tx);
      await run("UPDATE addresses SET is_default = 1 WHERE id = ?", [addressId], tx);
    });

    return NextResponse.json({ ok: true });
  }
);
