import type { PageInfo } from '@/lib/routes';
import type { SiteContext } from '@/lib/site';

type Props = { site: SiteContext; page: PageInfo };

export default function SiteHeader({ site, page }: Props) {
  const { t, lang, user, adminBase, wishlistIds, currentUrl } = site;

  const navItems = [
    { id: 'new', href: '/shop?new=1', label: t('nav.newArrivals'), mega: false },
    { id: 'clothing', href: '/shop', label: t('nav.clothing'), mega: true },
    { id: 'outerwear', href: '/shop/outerwear', label: t('nav.outerwear'), mega: false },
    { id: 'denim', href: '/shop/denim', label: t('nav.denim'), mega: false },
    { id: 'loungewear', href: '/shop/loungewear', label: t('nav.loungewear'), mega: false },
    { id: 'journal', href: '/journal', label: t('nav.journal'), mega: false },
    { id: 'about', href: '/about', label: t('nav.about'), mega: false },
  ];

  const loginHref = `/login?next=${encodeURIComponent(currentUrl)}`;

  return (
    <>
      <div className="announcement-bar">
        <div className="announcement-track" aria-hidden="true">
          <span>{site.announcement || t('labels.complimentaryShipping')}</span>
          <span>✦</span>
          <span>{t('labels.numberedEdition')}</span>
          <span>✦</span>
          <span>{t('labels.freeReturns')}</span>
        </div>
        <p className="announcement-static">{site.announcement || t('labels.complimentaryShipping')}</p>
        <a href="/client-care" className="announcement-link">{t('nav.clientCare')}<span aria-hidden="true">↗</span></a>
      </div>

      <div className="utility-bar">
        <div className="utility-left">
          <span>{lang === 'id' ? 'Arsip privat · Jakarta' : 'Private archive · Jakarta'}</span>
          <span className="utility-separator" aria-hidden="true" />
          <span>Collection 01 / {lang === 'id' ? 'Yang Tak Terucap' : 'The Unspoken'}</span>
        </div>
        <div className="utility-right">
          {user && user.role === 'admin' ? (
            <a href={adminBase} className="utility-admin">Dashboard ↗</a>
          ) : null}
          <a href="/stores">{t('nav.stores')}</a>
          <a href="/client-care">{t('nav.clientCare')}</a>
          <a href={site.langSwitchUrl} hrefLang={lang === 'en' ? 'id' : 'en'} aria-label={t('footer.selectLanguage')}>{site.langAlt}</a>
          <a href={site.currencySwitchUrl} aria-label={t('footer.selectCurrency')}>{site.currencyAlt}</a>
          <span className="utility-demo">{t('footer.demo')}</span>
        </div>
      </div>

      <header className="site-header" data-site-header>
        <div className="header-inner">
          <button className="icon-button header-menu-button" type="button" data-menu-toggle aria-label={t('common.menu')} aria-expanded="false" aria-controls="mobile-menu">
            <span /><span />
          </button>
          <a className="brand" href="/" aria-label={`Starfall Enigma — ${t('common.home')}`}>
            <img src="/assets/img/logo-mark.svg" width={30} height={30} alt="" />
            <span className="brand-word">STARFALL ENIGMA</span>
          </a>
          <nav className="primary-nav" aria-label={t('common.menu')}>
            {navItems.map((item) => (
              <div className={`nav-item ${item.mega ? 'has-mega' : ''}`} key={item.id}>
                <a
                  className={`nav-link ${page.activeNav === item.id ? 'is-active' : ''}`}
                  href={item.href}
                  {...(item.mega
                    ? { 'aria-haspopup': 'true' as const, 'aria-expanded': 'false' as const, 'aria-controls': 'mega-clothing' }
                    : {})}
                >
                  {item.label}
                </a>
                {item.mega ? (
                  <div className="mega-menu" id="mega-clothing" role="group" aria-label={t('nav.clothing')}>
                    <div className="mega-grid">
                      <div className="mega-links">
                        <p className="eyebrow">{t('nav.clothing')}</p>
                        <a href="/shop"><span>01</span> {t('nav.shopAll')}</a>
                        {site.clothingCategories.map((category, index) => (
                          <a href={`/shop/${category.id}`} key={category.id}>
                            <span>0{index + 2}</span> {category.label}
                          </a>
                        ))}
                        <a className="mega-collections" href="/shop?collection=reliquary">
                          {lang === 'id' ? 'Koleksi Reliquary' : 'The Reliquary collection'} <span aria-hidden="true">↗</span>
                        </a>
                      </div>
                      <a className="mega-feature" href="/shop?category=tailoring,dresses">
                        <img
                          src="/assets/img/editorial/model-03.jpg"
                          alt={lang === 'id' ? 'Tailoring dan gaun Starfall Enigma' : 'Starfall Enigma tailoring and dresses'}
                          loading="lazy"
                        />
                        <span className="mega-feature-label">
                          {lang === 'id' ? 'Tailoring dan gaun' : 'Tailoring & dresses'}<span aria-hidden="true">↗</span>
                        </span>
                      </a>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </nav>
          <div className="header-actions">
            <button className="icon-button" type="button" data-search-open aria-label={t('search.open')}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.2" /><path d="M15.5 15.5 21 21" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
            </button>
            {user ? (
              <a className="icon-button account-button" href={user.role === 'admin' ? adminBase : '/account'} aria-label={t('common.account')}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.2" /><path d="M4.5 21c.5-4.2 3.3-6.5 7.5-6.5s7 2.3 7.5 6.5" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
              </a>
            ) : (
              <a className="icon-button account-button" href={loginHref} aria-label={t('common.account')}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.2" /><path d="M4.5 21c.5-4.2 3.3-6.5 7.5-6.5s7 2.3 7.5 6.5" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
              </a>
            )}
            <a className="icon-button wishlist-header-link" href="/wishlist" aria-label={t('common.wishlist')}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.2S4.2 15.4 4.2 9.4A4.2 4.2 0 0 1 12 6.6a4.2 4.2 0 0 1 7.8 2.8c0 6-7.8 10.8-7.8 10.8Z" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
              <span className="count-badge" data-wishlist-count>{wishlistIds.length || ''}</span>
            </a>
            <button className="icon-button bag-button" type="button" data-cart-open aria-label={t('common.bag')}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 8.5h13l-1 12h-11l-1-12Z" fill="none" stroke="currentColor" strokeWidth="1.2" /><path d="M9 9V6.8a3 3 0 0 1 6 0V9" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
              <span className="count-badge" data-cart-count />
            </button>
          </div>
        </div>
      </header>

      <div className="mobile-menu" id="mobile-menu" data-mobile-menu aria-hidden="true" role="dialog" aria-modal="true" aria-label={t('common.menu')}>
        <div className="mobile-menu-head">
          <span className="eyebrow">{t('common.menu')}</span>
          <button type="button" className="icon-button" data-menu-close aria-label={t('common.close')}>×</button>
        </div>
        <nav className="mobile-nav" aria-label={t('common.menu')}>
          <a href="/shop?new=1">{t('nav.newArrivals')}</a>
          <a href="/shop">{t('nav.shopAll')}</a>
          <details>
            <summary>{t('nav.clothing')}</summary>
            {site.clothingCategories.map((category) => (
              <a href={`/shop/${category.id}`} key={category.id}>{category.label}</a>
            ))}
          </details>
          <a href="/journal">{t('nav.journal')}</a>
          <a href="/about">{t('nav.about')}</a>
          <a href="/stores">{t('nav.stores')}</a>
          <a href="/client-care">{t('nav.clientCare')}</a>
          <div className="mobile-menu-utility">
            <a href={site.langSwitchUrl}>{t('footer.selectLanguage')} · {site.langAlt}</a>
            <a href={site.currencySwitchUrl}>{t('footer.selectCurrency')} · {site.currencyAlt}</a>
            {user ? (
              <a href={user.role === 'admin' ? adminBase : '/account'}>{t('common.account')}</a>
            ) : (
              <a href={loginHref}>{t('auth.login')}</a>
            )}
          </div>
        </nav>
      </div>
      <div className="page-shade" data-page-shade />
    </>
  );
}
