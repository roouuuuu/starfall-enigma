import { redirect } from 'next/navigation';

import { pageMetadata } from '@/lib/metadata';
import { getSiteContext } from '@/lib/site';
import { safeRedirect } from '@/src/utils';

type Props = { searchParams: Promise<{ next?: string }> };

export async function generateMetadata() {
  const site = await getSiteContext();
  return pageMetadata({
    title: `${site.t('auth.register')} — Starfall Enigma`,
    description: site.t('auth.registerIntro'),
    noindex: true,
  });
}

export default async function RegisterPage({ searchParams }: Props) {
  const site = await getSiteContext();
  const { t, lang } = site;
  if (site.user) redirect(site.user.role === 'admin' ? site.adminBase : '/account');

  const next = safeRedirect((await searchParams).next, '/account');

  return (
    <main id="main-content" className="auth-page">
      <section className="auth-layout auth-layout--reverse">
        <div className="auth-image">
          <img
            src="/assets/img/editorial/model-01.jpg"
            alt={lang === 'id' ? 'Model dalam jaket kulit gelap' : 'A model in a dark leather jacket'}
            fetchPriority="high"
          />
          <div className="auth-image-overlay"></div>
          <div className="auth-image-copy">
            <span className="auth-image-mark" aria-hidden="true">SE</span>
            <p className="eyebrow">{lang === 'id' ? 'Lingkaran dalam' : 'The inner circle'}</p>
            <p>{lang === 'id' ? 'Pesan privat, arsip tersimpan, dan akses awal ke setiap rilis.' : 'Private notes, a saved archive, and early access to each release.'}</p>
          </div>
        </div>
        <div className="auth-card-wrap">
          <div className="auth-card">
            <p className="eyebrow">{t('auth.register')} / SE</p>
            <h1>{t('auth.registerTitle')}</h1>
            <p className="auth-intro">{t('auth.registerIntro')}</p>
            <form className="auth-form" data-auth-form="register" data-next={next} noValidate>
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="register-first">{t('common.firstName')}</label>
                  <input id="register-first" name="firstName" type="text" autoComplete="given-name" required autoFocus />
                </div>
                <div className="form-field">
                  <label htmlFor="register-last">{t('common.lastName')}</label>
                  <input id="register-last" name="lastName" type="text" autoComplete="family-name" />
                </div>
              </div>
              <div className="form-field">
                <label htmlFor="register-email">{t('common.email')}</label>
                <input id="register-email" name="email" type="email" autoComplete="email" required />
              </div>
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="register-password">{t('common.password')}</label>
                  <div className="password-field">
                    <input id="register-password" name="password" type="password" autoComplete="new-password" minLength={8} required />
                    <button type="button" data-password-toggle aria-label={lang === 'id' ? 'Tampilkan kata sandi' : 'Show password'}>◐</button>
                  </div>
                </div>
                <div className="form-field">
                  <label htmlFor="register-confirm">{t('auth.confirmPassword')}</label>
                  <input id="register-confirm" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />
                </div>
              </div>
              <label className="check-line auth-newsletter">
                <input type="checkbox" name="subscribe" defaultChecked />
                <span>{t('auth.newsletter')}</span>
              </label>
              <div className="form-alert" data-auth-error hidden></div>
              <button className="button button--solid button--full" type="submit" data-auth-submit>
                {t('auth.registerCta')} <span aria-hidden="true">↗</span>
              </button>
              <p className="auth-terms">
                {lang === 'id' ? 'Dengan membuat akun, Anda menyetujui' : 'By creating an account, you agree to our'}{' '}
                <a href="/legal#terms">{t('footer.terms')}</a> {lang === 'id' ? 'dan' : 'and'} <a href="/legal#privacy">{t('footer.privacy')}</a>.
              </p>
            </form>
            <div className="auth-switch">
              <p>
                {t('auth.hasAccount')}{' '}
                <a href={`/login${next && next !== '/account' ? `?next=${encodeURIComponent(next)}` : ''}`}>{t('auth.loginCta')}</a>
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
