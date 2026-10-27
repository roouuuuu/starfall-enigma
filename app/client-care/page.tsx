import { pageMetadata } from '@/lib/metadata';
import { getSiteContext } from '@/lib/site';

export async function generateMetadata() {
  const site = await getSiteContext();
  return pageMetadata({
    title: site.t('care.metaTitle'),
    description: site.t('care.intro'),
  });
}

export default async function ClientCarePage() {
  const site = await getSiteContext();
  const { t, lang } = site;
  const faq = t('care.faq') as Array<[string, string]>;

  return (
    <main id="main-content" className="care-page">
      <header className="care-hero">
        <div>
          <p className="eyebrow">{t('care.kicker')} / SE</p>
          <h1>{t('care.title')}</h1>
          <p>{t('care.intro')}</p>
        </div>
        <div className="care-hero-mark" aria-hidden="true">
          <span className="care-hero-star">✦</span>
          <span>SE / CARE</span>
        </div>
      </header>

      <div className="care-layout">
        <aside className="care-nav" aria-label={t('nav.clientCare')}>
          <a href="#faq">{t('care.faqTitle')}</a>
          <a href="#sizing">{t('care.sizeTitle')}</a>
          <a href="#care">{t('care.careTitle')}</a>
          <a href="#shipping">{t('care.shippingReturnsTitle')}</a>
          <a href="#contact">{t('care.contactTitle')}</a>
        </aside>
        <div className="care-content">
          <section id="faq" className="care-block">
            <div className="care-block-head"><p className="eyebrow">01</p><h2>{t('care.faqTitle')}</h2></div>
            <div className="faq-list">
              {faq.map((item, index) => (
                <details open={index === 0} key={item[0]}>
                  <summary><span>{item[0]}</span><span aria-hidden="true">+</span></summary>
                  <p>{item[1]}</p>
                </details>
              ))}
            </div>
          </section>

          <section id="sizing" className="care-block">
            <div className="care-block-head"><p className="eyebrow">02</p><h2>{t('care.sizeTitle')}</h2></div>
            <p className="care-lead">{t('care.sizeIntro')}</p>
            <div className="sizing-grid">
              <div>
                <h3>{t('care.sizeApparelTitle')}</h3>
                <p className="preline">{t('care.sizeApparel')}</p>
              </div>
              <div>
                <h3>{t('care.sizeWaistTitle')}</h3>
                <p className="preline">{t('care.sizeWaist')}</p>
              </div>
            </div>
          </section>

          <section id="care" className="care-block">
            <div className="care-block-head"><p className="eyebrow">03</p><h2>{t('care.careTitle')}</h2></div>
            <p className="care-lead">{t('care.careText')}</p>
            <div className="care-notes">
              <div>
                <span aria-hidden="true">◐</span>
                <h3>{lang === 'id' ? 'Simpan' : 'Store'}</h3>
                <p>{lang === 'id' ? 'Gantung tailoring pada hanger berlapis dan simpan rajutan terlipat. Beri ruang agar kain bisa bernapas.' : 'Hang tailoring on a padded hanger and store knitwear folded. Leave room for the cloth to breathe.'}</p>
              </div>
              <div>
                <span aria-hidden="true">✦</span>
                <h3>{lang === 'id' ? 'Rawat' : 'Maintain'}</h3>
                <p>{lang === 'id' ? 'Gunakan sikat pakaian lembut dan cuci sesekali dengan metode paling lembut yang disarankan.' : 'Use a soft clothes brush and wash sparingly with the gentlest method recommended.'}</p>
              </div>
              <div>
                <span aria-hidden="true">↺</span>
                <h3>{lang === 'id' ? 'Kembalikan' : 'Restore'}</h3>
                <p>{lang === 'id' ? 'Untuk perbaikan atau penyesuaian, hubungi concierge. Layanan ini fiktif dalam demo.' : 'For repair or alteration, contact the concierge. This service is fictional in the demo.'}</p>
              </div>
            </div>
          </section>

          <section id="shipping" className="care-block">
            <div className="care-block-head"><p className="eyebrow">04</p><h2>{t('care.shippingReturnsTitle')}</h2></div>
            <div className="shipping-grid">
              <div><h3>{t('care.shippingTitle')}</h3><p>{t('care.shippingText')}</p></div>
              <div><h3>{t('care.returnsTitle')}</h3><p>{t('care.returnsText')}</p></div>
            </div>
          </section>

          <section id="contact" className="care-contact">
            <div>
              <p className="eyebrow">05</p>
              <h2>{t('care.contactTitle')}</h2>
              <p>{t('care.contactText')}</p>
            </div>
            <div className="care-contact-details">
              <a href={`mailto:${site.brandEmail}`}><span>{t('care.email')}</span>{site.brandEmail}</a>
              <a href={`tel:${site.supportPhone.replace(/\s/g, '')}`}><span>{t('care.phone')}</span>{site.supportPhone}</a>
              <div><span>{t('care.hours')}</span>{t('care.hoursValue')}</div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
