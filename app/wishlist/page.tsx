import ProductCard from '@/components/product-card';
import { pageMetadata } from '@/lib/metadata';
import { getSiteContext } from '@/lib/site';
import { wishlistItemsFor } from '@/lib/wishlist';

export async function generateMetadata() {
  const site = await getSiteContext();
  return pageMetadata({
    title: site.t('wishlist.metaTitle'),
    description: site.t('wishlist.intro'),
    noindex: true,
  });
}

export default async function WishlistPage() {
  const site = await getSiteContext();
  const { t, lang, money, wishlistIds } = site;
  const items = await wishlistItemsFor(site.user?.id, lang);

  const cardLabels = {
    lang,
    wishlistIds,
    money,
    addToBagLabel: t('product.addToBag'),
    soldOutLabel: t('product.soldOut'),
    wishlistLabel: t('common.wishlist'),
  };

  return (
    <main
      id="main-content"
      className="wishlist-page"
      data-wishlist-page
      data-initial-count={items.length}
      data-signed-in={site.user ? '1' : '0'}
    >
      <header className="wishlist-hero">
        <p className="eyebrow">{t('common.wishlist')} / SE</p>
        <h1>{t('wishlist.title')}</h1>
        <p>{t('wishlist.intro')}</p>
        <span className="wishlist-hero-star" aria-hidden="true">✦</span>
      </header>

      <div className="wishlist-content">
        <div className="wishlist-toolbar">
          <p className="eyebrow"><span data-wishlist-count-label>{items.length}</span> {lang === 'id' ? 'karya disimpan' : 'pieces saved'}</p>
          <button className="text-button" type="button" data-wishlist-move-all>{t('wishlist.moveAll')} <span aria-hidden="true">↗</span></button>
        </div>
        <div className="product-grid product-grid--four" data-wishlist-grid>
          {items.map((product) => <ProductCard product={product} {...cardLabels} key={product.id} />)}
        </div>
        <div className="wishlist-empty" data-wishlist-empty hidden={items.length > 0}>
          <span className="wishlist-empty-mark" aria-hidden="true">✦</span>
          <h2>{t('wishlist.empty')}</h2>
          <p>{t('wishlist.emptyText')}</p>
          <a className="button button--solid" href="/shop">{t('cart.startShopping')} <span aria-hidden="true">↗</span></a>
        </div>
      </div>
    </main>
  );
}
