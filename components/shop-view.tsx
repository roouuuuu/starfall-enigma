import ProductCard from '@/components/product-card';
import type { SiteContext } from '@/lib/site';

export type ShopMeta = { id: string; title: string; intro: string; image: string };

export type ShopFacets = {
  categories: Array<{ id: string; label: string; count: number }>;
  collections: Array<{ id: string; label: string; count: number }>;
  materials: Array<{ value: string; label: string; count: number }>;
};

export type FilterState = {
  category: string[];
  collection: string[];
  material: string;
  size: string;
  availability: string;
  minPrice: string;
  maxPrice: string;
  search: string;
  sort: string;
};

export type SizeGroup = { label: string; values: string[] };

type Props = {
  site: SiteContext;
  meta: ShopMeta;
  categoryId: string;
  selectedCategories: string[];
  result: { items: any[]; total: number; hasMore: boolean };
  facets: ShopFacets;
  filterState: FilterState;
  sizeGroups: SizeGroup[];
};

export default function ShopView({
  site,
  meta,
  categoryId,
  selectedCategories,
  result,
  facets,
  filterState,
  sizeGroups,
}: Props) {
  const { t, lang, currency, money, wishlistIds } = site;
  const clearHref = meta.id ? `/shop/${meta.id}` : '/shop';
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
      className="shop-page"
      data-shop-root
      data-category={categoryId}
      data-currency={currency}
    >
      <header className="shop-hero">
        <div className="shop-hero-copy">
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <a href="/">{t('common.home')}</a><span aria-hidden="true">/</span>
            <a href="/shop">{t('nav.shopAll')}</a>
            {meta.id ? <><span aria-hidden="true">/</span><span>{meta.title}</span></> : null}
          </nav>
          <p className="eyebrow">{lang === 'id' ? 'Arsip / Koleksi' : 'Archive / Collection'}</p>
          <h1>{meta.title}</h1>
          <p>{meta.intro}</p>
          <div className="shop-hero-meta">
            <span>{t('shop.categoryCount', { count: result.total })}</span>
            <span>USD / IDR</span>
            <span>{lang === 'id' ? 'Dikirim dari Jakarta' : 'Sent from Jakarta'}</span>
          </div>
        </div>
        <div className="shop-hero-image">
          <img src={meta.image} alt={meta.title} fetchPriority="high" />
          <span className="shop-hero-index">SE / 01</span>
        </div>
      </header>

      <div className="shop-shell">
        <button className="filter-mobile-toggle" type="button" data-filter-toggle aria-expanded="false" aria-controls="shop-filters">
          <span>{t('shop.filters')}</span><span aria-hidden="true">+</span>
        </button>
        <aside className="shop-filters" id="shop-filters" data-shop-filters-panel aria-label={t('shop.filters')}>
          <div className="filter-head">
            <p className="eyebrow">{t('shop.filters')}</p>
            <button className="text-button" type="button" data-filter-close aria-label={t('common.close')}>×</button>
          </div>
          <form className="filter-form" data-shop-filters noValidate>
            <div className="filter-search">
              <label htmlFor="shop-search">{t('common.search')}</label>
              <input
                id="shop-search"
                type="search"
                name="search"
                defaultValue={filterState.search}
                placeholder={t('shop.searchPlaceholder')}
              />
            </div>
            <fieldset className="filter-group">
              <legend>{t('shop.filterCategory')}</legend>
              <div className="filter-options filter-options--scroll">
                {facets.categories.map((category) => (
                  <label className="check-line" key={category.id}>
                    <input
                      type="checkbox"
                      name="category"
                      value={category.id}
                      defaultChecked={selectedCategories.includes(category.id)}
                    />
                    <span>{category.label}</span><small>{category.count}</small>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="filter-group">
              <legend>{t('shop.filterCollection')}</legend>
              <div className="filter-options">
                {facets.collections.map((collection) => (
                  <label className="check-line" key={collection.id}>
                    <input
                      type="checkbox"
                      name="collection"
                      value={collection.id}
                      defaultChecked={filterState.collection.includes(collection.id)}
                    />
                    <span>{collection.label}</span><small>{collection.count}</small>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="filter-group">
              <legend>{t('shop.filterMaterial')}</legend>
              <select name="material" aria-label={t('shop.filterMaterial')} defaultValue={filterState.material}>
                <option value="">{lang === 'id' ? 'Semua material' : 'All materials'}</option>
                {facets.materials.map((material) => (
                  <option value={material.value} key={material.value}>{material.label} ({material.count})</option>
                ))}
              </select>
            </fieldset>
            <fieldset className="filter-group">
              <legend>{t('shop.filterSize')}</legend>
              <select name="size" aria-label={t('shop.filterSize')} defaultValue={filterState.size}>
                <option value="">{lang === 'id' ? 'Semua ukuran' : 'All sizes'}</option>
                {sizeGroups.map((group) => (
                  <optgroup label={group.label} key={group.label}>
                    {group.values.map((size) => <option value={size} key={size}>{size}</option>)}
                  </optgroup>
                ))}
              </select>
            </fieldset>
            <fieldset className="filter-group">
              <legend>{t('shop.filterAvailability')}</legend>
              <select name="availability" aria-label={t('shop.filterAvailability')} defaultValue={filterState.availability}>
                <option value="">{lang === 'id' ? 'Semua' : 'All'}</option>
                <option value="in">{t('shop.inStockOnly')}</option>
                <option value="low">{lang === 'id' ? 'Hampir habis' : 'Low stock'}</option>
                <option value="out">{lang === 'id' ? 'Habis' : 'Sold out'}</option>
              </select>
            </fieldset>
            <fieldset className="filter-group">
              <legend>{t('shop.filterPrice')} ({currency})</legend>
              <div className="price-range">
                <label>
                  <span>{t('shop.filterPriceMin')}</span>
                  <input type="number" min="0" step="1" name="minPrice" defaultValue={filterState.minPrice} placeholder="0" />
                </label>
                <span aria-hidden="true">—</span>
                <label>
                  <span>{t('shop.filterPriceMax')}</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    name="maxPrice"
                    defaultValue={filterState.maxPrice}
                    placeholder={currency === 'IDR' ? '10000000' : '500'}
                  />
                </label>
              </div>
            </fieldset>
            <div className="filter-actions">
              <button className="button button--solid button--full" type="submit">{t('shop.applyFilters')}</button>
              <a className="text-button" href={clearHref}>{t('shop.clearAll')}</a>
            </div>
          </form>
        </aside>

        <section className="shop-results" aria-live="polite">
          <div className="shop-toolbar">
            <div>
              <p className="eyebrow" data-shop-result-label>{t('shop.showing', { shown: result.items.length, total: result.total })}</p>
              <h2>{filterState.search ? `${t('search.results')}: “${filterState.search}”` : meta.title}</h2>
            </div>
            <div className="shop-toolbar-actions">
              <label className="sort-select">
                <span>{t('shop.sort')}</span>
                <select name="sort" data-shop-sort form="shop-sort-form" defaultValue={filterState.sort}>
                  <option value="featured">{t('shop.sortFeatured')}</option>
                  <option value="newest">{t('shop.sortNewest')}</option>
                  <option value="price_asc">{t('shop.sortPriceAsc')}</option>
                  <option value="price_desc">{t('shop.sortPriceDesc')}</option>
                  <option value="name">{t('shop.sortName')}</option>
                </select>
              </label>
            </div>
          </div>
          <form id="shop-sort-form" hidden />
          <div className="active-filter-chips" data-active-filters />
          <div className="product-grid product-grid--three shop-grid" data-shop-grid>
            {result.items.map((product) => <ProductCard product={product} {...cardLabels} key={product.id} />)}
          </div>
          <div className="shop-empty" data-shop-empty hidden={result.items.length > 0}>
            <span aria-hidden="true">✦</span>
            <h2>{t('shop.noResults')}</h2>
            <p>{t('shop.noResultsText')}</p>
            <a className="button button--outline" href={clearHref}>{t('shop.clearAll')}</a>
          </div>
          <div className="shop-load-more">
            <button className="button button--outline" type="button" data-shop-load-more hidden={!result.hasMore}>{t('shop.loadMore')}</button>
            <p data-shop-end-note hidden={result.hasMore}>{lang === 'id' ? 'Anda telah mencapai akhir arsip.' : 'You have reached the end of the archive.'}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
