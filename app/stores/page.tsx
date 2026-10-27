import { pageMetadata } from '@/lib/metadata';
import { getSiteContext } from '@/lib/site';

const revealDelay = (ms: number) => ({ '--reveal-delay': `${ms}ms` }) as React.CSSProperties;

export async function generateMetadata() {
  const site = await getSiteContext();
  return pageMetadata({
    title: site.t('stores.metaTitle'),
    description: site.t('stores.intro'),
    image: '/assets/img/editorial/cathedral-detail.jpg',
  });
}

type Location = {
  city: string;
  country: string;
  address: string;
  region: string;
  hours: string;
  phone: string;
};

export default async function StoresPage() {
  const site = await getSiteContext();
  const { t, lang } = site;
  const locations = t('stores.locations') as Location[];

  return (
    <main id="main-content" className="stores-page">
      <header className="stores-hero">
        <img
          src="/assets/img/editorial/cathedral-detail.jpg"
          alt={lang === 'id' ? 'Detail jendela katedral' : 'Cathedral window detail'}
          fetchPriority="high"
        />
        <div className="stores-hero-copy">
          <p className="eyebrow">{t('stores.kicker')} / SE</p>
          <h1>{t('stores.title')}</h1>
          <p>{t('stores.intro')}</p>
          <a
            className="button button--light"
            href={`mailto:${site.brandEmail}?subject=${encodeURIComponent('Private appointment request — Starfall Enigma')}`}
          >
            {t('stores.book')} <span aria-hidden="true">↗</span>
          </a>
        </div>
        <div className="stores-hero-coordinates" aria-hidden="true"><span>06° 13′ S</span><span>106° 49′ E</span></div>
      </header>

      <section className="stores-list section" aria-labelledby="stores-list-title">
        <div className="section-head">
          <div>
            <p className="eyebrow">{t('stores.locationsTitle')}</p>
            <h2 id="stores-list-title">{lang === 'id' ? 'Enam ruang privat.' : 'Six private rooms.'}</h2>
          </div>
          <p className="section-intro">{lang === 'id' ? 'Direktori fiktif untuk demo. Setiap kunjungan diatur melalui concierge.' : 'A fictional directory for the demo. Every visit is arranged through the concierge.'}</p>
        </div>
        <div className="locations-grid">
          {locations.map((location, index) => (
            <article className="location-card" data-reveal style={revealDelay(index * 45)} key={location.city}>
              <div className="location-card-head">
                <span className="location-index">0{index + 1}</span>
                <span className="location-appointment">{t('stores.appointmentOnly')}</span>
              </div>
              <h3>{location.city}</h3>
              <p className="location-country">{location.country}</p>
              <address>
                <span>{location.address}</span>
                <span>{location.region}</span>
              </address>
              <dl>
                <div><dt>{t('stores.hours')}</dt><dd>{location.hours}</dd></div>
                <div><dt>{t('stores.phone')}</dt><dd><a href={`tel:${location.phone.replace(/\s/g, '')}`}>{location.phone}</a></dd></div>
              </dl>
              <a
                className="text-link"
                href={`mailto:${site.brandEmail}?subject=${encodeURIComponent(`${location.city} appointment — Starfall Enigma`)}`}
              >
                {t('stores.book')} <span aria-hidden="true">↗</span>
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="stores-partners">
        <div>
          <p className="eyebrow">{t('stores.partners')}</p>
          <h2>{lang === 'id' ? 'Daftar mitra kami dijaga secara privat.' : 'Our partner list is kept private.'}</h2>
          <p>{t('stores.partnerNote')}</p>
        </div>
        <a
          className="button button--outline"
          href={`mailto:${site.brandEmail}?subject=${encodeURIComponent('Concierge recommendation — Starfall Enigma')}`}
        >
          {t('stores.contactCta')} <span aria-hidden="true">↗</span>
        </a>
      </section>

      <section className="stores-visit">
        <span className="stores-visit-star" aria-hidden="true">✦</span>
        <p className="eyebrow">{lang === 'id' ? 'Sebelum berkunjung' : 'Before your visit'}</p>
        <p>{lang === 'id' ? 'Kami menerima satu atau dua tamu per slot. Beri tahu kami karya yang ingin Anda lihat, ukuran pakaian, atau waktu yang Anda butuhkan. Concierge akan mengonfirmasi ketersediaan melalui email.' : 'We receive one or two guests per slot. Tell us which pieces you would like to see, your clothing size, or the time you need. The concierge will confirm availability by email.'}</p>
      </section>
    </main>
  );
}
