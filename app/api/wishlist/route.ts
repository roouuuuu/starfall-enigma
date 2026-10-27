import { NextRequest, NextResponse } from "next/server";
import { get, run, nowIso } from "@/lib/db";
import { getRequestContext } from "@/lib/context";
import { requireAuth, requireCsrf } from "@/lib/auth";
import { AppError, handle } from "@/lib/http";
import { wishlistResponse } from "@/lib/wishlist-api";

export const GET = handle(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const ctx = await getRequestContext(req);
  return NextResponse.json(
    { ok: true, ...(await wishlistResponse(user.id, ctx.lang)) },
    { headers: { "Cache-Control": "no-store" } }
  );
});

export const POST = handle(async (req: NextRequest) => {
  const user = await requireAuth(req);
  await requireCsrf(req);
  const ctx = await getRequestContext(req);
  const body = await req.json().catch(() => ({}));
  const productId = Number(body?.productId);
  if (!Number.isInteger(productId) || productId <= 0) throw new AppError(422, "Produk tidak valid.", "validation");
  const product = await get("SELECT id FROM products WHERE id = ? AND published = 1", [productId]);
  if (!product) throw new AppError(404, "Produk tidak ditemukan.", "not_found");
  await run(
    "INSERT OR IGNORE INTO wishlists (user_id, product_id, created_at) VALUES (?, ?, ?)",
    [Number(user.id), productId, nowIso()]
  );
  return NextResponse.json({ ok: true, ...(await wishlistResponse(user.id, ctx.lang)) });
});
