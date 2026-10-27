'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const {
  ADMIN_BASE,
  Client,
  createSeededDatabase,
  removeTempDir,
  startTestServer,
  stopTestServer,
  csrfFrom
} = require('./helpers');

const OWNER = {
  email: 'owner@starfallenigma.test',
  password: 'StarfallOwner2026#',
  firstName: 'Starfall',
  lastName: 'Owner'
};

const CUSTOMER = {
  email: 'customer@starfallenigma.test',
  password: 'Customer2026#',
  firstName: 'Mara',
  lastName: 'Voss'
};

// Node's fetch (undici) injects `cache-control: no-cache` as soon as a request
// carries conditional headers, which defeats revalidation. Raw HTTP keeps the
// test honest about the 304 a browser receives on a normal navigation.
function conditionalGet(baseUrl, pathname, headers) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, baseUrl);
    const request = http.request(
      { hostname: url.hostname, port: url.port, path: `${url.pathname}${url.search}`, method: 'GET', headers },
      (response) => {
        response.resume();
        response.on('end', () => resolve({ status: response.statusCode, headers: response.headers }));
      }
    );
    request.on('error', reject);
    request.end();
  });
}

let temp;
let ctx;
let db;
let guest;
let admin;
let adminToken;
let productSlug;
let journalSlug;

before(async () => {
  temp = createSeededDatabase();
  ctx = await startTestServer(temp.dbPath);
  db = ctx.db;
  guest = new Client(ctx.baseUrl);
  admin = new Client(ctx.baseUrl);
  productSlug = db.prepare('SELECT slug FROM products ORDER BY id LIMIT 1').get().slug;
  journalSlug = require('../src/content').JOURNAL[0].slug;
});

after(async () => {
  await stopTestServer(ctx?.server, db);
  if (temp) removeTempDir(temp.dir);
});

async function expectPage(client, path, expectedStatus = 200) {
  const page = await client.text(path);
  const label = `${path} returned ${page.status}\n${page.text.slice(0, 220)}`;
  assert.equal(page.status, expectedStatus, label);
  return page;
}

async function tokenFor(client, path) {
  const page = await expectPage(client, path);
  return { ...page, token: csrfFrom(page.text) };
}

async function currentAdminToken() {
  const page = await expectPage(admin, '/admin');
  adminToken = csrfFrom(page.text);
  return adminToken;
}

function orderBody(variantId, overrides = {}) {
  return {
    email: 'guest@starfallenigma.test',
    firstName: 'Guest',
    lastName: 'Shopper',
    phone: '081234567890',
    address1: 'Jl. Malam No. 7',
    address2: 'Lantai 2',
    city: 'Jakarta',
    region: 'DKI Jakarta',
    postalCode: '12110',
    country: 'Indonesia',
    note: 'Uji checkout demo',
    currency: 'USD',
    items: [{ variantId, quantity: 1 }],
    ...overrides
  };
}

