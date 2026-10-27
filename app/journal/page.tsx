import { pageMetadata } from '@/lib/metadata';
import { getSiteContext } from '@/lib/site';
import { journalFor } from '@/lib/journal';

const revealDelay = (ms: number) => ({ '--reveal-delay': `${ms}ms` }) as React.CSSProperties;

export async function generateMetadata() {
  const site = await getSiteContext();
  return pageMetadata({
    title: site.t('journal.metaTitle'),
    description: site.t('journal.intro'),
  });
}

export default async function JournalPage() {
  const site = await getSiteContext();
  const { t, lang } = site;
  const journal = journalFor(lang);
  const [lead, ...rest] = journal;

  return (
    <main id="main-content" className="journal-page">
      <header className="journal-hero">
        <p className="eyebrow">{t('journal.kicker')} / SE</p>
        <h1>{t('journal.title')}</h1>
        <p>{t('journal.intro')}</p>
        <div className="journal-hero-meta">
          <span>{lang === 'id' ? 'Esai & studi atelier' : 'Essays & atelier studies'}</span>
          <span>{journal.length} {lang === 'id' ? 'catatan' : 'notes'}</span>
          <span>2026</span>
        </div>
      </header>

      {lead ? (
        <article className="journal-lead">
          <a className="journal-lead-image" href={`/journal/${lead.slug}`}>
            <img src={lead.image} alt={lead.title} fetchPriority="high" />
            <span className="journal-read">{t('journal.minRead', { count: lead.readMinutes })}</span>
          </a>
          <div className="journal-lead-copy">
            <p className="eyebrow">{lead.category} · {site.formatDate(lead.date)}</p>
            <h2><a href={`/journal/${lead.slug}`}>{lead.title}</a></h2>
            <p>{lead.excerpt}</p>
            <a className="button button--outline" href={`/journal/${lead.slug}`}>{t('journal.read')} <span aria-hidden="true">↗</span></a>
            <span className="journal-lead-number" aria-hidden="true">01</span>
          </div>
        </article>
      ) : null}

      <div className="journal-list">
        {rest.map((article, index) => (
          <article className="journal-list-card" data-reveal style={revealDelay(index * 80)} key={article.slug}>
            <a className="journal-list-image" href={`/journal/${article.slug}`}>
              <img src={article.image} alt={article.title} loading="lazy" />
            </a>
            <div className="journal-list-copy">
              <p className="eyebrow">{article.category} · {site.formatDate(article.date)} · {t('journal.minRead', { count: article.readMinutes })}</p>
              <h2><a href={`/journal/${article.slug}`}>{article.title}</a></h2>
              <p>{article.excerpt}</p>
              <a className="text-link" href={`/journal/${article.slug}`}>{t('journal.read')} <span aria-hidden="true">↗</span></a>
            </div>
            <span className="journal-list-number" aria-hidden="true">0{index + 2}</span>
          </article>
        ))}
      </div>

      <section className="journal-invite">
        <p className="eyebrow">{lang === 'id' ? 'Surat privat' : 'Private correspondence'}</p>
        <h2>{lang === 'id' ? 'Catatan yang dikirim setelah gelap.' : 'Notes delivered after dark.'}</h2>
        <p>{t('footer.newsletterText')}</p>
        <a className="button button--outline" href="#footer-newsletter-email">{t('footer.subscribe')} <span aria-hidden="true">↗</span></a>
      </section>
    </main>
  );
}
