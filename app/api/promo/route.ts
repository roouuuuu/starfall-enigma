import { NextRequest, NextResponse } from "next/server";
import { getPromo, calculateDiscount } from "@/lib/order-service";
import { getRequestContext } from "@/lib/context";
import { AppError, handle } from "@/lib/http";
import { requireCsrf } from "@/lib/auth";
import { cleanText, moneyIdr } from "@/lib/utils";

export const POST = handle(async (req: NextRequest) => {
  await requireCsrf(req);
  const ctx = await getRequestContext(req);
  const body = await req.json().catch(() => ({}));
  const supplied = cleanText(body?.code, 30);
  if (!supplied) {
    throw new AppError(422, ctx.lang === "id" ? "Masukkan kode promo." : "Enter a promo code.", "promo_invalid");
  }
  const promo = getPromo(ctx.settings, supplied);
  if (!promo.valid) {
    throw new AppError(400, ctx.lang === "id" ? "Kode promo tidak valid." : "That promo code is not valid.", "promo_invalid");
  }
  const subtotal = Math.max(0, Math.round(Number(body?.subtotalCents) || 0));
  const discountCents = calculateDiscount(subtotal, promo);
  return NextResponse.json({
    ok: true,
    code: promo.code,
    percent: promo.percent,
    discountCents,
    discountIdr: moneyIdr(discountCents, Number(ctx.settings.exchange_rate || ctx.exchangeRate))
  });
});
