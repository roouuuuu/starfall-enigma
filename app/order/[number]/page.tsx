import { notFound } from 'next/navigation';

import { pageMetadata } from '@/lib/metadata';
import { getSiteContext } from '@/lib/site';
import { getOrderByNumber, getOrderItems } from '@/lib/order-service';
import { formatMoney, statusLabel } from '@/src/utils';

type Props = {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ placed?: string }>;
};

async function loadOrder(number: string, site: Awaited<ReturnType<typeof getSiteContext>>) {
  const order = await getOrderByNumber(number);
  if (!order) return null;
  const authorized = Boolean(
    site.user?.role === 'admin' ||
    (site.user && Number(order.user_id) === Number(site.user.id)) ||
    (order.session_hash && order.session_hash === site.sessionHash)
  );
  if (!authorized) return null;
  return { order, items: await getOrderItems(order.id) };
}

export async function generateMetadata({ params }: Props) {
  const { number } = await params;
  const site = await getSiteContext();
  const data = await loadOrder(number, site);
  return pageMetadata({
    title: data ? `${site.lang === 'id' ? 'Pesanan' : 'Order'} ${data.order.order_number} — Starfall Enigma` : 'Starfall Enigma',
    description: '',
    noindex: true,
  });
}

export default async function OrderPage({ params, searchParams }: Props) {
  const { number } = await params;
  const site = await getSiteContext();
  const { t, lang } = site;
  const data = await loadOrder(number, site);
  if (!data) notFound();

  const { order, items } = data;
  const placed = (await searchParams).placed === '1';
  const rate = Number(order.exchange_rate);

  const orderMoney = (cents: number) => formatMoney(Number(cents || 0), order.currency, rate);
  const otherMoney = (cents: number) => formatMoney(
    Number(cents || 0),
    order.currency === 'USD' ? 'IDR' : 'USD',
    rate
  );

  return (
    <main id="main-content" className="order-page">
      <header className="order-hero">
        <span className="order-hero-mark" aria-hidden="true">✦</span>
        <p className="eyebrow">{placed ? t('checkout.successTitle') : `${t('checkout.orderNumber')} ${order.order_number}`}</p>
        <h1>{placed ? t('checkout.successTitle') : (lang === 'id' ? 'Detail pesanan' : 'Order detail')}</h1>
        <p>{placed ? t('checkout.successText') : (lang === 'id' ? 'Rincian catatan demo Anda.' : 'The details of your demo record.')}</p>
        <div className="order-hero-meta">
          <span className={`order-status order-status--${order.status}`}>{statusLabel(order.status, lang)}</span>
          <span>{site.formatDate(order.created_at)}</span>
          <span>{order.order_number}</span>
        </div>
      </header>

      {order.status === 'cancelled' ? (
        <div className="order-banner">
          <strong>{lang === 'id' ? 'Pesanan dibatalkan.' : 'Order cancelled.'}</strong>
          <span>{lang === 'id' ? 'Stok telah dikembalikan dan pemasukan dibalik dalam buku kas.' : 'Stock has been restored and income reversed in the ledger.'}</span>
        </div>
      ) : null}

      <div className="demo-banner">
        <span aria-hidden="true">✦</span>
        <p><strong>{t('checkout.paymentDemoTitle')}</strong> {t('checkout.successText')}</p>
      </div>

      <div className="order-layout">
        <section className="order-main">
          <div className="order-section-head">
            <h2>{lang === 'id' ? 'Karya dalam pesanan' : 'Pieces in this order'}</h2>
            <span>{items.length} {lang === 'id' ? 'baris' : 'lines'}</span>
          </div>
          <div className="order-items">
            {items.map((item) => (
              <div className="order-item" key={item.id}>
                <a href={`/product/${item.slug}`} className="order-item-image">
                  <img src={item.image_a} alt={item.product_name} />
                </a>
                <div className="order-item-copy">
                  <h3><a href={`/product/${item.slug}`}>{item.product_name}</a></h3>
                  <p>{item.variant_label} · {t('common.quantity')} {item.quantity}</p>
                  <span>{orderMoney(item.unit_price_usd_cents)}</span>
                </div>
                <strong>{orderMoney(item.total_usd_cents)}</strong>
              </div>
            ))}
          </div>

          <div className="order-info-grid">
            <div>
              <p className="eyebrow">{t('checkout.shippingAddress')}</p>
              <address>
                <strong>{order.first_name} {order.last_name}</strong>
                <span>{order.address1}</span>
                {order.address2 ? <span>{order.address2}</span> : null}
                <span>{order.city}{order.region ? `, ${order.region}` : ''} {order.postal_code}</span>
                <span>{order.country}</span>
              </address>
            </div>
            <div>
              <p className="eyebrow">{t('footer.contact')}</p>
              <p>{order.email}</p>
              {order.phone ? <p>{order.phone}</p> : null}
              {order.note ? (
                <>
                  <p className="order-note-label">{t('checkout.noteLabel')}</p>
                  <p className="order-note">{order.note}</p>
                </>
              ) : null}
            </div>
            <div>
              <p className="eyebrow">{t('checkout.payment')}</p>
              <p><strong>{t('checkout.paymentDemoTitle')}</strong></p>
              <p>{lang === 'id' ? 'Tidak ada pembayaran nyata yang diambil.' : 'No real payment was taken.'}</p>
            </div>
          </div>
        </section>

        <aside className="order-summary">
          <h2>{t('checkout.orderSummary')}</h2>
          <div className="order-summary-lines">
            <div><span>{t('common.subtotal')}</span><span>{orderMoney(order.subtotal_usd_cents)}</span></div>
            {Number(order.discount_usd_cents) > 0 ? (
              <div>
                <span>{t('checkout.discount')} {order.promo_code ? `(${order.promo_code})` : ''}</span>
                <span>−{orderMoney(order.discount_usd_cents)}</span>
              </div>
            ) : null}
            <div><span>{t('common.shipping')}</span><span>{t('common.included')}</span></div>
            <div className="order-summary-total"><span>{t('common.total')}</span><span>{orderMoney(order.total_usd_cents)}</span></div>
          </div>
          {order.currency === 'USD' ? (
            <p className="order-secondary-total">≈ {otherMoney(order.total_usd_cents)} IDR</p>
          ) : (
            <p className="order-secondary-total">≈ {formatMoney(order.total_usd_cents, 'USD', rate)} USD</p>
          )}
          <p className="order-currency-note">
            {lang === 'id'
              ? `Nilai tukar demo: 1 USD = ${Number(order.exchange_rate).toLocaleString('id-ID')} IDR`
              : `Demo exchange rate: 1 USD = ${Number(order.exchange_rate).toLocaleString('en-US')} IDR`}
          </p>
          <div className="order-actions">
            <button className="button button--outline button--full" type="button" data-print-order>{t('checkout.print')}</button>
            <a className="button button--solid button--full" href="/shop">{t('common.continueShopping')} <span aria-hidden="true">↗</span></a>
          </div>
          {site.user ? <a className="text-link order-account-link" href="/account">{t('common.account')} <span aria-hidden="true">↗</span></a> : null}
          <p className="order-help">{lang === 'id' ? 'Butuh bantuan?' : 'Need help?'} <a href={`mailto:${site.brandEmail}`}>{site.brandEmail}</a></p>
        </aside>
      </div>
    </main>
  );
}
