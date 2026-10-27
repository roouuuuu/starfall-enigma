import { getFacets, getShopMeta, listProducts, categoryById } from '@/lib/catalog-service';

import type { FilterState, ShopFacets, ShopMeta, SizeGroup } from '@/components/shop-view';

export const SIZE_GROUPS = [
  { label_en: 'Clothing', label_id: 'Pakaian', values: ['XS', 'S', 'M', 'L', 'XL'] },
  { label_en: 'Waist', label_id: 'Pinggang', values: ['28', '30', '32', '34', '36'] },
];

export function sizeGroupsFor(lang: 'en' | 'id'): SizeGroup[] {
  return SIZE_GROUPS.map((group) => ({
    label: lang === 'id' ? group.label_id : group.label_en,
    values: group.values,
  }));
}

export type SearchParams = Record<string, string | string[] | undefined>;

function flat(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value.join(',');
  return value == null ? '' : String(value);
}

export type ShopData = {
  meta: ShopMeta;
  categoryId: string;
  selectedCategories: string[];
  result: { items: any[]; total: number; hasMore: boolean };
  facets: ShopFacets;
  filterState: FilterState;
  sizeGroups: SizeGroup[];
};

export async function buildShopData(
  lang: 'en' | 'id',
  currency: string,
  exchangeRate: number,
  searchParams: SearchParams,
  categoryOverride = ''
): Promise<ShopData> {
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(searchParams)) query[key] = flat(value);

  if (categoryOverride) query.category = categoryOverride;

  const selectedCategories = String(query.category || '')
    .split(',')
    .filter((value) => Boolean(categoryById[value]));

  const metaCategory = categoryOverride || (selectedCategories.length === 1 ? selectedCategories[0] : '');
  const meta = getShopMeta(metaCategory, lang) as ShopMeta;

  const result = await listProducts({
    ...query,
    page: query.page || 1,
    limit: 12,
    currency,
    rate: exchangeRate,
  }, lang) as { items: any[]; total: number; hasMore: boolean };

  const facets = await getFacets(lang) as ShopFacets;

  const filterState: FilterState = {
    category: selectedCategories,
    collection: String(query.collection || '').split(',').filter(Boolean),
    material: String(query.material || ''),
    size: String(query.size || ''),
    availability: String(query.availability || ''),
    minPrice: String(query.minPrice || ''),
    maxPrice: String(query.maxPrice || ''),
    search: String(query.search || ''),
    sort: String(query.sort || 'featured'),
  };

  return {
    meta,
    categoryId: metaCategory,
    selectedCategories: categoryOverride ? [categoryOverride] : selectedCategories,
    result,
    facets,
    filterState,
    sizeGroups: sizeGroupsFor(lang),
  };
}
