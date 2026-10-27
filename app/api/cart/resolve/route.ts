import { NextRequest, NextResponse } from "next/server";
import { resolveCartItems } from "@/lib/catalog-service";
import { handle } from "@/lib/http";
import { requireCsrf } from "@/lib/auth";

export const POST = handle(async (req: NextRequest) => {
  await requireCsrf(req);
  const body = await req.json().catch(() => ({}));
  const result = await resolveCartItems(body?.items);
  return NextResponse.json({
    ok: true,
    items: result.items,
    subtotalCents: result.subtotalCents,
    count: result.items.reduce((sum, item) => sum + item.quantity, 0)
  });
});
