import { redirect } from 'next/navigation';

import { pageMetadata } from '@/lib/metadata';
import { getSiteContext } from '@/lib/site';
import { getDb } from '@/src/db';
import { statusLabel } from '@/src/utils';

export async function generateMetadata() {
  const site = await getSiteContext();
  return pageMetadata({
    title: site.t('account.metaTitle'),
    description: site.t('account.intro'),
    noindex: true,
  });
}

export default async function AccountPage() {
  const site = await getSiteContext();
  if (!site.user) redirect(`/login?next=${encodeURIComponent('/account')}`);

  const { t, lang, money } = site;
  const db = getDb();
  const accountUser = db.prepare(
    'SELECT id, email, first_name, last_name, phone, role, created_at FROM users WHERE id = ?'
  ).get(Number(site.user.id)) as Record<string, any> | undefined;

  if (!accountUser) redirect('/login');

  const addresses = db.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC')
    .all(Number(site.user.id)) as Array<Record<string, any>>;
  const orders = db.prepare(
    `SELECT o.*, (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
     FROM orders o WHERE o.user_id = ? ORDER BY o.created_at DESC LIMIT 100`
  ).all(Number(site.user.id)) as Array<Record<string, any>>;
  const wishlistCount = Number(
    (db.prepare('SELECT COUNT(*) AS count FROM wishlists WHERE user_id = ?').get(Number(site.user.id)) as { count: number }).count
  );

  return (
    <>
      <main id="main-content" className="account-page" data-account-page>
        <header className="account-hero">
          <div>
            <p className="eyebrow">{t('common.account')} / SE</p>
            <h1>{t('account.hello', { name: accountUser.first_name })}</h1>
            <p>{t('account.intro')}</p>
          </div>
          <div className="account-hero-meta">
            <span>{accountUser.email}</span>
            <span>{lang === 'id' ? 'Anggota sejak' : 'Member since'} {site.formatDate(accountUser.created_at)}</span>
            <span className="account-id">SE / {String(accountUser.id).padStart(4, '0')}</span>
          </div>
        </header>

        <div className="account-layout">
          <aside className="account-nav" aria-label={t('account.accountNavigation')}>
            <button className="account-nav-item is-active" type="button" data-account-tab="profile"><span>01</span>{t('account.profile')}</button>
            <button className="account-nav-item" type="button" data-account-tab="orders"><span>02</span>{t('account.orders')} <small>{orders.length}</small></button>
            <button className="account-nav-item" type="button" data-account-tab="addresses"><span>03</span>{t('account.addresses')} <small>{addresses.length}</small></button>
            <a className="account-nav-item" href="/wishlist"><span>04</span>{t('common.wishlist')} <small>{wishlistCount}</small></a>
            {accountUser.role === 'admin' ? <a className="account-nav-item account-nav-admin" href={site.adminBase}><span>05</span>Dashboard <small>↗</small></a> : null}
            <button className="account-nav-item account-nav-logout" type="button" data-logout><span>—</span>{t('auth.logout')}</button>
          </aside>

          <div className="account-content">
            <section className="account-panel is-active" data-account-panel="profile">
              <div className="account-panel-head">
                <p className="eyebrow">01 / {t('account.profile')}</p>
                <h2>{lang === 'id' ? 'Detail pribadi' : 'Personal details'}</h2>
              </div>
              <form className="account-form" data-profile-form noValidate>
                <div className="form-grid">
                  <div className="form-field">
                    <label htmlFor="account-first">{t('common.firstName')}</label>
                    <input id="account-first" name="firstName" type="text" autoComplete="given-name" defaultValue={accountUser.first_name} required />
                  </div>
                  <div className="form-field">
                    <label htmlFor="account-last">{t('common.lastName')}</label>
                    <input id="account-last" name="lastName" type="text" autoComplete="family-name" defaultValue={accountUser.last_name} />
                  </div>
                  <div className="form-field">
                    <label htmlFor="account-email">{t('common.email')}</label>
                    <input id="account-email" type="email" defaultValue={accountUser.email} disabled />
                    <small>{lang === 'id' ? 'Hubungi concierge untuk mengubah email.' : 'Contact the concierge to change your email.'}</small>
                  </div>
                  <div className="form-field">
                    <label htmlFor="account-phone">{t('common.phone')}</label>
                    <input id="account-phone" name="phone" type="tel" autoComplete="tel" defaultValue={accountUser.phone || ''} />
                  </div>
                </div>
                <div className="form-alert" data-profile-feedback hidden></div>
                <button className="button button--solid" type="submit">{t('account.saveProfile')} <span aria-hidden="true">↗</span></button>
              </form>

              <div className="account-rule"></div>

              <div className="account-panel-head account-panel-head--small">
                <p className="eyebrow">SE / {lang === 'id' ? 'Keamanan' : 'Security'}</p>
                <h2>{t('account.changePassword')}</h2>
              </div>
              <form className="account-form" data-password-form noValidate>
                <div className="form-grid">
                  <div className="form-field form-field--full">
                    <label htmlFor="password-current">{t('account.currentPassword')}</label>
                    <input id="password-current" name="currentPassword" type="password" autoComplete="current-password" required />
                  </div>
                  <div className="form-field">
                    <label htmlFor="password-new">{t('account.newPassword')}</label>
                    <input id="password-new" name="newPassword" type="password" autoComplete="new-password" minLength={8} required />
                  </div>
                  <div className="form-field">
                    <label htmlFor="password-confirm">{lang === 'id' ? 'Konfirmasi kata sandi baru' : 'Confirm new password'}</label>
                    <input id="password-confirm" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />
                  </div>
                </div>
                <div className="form-alert" data-password-feedback hidden></div>
                <button className="button button--outline" type="submit">{t('account.changePassword')}</button>
              </form>
            </section>

            <section className="account-panel" data-account-panel="orders">
              <div className="account-panel-head account-panel-head--row">
                <div><p className="eyebrow">02 / {t('account.orders')}</p><h2>{lang === 'id' ? 'Riwayat pesanan' : 'Order history'}</h2></div>
                <a className="text-link" href="/shop">{t('common.continueShopping')} <span aria-hidden="true">↗</span></a>
              </div>
              {orders.length ? (
                <div className="account-orders">
                  {orders.map((order) => (
                    <article className="account-order" key={order.id}>
                      <div className="account-order-head">
                        <div><span>{t('account.orderNumber')}</span><strong>{order.order_number}</strong></div>
                        <div><span>{t('account.date')}</span><strong>{site.formatDate(order.created_at)}</strong></div>
                        <div><span>{t('account.status')}</span><strong className={`order-status order-status--${order.status}`}>{statusLabel(order.status, lang)}</strong></div>
                        <div><span>Total</span><strong>{money(order.total_usd_cents)}</strong></div>
                      </div>
                      <div className="account-order-foot">
                        <span>{order.item_count} {lang === 'id' ? 'baris karya' : 'piece lines'}</span>
                        <a className="text-link" href={`/order/${encodeURIComponent(order.order_number)}`}>{t('account.viewOrder')} <span aria-hidden="true">↗</span></a>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="account-empty">
                  <span aria-hidden="true">✦</span>
                  <h3>{t('account.noOrders')}</h3>
                  <p>{t('account.noOrdersText')}</p>
                  <a className="button button--outline" href="/shop">{t('cart.startShopping')}</a>
                </div>
              )}
            </section>

            <section className="account-panel" data-account-panel="addresses">
              <div className="account-panel-head account-panel-head--row">
                <div><p className="eyebrow">03 / {t('account.addresses')}</p><h2>{lang === 'id' ? 'Alamat pengiriman' : 'Delivery addresses'}</h2></div>
                <button className="button button--outline account-add-address" type="button" data-address-open>{t('account.addAddress')} <span aria-hidden="true">+</span></button>
              </div>
              <div className="address-list" data-address-list>
                {addresses.length ? addresses.map((address) => (
                  <article className="address-card" data-address-id={address.id} key={address.id}>
                    <div className="address-card-head">
                      <span className="address-label">{address.label}</span>
                      {address.is_default ? <span className="address-default">{t('account.defaultAddress')}</span> : null}
                    </div>
                    <p className="address-name">{address.first_name} {address.last_name}</p>
                    <address>
                      <span>{address.address1}</span>
                      {address.address2 ? <span>{address.address2}</span> : null}
                      <span>{address.city}{address.region ? `, ${address.region}` : ''} {address.postal_code}</span>
                      <span>{address.country}</span>
                      <span>{address.phone}</span>
                    </address>
                    <div className="address-actions">
                      {!address.is_default ? <button className="text-button" type="button" data-address-default={address.id}>{lang === 'id' ? 'Jadikan utama' : 'Make default'}</button> : null}
                      <button className="text-button text-button--muted" type="button" data-address-delete={address.id}>{t('account.deleteAddress')}</button>
                    </div>
                  </article>
                )) : (
                  <div className="account-empty account-empty--compact">
                    <span aria-hidden="true">✦</span>
                    <h3>{t('account.noAddresses')}</h3>
                    <p>{lang === 'id' ? 'Tambahkan alamat agar checkout berikutnya lebih cepat.' : 'Add an address to speed up your next checkout.'}</p>
                  </div>
                )}
              </div>
              <div className="form-alert" data-address-feedback hidden></div>
            </section>
          </div>
        </div>
      </main>

      <dialog className="form-dialog" id="address-dialog" data-address-dialog>
        <form className="form-dialog-inner" data-address-form noValidate>
          <div className="form-dialog-head">
            <div><p className="eyebrow">{t('account.addresses')} / SE</p><h2>{t('account.addAddress')}</h2></div>
            <button className="icon-button" type="button" data-address-close aria-label={t('common.close')}>×</button>
          </div>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="address-label">Label</label>
              <input id="address-label" name="label" type="text" defaultValue="Rumah" maxLength={40} />
            </div>
            <div className="form-field">
              <label htmlFor="address-country">{t('common.country')}</label>
              <input id="address-country" name="country" type="text" defaultValue="Indonesia" autoComplete="country-name" />
            </div>
            <div className="form-field">
              <label htmlFor="address-first">{t('common.firstName')}</label>
              <input id="address-first" name="firstName" type="text" defaultValue={accountUser.first_name} autoComplete="given-name" required />
            </div>
            <div className="form-field">
              <label htmlFor="address-last">{t('common.lastName')}</label>
              <input id="address-last" name="lastName" type="text" defaultValue={accountUser.last_name} autoComplete="family-name" />
            </div>
            <div className="form-field form-field--full">
              <label htmlFor="address-line1">{t('common.address')}</label>
              <input id="address-line1" name="address1" type="text" autoComplete="address-line1" required />
            </div>
            <div className="form-field form-field--full">
              <label htmlFor="address-line2">{t('common.address2')} <em>{t('common.optional')}</em></label>
              <input id="address-line2" name="address2" type="text" autoComplete="address-line2" />
            </div>
            <div className="form-field">
              <label htmlFor="address-city">{t('common.city')}</label>
              <input id="address-city" name="city" type="text" autoComplete="address-level2" required />
            </div>
            <div className="form-field">
              <label htmlFor="address-region">{t('common.region')}</label>
              <input id="address-region" name="region" type="text" autoComplete="address-level1" />
            </div>
            <div className="form-field">
              <label htmlFor="address-postal">{t('common.postalCode')}</label>
              <input id="address-postal" name="postalCode" type="text" autoComplete="postal-code" required />
            </div>
            <div className="form-field">
              <label htmlFor="address-phone">{t('common.phone')}</label>
              <input id="address-phone" name="phone" type="tel" defaultValue={accountUser.phone || ''} autoComplete="tel" />
            </div>
            <label className="check-line form-field--full">
              <input type="checkbox" name="isDefault" />
              <span>{lang === 'id' ? 'Jadikan alamat utama' : 'Set as default address'}</span>
            </label>
          </div>
          <div className="form-alert" data-address-dialog-error hidden></div>
          <div className="form-dialog-actions">
            <button className="text-button" type="button" data-address-close>{t('common.cancel')}</button>
            <button className="button button--solid" type="submit">{t('common.save')} <span aria-hidden="true">↗</span></button>
          </div>
        </form>
      </dialog>
    </>
  );
}
