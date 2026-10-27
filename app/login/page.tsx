import { redirect } from 'next/navigation';

import { pageMetadata } from '@/lib/metadata';
import { getSiteContext } from '@/lib/site';
import { safeRedirect } from '@/src/utils';

type Props = { searchParams: Promise<{ next?: string }> };

export async function generateMetadata() {
  const site = await getSiteContext();
  return pageMetadata({
    title: `${site.t('auth.login')} — Starfall Enigma`,
    description: site.t('auth.loginIntro'),
    noindex: true,
  });
}

export default async function LoginPage({ searchParams }: Props) {
  const site = await getSiteContext();
  const { t, lang } = site;
  if (site.user) redirect(site.user.role === 'admin' ? site.adminBase : '/account');

  const next = safeRedirect((await searchParams).next, '/account');

  return (
    <main id="main-content" className="auth-page">
      <section className="auth-layout">
        <div className="auth-image">
          <img
            src="/assets/img/editorial/model-02.jpg"
            alt={lang === 'id' ? 'Model dalam luaran kulit gelap' : 'A model in dark leather outerwear'}
            fetchPriority="high"
          />
          <div className="auth-image-overlay"></div>
          <div className="auth-image-copy">
            <span className="auth-image-mark" aria-hidden="true">SE</span>
            <p className="eyebrow">{lang === 'id' ? 'Arsip privat' : 'The private archive'}</p>
            <p>{lang === 'id' ? '“Yang Anda simpan mengatakan lebih banyak daripada yang Anda kenakan.”' : '“What you keep says more than what you wear.”'}</p>
          </div>
        </div>
        <div className="auth-card-wrap">
          <div className="auth-card">
            <p className="eyebrow">{t('auth.login')} / SE</p>
            <h1>{t('auth.loginTitle')}</h1>
            <p className="auth-intro">{t('auth.loginIntro')}</p>
            <form className="auth-form" data-auth-form="login" data-next={next} noValidate>
              <div className="form-field">
                <label htmlFor="login-email">{t('common.email')}</label>
                <input id="login-email" name="email" type="email" autoComplete="email" required autoFocus />
              </div>
              <div className="form-field">
                <label htmlFor="login-password">{t('common.password')}</label>
                <div className="password-field">
                  <input id="login-password" name="password" type="password" autoComplete="current-password" required />
                  <button type="button" data-password-toggle aria-label={lang === 'id' ? 'Tampilkan kata sandi' : 'Show password'}>◐</button>
                </div>
              </div>
              <div className="form-alert" data-auth-error hidden></div>
              <button className="button button--solid button--full" type="submit" data-auth-submit>
                {t('auth.loginCta')} <span aria-hidden="true">↗</span>
              </button>
              <p className="auth-terms">
                {lang === 'id' ? 'Dengan masuk, Anda menyetujui penggunaan cookie sesi lokal.' : 'By signing in, you accept the use of a local session cookie.'}{' '}
                <a href="/legal#cookies">{t('footer.cookies')}</a>
              </p>
            </form>
            <div className="auth-switch">
              <p>
                {t('auth.noAccount')}{' '}
                <a href={`/register${next && next !== '/account' ? `?next=${encodeURIComponent(next)}` : ''}`}>{t('auth.registerCta')}</a>
              </p>
            </div>
            <details className="auth-forgot">
              <summary>{t('auth.forgot')}</summary>
              <p>
                {t('auth.forgotNote')}{' '}
                <a href={`mailto:${site.brandEmail}?subject=${encodeURIComponent('Password reset request - Starfall Enigma')}`}>{site.brandEmail}</a>
              </p>
            </details>
          </div>
        </div>
      </section>
    </main>
  );
}
