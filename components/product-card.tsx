type CardProduct = {
  id: number;
  slug: string;
  name: string;
  category: string;
  categoryLabel: string;
  collection: string;
  priceCents: number;
  imageA: string;
  imageB: string;
  totalStock: number;
  lowStock: boolean;
  soldOut: boolean;
  badgeLabel?: string;
  hasPriceRange?: boolean;
  url: string;
  defaultVariant?: { id: number; label: string; priceCents: number; stock: number } | null;
};

type Props = {
  product: CardProduct;
  lang: 'en' | 'id';
  wishlistIds: number[];
  money: (cents: number) => string;
  addToBagLabel: string;
  soldOutLabel: string;
  wishlistLabel: string;
};

export default function ProductCard({ product, lang, wishlistIds, money, addToBagLabel, soldOutLabel, wishlistLabel }: Props) {
  const cardData = {
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
    lowStock: product.lowStock,
    soldOut: product.soldOut,
    defaultVariant: product.defaultVariant
      ? {
          id: product.defaultVariant.id,
          label: product.defaultVariant.label,
          priceCents: product.defaultVariant.priceCents,
          stock: product.defaultVariant.stock,
        }
      : null,
  };
  const isSaved = wishlistIds.includes(product.id);

  return (
    <article className="product-card" data-product-card data-product-id={product.id} data-product-json={JSON.stringify(cardData)}>
      <div className="product-card-media">
        <a href={product.url} className="product-image-wrap" aria-label={product.name}>
          <img className="product-image product-image--a" src={product.imageA} alt={product.name} loading="lazy" decoding="async" />
          <img className="product-image product-image--b" src={product.imageB} alt="" loading="lazy" decoding="async" />
        </a>
        {product.badgeLabel ? (
          <span className="product-badge">{product.badgeLabel}</span>
        ) : product.lowStock ? (
          <span className="product-badge product-badge--quiet">{lang === 'id' ? 'Stok terbatas' : 'Low stock'}</span>
        ) : null}
        <button
          className={`wishlist-toggle ${isSaved ? 'is-saved' : ''}`}
          type="button"
          data-wishlist-toggle
          aria-label={wishlistLabel}
          aria-pressed={isSaved ? 'true' : 'false'}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.2S4.2 15.4 4.2 9.4A4.2 4.2 0 0 1 12 6.6a4.2 4.2 0 0 1 7.8 2.8c0 6-7.8 10.8-7.8 10.8Z" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
        </button>
        {!product.soldOut && product.defaultVariant ? (
          <button className="quick-add" type="button" data-quick-add>
            <span>{addToBagLabel}</span>
            <span aria-hidden="true">+</span>
          </button>
        ) : (
          <span className="quick-add quick-add--disabled">{soldOutLabel}</span>
        )}
      </div>
      <div className="product-card-info">
        <div>
          <p className="product-card-category">{product.categoryLabel}</p>
          <h3><a href={product.url}>{product.name}</a></h3>
        </div>
        <p className="product-card-price">
          {product.hasPriceRange ? <span>{lang === 'id' ? 'Dari' : 'From'}</span> : null}
          <span>{money(product.priceCents)}</span>
        </p>
      </div>
    </article>
  );
}
