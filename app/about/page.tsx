import { pageMetadata } from '@/lib/metadata';
import { getSiteContext } from '@/lib/site';

const revealDelay = (ms: number) => ({ '--reveal-delay': `${ms}ms` }) as React.CSSProperties;

export async function generateMetadata() {
  const site = await getSiteContext();
  return pageMetadata({
    title: site.t('about.metaTitle'),
    description: site.t('about.intro'),
    image: '/assets/img/editorial/cathedral.jpg',
  });
}

export default async function AboutPage() {
  const site = await getSiteContext();
  const { t, lang } = site;
  const values = t('about.values') as Array<[string, string]>;

  return (
    <main id="main-content" className="about-page">
      <header className="about-hero">
        <div className="about-hero-image">
          <img
            src="/assets/img/editorial/cathedral.jpg"
            alt={lang === 'id' ? 'Interior katedral dalam cahaya rendah' : 'Cathedral interior in low light'}
            fetchPriority="high"
          />
          <span className="about-hero-mark" aria-hidden="true">SE</span>
        </div>
        <div className="about-hero-copy">
          <p className="eyebrow">{t('about.heroKicker')} / Depuis 2026</p>
          <h1>{t('about.heroTitle')}</h1>
          <p>{t('about.intro')}</p>
          <div className="about-hero-notes">
            <span>Jakarta</span><span>Ubud</span><span>Tokyo</span><span>Paris</span>
          </div>
        </div>
      </header>

      <section className="manifesto" data-reveal>
        <span className="manifesto-mark" aria-hidden="true">✦</span>
        <p>{lang === 'id' ? '“Kami tidak membuat pakaian untuk mengisi lemari. Kami membuat pakaian yang mengubah cara tubuh bergerak.”' : '“We do not make clothes to fill a wardrobe. We make clothes that change the way a body moves.”'}</p>
        <span>— Starfall Enigma Atelier</span>
      </section>

      <section className="about-craft">
        <div className="about-craft-image" data-reveal>
          <img
            src="/assets/img/editorial/model-04.jpg"
            alt={lang === 'id' ? 'Model di studio dengan pakaian gelap' : 'A model in dark clothing in the studio'}
            loading="lazy"
          />
          <span className="image-caption">Atelier study / 02</span>
        </div>
        <div className="about-craft-copy" data-reveal>
          <p className="eyebrow">{lang === 'id' ? 'Cara kami bekerja' : 'The way we work'}</p>
          <h2>{t('about.craftTitle')}</h2>
          <p>{t('about.craftText')}</p>
          <p>{t('about.atelierText')}</p>
        </div>
      </section>

      <section className="about-values section" aria-labelledby="values-title">
        <div className="section-head" data-reveal>
          <div>
            <p className="eyebrow">{lang === 'id' ? 'Prinsip' : 'Principles'}</p>
            <h2 id="values-title">{t('about.valuesTitle')}</h2>
          </div>
          <p className="section-intro">{lang === 'id' ? 'Empat aturan sederhana yang menjaga arsip tetap utuh.' : 'Four quiet rules that keep the archive intact.'}</p>
        </div>
        <div className="values-grid">
          {values.map((value, index) => (
            <article data-reveal style={revealDelay(index * 65)} key={value[0]}>
              <span className="value-index">0{index + 1}</span>
              <h3>{value[0]}</h3>
              <p>{value[1]}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-image-band">
        <img
          src="/assets/img/editorial/cathedral-detail.jpg"
          alt={lang === 'id' ? 'Detail jendela katedral' : 'Cathedral window detail'}
          loading="lazy"
        />
        <div className="about-image-band-copy">
          <p className="eyebrow">{lang === 'id' ? 'Cahaya sebagai material' : 'Light as material'}</p>
          <p>{lang === 'id' ? 'Kami memikirkan bayangan sebagai lapisan terakhir dari setiap karya — sesuatu yang tidak dapat dipoles, hanya dapat diarahkan.' : 'We think of shadow as the final layer of every piece — something that cannot be polished, only directed.'}</p>
        </div>
      </section>

      <section className="about-atelier">
        <div className="about-atelier-copy" data-reveal>
          <p className="eyebrow">{t('about.atelierTitle')}</p>
          <h2>{lang === 'id' ? 'Sebuah ruangan kecil dengan cahaya rendah.' : 'A small room with low light.'}</h2>
          <p>{t('about.atelierText')}</p>
          <div className="about-numbers">
            <div><span>72</span><small>{lang === 'id' ? 'karya dalam arsip' : 'pieces in the archive'}</small></div>
            <div><span>360</span><small>{lang === 'id' ? 'varian ukuran' : 'size variants'}</small></div>
            <div><span>9</span><small>{lang === 'id' ? 'kategori pakaian' : 'clothing categories'}</small></div>
          </div>
          <a className="button button--solid" href="/shop">{t('about.cta')} <span aria-hidden="true">↗</span></a>
        </div>
        <div className="about-atelier-image" data-reveal>
          <img
            src="/assets/img/editorial/model-03.jpg"
            alt={lang === 'id' ? 'Studi tailoring gelap' : 'Dark tailoring study'}
            loading="lazy"
          />
        </div>
      </section>

      <section className="about-credits">
        <p>{lang === 'id' ? 'Starfall Enigma adalah maison konsep fiktif. Seluruh produk, nama, teks, dan packshot dibuat orisinal untuk demonstrasi ini.' : 'Starfall Enigma is a fictional concept maison. All products, names, copy and packshots were created originally for this demonstration.'}</p>
        <a className="text-link" href="/credits">{t('footer.credits')} <span aria-hidden="true">↗</span></a>
      </section>
    </main>
  );
}
