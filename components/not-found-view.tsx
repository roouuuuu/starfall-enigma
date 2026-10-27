import { getSiteContext } from '@/lib/site';

export default async function NotFoundView() {
  const site = await getSiteContext();
  const { t, lang } = site;

  return (
    <main id="main-content" className="error-page">
      <div className="error-orbit" aria-hidden="true"><span>✦</span></div>
      <p className="eyebrow">SE / 404</p>
      <h1>{lang === 'id' ? 'Halaman ini telah menghilang.' : 'This page has vanished.'}</h1>
      <p>{lang === 'id' ? 'Seperti bintang yang jatuh, ia meninggalkan jejak yang tidak bisa diikuti.' : 'Like a fallen star, it left a trace that cannot be followed.'}</p>
      <div className="error-actions">
        <a className="button button--solid" href="/">{t('common.home')} <span aria-hidden="true">↗</span></a>
        <a className="button button--outline" href="/shop">{t('nav.shopAll')}</a>
      </div>
      <span className="error-coordinates">06° 13′ S / 106° 49′ E</span>
    </main>
  );
}
