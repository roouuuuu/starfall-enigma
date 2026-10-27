import type { Metadata } from 'next';
import { headers } from 'next/headers';

import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import Overlays from '@/components/overlays';
import DeferredScripts from '@/components/deferred-scripts';
import { resolvePage } from '@/lib/routes';
import { getSiteContext } from '@/lib/site';
import { safeJson } from '@/src/utils';

export const dynamic = 'force-dynamic';


export const metadata: Metadata = {
  title: {
    default: 'STARFALL ENIGMA',
    template: '%s',
  },
  description: '',
  icons: { icon: '/assets/img/favicon.svg' },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const site = await getSiteContext();
  const page = resolvePage(site.pathname);
  const headerStore = await headers();
  const nonce = headerStore.get('x-se-nonce') || '';

  const clientState = {
    lang: site.lang,
    currency: site.currency,
    exchangeRate: site.exchangeRate,
    csrfToken: site.csrfToken,
    user: site.user
      ? {
          id: site.user.id,
          firstName: site.user.firstName,
          lastName: site.user.lastName,
          email: site.user.email,
          role: site.user.role,
        }
      : null,
    wishlistIds: site.wishlistIds,
    strings: site.clientStrings,
    page: page.pageKey,
    orderPlaced: false,
    routes: {
      shop: '/shop',
      checkout: '/checkout',
      wishlist: '/wishlist',
      account: '/account',
      login: '/login',
      register: '/register',
      cartResolve: '/api/cart/resolve',
    },
  };

  return (
    <html lang={site.lang}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0a0908" />
        <meta name="color-scheme" content="dark" />
        <link rel="preload" href="/assets/fonts/files/cormorant-garamond-normal-300700-latin.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/assets/fonts/files/jost-normal-300600-latin.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="stylesheet" href={site.asset('/assets/fonts/fonts.css')} />
        <link rel="stylesheet" href={site.asset('/css/storefront.css')} />
      </head>
      <body
        className={page.bodyClass}
        data-page={page.pageKey}
        data-currency={site.currency}
        data-lang={site.lang}
        data-clear-cart="0"
      >
        <a className="skip-link" href="#main-content">
          {site.lang === 'id' ? 'Lewati ke konten' : 'Skip to content'}
        </a>
        <SiteHeader site={site} page={page} />
        {children}
        <SiteFooter site={site} />
        <Overlays site={site} />
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: `window.SE = ${safeJson(clientState)};` }}
        />
        <DeferredScripts sources={['/js/app.js', ...page.scripts]} />
      </body>
    </html>
  );
}
