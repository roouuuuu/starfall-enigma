import { getDb } from '@/src/db';
import { getVariants, toProductCard } from '@/src/catalog-service';

export function wishlistItemsFor(userId: number | null | undefined, lang: 'en' | 'id') {
  if (!userId) return [];
  const db = getDb();
  const rows = db.prepare(
    `SELECT p.*, w.created_at AS wished_at
     FROM wishlists w JOIN products p ON p.id = w.product_id
     WHERE w.user_id = ? AND p.published = 1
     ORDER BY w.created_at DESC`
  ).all(Number(userId)) as Array<Record<string, any>>;
  const variantMap = getVariants(db, rows.map((row) => Number(row.id)));
  return rows.map((row) => toProductCard(row, variantMap.get(Number(row.id)) || [], lang));
}
