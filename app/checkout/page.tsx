import { pageMetadata } from '@/lib/metadata';
import { getSiteContext } from '@/lib/site';
import { all } from '@/lib/db';
import { COUNTRIES } from '@/src/countries';

export async function generateMetadata() {
  const site = await getSiteContext();
  return pageMetadata({
    title: `${site.t('checkout.title')} — Starfall Enigma`,
    description: '',
    noindex: true,
  });
}

export default async function CheckoutPage() {
  const site = await getSiteContext();
  const { t, lang, currency } = site;

  const addresses = site.user
    ? await all<Record<string, any>>(
        'SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC',
        [Number(site.user.id)]
      )
    : [];
  const defaultAddress = addresses[0] || null;
  const countries = COUNTRIES as string[];
  const promoCode = String(site.settings.promo_code || '');

  return (
    <>
      <header className="checkout-header">
        <a className="brand" href="/" aria-label="Starfall Enigma">
          <img src="/assets/img/logo-mark.svg" width={30} height={30} alt="" />
          <span className="brand-word">STARFALL ENIGMA</span>
        </a>
        <div className="checkout-header-meta">
          <span className="checkout-secure"><span aria-hidden="true">✦</span> {t('checkout.paymentDemoTitle')}</span>
          <a href="/shop">{t('common.continueShopping')}</a>
        </div>
      </header>

      <main id="main-content" className="checkout-page">
        <div className="checkout-title">
          <p className="eyebrow">{t('checkout.title')} / SE</p>
          <h1>{t('checkout.title')}</h1>
          <p>{lang === 'id' ? 'Lengkapi detail pengiriman. Ini adalah checkout demonstrasi — tidak ada pembayaran nyata yang diproses.' : 'Complete your delivery details. This is a demo checkout — no real payment is processed.'}</p>
        </div>

        <noscript>
          <div className="form-alert">{lang === 'id' ? 'Checkout demo ini memerlukan JavaScript untuk membaca tas lokal Anda.' : 'This demo checkout requires JavaScript to read your local bag.'}</div>
        </noscript>

        <div className="checkout-layout">
          <form className="checkout-form" data-checkout-form noValidate>
            <section className="checkout-step">
              <div className="checkout-step-head"><span>01</span><div><h2>{t('checkout.contact')}</h2><p>{t('checkout.emailNote')}</p></div></div>
              <div className="form-grid">
                <div className="form-field form-field--full">
                  <label htmlFor="checkout-email">{t('common.email')}</label>
                  <input id="checkout-email" type="email" name="email" autoComplete="email" required defaultValue={site.user ? site.user.email : ''} />
                </div>
                <div className="form-field">
                  <label htmlFor="checkout-first">{t('common.firstName')}</label>
                  <input id="checkout-first" type="text" name="firstName" autoComplete="given-name" required defaultValue={defaultAddress ? defaultAddress.first_name : (site.user ? site.user.firstName : '')} />
                </div>
                <div className="form-field">
                  <label htmlFor="checkout-last">{t('common.lastName')}</label>
                  <input id="checkout-last" type="text" name="lastName" autoComplete="family-name" defaultValue={defaultAddress ? defaultAddress.last_name : (site.user ? site.user.lastName : '')} />
                </div>
                <div className="form-field form-field--full">
                  <label htmlFor="checkout-phone">{t('common.phone')}</label>
                  <input id="checkout-phone" type="tel" name="phone" autoComplete="tel" required defaultValue={defaultAddress ? defaultAddress.phone : ''} />
                </div>
              </div>
            </section>

            <section className="checkout-step">
              <div className="checkout-step-head"><span>02</span><div><h2>{t('checkout.shippingAddress')}</h2><p>{lang === 'id' ? 'Alamat pengiriman untuk catatan demo ini.' : 'The delivery address for this demo record.'}</p></div></div>
              <div className="form-grid">
                <div className="form-field form-field--full">
                  <label htmlFor="checkout-address1">{t('common.address')}</label>
                  <input id="checkout-address1" type="text" name="address1" autoComplete="address-line1" required defaultValue={defaultAddress ? defaultAddress.address1 : ''} />
                </div>
                <div className="form-field form-field--full">
                  <label htmlFor="checkout-address2">{t('common.address2')} <em>{t('common.optional')}</em></label>
                  <input id="checkout-address2" type="text" name="address2" autoComplete="address-line2" defaultValue={defaultAddress ? defaultAddress.address2 : ''} />
                </div>
                <div className="form-field">
                  <label htmlFor="checkout-city">{t('common.city')}</label>
                  <input id="checkout-city" type="text" name="city" autoComplete="address-level2" required defaultValue={defaultAddress ? defaultAddress.city : ''} />
                </div>
                <div className="form-field">
                  <label htmlFor="checkout-region">{t('common.region')}</label>
                  <input id="checkout-region" type="text" name="region" autoComplete="address-level1" defaultValue={defaultAddress ? defaultAddress.region : ''} />
                </div>
                <div className="form-field">
                  <label htmlFor="checkout-postal">{t('common.postalCode')}</label>
                  <input id="checkout-postal" type="text" name="postalCode" autoComplete="postal-code" required defaultValue={defaultAddress ? defaultAddress.postal_code : ''} />
                </div>
                <div className="form-field">
                  <label htmlFor="checkout-country">{t('common.country')}</label>
                  <select
                    id="checkout-country"
                    name="country"
                    autoComplete="country-name"
                    required
                    defaultValue={defaultAddress ? defaultAddress.country : 'Indonesia'}
                  >
                    {countries.map((country) => <option value={country} key={country}>{country}</option>)}
                  </select>
                </div>
                <div className="form-field form-field--full">
                  <label htmlFor="checkout-note">{t('checkout.noteLabel')}</label>
                  <textarea id="checkout-note" name="note" rows={3} maxLength={500}></textarea>
                </div>
              </div>
            </section>

            <section className="checkout-step">
              <div className="checkout-step-head"><span>03</span><div><h2>{t('checkout.payment')}</h2><p>{lang === 'id' ? 'Tidak ada data kartu yang diperlukan.' : 'No card details are required.'}</p></div></div>
              <div className="demo-payment">
                <span className="demo-payment-mark" aria-hidden="true">SE</span>
                <div>
                  <h3>{t('checkout.paymentDemoTitle')}</h3>
                  <p>{t('checkout.paymentDemoText')}</p>
                </div>
                <span className="demo-pill">Demo</span>
              </div>
              <label className="check-line check-line--terms">
                <input type="checkbox" name="terms" required />
                <span>
                  {lang === 'id' ? 'Saya menyetujui' : 'I agree to the'}{' '}
                  <a href="/legal#terms" target="_blank" rel="noopener">{t('footer.terms')}</a> {lang === 'id' ? 'dan' : 'and'}{' '}
                  <a href="/legal#privacy" target="_blank" rel="noopener">{t('footer.privacy')}</a>.
                </span>
              </label>
            </section>

            <div className="form-alert" data-checkout-error hidden></div>
            <button className="button button--solid button--full checkout-submit" type="submit" data-checkout-submit>
              <span data-checkout-submit-label>{t('checkout.placeOrder')}</span><span aria-hidden="true">↗</span>
            </button>
            <p className="checkout-footnote">{lang === 'id' ? 'Dengan membuat pesanan demo, stok lokal dan catatan keuangan akan diperbarui. Tidak ada pengiriman atau pembayaran nyata.' : 'By placing a demo order, local stock and finance records will be updated. No real shipment or payment occurs.'}</p>
          </form>

          <aside className="checkout-summary" aria-labelledby="checkout-summary-title">
            <div className="checkout-summary-head">
              <h2 id="checkout-summary-title">{t('checkout.orderSummary')}</h2>
              <span data-checkout-currency>{currency}</span>
            </div>
            <div className="checkout-summary-items" data-checkout-items>
              <p className="summary-loading">{t('common.loading')}…</p>
            </div>
            <form className="promo-form" data-promo-form noValidate>
              <label htmlFor="promo-code">{t('checkout.promo')}</label>
              <div>
                <input id="promo-code" type="text" name="promoCode" autoComplete="off" placeholder={t('checkout.promoCode')} />
                <button type="submit">{t('checkout.promoApply')}</button>
              </div>
              <p className="promo-message" data-promo-message role="status"></p>
              {promoCode ? <p className="promo-hint">{lang === 'id' ? `Kode demo: ${promoCode}` : `Demo code: ${promoCode}`}</p> : null}
            </form>
            <div className="checkout-totals">
              <div><span>{t('common.subtotal')}</span><span data-summary-subtotal>—</span></div>
              <div data-summary-discount-row hidden><span>{t('checkout.discount')}</span><span data-summary-discount>—</span></div>
              <div><span>{t('common.shipping')}</span><span>{t('common.included')}</span></div>
              <div className="checkout-total"><span>{t('common.total')}</span><span data-summary-total>—</span></div>
            </div>
            <p className="checkout-currency-note">{t('cart.currencyNote', { currency })}</p>
            <div className="checkout-promise">
              <span aria-hidden="true">✦</span>
              <p>{t('checkout.deliveryStandard')}<small>{t('checkout.deliveryStandardNote')}</small></p>
            </div>
          </aside>
        </div>
      </main>

      <footer className="checkout-footer">
        <p>{t('footer.disclaimer')}</p>
        <div>
          <a href="/legal">{t('footer.legal')}</a>
          <a href="/client-care">{t('nav.clientCare')}</a>
          <a href="/">{t('common.home')}</a>
        </div>
      </footer>

      <div className="toast-stack" data-toast-stack aria-live="polite"></div>
    </>
  );
}
