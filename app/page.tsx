import { Fragment } from 'react';

import ProductCard from '@/components/product-card';
import { pageMetadata } from '@/lib/metadata';
import { getSiteContext } from '@/lib/site';
import { getDb } from '@/src/db';
import { getFeatured } from '@/src/catalog-service';
import { CATEGORY_LIST } from '@/src/catalog';
import { JOURNAL } from '@/src/content';

const revealDelay = (ms: number) => ({ '--reveal-delay': `${ms}ms` }) as React.CSSProperties;

export async function generateMetadata() {
  const site = await getSiteContext();
  return pageMetadata({
    title: site.t('home.metaTitle'),
    description: site.t('home.metaDescription'),
    image: '/assets/img/editorial/model-04.jpg',
  });
}

export default async function HomePage() {
  const site = await getSiteContext();
  const { t, lang, money } = site;
  const db = getDb();

  const featured = getFeatured(db, lang, 4, 'featured') as any[];
  const newArrivals = getFeatured(db, lang, 4, 'new') as any[];

  const journal = JOURNAL.map((item: any) => ({
    slug: item.slug,
    date: item.date,
    readMinutes: item.readMinutes,
    image: item.image,
    category: lang === 'id' ? item.category_id : item.category_en,
    title: lang === 'id' ? item.title_id : item.title_en,
    excerpt: lang === 'id' ? item.excerpt_id : item.excerpt_en,
  })).slice(0, 3);

  const categoryTiles = CATEGORY_LIST.map((category: any) => ({
    id: category.id,
    label: lang === 'id' ? category.label_id : category.label_en,
    image: category.image,
  }));

  const ticker = t('home.ticker') as string[];
  const cardLabels = {
    lang,
    wishlistIds: site.wishlistIds,
    money,
    addToBagLabel: t('product.addToBag'),
    soldOutLabel: t('product.soldOut'),
    wishlistLabel: t('common.wishlist'),
  };

  return (
    <main id="main-content">
      <section className="hero">
        <div className="hero-media">
          <img
            src="/assets/img/editorial/model-04.jpg"
            alt={lang === 'id' ? 'Model dalam tailoring gelap di studio' : 'A model in dark tailoring in the studio'}
            fetchPriority="high"
          />
          <div className="hero-veil" />
          <div className="hero-orbit" aria-hidden="true"><span /></div>
        </div>
        <div className="hero-content">
          <p className="eyebrow">{t('home.heroKicker')}</p>
          <h1 dangerouslySetInnerHTML={{ __html: t('home.heroTitle') }} />
          <p className="hero-text">{t('home.heroText')}</p>
          <div className="hero-actions">
            <a className="button button--solid" href="/shop">{t('home.exploreCollection')} <span aria-hidden="true">↗</span></a>
            <a className="text-link" href="/about">{t('home.discoverMaison')}</a>
          </div>
          <div className="hero-meta">
            <span>01 / 04</span>
            <span>Jakarta · 19:47</span>
            <span>{lang === 'id' ? 'Edisi terbatas' : 'Limited release'}</span>
          </div>
        </div>
        <div className="hero-side-note" aria-hidden="true">
          <span>STARFALL</span><span>ENIGMA</span>
        </div>
      </section>

      <div className="ticker" aria-hidden="true">
        <div className="ticker-track">
          {[0, 1].map((round) => ticker.map((line, index) => (
            <Fragment key={`${round}-${index}`}>
              <span>{line}</span><span className="ticker-star">✦</span>
            </Fragment>
          )))}
        </div>
      </div>

      <section className="section arrivals-section" aria-labelledby="arrivals-title">
        <div className="section-head" data-reveal>
          <div>
            <p className="eyebrow">{t('home.newArrivals')}</p>
            <h2 id="arrivals-title">{t('home.newArrivalsText')}</h2>
          </div>
          <a className="text-link" href="/shop?new=1">{t('common.viewAll')} <span aria-hidden="true">↗</span></a>
        </div>
        <div className="product-grid product-grid--four">
          {newArrivals.map((product, index) => (
            <div data-reveal style={revealDelay(index * 75)} key={product.id}>
              <ProductCard product={product} {...cardLabels} />
            </div>
          ))}
        </div>
      </section>

      <section className="collection-pair" aria-label={t('home.featuredCollections')}>
        <a className="collection-panel collection-panel--starfall" href="/shop?collection=starfall" data-reveal>
          <img src="/assets/img/editorial/model-03.jpg" alt={lang === 'id' ? 'Tailoring gelap di studio' : 'Dark tailoring in the studio'} loading="lazy" />
          <div className="collection-panel-overlay" />
          <div className="collection-panel-copy">
            <span className="eyebrow">01 / Collection</span>
            <h2>STARFALL</h2>
            <p>{lang === 'id' ? 'Tailoring celestial dan sutra, dipotong untuk kegelapan.' : 'Celestial tailoring and silk, cut for the dark.'}</p>
            <span className="circle-link" aria-hidden="true">↗</span>
          </div>
        </a>
        <a className="collection-panel collection-panel--nocturne" href="/shop?collection=nocturne" data-reveal>
          <img src="/assets/img/editorial/model-02.jpg" alt={lang === 'id' ? 'Luaran kulit gelap' : 'Dark leather outerwear'} loading="lazy" />
          <div className="collection-panel-overlay" />
          <div className="collection-panel-copy">
            <span className="eyebrow">02 / Collection</span>
            <h2>NOCTURNE</h2>
            <p>{lang === 'id' ? 'Denim menghitam, kulit, dan rajutan bercahaya bulan.' : 'Blackened denim, leather and moonlit knit.'}</p>
            <span className="circle-link" aria-hidden="true">↗</span>
          </div>
        </a>
      </section>

      <section className="section categories-section" aria-labelledby="categories-title">
        <div className="section-head" data-reveal>
          <div>
            <p className="eyebrow">{t('home.categoriesKicker')}</p>
            <h2 id="categories-title">{t('home.categoriesTitle')}</h2>
          </div>
          <p className="section-intro">{t('home.categoriesText')}</p>
        </div>
        <div className="category-grid">
          {categoryTiles.map((category, index) => (
            <a
              className={`category-tile ${index === 0 ? 'category-tile--wide' : ''}`}
              href={`/shop/${category.id}`}
              data-reveal
              style={revealDelay(index * 55)}
              key={category.id}
            >
              <img src={category.image} alt={category.label} loading="lazy" />
              <span className="category-tile-index">0{index + 1}</span>
              <span className="category-tile-label">{category.label}<span aria-hidden="true">↗</span></span>
            </a>
          ))}
        </div>
      </section>

      <section className="campaign-band">
        <img className="campaign-band-image" src="/assets/img/editorial/jacket.jpg" alt={lang === 'id' ? 'Model dalam jaket kulit gelap' : 'Model in a dark leather jacket'} loading="lazy" />
        <div className="campaign-band-overlay" />
        <div className="campaign-band-copy" data-reveal>
          <p className="eyebrow">{t('home.campaignKicker')}</p>
          <h2>{t('home.campaignTitle')}</h2>
          <p>{t('home.campaignText')}</p>
          <a className="button button--light" href="/shop/outerwear">{t('nav.outerwear')} <span aria-hidden="true">↗</span></a>
        </div>
        <div className="campaign-band-credit">{lang === 'id' ? 'Studi editorial / Pexels' : 'Editorial study / Pexels'}</div>
      </section>

      <section className="section featured-row" aria-labelledby="featured-title">
        <div className="section-head" data-reveal>
          <div>
            <p className="eyebrow">{lang === 'id' ? 'Pilihan atelier' : 'Atelier selections'}</p>
            <h2 id="featured-title">{lang === 'id' ? 'Yang tetap tinggal setelah cahaya padam.' : 'What remains after the lights go down.'}</h2>
          </div>
          <a className="text-link" href="/shop">{t('common.viewAll')} <span aria-hidden="true">↗</span></a>
        </div>
        <div className="product-grid product-grid--four">
          {featured.map((product, index) => (
            <div data-reveal style={revealDelay(index * 75)} key={product.id}>
              <ProductCard product={product} {...cardLabels} />
            </div>
          ))}
        </div>
      </section>

      <section className="story-section">
        <div className="story-image" data-reveal>
          <img src="/assets/img/editorial/model-05.jpg" alt={lang === 'id' ? 'Model dalam gaun gelap' : 'A model in a dark dress'} loading="lazy" />
          <span className="story-image-mark">SE</span>
        </div>
        <div className="story-copy" data-reveal>
          <p className="eyebrow">{t('home.storyKicker')}</p>
          <h2>{t('home.storyTitle')}</h2>
          <p>{t('home.storyText')}</p>
          <a className="text-link" href="/about">{t('home.storyCta')} <span aria-hidden="true">↗</span></a>
          <div className="story-stats">
            <div><span>72</span><small>{lang === 'id' ? 'Karya dalam arsip' : 'Pieces in the archive'}</small></div>
            <div><span>144</span><small>{lang === 'id' ? 'Studi packshot orisinal' : 'Original packshot studies'}</small></div>
            <div><span>9</span><small>{lang === 'id' ? 'Kategori pakaian' : 'Clothing categories'}</small></div>
          </div>
        </div>
      </section>

      <section className="section journal-section" aria-labelledby="journal-title">
        <div className="section-head" data-reveal>
          <div>
            <p className="eyebrow">{t('home.journalKicker')}</p>
            <h2 id="journal-title">{t('home.journalTitle')}</h2>
          </div>
          <a className="text-link" href="/journal">{t('common.viewAll')} <span aria-hidden="true">↗</span></a>
        </div>
        <div className="journal-grid">
          {journal.map((article, index) => (
            <article className="journal-card" data-reveal style={revealDelay(index * 80)} key={article.slug}>
              <a className="journal-card-image" href={`/journal/${article.slug}`}>
                <img src={article.image} alt={article.title} loading="lazy" />
                <span className="journal-read">{t('journal.minRead', { count: article.readMinutes })}</span>
              </a>
              <div className="journal-card-copy">
                <p className="eyebrow">{article.category} · {site.formatDate(article.date)}</p>
                <h3><a href={`/journal/${article.slug}`}>{article.title}</a></h3>
                <p>{article.excerpt}</p>
                <a className="text-link" href={`/journal/${article.slug}`}>{t('journal.read')} <span aria-hidden="true">↗</span></a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="stores-invite">
        <div className="stores-invite-image">
          <img src="/assets/img/editorial/cathedral.jpg" alt={lang === 'id' ? 'Interior katedral gelap' : 'Dark cathedral interior'} loading="lazy" />
        </div>
        <div className="stores-invite-copy" data-reveal>
          <p className="eyebrow">{t('home.storesKicker')}</p>
          <h2>{t('home.storesTitle')}</h2>
          <p>{t('home.storesText')}</p>
          <a className="button button--outline" href="/stores">{t('home.storesCta')} <span aria-hidden="true">↗</span></a>
        </div>
        <div className="stores-invite-coordinates" aria-hidden="true">
          <span>6°13′ S</span><span>106°49′ E</span>
        </div>
      </section>

      {site.socials.length ? (
        <section className="social-invite">
          <p className="eyebrow">{t('home.socialKicker')}</p>
          <h2>{t('home.socialTitle')}</h2>
          <div className="social-invite-links">
            {site.socials.map((social) => (
              <a href={social.href} target="_blank" rel="noopener noreferrer" key={social.platform}>
                {social.label} <span aria-hidden="true">↗</span>
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
