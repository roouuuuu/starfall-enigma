import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/context";
import { handle } from "@/lib/http";
import { loadSession, requireCsrf } from "@/lib/auth";
import { createWebsiteOrder } from "@/lib/order-service";

export const POST = handle(async (req: NextRequest) => {
  await requireCsrf(req);
  const ctx = await getRequestContext(req);
  const { user, session } = await loadSession(req);
  const body = await req.json().catch(() => ({}));

  const result = await createWebsiteOrder({
    user: user ? { id: Number(user.id), role: user.role } : null,
    sessionHash: session?.token_hash || "",
    input: body || {},
    settings: ctx.settings
  });

  return NextResponse.json(
    {
      ok: true,
      order: {
        number: result.orderNumber,
        totalCents: result.totalCents,
        totalIdr: result.totalIdr,
        currency: result.currency,
        discountCents: result.discountCents,
        subtotalCents: result.subtotalCents,
        email: result.email,
        createdAt: result.createdAt
      },
      redirect: `/order/${encodeURIComponent(result.orderNumber)}?placed=1`
    },
    { status: 201 }
  );
});