test('first-run setup is one-time, login/logout rotates secure sessions', async () => {
  let response = await guest.request('/admin');
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), `${ADMIN_BASE}/setup`);

  const blocked = await guest.json('/api/admin/dashboard');
  assert.equal(blocked.status, 401);
  assert.equal(blocked.data?.error?.code, 'admin_required');

  const setupPage = await tokenFor(guest, '/setup');
  assert.match(setupPage.text, /<html[^>]*lang="id"/);
  assert.match(setupPage.text, /Penyiapan/);

  const noCsrf = await guest.json('/api/setup', {
    method: 'POST',
    body: { ...OWNER, confirmPassword: OWNER.password }
  });
  assert.equal(noCsrf.status, 419);

  const weak = await guest.json('/api/setup', {
    method: 'POST',
    csrf: setupPage.token,
    body: { ...OWNER, password: 'short', confirmPassword: 'short' }
  });
  assert.equal(weak.status, 422);

  const created = await guest.json('/api/setup', {
    method: 'POST',
    csrf: setupPage.token,
    body: { ...OWNER, confirmPassword: OWNER.password }
  });
  assert.equal(created.status, 201, created.raw);
  assert.equal(created.data.ok, true);
  assert.equal(created.data.redirect, ADMIN_BASE);

  const sessionCookie = guest.lastSetCookies.find((line) => line.startsWith('se_session='));
  assert.ok(sessionCookie, 'setup must create a session cookie');
  assert.match(sessionCookie, /HttpOnly/i);
  assert.match(sessionCookie, /SameSite=Lax/i);

  const dashboard = await tokenFor(guest, '/admin');
  assert.match(dashboard.text, /<html[^>]*lang="id"/);
  assert.doesNotMatch(dashboard.text, /password_hash|scrypt\$/);
  admin = guest;
  adminToken = dashboard.token;

  const setupAgainPage = await guest.request('/setup');
  assert.equal(setupAgainPage.status, 302);
  assert.equal(setupAgainPage.headers.get('location'), ADMIN_BASE);
  const setupAgainApi = await guest.json('/api/setup', {
    method: 'POST',
    csrf: adminToken,
    body: { ...OWNER, email: 'second-admin@starfallenigma.test', confirmPassword: OWNER.password }
  });
  assert.equal(setupAgainApi.status, 403);

  const settings = await admin.json('/api/admin/settings');
  assert.equal(settings.status, 200);
  assert.equal(settings.data.counts.admins, 1);
  assert.equal(settings.data.counts.products, 72);
  assert.equal(settings.data.counts.variants, 360);
  assert.doesNotMatch(settings.raw, /password_hash|scrypt\$/);

  const logout = await admin.json('/api/auth/logout', { method: 'POST', csrf: adminToken });
  assert.equal(logout.status, 200);
  const afterLogout = await admin.request('/admin');
  assert.equal(afterLogout.status, 302);
  assert.equal(afterLogout.headers.get('location'), `${ADMIN_BASE}/login`);

  const loginClient = new Client(ctx.baseUrl);
  const loginPage = await tokenFor(loginClient, '/admin/login?lang=en');
  assert.match(loginPage.text, /<html[^>]*lang="id"/);
  assert.match(loginPage.text, /Masuk dasbor/);
  assert.doesNotMatch(loginPage.text, /password_hash|scrypt\$/);

  const wrong = await loginClient.json('/api/admin/login', {
    method: 'POST',
    csrf: loginPage.token,
    body: { email: OWNER.email, password: 'DefinitelyWrong2026#' }
  });
  assert.equal(wrong.status, 401);

  const login = await loginClient.json('/api/admin/login', {
    method: 'POST',
    csrf: loginPage.token,
    body: { email: OWNER.email, password: OWNER.password }
  });
  assert.equal(login.status, 200, login.raw);
  assert.equal(login.data.user.role, 'admin');
  assert.ok(login.data.user.email);
  assert.doesNotMatch(login.raw, /password_hash|scrypt\$/);

  const loginCookie = loginClient.lastSetCookies.find((line) => line.startsWith('se_session='));
  assert.ok(loginCookie);
  assert.match(loginCookie, /HttpOnly/i);

  const rawSession = loginClient.cookies.get('se_session');
  assert.match(rawSession, /^[a-f0-9]{64}$/);
  const hash = crypto.createHash('sha256').update(rawSession).digest('hex');
  const stored = db.prepare('SELECT token_hash, user_id FROM sessions WHERE token_hash = ?').get(hash);
  assert.ok(stored, 'the session must be stored by its SHA-256 hash');
  assert.notEqual(stored.token_hash, rawSession);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM sessions WHERE token_hash = ?').get(rawSession).count, 0);

  admin = loginClient;
  adminToken = await currentAdminToken();

  for (const route of ['/admin', '/admin/orders', '/admin/inventory', '/admin/finance', '/admin/social', '/admin/customers', '/admin/settings']) {
    const page = await expectPage(admin, route);
    assert.match(page.text, /<html[^>]*lang="id"/);
    assert.doesNotMatch(page.text, /password_hash|scrypt\$/);
    assert.match(page.response.headers.get('x-robots-tag') || '', /noindex/i);
  }
});

