import { CREDITS } from '@/src/content';

import { pageMetadata } from '@/lib/metadata';
import { getSiteContext } from '@/lib/site';

export async function generateMetadata() {
  const site = await getSiteContext();
  const credits = CREDITS[site.lang] || CREDITS.en;
  return pageMetadata({ title: credits.metaTitle, description: credits.intro });
}

export default async function CreditsPage() {
  const site = await getSiteContext();
  const { t, lang } = site;
  const credits = CREDITS[lang] || CREDITS.en;
  const photos = credits.photos as Array<[string, string]>;

  return (
    <main id="main-content" className="credits-page">
      <header className="credits-hero">
        <p className="eyebrow">SE / Archive notes</p>
        <h1>{credits.title}</h1>
        <p>{credits.intro}</p>
        <span className="credits-hero-mark" aria-hidden="true">✦</span>
      </header>
      <div className="credits-layout">
        <aside className="credits-nav">
          <a href="#photography">{credits.photographyTitle}</a>
          <a href="#technology">{credits.technologyTitle}</a>
          <a href="#fonts">{credits.fontsTitle}</a>
          <a href="#final">{credits.finalTitle}</a>
          <a href="/legal">{t('footer.legal')}</a>
        </aside>
        <div className="credits-content">
          <section id="photography" className="credits-section">
            <p className="eyebrow">01</p>
            <h2>{credits.photographyTitle}</h2>
            <p>{credits.photographyText} <a className="text-link" href="https://www.pexels.com/license/" target="_blank" rel="noopener noreferrer">Pexels License ↗</a></p>
            <ol className="photo-credits">
              {photos.map((photo) => (
                <li key={photo[1]}><span>{photo[0]}</span><a href={photo[1]} target="_blank" rel="noopener noreferrer">Pexels ↗</a></li>
              ))}
            </ol>
          </section>
          <section id="technology" className="credits-section">
            <p className="eyebrow">02</p>
            <h2>{credits.technologyTitle}</h2>
            <p>{credits.technologyText}</p>
            <div className="credits-specs">
              <div><span>72</span><small>{lang === 'id' ? 'produk orisinal' : 'original products'}</small></div>
              <div><span>144</span><small>{lang === 'id' ? 'packshot SVG' : 'SVG packshots'}</small></div>
              <div><span>360</span><small>{lang === 'id' ? 'varian stok' : 'stock variants'}</small></div>
              <div><span>9</span><small>{lang === 'id' ? 'foto editorial' : 'editorial photographs'}</small></div>
            </div>
          </section>
          <section id="fonts" className="credits-section">
            <p className="eyebrow">03</p>
            <h2>{credits.fontsTitle}</h2>
            <p>{credits.fontsText}</p>
            <ul className="credits-font-list">
              <li><strong>Cinzel</strong><span>SIL Open Font License 1.1</span></li>
              <li><strong>Cormorant Garamond</strong><span>SIL Open Font License 1.1</span></li>
              <li><strong>Jost</strong><span>SIL Open Font License 1.1</span></li>
            </ul>
            <a className="text-link" href="/assets/fonts/OFL.txt" target="_blank" rel="noopener">OFL.txt <span aria-hidden="true">↗</span></a>
          </section>
          <section id="final" className="credits-section credits-final">
            <p className="eyebrow">04</p>
            <h2>{credits.finalTitle}</h2>
            <p>{credits.finalText}</p>
            <p>{lang === 'id' ? 'Tidak ada afiliasi dengan merek, rumah mode, fotografer, atau platform pihak ketiga. Semua produk, harga, stok, lokasi, dan pesanan adalah data fiktif untuk demonstrasi.' : 'There is no affiliation with any third-party brand, fashion house, photographer or platform. All products, prices, stock, locations and orders are fictional demonstration data.'}</p>
          </section>
        </div>
      </div>
    </main>
  );
}
