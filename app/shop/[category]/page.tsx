import { notFound } from 'next/navigation';

import ShopView from '@/components/shop-view';
import { pageMetadata } from '@/lib/metadata';
import { getSiteContext } from '@/lib/site';
import { buildShopData, type SearchParams } from '@/lib/shop';
import { categoryById } from '@/src/catalog-service';

type Props = {
  params: Promise<{ category: string }>;
  searchParams: Promise<SearchParams>;
};

export async function generateMetadata({ params, searchParams }: Props) {
  const { category } = await params;
  const site = await getSiteContext();
  if (!categoryById[category]) return pageMetadata({ title: 'Starfall Enigma', noindex: true });
  const data = buildShopData(site.lang, site.currency, site.exchangeRate, await searchParams, category);
  return pageMetadata({
    title: `${data.meta.title} — Starfall Enigma`,
    description: data.meta.intro,
    image: data.meta.image,
  });
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { category } = await params;
  if (!categoryById[category]) notFound();

  const site = await getSiteContext();
  const data = buildShopData(site.lang, site.currency, site.exchangeRate, await searchParams, category);
  return <ShopView site={site} {...data} />;
}
