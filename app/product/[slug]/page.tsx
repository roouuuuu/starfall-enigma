import { notFound } from 'next/navigation';

import ProductCard from '@/components/product-card';
import { pageMetadata } from '@/lib/metadata';
import { getSiteContext } from '@/lib/site';
import { getProductBySlug, getRelatedProducts, categoryById } from '@/lib/catalog-service';
import { cleanText } from '@/src/utils';

type Props = { params: Promise<{ slug: string }> };

async function loadProduct(slug: string, lang: 'en' | 'id') {
  const found = await getProductBySlug(slug, lang);
  if (!found) return null;
  const product = found.product as any;
  const related = await getRelatedProducts(product, lang, 4) as any[];
  const category = categoryById[product.category];
  return {
    product,
    related,
    categoryLabel: category ? (lang === 'id' ? category.label_id : category.label_en) : product.categoryLabel,
    categoryDescription: category ? (lang === 'id' ? category.description_id : category.description_en) : '',
  };
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const site = await getSiteContext();
  const data = await loadProduct(slug, site.lang);
  if (!data) return pageMetadata({ title: 'Starfall Enigma', noindex: true });
  return pageMetadata({
    title: `${data.product.name} — Starfall Enigma`,
    description: cleanText(data.product.description, 180),
    image: data.product.imageA,
  });
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const site = await getSiteContext();
  const { t, lang, money, wishlistIds } = site;
  const data = await loadProduct(slug, lang);
  if (!data) notFound();

  const { product, related, categoryLabel, categoryDescription } = data;
  const selectedVariant = product.defaultVariant || product.variants[0] || null;
  const isSaved = wishlistIds.includes(product.id);

  const productState = {
    id: product.id,
    slug: product.slug,
    name: product.name,
    category: product.category,
    categoryLabel: product.categoryLabel,
    collection: product.collection,
    priceCents: product.priceCents,
    imageA: product.imageA,
    imageB: product.imageB,
    totalStock: product.totalStock,
    soldOut: product.soldOut,
    variants: product.variants.map((variant: any) => ({
      id: variant.id,
      label: variant.label,
      priceCents: variant.priceCents,
      stock: variant.stock,
      available: variant.available,
      sku: variant.sku,
    })),
  };
  const productJson = JSON.stringify(productState);

  const cardLabels = {
    lang,
    wishlistIds,
    money,
    addToBagLabel: t('product.addToBag'),
    soldOutLabel: t('product.soldOut'),
    wishlistLabel: t('common.wishlist'),
  };

  return (
    <>
      <main id="main-content" className="product-page">
        <nav className="product-breadcrumbs" aria-label="Breadcrumb">
          <a href="/">{t('common.home')}</a><span aria-hidden="true">/</span>
          <a href="/shop">{t('nav.shopAll')}</a><span aria-hidden="true">/</span>
          <a href={`/shop/${product.category}`}>{categoryLabel}</a><span aria-hidden="true">/</span>
          <span>{product.name}</span>
        </nav>

        <section className="product-layout">
          <div className="product-gallery" data-product-gallery>
            <div className="product-gallery-main">
              <img src={product.imageA} alt={product.name} data-product-main-image fetchPriority="high" />
              <button className="gallery-zoom" type="button" data-gallery-zoom aria-label={lang === 'id' ? 'Perbesar gambar' : 'Enlarge image'}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.2" /><path d="M15.4 15.4 21 21M10.5 7.5v6M7.5 10.5h6" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
              </button>
              {product.badgeLabel ? <span className="product-detail-badge">{product.badgeLabel}</span> : null}
            </div>
            <div className="product-gallery-thumbs" role="group" aria-label={lang === 'id' ? 'Gambar produk' : 'Product images'}>
              <button type="button" className="is-active" data-gallery-thumb data-src={product.imageA} aria-label={lang === 'id' ? 'Tampilan depan' : 'Front view'}>
                <img src={product.imageA} alt="" />
              </button>
              <button type="button" data-gallery-thumb data-src={product.imageB} aria-label={lang === 'id' ? 'Tampilan detail' : 'Detail view'}>
                <img src={product.imageB} alt="" />
              </button>
            </div>
            <p className="gallery-note">{lang === 'id' ? 'Studi vektor orisinal · Warna dapat berbeda pada layar' : 'Original vector study · Colour may vary on screen'}</p>
          </div>

          <div className="product-details">
            <div className="product-kicker">
              <p className="eyebrow">{product.categoryLabel} / {product.collectionLabel}</p>
              <span className="product-ref">{t('product.sku')} {product.sku}</span>
            </div>
            <h1>{product.name}</h1>
            <div className="product-price-row">
              <p className="product-price" data-product-price>
                {product.hasPriceRange ? <span>{lang === 'id' ? 'Dari' : 'From'}</span> : null}
                <strong>{money(product.priceCents)}</strong>
              </p>
              <span className="product-tax-note">{t('cart.subtotalNote')}</span>
            </div>
            <p className="product-description">{product.description}</p>

            <form className="product-buy-form" data-product-form data-product-json={productJson} noValidate>
              <fieldset className="variant-fieldset">
                <legend>
                  <span>{lang === 'id' ? 'Pilih ukuran' : 'Select size'}</span>
                  <a className="text-link text-link--small" href="/client-care#sizing">{t('product.sizeGuideLink')}</a>
                </legend>
                <div className="variant-options">
                  {product.variants.map((variant: any) => {
                    const selected = Boolean(selectedVariant && selectedVariant.id === variant.id);
                    return (
                      <button
                        type="button"
                        className={`variant-option ${selected ? 'is-selected' : ''}`}
                        data-variant-option
                        data-variant-id={variant.id}
                        data-price-cents={variant.priceCents}
                        data-stock={variant.stock}
                        disabled={!variant.available}
                        aria-pressed={selected ? 'true' : 'false'}
                        key={variant.id}
                      >
                        <span>{variant.label}</span>
                        {!variant.available
                          ? <small>{lang === 'id' ? 'Habis' : 'Sold out'}</small>
                          : variant.stock <= variant.lowStockThreshold
                            ? <small>{variant.stock} {lang === 'id' ? 'tersisa' : 'left'}</small>
                            : null}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="product-stock-line" data-product-stock>
                {product.soldOut ? (
                  <><span className="stock-dot stock-dot--out" /> {t('product.soldOut')}</>
                ) : selectedVariant && selectedVariant.stock <= selectedVariant.lowStockThreshold ? (
                  <><span className="stock-dot stock-dot--low" /> {t('product.lowStock', { count: selectedVariant.stock })}</>
                ) : (
                  <><span className="stock-dot" /> {lang === 'id' ? 'Tersedia untuk dikirim' : 'Available to ship'}</>
                )}
              </div>

              <div className="product-buy-row">
                <div className="quantity-field">
                  <label htmlFor="product-quantity">{t('common.quantity')}</label>
                  <div className="quantity-input">
                    <button type="button" data-qty-minus aria-label={lang === 'id' ? 'Kurangi jumlah' : 'Decrease quantity'}>−</button>
                    <input
                      id="product-quantity"
                      type="number"
                      name="quantity"
                      defaultValue={1}
                      min="1"
                      max={Math.min(selectedVariant ? selectedVariant.stock : 0, 10) || 1}
                      inputMode="numeric"
                    />
                    <button type="button" data-qty-plus aria-label={lang === 'id' ? 'Tambah jumlah' : 'Increase quantity'}>+</button>
                  </div>
                </div>
                <button className="button button--solid product-add-button" type="submit" data-add-to-bag disabled={product.soldOut}>
                  <span data-add-label>{t('product.addToBag')}</span><span aria-hidden="true">↗</span>
                </button>
                <button
                  className={`wishlist-toggle wishlist-toggle--detail ${isSaved ? 'is-saved' : ''}`}
                  type="button"
                  data-wishlist-toggle
                  data-product-id={product.id}
                  data-product-json={productJson}
                  aria-label={t('common.wishlist')}
                  aria-pressed={isSaved ? 'true' : 'false'}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.2S4.2 15.4 4.2 9.4A4.2 4.2 0 0 1 12 6.6a4.2 4.2 0 0 1 7.8 2.8c0 6-7.8 10.8-7.8 10.8Z" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
                </button>
              </div>
              <p className="product-form-feedback" data-product-feedback role="status" />
            </form>

            <div className="product-assurances">
              <div><span aria-hidden="true">✦</span><p>{t('labels.complimentaryShipping')}</p></div>
              <div><span aria-hidden="true">↺</span><p>{t('labels.freeReturns')}</p></div>
              <div><span aria-hidden="true">SE</span><p>{t('labels.numberedEdition')}</p></div>
            </div>

            <div className="product-accordions">
              <details open>
                <summary>{t('product.details')}<span aria-hidden="true">+</span></summary>
                <div className="accordion-body">
                  <dl className="detail-list">
                    {product.details.map((detail: any) => (
                      <div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>
                    ))}
                    <div><dt>{lang === 'id' ? 'Dimensi kemasan' : 'Archive box'}</dt><dd>{t('labels.packaging')}</dd></div>
                  </dl>
                </div>
              </details>
              <details>
                <summary>{t('product.care')}<span aria-hidden="true">+</span></summary>
                <div className="accordion-body"><p>{product.care}</p></div>
              </details>
              <details id="shipping">
                <summary>{t('product.shipping')}<span aria-hidden="true">+</span></summary>
                <div className="accordion-body"><p>{t('product.shippingText')}</p></div>
              </details>
            </div>

            <div className="product-share">
              <span>{t('product.share')}</span>
              <button type="button" className="text-button" data-share-copy>{lang === 'id' ? 'Salin tautan' : 'Copy link'}</button>
              <span className="share-feedback" data-share-feedback />
            </div>
          </div>
        </section>

        <section className="product-category-note">
          <p className="eyebrow">{categoryLabel}</p>
          <p>{categoryDescription}</p>
          <a className="text-link" href={`/shop/${product.category}`}>{t('common.viewAll')} <span aria-hidden="true">↗</span></a>
        </section>

        {related.length ? (
          <section className="section related-section" aria-labelledby="related-title">
            <div className="section-head">
              <div>
                <p className="eyebrow">{t('product.related')}</p>
                <h2 id="related-title">{t('product.relatedText')}</h2>
              </div>
            </div>
            <div className="product-grid product-grid--four">
              {related.map((item) => <ProductCard product={item} {...cardLabels} key={item.id} />)}
            </div>
          </section>
        ) : null}
      </main>

      <dialog className="image-dialog" data-image-dialog>
        <button type="button" className="icon-button image-dialog-close" data-image-dialog-close aria-label={t('common.close')}>×</button>
        <img src={product.imageA} alt={product.name} data-image-dialog-img />
      </dialog>
    </>
  );
}
