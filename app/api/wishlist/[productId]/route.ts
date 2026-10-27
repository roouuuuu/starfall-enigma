import { NextRequest, NextResponse } from "next/server";
import { run } from "@/lib/db";
import { getRequestContext } from "@/lib/context";
import { requireAuth, requireCsrf } from "@/lib/auth";
import { handle } from "@/lib/http";
import { wishlistResponse } from "@/lib/wishlist-api";

export const DELETE = handle(
  async (req: NextRequest, { params }: { params: Promise<{ productId: string }> }) => {
    const user = await requireAuth(req);
    await requireCsrf(req);
    const ctx = await getRequestContext(req);
    const productId = Number((await params).productId);
    if (Number.isInteger(productId)) {
      await run("DELETE FROM wishlists WHERE user_id = ? AND product_id = ?", [Number(user.id), productId]);
    }
    return NextResponse.json({ ok: true, ...(await wishlistResponse(user.id, ctx.lang)) });
  }
);
