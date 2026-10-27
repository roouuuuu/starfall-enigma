import { all } from '@/lib/db';
import { getVariants, toProductCard } from '@/lib/catalog-service';

export async function wishlistItemsFor(userId: number | null | undefined, lang: 'en' | 'id') {
  if (!userId) return [];
  const rows = await all<Record<string, any>>(
    `SELECT p.*, w.created_at AS wished_at
     FROM wishlists w JOIN products p ON p.id = w.product_id
     WHERE w.user_id = ? AND p.published = 1
     ORDER BY w.created_at DESC`,
    [Number(userId)]
  );
  const variantMap = await getVariants(rows.map((row) => Number(row.id)));
  return rows.map((row) => toProductCard(row, variantMap.get(Number(row.id)) || [], lang));
}
