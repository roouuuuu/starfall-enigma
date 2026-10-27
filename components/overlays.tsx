import type { SiteContext } from '@/lib/site';

export default function Overlays({ site }: { site: SiteContext }) {
  const { t } = site;

  return (
    <>
      <div className="search-overlay" data-search-overlay aria-hidden="true">
        <div className="search-panel" role="dialog" aria-modal="true" aria-labelledby="search-title">
          <div className="search-panel-head">
            <p id="search-title" className="eyebrow">{t('search.title')}</p>
            <button type="button" className="icon-button search-close" data-search-close aria-label={t('common.close')}>×</button>
          </div>
          <form className="search-form" data-search-form role="search">
            <label className="sr-only" htmlFor="search-input">{t('search.title')}</label>
            <input id="search-input" type="search" name="q" autoComplete="off" placeholder={t('search.placeholder')} data-search-input />
            <span className="search-submit-mark" aria-hidden="true">↵</span>
          </form>
          <div className="search-suggestions" data-search-suggestions>
            <div>
              <p className="eyebrow">{t('search.popular')}</p>
              <div className="search-chips">
                <a href="/shop/outerwear">{t('nav.outerwear')}</a>
                <a href="/shop?collection=nocturne">Nocturne</a>
                <a href="/shop/dresses">{t('nav.dresses')}</a>
                <a href="/shop/denim">{t('nav.denim')}</a>
              </div>
            </div>
            <div>
              <p className="eyebrow">{t('search.suggested')}</p>
              <div className="search-popular-links">
                <a href="/product/eclipsed-trench-coat"><span>Eclipsed Trench Coat</span><span aria-hidden="true">↗</span></a>
                <a href="/product/nocturne-leather-blouson"><span>Nocturne Leather Blouson</span><span aria-hidden="true">↗</span></a>
                <a href="/product/eclipse-bias-slip-dress"><span>Eclipse Bias Slip Dress</span><span aria-hidden="true">↗</span></a>
              </div>
            </div>
          </div>
          <div className="search-results" data-search-results />
          <a className="search-view-all" data-search-view-all href="/shop" hidden>{t('search.viewAllResults')} <span aria-hidden="true">↗</span></a>
        </div>
      </div>

      <div className="cart-backdrop" data-cart-backdrop />
      <aside className="cart-drawer" data-cart-drawer aria-hidden="true" aria-labelledby="cart-title" role="dialog" aria-modal="true">
        <div className="cart-drawer-head">
          <div>
            <p className="eyebrow">{t('cart.title')}</p>
            <h2 id="cart-title">{t('common.bag')} <span data-cart-drawer-count /></h2>
          </div>
          <button type="button" className="icon-button" data-cart-close aria-label={t('common.close')}>×</button>
        </div>
        <div className="cart-drawer-body" data-cart-items />
        <div className="cart-drawer-foot">
          <div className="cart-subtotal-row">
            <span>{t('common.subtotal')}</span>
            <strong data-cart-subtotal />
          </div>
          <p className="cart-note">{t('cart.shippingNote')}</p>
          <a className="button button--solid button--full" href="/checkout" data-cart-checkout>
            {t('cart.checkout')} <span aria-hidden="true">↗</span>
          </a>
          <button type="button" className="text-button" data-cart-close>{t('cart.keepShopping')}</button>
        </div>
      </aside>

      <div className="toast-stack" data-toast-stack aria-live="polite" aria-atomic="false" />
      <div className="cursor-note" aria-hidden="true">✦</div>
    </>
  );
}