test('storefront, CSP, bilingual routes, search, and missing pages behave safely', async () => {
  const store = new Client(ctx.baseUrl);
  const homeResponse = await store.request('/');
  assert.equal(homeResponse.status, 200);
  assert.equal(homeResponse.headers.get('x-powered-by'), null);
  assert.equal(homeResponse.headers.get('x-frame-options'), 'DENY');
  assert.match(homeResponse.headers.get('referrer-policy') || '', /strict-origin/);
  assert.match(homeResponse.headers.get('permissions-policy') || '', /camera=\(\)/);
  assert.match(homeResponse.headers.get('cross-origin-opener-policy') || '', /same-origin/);
  const csp = homeResponse.headers.get('content-security-policy') || '';
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
  assert.ok(nonce, 'CSP must contain a per-request nonce');
  const home = await homeResponse.text();
  assert.match(home, new RegExp(`nonce="${nonce.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  assert.match(home, /<html[^>]*lang="en"/);
  const resourceUrls = [...home.matchAll(/<(?:script|link|img)\b[^>]*(?:src|href)="([^"]+)"/gi)].map((match) => match[1]);
  const externalResources = resourceUrls.filter((url) => {
    if (url.startsWith('/') || url.startsWith('data:')) return false;
    try { return new URL(url).hostname !== '127.0.0.1'; } catch (_) { return true; }
  });
  assert.deepEqual(externalResources, []);

  const unauthAdmin = await store.request('/admin');
  assert.equal(unauthAdmin.status, 302);
  assert.equal(unauthAdmin.headers.get('location'), `${ADMIN_BASE}/login`);
  assert.match(unauthAdmin.headers.get('x-robots-tag') || '', /noindex/i);

  const unauthApi = await store.json('/api/admin/dashboard');
  assert.equal(unauthApi.status, 401);

  const pagePaths = [
    '/',
    '/shop',
    '/shop/outerwear',
    `/product/${productSlug}`,
    '/wishlist',
    '/checkout',
    '/journal',
    `/journal/${journalSlug}`,
    '/about',
    '/stores',
    '/client-care',
    '/legal',
    '/credits',
    '/login',
    '/register'
  ];
  for (const path of pagePaths) {
    const page = await expectPage(store, path);
    assert.match(page.response.headers.get('content-security-policy') || '', /default-src 'self'/, path);
    assert.match(page.text, /<html[^>]*lang="(en|id)"/, path);
    assert.match(page.text, /<main id="main-content"/, path);
    assert.equal((page.text.match(/<h1\b/gi) || []).length, 1, `${path} needs exactly one h1`);
    assert.match(page.text, /<title>[^<]+<\/title>/, `${path} needs a title`);
    assert.doesNotMatch(page.text, /password_hash|scrypt\$/, `${path} leaked a password field`);
  }

  const accountRedirect = await store.request('/account');
  assert.equal(accountRedirect.status, 302);
  assert.match(accountRedirect.headers.get('location') || '', /^\/login\?next=/);

  const checkout = await expectPage(store, '/checkout');
  assert.match(checkout.text, /href="\/legal#terms"/);
  assert.match(checkout.text, /href="\/legal#privacy"/);

  const search = await store.json('/api/products?search=eclipse');
  assert.equal(search.status, 200);
  assert.ok(search.data.items.length > 0);
  const emptySearch = await store.json('/api/products?search=zzzzzzzz');
  assert.equal(emptySearch.status, 200);
  assert.equal(emptySearch.data.items.length, 0);
  await expectPage(store, '/shop?search=eclipse');

  const preferences = await store.request('/preferences?lang=id&redirect=%2Fshop%2Fouterwear');
  assert.equal(preferences.status, 302);
  const idPage = await expectPage(store, '/shop/outerwear');
  assert.match(idPage.text, /<html[^>]*lang="id"/);
  assert.match(idPage.text, /Luaran/);

  const currencyPreference = await store.request('/preferences?lang=en&currency=IDR&redirect=%2Fshop');
  assert.equal(currencyPreference.status, 302);
  const currencyPage = await expectPage(store, '/shop');
  assert.match(currencyPage.text, /\bRp\s?[\d.]+/);
  await store.request('/preferences?lang=en&currency=USD&redirect=%2F');

  const missingPage = await expectPage(store, '/a-page-that-does-not-exist', 404);
  assert.match(missingPage.text, /<main id="main-content"/);
  const missingApi = await store.json('/api/a-page-that-does-not-exist');
  assert.equal(missingApi.status, 404);
  assert.equal(missingApi.data.ok, false);

  const noCsrfOrder = await store.json('/api/orders', { method: 'POST', body: orderBody(1) });
  assert.equal(noCsrfOrder.status, 419);

  const sitemap = await store.text('/sitemap.xml');
  assert.equal(sitemap.status, 200);
  assert.match(sitemap.text, /<urlset/);
  assert.equal((sitemap.text.match(/\/product\//g) || []).length, 72);
  assert.doesNotMatch(sitemap.text, /\/admin/);
  const robots = await store.text('/robots.txt');
  assert.equal(robots.status, 200);
  assert.match(robots.text, /Disallow: \/admin/);
  assert.match(robots.text, /Disallow: \/api\//);
  assert.match(robots.text, /Sitemap: http/);
  const health = await store.json('/health');
  assert.equal(health.status, 200);
  assert.equal(health.data.ok, true);
  const unknownSocial = await store.request('/go/not-a-network');
  assert.equal(unknownSocial.status, 302);
  assert.equal(unknownSocial.headers.get('location'), '/');
});

test('customers can register, sync wishlists, manage addresses, and see order history', async () => {
  const customer = new Client(ctx.baseUrl);
  const registerPage = await tokenFor(customer, '/register');
  const registration = await customer.json('/api/auth/register', {
    method: 'POST',
    csrf: registerPage.token,
    body: {
      ...CUSTOMER,
      confirmPassword: CUSTOMER.password,
      wishlistProductIds: [1]
    }
  });
  assert.equal(registration.status, 201, registration.raw);
  assert.equal(registration.data.user.email, CUSTOMER.email);
  assert.doesNotMatch(registration.raw, /password_hash|scrypt\$/);
  const customerCookie = customer.lastSetCookies.find((line) => line.startsWith('se_session='));
  assert.ok(customerCookie);
  assert.match(customerCookie, /HttpOnly/i);

  const customerAdmin = await customer.request('/admin');
  assert.equal(customerAdmin.status, 302);
  assert.equal(customerAdmin.headers.get('location'), `${ADMIN_BASE}/login`);

  const wishlist = await customer.json('/api/wishlist');
  assert.equal(wishlist.status, 200);
  assert.deepEqual(wishlist.data.ids, [1]);

  const account = await tokenFor(customer, '/account');
  assert.match(account.text, /<html[^>]*lang="en"/);
  assert.doesNotMatch(account.text, /password_hash|scrypt\$/);

  const removeWishlist = await customer.json('/api/wishlist/1', {
    method: 'DELETE',
    csrf: account.token
  });
  assert.equal(removeWishlist.status, 200);
  assert.deepEqual(removeWishlist.data.ids, []);

  const profile = await customer.json('/api/account/profile', {
    method: 'POST',
    csrf: account.token,
    body: { firstName: 'Mara', lastName: 'Voss', phone: '081298765432' }
  });
  assert.equal(profile.status, 200);
  assert.equal(profile.data.user.phone, '081298765432');
  assert.doesNotMatch(profile.raw, /password_hash|scrypt\$/);

  const address = await customer.json('/api/account/addresses', {
    method: 'POST',
    csrf: account.token,
    body: {
      label: 'Rumah',
      address1: 'Jl. Kenanga No. 12',
      city: 'Bandung',
      region: 'Jawa Barat',
      postalCode: '40115',
      country: 'Indonesia',
      phone: '081298765432',
      isDefault: true
    }
  });
  assert.equal(address.status, 201, address.raw);
  const addresses = await customer.json('/api/account/addresses');
  assert.equal(addresses.status, 200);
  assert.equal(addresses.data.addresses.length, 1);
  assert.equal(addresses.data.addresses[0].is_default, 1);

  const orderVariant = db.prepare(`
    SELECT v.id, v.stock, p.name, p.price_usd_cents
    FROM variants v JOIN products p ON p.id = v.product_id
    WHERE v.stock >= 2 AND p.published = 1
    ORDER BY v.stock DESC, v.id ASC LIMIT 1
  `).get();
  assert.ok(orderVariant, 'the seeded catalogue needs an available variant for logged-in checkout');
  const checkout = await tokenFor(customer, '/checkout');
  const placed = await customer.json('/api/orders', {
    method: 'POST',
    csrf: checkout.token,
    body: orderBody(orderVariant.id, {
      email: CUSTOMER.email,
      firstName: CUSTOMER.firstName,
      lastName: CUSTOMER.lastName
    })
  });
  assert.equal(placed.status, 201, placed.raw);
  const accountOrderNumber = placed.data.order.number;
  assert.ok(accountOrderNumber);
  assert.equal(db.prepare('SELECT stock FROM variants WHERE id = ?').get(orderVariant.id).stock, orderVariant.stock - 1);

  const history = await expectPage(customer, '/account');
  assert.match(history.text, new RegExp(accountOrderNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const orderPage = await expectPage(customer, `/order/${accountOrderNumber}?placed=1`);
  assert.match(orderPage.text, new RegExp(accountOrderNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(orderPage.text, /password_hash|scrypt\$/);

  const logout = await customer.json('/api/auth/logout', { method: 'POST', csrf: account.token });
  assert.equal(logout.status, 200);
  const afterLogout = await customer.request('/account');
  assert.equal(afterLogout.status, 302);
  assert.match(afterLogout.headers.get('location') || '', /^\/login/);

  const freshGuest = new Client(ctx.baseUrl);
  const privateOrder = await freshGuest.request(`/order/${accountOrderNumber}`);
  assert.equal(privateOrder.status, 404);
});

test('oversell protection, stock audit, and cancellation reversal are exact', async () => {
  assert.ok(adminToken);
  adminToken = await currentAdminToken();

  const raceVariant = db.prepare(`
    SELECT v.id, v.stock, v.sku, p.name, p.price_usd_cents
    FROM variants v JOIN products p ON p.id = v.product_id
    WHERE v.stock = 1 AND p.published = 1
    ORDER BY v.id ASC LIMIT 1
  `).get();
  assert.ok(raceVariant, 'the seed must include a final-unit variant');

  const oversellClient = new Client(ctx.baseUrl);
  const oversellCheckout = await tokenFor(oversellClient, '/checkout');
  const oversell = await oversellClient.json('/api/orders', {
    method: 'POST',
    csrf: oversellCheckout.token,
    body: orderBody(raceVariant.id, { items: [{ variantId: raceVariant.id, quantity: 2 }] })
  });
  assert.equal(oversell.status, 409);
  assert.equal(db.prepare('SELECT stock FROM variants WHERE id = ?').get(raceVariant.id).stock, 1);

  const soldOutVariant = db.prepare(`
    SELECT v.id FROM variants v JOIN products p ON p.id = v.product_id
    WHERE v.stock = 0 AND p.published = 1 ORDER BY v.id ASC LIMIT 1
  `).get();
  assert.ok(soldOutVariant);
  const soldOutClient = new Client(ctx.baseUrl);
  const soldOutCheckout = await tokenFor(soldOutClient, '/checkout');
  const soldOut = await soldOutClient.json('/api/orders', {
    method: 'POST',
    csrf: soldOutCheckout.token,
    body: orderBody(soldOutVariant.id)
  });
  assert.equal(soldOut.status, 409);

  const baseline = await admin.json('/api/admin/dashboard');
  assert.equal(baseline.status, 200);

  const raceA = new Client(ctx.baseUrl);
  const raceB = new Client(ctx.baseUrl);
  const [checkoutA, checkoutB] = await Promise.all([
    tokenFor(raceA, '/checkout'),
    tokenFor(raceB, '/checkout')
  ]);
  const [attemptA, attemptB] = await Promise.all([
    raceA.json('/api/orders', {
      method: 'POST',
      csrf: checkoutA.token,
      body: orderBody(raceVariant.id)
    }),
    raceB.json('/api/orders', {
      method: 'POST',
      csrf: checkoutB.token,
      body: orderBody(raceVariant.id)
    })
  ]);
  const attempts = [attemptA, attemptB];
  assert.equal(attempts.filter((attempt) => attempt.status === 201).length, 1, `race statuses: ${attempts.map((a) => a.status).join(',')}`);
  assert.equal(attempts.filter((attempt) => attempt.status === 409).length, 1);
  const winnerIndex = attempts.findIndex((attempt) => attempt.status === 201);
  const winner = winnerIndex === 0 ? raceA : raceB;
  const winningAttempt = attempts[winnerIndex];
  const orderNumber = winningAttempt.data.order.number;
  const orderRow = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(orderNumber);
  assert.ok(orderRow);
  assert.equal(orderRow.status, 'paid');
  assert.equal(Number(orderRow.total_idr), winningAttempt.data.order.totalIdr);
  assert.equal(db.prepare('SELECT stock FROM variants WHERE id = ?').get(raceVariant.id).stock, 0);

  const orderPage = await expectPage(winner, `/order/${orderNumber}?placed=1`);
  assert.match(orderPage.text, new RegExp(orderNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  const afterOrder = await admin.json('/api/admin/dashboard');
  assert.equal(afterOrder.status, 200);
  assert.equal(afterOrder.data.summary.income, baseline.data.summary.income + Number(orderRow.total_idr));
  assert.equal(afterOrder.data.summary.net, baseline.data.summary.net + Number(orderRow.total_idr));

  const orderDetailBefore = await admin.json(`/api/admin/orders/${orderRow.id}`);
  assert.equal(orderDetailBefore.status, 200);
  assert.equal(orderDetailBefore.data.order.status, 'paid');
  assert.equal(orderDetailBefore.data.order.financeEntries.length, 1);
  assert.equal(orderDetailBefore.data.order.financeEntries[0].type, 'income');

  const cancel = await admin.json(`/api/admin/orders/${orderRow.id}/status`, {
    method: 'PATCH',
    csrf: adminToken,
    body: { status: 'cancelled', reason: 'Uji pembatalan otomatis' }
  });
  assert.equal(cancel.status, 200, cancel.raw);
  assert.equal(cancel.data.status, 'cancelled');
  assert.equal(db.prepare('SELECT stock FROM variants WHERE id = ?').get(raceVariant.id).stock, 1);

  const afterCancel = await admin.json('/api/admin/dashboard');
  assert.equal(afterCancel.status, 200);
  assert.equal(afterCancel.data.summary.income, baseline.data.summary.income + Number(orderRow.total_idr));
  assert.equal(afterCancel.data.summary.expense, baseline.data.summary.expense + Number(orderRow.total_idr));
  assert.equal(afterCancel.data.summary.net, baseline.data.summary.net);

  const orderDetailAfter = await admin.json(`/api/admin/orders/${orderRow.id}`);
  assert.equal(orderDetailAfter.data.order.status, 'cancelled');
  assert.equal(orderDetailAfter.data.order.financeEntries.length, 2);
  const reversal = orderDetailAfter.data.order.financeEntries.find((entry) => entry.type === 'expense');
  assert.ok(reversal);
  assert.equal(reversal.category, 'Pembatalan Pesanan');
  assert.equal(reversal.amountIdr, Number(orderRow.total_idr));

  const movements = await admin.json(`/api/admin/inventory/movements?search=${encodeURIComponent(orderNumber)}`);
  assert.equal(movements.status, 200);
  const raceMovements = movements.data.movements.filter((movement) => movement.reference === orderNumber);
  assert.equal(raceMovements.filter((movement) => movement.type === 'sale').length, 1);
  assert.equal(raceMovements.filter((movement) => movement.type === 'return').length, 1);
  assert.equal(raceMovements.find((movement) => movement.type === 'sale').qtyChange, -1);
  assert.equal(raceMovements.find((movement) => movement.type === 'return').qtyChange, 1);
  assert.equal(raceMovements.find((movement) => movement.type === 'sale').stockAfter, 0);
  assert.equal(raceMovements.find((movement) => movement.type === 'return').stockAfter, 1);

  const duplicateCancel = await admin.json(`/api/admin/orders/${orderRow.id}/status`, {
    method: 'PATCH',
    csrf: adminToken,
    body: { status: 'cancelled', reason: 'Coba batalkan lagi' }
  });
  assert.equal(duplicateCancel.status, 409);
  assert.equal(db.prepare('SELECT stock FROM variants WHERE id = ?').get(raceVariant.id).stock, 1);
  const afterDuplicate = await admin.json(`/api/admin/orders/${orderRow.id}`);
  assert.equal(afterDuplicate.data.order.financeEntries.length, 2);

  const noCsrfStock = await admin.json('/api/admin/inventory/stock', {
    method: 'POST',
    body: { variantId: raceVariant.id, action: 'set', quantity: -1 }
  });
  assert.equal(noCsrfStock.status, 419);
  const negativeStock = await admin.json('/api/admin/inventory/stock', {
    method: 'POST',
    csrf: adminToken,
    body: { variantId: raceVariant.id, action: 'set', quantity: -1 }
  });
  assert.equal(negativeStock.status, 422);
  assert.equal(db.prepare('SELECT stock FROM variants WHERE id = ?').get(raceVariant.id).stock, 1);

  const receiveBaseline = await admin.json('/api/admin/dashboard');
  const received = await admin.json('/api/admin/inventory/stock', {
    method: 'POST',
    csrf: adminToken,
    body: {
      variantId: raceVariant.id,
      action: 'receive',
      quantity: 2,
      unitCostIdr: 10_000,
      supplier: 'Uji Pemasok',
      note: 'Uji penerimaan stok',
      recordExpense: true
    }
  });
  assert.equal(received.status, 200, received.raw);
  assert.equal(received.data.newStock, 3);
  assert.equal(received.data.delta, 2);
  assert.equal(received.data.financeAmount, 20_000);
  assert.equal(db.prepare('SELECT stock FROM variants WHERE id = ?').get(raceVariant.id).stock, 3);
  const afterReceive = await admin.json('/api/admin/dashboard');
  assert.equal(afterReceive.data.summary.expense, receiveBaseline.data.summary.expense + 20_000);
  assert.equal(afterReceive.data.summary.net, receiveBaseline.data.summary.net - 20_000);

  const receivedMovements = await admin.json('/api/admin/inventory/movements?search=Uji%20Pemasok');
  assert.equal(receivedMovements.status, 200);
  const inMovement = receivedMovements.data.movements.find((movement) => movement.type === 'in' && movement.note === 'Uji penerimaan stok');
  assert.ok(inMovement);
  assert.equal(inMovement.qtyChange, 2);
  assert.equal(inMovement.stockAfter, 3);
  assert.equal(inMovement.unitCostIdr, 10_000);
});

test('manual social/offline sales update stock and revenue for every channel', async () => {
  assert.ok(adminToken);
  adminToken = await currentAdminToken();

  const manualVariant = db.prepare(`
    SELECT v.id, v.stock, v.sku, p.name
    FROM variants v JOIN products p ON p.id = v.product_id
    WHERE v.stock >= 4 AND p.published = 1
    ORDER BY v.stock DESC, v.id ASC LIMIT 1
  `).get();
  assert.ok(manualVariant);

  const soldOutVariant = db.prepare(`
    SELECT v.id FROM variants v JOIN products p ON p.id = v.product_id
    WHERE v.stock = 0 AND p.published = 1 ORDER BY v.id LIMIT 1
  `).get();
  assert.ok(soldOutVariant);

  const invalidChannel = await admin.json('/api/admin/orders/manual', {
    method: 'POST',
    csrf: adminToken,
    body: {
      customerName: 'Pembeli Uji',
      channel: 'website',
      items: [{ variantId: manualVariant.id, quantity: 1 }]
    }
  });
  assert.equal(invalidChannel.status, 422);
  const oversoldManual = await admin.json('/api/admin/orders/manual', {
    method: 'POST',
    csrf: adminToken,
    body: {
      customerName: 'Pembeli Uji',
      channel: 'instagram',
      items: [{ variantId: soldOutVariant.id, quantity: 1 }]
    }
  });
  assert.equal(oversoldManual.status, 409);

  const baseline = await admin.json('/api/admin/dashboard');
  const expectedCategories = {
    instagram: 'Penjualan Instagram',
    tiktok: 'Penjualan TikTok',
    shopee: 'Penjualan Shopee',
    offline: 'Penjualan Offline'
  };
  let stock = Number(db.prepare('SELECT stock FROM variants WHERE id = ?').get(manualVariant.id).stock);
  let totalManualIdr = 0;
  let lastOrderNumber = '';

  for (const [channel, category] of Object.entries(expectedCategories)) {
    const result = await admin.json('/api/admin/orders/manual', {
      method: 'POST',
      csrf: adminToken,
      body: {
        customerName: `Pembeli ${channel}`,
        customerEmail: `${channel}@starfallenigma.test`,
        channel,
        reference: `UJI-${channel.toUpperCase()}`,
        note: 'Uji penjualan manual',
        items: [{ variantId: manualVariant.id, quantity: 1 }]
      }
    });
    assert.equal(result.status, 201, result.raw);
    assert.ok(result.data.orderNumber);
    assert.ok(result.data.totalIdr > 0);
    lastOrderNumber = result.data.orderNumber;
    totalManualIdr += Number(result.data.totalIdr);
    stock -= 1;
    assert.equal(Number(db.prepare('SELECT stock FROM variants WHERE id = ?').get(manualVariant.id).stock), stock);
    assert.equal(db.prepare('SELECT channel FROM orders WHERE order_number = ?').get(lastOrderNumber).channel, channel);

    const finance = await admin.json(`/api/admin/finance?search=${encodeURIComponent(lastOrderNumber)}`);
    assert.equal(finance.status, 200);
    const entry = finance.data.entries.find((row) => row.orderId === result.data.id && row.type === 'income');
    assert.ok(entry, `${channel} manual sale must create income`);
    assert.equal(entry.category, category);
    assert.equal(entry.amountIdr, result.data.totalIdr);
  }

  const after = await admin.json('/api/admin/dashboard');
  assert.equal(after.status, 200);
  assert.equal(after.data.summary.income, baseline.data.summary.income + totalManualIdr);
  assert.equal(after.data.summary.expense, baseline.data.summary.expense);
  assert.equal(after.data.summary.net, baseline.data.summary.net + totalManualIdr);

  const manualOrders = await admin.json(`/api/admin/orders?search=${encodeURIComponent(lastOrderNumber)}`);
  assert.equal(manualOrders.status, 200);
  assert.ok(manualOrders.data.orders.some((order) => order.number === lastOrderNumber));
  assert.doesNotMatch(manualOrders.raw, /password_hash|scrypt\$/);
});

test('social links are configurable, clicks are real, and exports/backup are safe', async () => {
  assert.ok(adminToken);
  adminToken = await currentAdminToken();

  const socialBefore = await admin.json('/api/admin/social');
  assert.equal(socialBefore.status, 200);
  assert.ok(socialBefore.data.links.some((link) => link.platform === 'instagram'));
  assert.doesNotMatch(socialBefore.raw, /password_hash|scrypt\$/);

  const instagramUrl = 'https://www.instagram.com/starfall.enigma.demo';
  const updated = await admin.json('/api/admin/social', {
    method: 'PUT',
    csrf: adminToken,
    body: { links: { instagram: { url: instagramUrl, active: true } } }
  });
  assert.equal(updated.status, 200, updated.raw);

  const store = new Client(ctx.baseUrl);
  const home = await expectPage(store, '/');
  assert.match(home.text, /href="\/go\/instagram\?from=%2F"/);

  const click = await store.request('/go/instagram?from=%2F');
  assert.equal(click.status, 302);
  const location = click.headers.get('location') || '';
  assert.ok(location.startsWith(instagramUrl), location);
  assert.match(location, /utm_source=starfall_enigma/);
  assert.match(location, /utm_content=instagram/);

  const socialAfter = await admin.json('/api/admin/social');
  assert.equal(socialAfter.data.totalClicks, socialBefore.data.totalClicks + 1);
  assert.equal(socialAfter.data.recentClicks[0].platform, 'instagram');
  assert.equal(socialAfter.data.recentClicks[0].path, '/');

  const disabled = await admin.json('/api/admin/social', {
    method: 'PUT',
    csrf: adminToken,
    body: { links: { instagram: { url: instagramUrl, active: false } } }
  });
  assert.equal(disabled.status, 200);
  const disabledClick = await store.request('/go/instagram');
  assert.equal(disabledClick.status, 302);
  assert.equal(disabledClick.headers.get('location'), '/');
  const afterDisabled = await admin.json('/api/admin/social');
  assert.equal(afterDisabled.data.totalClicks, socialAfter.data.totalClicks);

  const settings = await admin.json('/api/admin/settings');
  assert.equal(settings.status, 200);
  assert.doesNotMatch(settings.raw, /password_hash|scrypt\$/);
  const invalidSettings = await admin.json('/api/admin/settings', {
    method: 'PUT',
    csrf: adminToken,
    body: {
      exchange_rate: 999,
      brand_email: settings.data.settings.brand_email,
      support_phone: settings.data.settings.support_phone,
      announcement_en: settings.data.settings.announcement_en,
      announcement_id: settings.data.settings.announcement_id,
      promo_code: settings.data.settings.promo_code,
      promo_percent: Number(settings.data.settings.promo_percent),
      low_stock_threshold: Number(settings.data.settings.low_stock_threshold)
    }
  });
  assert.equal(invalidSettings.status, 422);

  const validSettings = await admin.json('/api/admin/settings', {
    method: 'PUT',
    csrf: adminToken,
    body: {
      exchange_rate: Number(settings.data.settings.exchange_rate),
      brand_email: settings.data.settings.brand_email,
      support_phone: settings.data.settings.support_phone,
      announcement_en: settings.data.settings.announcement_en,
      announcement_id: settings.data.settings.announcement_id,
      promo_code: settings.data.settings.promo_code,
      promo_percent: Number(settings.data.settings.promo_percent),
      low_stock_threshold: Number(settings.data.settings.low_stock_threshold)
    }
  });
  assert.equal(validSettings.status, 200, validSettings.raw);
  assert.doesNotMatch(validSettings.raw, /password_hash|scrypt\$/);

  const customers = await admin.json('/api/admin/customers');
  assert.equal(customers.status, 200);
  assert.ok(customers.data.customers.some((customer) => customer.email === CUSTOMER.email));
  assert.doesNotMatch(customers.raw, /password_hash|scrypt\$/);

  const financeExport = await admin.text('/api/admin/finance/export');
  assert.equal(financeExport.status, 200);
  assert.match(financeExport.response.headers.get('content-type') || '', /text\/csv/);
  assert.match(financeExport.response.headers.get('content-disposition') || '', /attachment; filename=/);
  assert.match(financeExport.text, /Nominal IDR/);
  assert.match(financeExport.text, /Pemasukan/);

  const backup = await admin.request('/api/admin/backup');
  assert.equal(backup.status, 200);
  assert.match(backup.headers.get('content-disposition') || '', /attachment; filename=/);
  const backupBytes = Buffer.from(await backup.arrayBuffer());
  assert.equal(backupBytes.subarray(0, 16).toString('utf8'), 'SQLite format 3\u0000');

  for (const route of ['/admin', '/admin/finance', '/admin/settings']) {
    const page = await expectPage(admin, route);
    assert.doesNotMatch(page.text, /password_hash|scrypt\$/);
  }
});

test('the admin workspace is unreachable without the private slug', async () => {
  const hiddenPages = ['/admin', '/admin/login', '/admin/orders', '/admin/settings', '/setup'];
  for (const route of hiddenPages) {
    const response = await guest.request(route, { raw: true });
    assert.equal(response.status, 404, `${route} must not be reachable`);
    const body = await response.text();
    assert.doesNotMatch(body, /admin-auth|admin-shell/);
  }

  for (const route of ['/api/admin/login', '/api/admin/dashboard', '/api/admin/backup', '/api/setup']) {
    const response = await guest.json(route, { raw: true });
    assert.equal(response.status, 404, `${route} must not be reachable`);
  }

  // The slug itself still works and every admin link stays inside it.
  const loginPage = await expectPage(guest, '/admin/login');
  assert.ok(loginPage.text.includes(`content="${ADMIN_BASE}"`), 'admin base meta is injected');

  const dashboard = await expectPage(admin, '/admin');
  assert.ok(dashboard.text.includes(`href="${ADMIN_BASE}/orders"`), 'sidebar links use the private slug');
  assert.ok(dashboard.text.includes(`href="${ADMIN_BASE}/finance"`), 'sidebar links use the private slug');
  assert.doesNotMatch(dashboard.text, /href="\/admin\//, 'no legacy /admin links are rendered');

  const apiThroughSlug = await admin.json('/api/admin/dashboard', { raw: true, headers: {}, });
  assert.equal(apiThroughSlug.status, 404, 'bare API path stays closed');

  const apiOnSlug = await admin.json(`${ADMIN_BASE}/api/admin/dashboard`, { raw: true });
  assert.equal(apiOnSlug.status, 200, 'API works through the slug');
});

test('static assets always revalidate and the dev reload endpoint stays off', async () => {
  const css = await guest.request('/css/storefront.css', { raw: true });
  assert.equal(css.status, 200);
  assert.equal(css.headers.get('cache-control'), 'no-cache');
  assert.ok(css.headers.get('etag'), 'an ETag is still issued for 304 responses');
  assert.ok((await css.text()).includes('.mega-menu'), 'stylesheet body is served');

  const cached = await conditionalGet(guest.baseUrl, '/css/storefront.css', {
    'if-none-match': css.headers.get('etag')
  });
  assert.equal(cached.status, 304, 'unchanged assets revalidate to 304');

  const reload = await guest.request('/__dev/reload', { raw: true });
  assert.equal(reload.status, 404, 'live reload is disabled when it is not requested');

  const page = await expectPage(guest, '/');
  assert.doesNotMatch(page.text, /dev-live-reload/, 'the dev script is not injected');
  assert.match(page.text, /\/css\/storefront\.css\?v=[a-z0-9]+/, 'asset URLs carry a version');
});
