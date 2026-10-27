import { createClient } from "@libsql/client";
import fs from "node:fs";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "file:data/starfall.sqlite",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const schema = fs
  .readFileSync("src/schema.sql", "utf8")
  .replace(/^PRAGMA .*$/gim, "");
await db.executeMultiple(schema);

const defaults = {
  exchange_rate: "16350",
  brand_email: "concierge@starfallenigma.com",
  support_phone: "+62 21 5000 1947",
  announcement_en: "Complimentary worldwide delivery · Duties included",
  announcement_id: "Pengiriman gratis ke seluruh dunia · Termasuk bea masuk",
  free_shipping_threshold: "0",
  promo_code: "STARFALL10",
  promo_percent: "10",
  low_stock_threshold: "3",
  admin_setup_complete: "0",
};
for (const [key, value] of Object.entries(defaults)) {
  await db.execute({ sql: "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", args: [key, value] });
}

const stamp = new Date().toISOString();
for (const [p, url, label] of [
  ["instagram", "https://www.instagram.com/", "Instagram"],
  ["tiktok", "https://www.tiktok.com/", "TikTok"],
  ["shopee", "https://shopee.co.id/", "Shopee"],
]) {
  await db.execute({
    sql: `INSERT OR IGNORE INTO social_links (platform, url, label, active, updated_at) VALUES (?, ?, ?, 1, ?)`,
    args: [p, url, label, stamp],
  });
}
console.log("Migrasi selesai.");