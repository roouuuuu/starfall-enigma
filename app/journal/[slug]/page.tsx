import { notFound } from 'next/navigation';

import { pageMetadata } from '@/lib/metadata';
import { getSiteContext } from '@/lib/site';
import { journalFor } from '@/lib/journal';

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const site = await getSiteContext();
  const article = journalFor(site.lang).find((item) => item.slug === slug);
  if (!article) return pageMetadata({ title: 'Starfall Enigma', noindex: true });
  return pageMetadata({
    title: `${article.title} — Starfall Enigma`,
    description: article.excerpt,
    image: article.image,
    type: 'article',
  });
}

export default async function ArticlePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const site = await getSiteContext();
  const { t, lang } = site;
  const journal = journalFor(lang);
  const article = journal.find((item) => item.slug === slug);
  if (!article) notFound();

  const related = journal.filter((item) => item.slug !== article.slug).slice(0, 2);

  return (
    <main id="main-content" className="article-page">
      <nav className="product-breadcrumbs" aria-label="Breadcrumb">
        <a href="/">{t('common.home')}</a><span aria-hidden="true">/</span>
        <a href="/journal">{t('nav.journal')}</a><span aria-hidden="true">/</span>
        <span>{article.category}</span>
      </nav>
      <article>
        <header className="article-hero">
          <div className="article-hero-copy">
            <p className="eyebrow">{article.category} · {site.formatDate(article.date)}</p>
            <h1>{article.title}</h1>
            <p className="article-deck">{article.excerpt}</p>
            <div className="article-meta">
              <span>{lang === 'id' ? 'Oleh Atelier' : 'By the Atelier'}</span>
              <span>{t('journal.minRead', { count: article.readMinutes })}</span>
              <span>Starfall Enigma</span>
            </div>
          </div>
          <figure className="article-hero-image">
            <img src={article.image} alt={article.title} fetchPriority="high" />
            <figcaption>{lang === 'id' ? 'Studi editorial / Pexels' : 'Editorial study / Pexels'}</figcaption>
          </figure>
        </header>

        <div className="article-body">
          <aside className="article-aside">
            <p className="eyebrow">{t('nav.journal')}</p>
            <p>{lang === 'id' ? 'Catatan dari arsip Starfall Enigma tentang material, keheningan, dan pakaian yang menyimpan misterinya sendiri.' : 'Notes from the Starfall Enigma archive on material, silence, and clothes that keep their own mystery.'}</p>
            <a className="text-link" href="/journal">{lang === 'id' ? 'Semua catatan' : 'All notes'} <span aria-hidden="true">↗</span></a>
          </aside>
          <div className="article-prose">
            {article.body.map((paragraph, index) => (
              <p className={index === 0 ? 'article-first' : ''} key={index}>{paragraph}</p>
            ))}
            <div className="article-end"><span aria-hidden="true">✦</span><span>SE</span></div>
          </div>
        </div>

        <div className="article-shop-cta">
          <div>
            <p className="eyebrow">{lang === 'id' ? 'Dari halaman ke lemari' : 'From page to wardrobe'}</p>
            <h2>{lang === 'id' ? 'Karya yang menyertai catatan ini.' : 'Pieces that keep this note company.'}</h2>
          </div>
          <a className="button button--solid" href="/shop">{t('home.exploreCollection')} <span aria-hidden="true">↗</span></a>
        </div>
      </article>

      {related.length ? (
        <section className="section article-related">
          <div className="section-head">
            <div>
              <p className="eyebrow">{lang === 'id' ? 'Bacaan berikutnya' : 'Continue reading'}</p>
              <h2>{lang === 'id' ? 'Catatan lain dari arsip.' : 'More notes from the archive.'}</h2>
            </div>
          </div>
          <div className="journal-list">
            {related.map((item, index) => (
              <article className="journal-list-card" key={item.slug}>
                <a className="journal-list-image" href={`/journal/${item.slug}`}><img src={item.image} alt={item.title} loading="lazy" /></a>
                <div className="journal-list-copy">
                  <p className="eyebrow">{item.category} · {site.formatDate(item.date)}</p>
                  <h2><a href={`/journal/${item.slug}`}>{item.title}</a></h2>
                  <p>{item.excerpt}</p>
                  <a className="text-link" href={`/journal/${item.slug}`}>{t('journal.read')} <span aria-hidden="true">↗</span></a>
                </div>
                <span className="journal-list-number" aria-hidden="true">0{index + 1}</span>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
