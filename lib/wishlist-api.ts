import { all } from "@/lib/db";
import { getVariants, toProductCard } from "@/lib/catalog-service";

// Async variant of lib/wishlist.ts for the Next route handlers on libSQL.
export async function wishlistResponse(userId: number, lang: string) {
  const rows = await all(
    `SELECT p.*, w.created_at AS wished_at
     FROM wishlists w JOIN products p ON p.id = w.product_id
     WHERE w.user_id = ? AND p.published = 1
     ORDER BY w.created_at DESC`,
    [Number(userId)]
  );
  const variantMap = await getVariants(rows.map((row) => Number(row.id)));
  const items = rows.map((row) => toProductCard(row, variantMap.get(Number(row.id)) || [], lang));
  return { items, ids: items.map((item) => item.id) };
}
