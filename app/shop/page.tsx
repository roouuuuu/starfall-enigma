import ShopView from '@/components/shop-view';
import { pageMetadata } from '@/lib/metadata';
import { getSiteContext } from '@/lib/site';
import { buildShopData, type SearchParams } from '@/lib/shop';

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const site = await getSiteContext();
  const { meta } = buildShopData(site.lang, site.currency, site.exchangeRate, params);
  return pageMetadata({
    title: `${meta.title} — Starfall Enigma`,
    description: meta.intro,
    image: meta.image,
  });
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const site = await getSiteContext();
  const data = buildShopData(site.lang, site.currency, site.exchangeRate, params);
  return <ShopView site={site} {...data} />;
}
