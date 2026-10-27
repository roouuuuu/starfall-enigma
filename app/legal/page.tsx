import { pageMetadata } from '@/lib/metadata';
import { getSiteContext } from '@/lib/site';

export async function generateMetadata() {
  const site = await getSiteContext();
  return pageMetadata({
    title: `${site.t('legal.title')} — Starfall Enigma`,
    description: String(site.t('legal.privacy')).slice(0, 170),
  });
}

export default async function LegalPage() {
  const site = await getSiteContext();
  const { t, lang } = site;

  return (
    <main id="main-content" className="legal-page">
      <header className="legal-hero">
        <p className="eyebrow">SE / Legal</p>
        <h1>{t('legal.title')}</h1>
        <p>{t('legal.updated')}</p>
      </header>
      <div className="legal-layout">
        <aside className="legal-nav" aria-label={t('legal.title')}>
          <a href="#privacy">{t('legal.privacyTitle')}</a>
          <a href="#terms">{t('legal.termsTitle')}</a>
          <a href="#cookies">{t('legal.cookiesTitle')}</a>
          <a href="#accessibility">{t('legal.accessibilityTitle')}</a>
        </aside>
        <article className="legal-content">
          <div className="legal-notice">
            <span aria-hidden="true">✦</span>
            <p><strong>{lang === 'id' ? 'Demonstrasi lokal.' : 'Local demonstration.'}</strong> {t('footer.disclaimer')}</p>
          </div>
          <section id="privacy">
            <span className="legal-index">01</span>
            <h2>{t('legal.privacyTitle')}</h2>
            <p>{t('legal.privacy')}</p>
          </section>
          <section id="terms">
            <span className="legal-index">02</span>
            <h2>{t('legal.termsTitle')}</h2>
            <p>{t('legal.terms')}</p>
            <p>{lang === 'id' ? 'Checkout berfungsi sebagai demo: pesanan dicatat secara lokal, stok dikurangi, dan pemasukan dicatat dalam buku kas. Tidak ada pemroses pembayaran, pengiriman, atau penagihan nyata yang terlibat.' : 'Checkout functions as a demo: orders are recorded locally, stock is decremented and income is written to the ledger. No real payment processor, shipment or charge is involved.'}</p>
          </section>
          <section id="cookies">
            <span className="legal-index">03</span>
            <h2>{t('legal.cookiesTitle')}</h2>
            <p>{t('legal.cookies')}</p>
            <ul>
              <li><strong>se_session</strong> — <span>{lang === 'id' ? 'cookie sesi aman untuk akun dan token CSRF.' : 'secure session cookie for your account and CSRF token.'}</span></li>
              <li><strong>se_lang</strong>, <strong>se_currency</strong> — <span>{lang === 'id' ? 'preferensi tampilan.' : 'display preferences.'}</span></li>
              <li><strong>localStorage</strong> — <span>{lang === 'id' ? 'tas tamu, wishlist tamu, dan preferensi kecil.' : 'guest bag, guest wishlist and small preferences.'}</span></li>
            </ul>
          </section>
          <section id="accessibility">
            <span className="legal-index">04</span>
            <h2>{t('legal.accessibilityTitle')}</h2>
            <p>{t('legal.accessibility')}</p>
          </section>
          <div className="legal-contact">
            <p>{lang === 'id' ? 'Pertanyaan tentang halaman ini?' : 'Questions about this page?'}</p>
            <a className="text-link" href={`mailto:${site.brandEmail}`}>{site.brandEmail} <span aria-hidden="true">↗</span></a>
          </div>
        </article>
      </div>
    </main>
  );
}
