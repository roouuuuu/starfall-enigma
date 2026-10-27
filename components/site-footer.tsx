import type { SiteContext } from '@/lib/site';

export default function SiteFooter({ site }: { site: SiteContext }) {
  const { t, lang, user, adminBase } = site;

  return (
    <footer className="site-footer">
      <section className="footer-newsletter" aria-labelledby="footer-newsletter-title">
        <div className="footer-newsletter-copy">
          <p className="eyebrow">{t('footer.newsletterTitle')}</p>
          <h2 id="footer-newsletter-title">{t('home.newsletterTitle')}</h2>
          <p>{t('home.newsletterText')}</p>
        </div>
        <form className="newsletter-form" data-newsletter-form noValidate>
          <label className="sr-only" htmlFor="footer-newsletter-email">{t('home.newsletterPlaceholder')}</label>
          <input
            id="footer-newsletter-email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder={t('home.newsletterPlaceholder')}
            required
          />
          <button type="submit">{t('footer.subscribe')}<span aria-hidden="true">↗</span></button>
          <p className="form-note">{t('home.newsletterConsent')}</p>
          <p className="form-feedback" data-newsletter-feedback role="status" />
        </form>
      </section>

      <div className="footer-main">
        <div className="footer-brand">
          <a className="footer-logo" href="/" aria-label="Starfall Enigma">
            <img src="/assets/img/logo-mark.svg" width={34} height={34} alt="" />
            <span>STARFALL<br />ENIGMA</span>
          </a>
          <p>
            {lang === 'id'
              ? 'Rumah bagi pakaian yang menyimpan bobot dan misterinya sendiri. Dipotong dalam jumlah kecil, diselesaikan dengan tangan.'
              : 'A house for clothes that keep their own weight and mystery. Cut in small runs, finished by hand.'}
          </p>
          <div className="footer-socials">
            {site.socials.length ? (
              <>
                <span>{t('footer.follow')}</span>
                {site.socials.map((social) => (
                  <a href={social.href} target="_blank" rel="noopener noreferrer" key={social.platform}>
                    {social.label}<span aria-hidden="true">↗</span>
                  </a>
                ))}
              </>
            ) : null}
          </div>
        </div>

        <div className="footer-columns">
          <div className="footer-column">
            <h3>{t('common.bag')} / {t('nav.shopAll')}</h3>
            <a href="/shop?new=1">{t('nav.newArrivals')}</a>
            <a href="/shop/outerwear">{t('nav.outerwear')}</a>
            <a href="/shop/tailoring">{t('nav.tailoring')}</a>
            <a href="/shop/knitwear">{t('nav.knitwear')}</a>
            <a href="/shop/dresses">{t('nav.dresses')}</a>
            <a href="/shop/denim">{t('nav.denim')}</a>
            <a href="/shop/loungewear">{t('nav.loungewear')}</a>
          </div>
          <div className="footer-column">
            <h3>{t('footer.maison')}</h3>
            <a href="/about">{t('footer.about')}</a>
            <a href="/journal">{t('footer.journal')}</a>
            <a href="/stores">{t('footer.stores')}</a>
            <a href="/wishlist">{t('common.wishlist')}</a>
            <a href="/account">{t('common.account')}</a>
          </div>
          <div className="footer-column">
            <h3>{t('footer.customerCare')}</h3>
            <a href="/client-care#faq">{t('footer.faq')}</a>
            <a href="/client-care#sizing">{t('footer.sizing')}</a>
            <a href="/client-care#shipping">{t('footer.shippingReturns')}</a>
            <a href="/client-care#care">{t('footer.careGuide')}</a>
            <a href={`mailto:${site.brandEmail}`}>{t('footer.contact')}</a>
          </div>
          <div className="footer-column">
            <h3>{t('footer.legal')}</h3>
            <a href="/legal#privacy">{t('footer.privacy')}</a>
            <a href="/legal#terms">{t('footer.terms')}</a>
            <a href="/legal#cookies">{t('footer.cookies')}</a>
            <a href="/legal#accessibility">{t('footer.accessibility')}</a>
            <a href="/credits">{t('footer.credits')}</a>
          </div>
        </div>
      </div>

      <div className="footer-mark" aria-hidden="true">
        <span>STARFALL</span><span className="footer-mark-star">✦</span><span>ENIGMA</span>
      </div>

      <div className="footer-bottom">
        <p>{t('footer.copyright', { year: site.year })}</p>
        <p className="footer-demo">{t('footer.disclaimer')}</p>
        <div className="footer-bottom-links">
          <a href={site.langSwitchUrl}>{t('footer.selectLanguage')} · {lang === 'id' ? 'Bahasa Indonesia' : 'English'}</a>
          <a href={site.currencySwitchUrl}>{t('footer.selectCurrency')} · {site.currency}</a>
          {user && user.role === 'admin' ? <a href={`${adminBase}/login`}>{t('adminLink')}</a> : null}
        </div>
      </div>
    </footer>
  );
}
