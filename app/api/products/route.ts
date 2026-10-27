import { NextRequest, NextResponse } from "next/server";
import { listProducts, getFacets } from "@/lib/catalog-service";
import { getRequestContext } from "@/lib/context";
import { handle } from "@/lib/http";

export const GET = handle(async (req: NextRequest) => {
  const ctx = await getRequestContext(req);
  const query = Object.fromEntries(req.nextUrl.searchParams);
  const result = await listProducts(
    { ...query, currency: ctx.currency, rate: ctx.exchangeRate },
    ctx.lang
  );
  const payload: Record<string, unknown> = {
    ok: true,
    ...result,
    currency: ctx.currency,
    exchangeRate: ctx.exchangeRate
  };
  if (query.facets === "1") payload.facets = await getFacets(ctx.lang);
  return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
});
