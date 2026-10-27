export type PageInfo = {
  pageKey: string;
  bodyClass: string;
  activeNav: string;
  scripts: string[];
};

const HOME: PageInfo = { pageKey: 'home', bodyClass: 'page-home', activeNav: 'home', scripts: [] };

export function resolvePage(pathname: string): PageInfo {
  if (pathname === '/') return HOME;

  if (pathname === '/shop') return { pageKey: 'shop', bodyClass: 'page-shop', activeNav: 'shop', scripts: ['/js/shop.js'] };
  if (pathname.startsWith('/shop/')) {
    const category = pathname.slice('/shop/'.length).split('/')[0];
    return { pageKey: 'shop', bodyClass: 'page-shop', activeNav: category || 'shop', scripts: ['/js/shop.js'] };
  }

  if (pathname.startsWith('/product/')) return { pageKey: 'product', bodyClass: 'page-product', activeNav: '', scripts: ['/js/product.js'] };
  if (pathname === '/wishlist') return { pageKey: 'wishlist', bodyClass: 'page-wishlist', activeNav: '', scripts: ['/js/wishlist.js'] };
  if (pathname === '/checkout') return { pageKey: 'checkout', bodyClass: 'page-checkout', activeNav: '', scripts: ['/js/checkout.js'] };
  if (pathname.startsWith('/order/')) return { pageKey: 'order', bodyClass: 'page-order', activeNav: '', scripts: ['/js/order.js'] };

  if (pathname === '/journal') return { pageKey: 'journal', bodyClass: 'page-journal', activeNav: 'journal', scripts: [] };
  if (pathname.startsWith('/journal/')) return { pageKey: 'journal', bodyClass: 'page-article', activeNav: 'journal', scripts: [] };

  if (pathname === '/about') return { pageKey: 'about', bodyClass: 'page-about', activeNav: 'about', scripts: [] };
  if (pathname === '/stores') return { pageKey: 'stores', bodyClass: 'page-stores', activeNav: 'stores', scripts: [] };
  if (pathname === '/client-care') return { pageKey: 'care', bodyClass: 'page-care', activeNav: 'client-care', scripts: [] };
  if (pathname === '/legal') return { pageKey: 'legal', bodyClass: 'page-legal', activeNav: '', scripts: [] };
  if (pathname === '/credits') return { pageKey: 'credits', bodyClass: 'page-credits', activeNav: '', scripts: [] };

  if (pathname === '/login') return { pageKey: 'login', bodyClass: 'page-auth', activeNav: '', scripts: ['/js/auth.js'] };
  if (pathname === '/register') return { pageKey: 'register', bodyClass: 'page-auth', activeNav: '', scripts: ['/js/auth.js'] };
  if (pathname === '/account') return { pageKey: 'account', bodyClass: 'page-account', activeNav: '', scripts: ['/js/account.js'] };

  return { pageKey: '', bodyClass: '', activeNav: '', scripts: [] };
}
