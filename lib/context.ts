import { NextRequest } from "next/server";
import { getSettings } from "@/lib/db";

export async function getRequestContext(req: NextRequest) {
  const settings = await getSettings();
  const cookieLang = req.cookies.get("lang")?.value;
  const lang = cookieLang === "id" || cookieLang === "en"
    ? cookieLang
    : (req.headers.get("accept-language") ?? "").startsWith("id") ? "id" : "en";
  const cookieCur = req.cookies.get("currency")?.value;
  const currency = cookieCur === "IDR" ? "IDR" : "USD";
  const exchangeRate = Number(settings.exchange_rate || 16350);
  return { lang, currency, exchangeRate, settings };
}