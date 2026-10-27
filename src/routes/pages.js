'use strict';

const express = require('express');
const {
  listProducts,
  getFacets,
  getShopMeta,
  getProductBySlug,
  getFeatured,
  getRelatedProducts,
  getVariants,
  toProductCard,
  categoryById
} = require('../catalog-service');
const { JOURNAL, CREDITS } = require('../content');
const { CATEGORY_LIST } = require('../catalog');
const { getOrderByNumber, getOrderItems } = require('../order-service');
const {
  statusLabel,
  safeRedirect,
  cleanText,
  formatMoney
} = require('../utils');
const { requireAuth } = require('../auth');

const router = express.Router();

const SIZE_GROUPS = [
  { label_en: 'Clothing', label_id: 'Pakaian', values: ['XS', 'S', 'M', 'L', 'XL'] },
  { label_en: 'Waist', label_id: 'Pinggang', values: ['28', '30', '32', '34', '36'] }
];

function sizeGroupsFor(lang) {
  return SIZE_GROUPS.map((group) => ({
    label: lang === 'id' ? group.label_id : group.label_en,
    values: group.values
  }));
}

const { COUNTRIES } = require('../countries');

function journalFor(lang) {
  return JOURNAL.map((item) => ({
    slug: item.slug,
    date: item.date,
    readMinutes: item.readMinutes,
    image: item.image,
    category: lang === 'id' ? item.category_id : item.category_en,
    title: lang === 'id' ? item.title_id : item.title_en,
    excerpt: lang === 'id' ? item.excerpt_id : item.excerpt_en,
    body: lang === 'id' ? item.body_id : item.body_en
  }));
}

function renderNotFound(req, res, message = '') {
  res.status(404).render('404', {
    pageTitle: req.lang === 'id' ? 'Halaman tidak ditemukan — Starfall Enigma' : 'Page not found — Starfall Enigma',
    metaDescription: '',
    bodyClass: 'page-404',
    activeNav: '',
    noindex: true,
    message
  });
}

function getWishlistItems(db, userId, lang) {
  if (!userId) return [];
  const rows = db.prepare(
    `SELECT p.*, w.created_at AS wished_at
     FROM wishlists w JOIN products p ON p.id = w.product_id
     WHERE w.user_id = ? AND p.published = 1
     ORDER BY w.created_at DESC`
  ).all(Number(userId));
  const variantMap = getVariants(db, rows.map((row) => Number(row.id)));
  return rows.map((row) => toProductCard(row, variantMap.get(Number(row.id)) || [], lang));
}

router.get('/', (req, res) => {
  const db = req.app.get('db');
  const featured = getFeatured(db, req.lang, 4, 'featured');
  const newArrivals = getFeatured(db, req.lang, 4, 'new');
  const journal = journalFor(req.lang);
  const categoryTiles = CATEGORY_LIST.map((category) => ({
    id: category.id,
    label: req.lang === 'id' ? category.label_id : category.label_en,
    image: category.image
  }));
  res.render('home', {
    pageTitle: res.locals.t('home.metaTitle'),
    metaDescription: res.locals.t('home.metaDescription'),
    ogImage: '/assets/img/editorial/model-04.jpg',
    bodyClass: 'page-home',
    activeNav: 'home',
    pageKey: 'home',
    featured,
    newArrivals,
    journal: journal.slice(0, 3),
    categoryTiles
  });
});

router.get('/shop', (req, res) => {
  const db = req.app.get('db');
  const query = { ...req.query };
  const selectedCategories = String(query.category || '').split(',').filter((value) => categoryById[value]);
  const metaCategory = selectedCategories.length === 1 ? selectedCategories[0] : '';
  const meta = getShopMeta(metaCategory, req.lang);
  const result = listProducts(db, {
    ...query,
    page: query.page ? query.page : 1,
    limit: 12,
    currency: req.currency,
    rate: req.exchangeRate
  }, req.lang);
  const facets = getFacets(db, req.lang);
  res.render('shop', {
    pageTitle: `${meta.title} — Starfall Enigma`,
    metaDescription: meta.intro,
    ogImage: meta.image,
    bodyClass: 'page-shop',
    activeNav: meta.id || 'shop',
    pageKey: 'shop',
    meta,
    categoryId: metaCategory,
    selectedCategories,
    result,
    facets,
    sizeGroups: sizeGroupsFor(req.lang),
    filterState: {
      category: selectedCategories,
      collection: String(query.collection || '').split(',').filter(Boolean),
      material: String(query.material || ''),
      size: String(query.size || ''),
      availability: String(query.availability || ''),
      minPrice: String(query.minPrice || ''),
      maxPrice: String(query.maxPrice || ''),
      search: String(query.search || ''),
      sort: String(query.sort || 'featured')
    }
  });
});

router.get('/shop/:category', (req, res, next) => {
  const category = String(req.params.category || '');
  if (!categoryById[category]) return renderNotFound(req, res);
  const db = req.app.get('db');
  const query = { ...req.query, category };
  const meta = getShopMeta(category, req.lang);
  const result = listProducts(db, {
    ...query,
    page: query.page ? query.page : 1,
    limit: 12,
    currency: req.currency,
    rate: req.exchangeRate
  }, req.lang);
  const facets = getFacets(db, req.lang);
  return res.render('shop', {
    pageTitle: `${meta.title} — Starfall Enigma`,
    metaDescription: meta.intro,
    ogImage: meta.image,
    bodyClass: 'page-shop',
    activeNav: category,
    pageKey: 'shop',
    meta,
    categoryId: category,
    selectedCategories: [category],
    result,
    facets,
    sizeGroups: sizeGroupsFor(req.lang),
    filterState: {
      category: [category],
      collection: String(query.collection || '').split(',').filter(Boolean),
      material: String(query.material || ''),
      size: String(query.size || ''),
      availability: String(query.availability || ''),
      minPrice: String(query.minPrice || ''),
      maxPrice: String(query.maxPrice || ''),
      search: String(query.search || ''),
      sort: String(query.sort || 'featured')
    }
  });
});

router.get('/product/:slug', (req, res) => {
  const db = req.app.get('db');
  const found = getProductBySlug(db, req.params.slug, req.lang);
  if (!found) return renderNotFound(req, res);
  const { product } = found;
  const related = getRelatedProducts(db, product, req.lang, 4);
  const category = categoryById[product.category];
  return res.render('product', {
    pageTitle: `${product.name} — Starfall Enigma`,
    metaDescription: cleanText(product.description, 180),
    ogImage: product.imageA,
    bodyClass: 'page-product',
    activeNav: product.category,
    pageKey: 'product',
    product,
    related,
    categoryLabel: category ? (req.lang === 'id' ? category.label_id : category.label_en) : product.categoryLabel,
    categoryDescription: category ? (req.lang === 'id' ? category.description_id : category.description_en) : ''
  });
});

router.get('/wishlist', (req, res) => {
  const db = req.app.get('db');
  const initialWishlist = req.user ? getWishlistItems(db, req.user.id, req.lang) : [];
  res.render('wishlist', {
    pageTitle: res.locals.t('wishlist.metaTitle'),
    metaDescription: res.locals.t('wishlist.intro'),
    bodyClass: 'page-wishlist',
    activeNav: '',
    pageKey: 'wishlist',
    initialWishlist,
    noindex: true
  });
});

router.get('/checkout', (req, res) => {
  const db = req.app.get('db');
  let defaultAddress = null;
  let addresses = [];
  if (req.user) {
    addresses = db.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC').all(Number(req.user.id));
    defaultAddress = addresses[0] || null;
  }
  res.render('checkout', {
    pageTitle: res.locals.t('checkout.title') + ' — Starfall Enigma',
    metaDescription: '',
    bodyClass: 'page-checkout',
    activeNav: '',
    pageKey: 'checkout',
    noindex: true,
    defaultAddress,
    addresses,
    countries: COUNTRIES,
    promoCode: req.settings.promo_code || '',
    promoPercent: Number(req.settings.promo_percent || 0)
  });
});

router.get('/order/:number', (req, res) => {
  const db = req.app.get('db');
  const order = getOrderByNumber(db, req.params.number);
  if (!order) return renderNotFound(req, res);
  const authorized = Boolean(
    req.user?.role === 'admin' ||
    (req.user && Number(order.user_id) === Number(req.user.id)) ||
    (order.session_hash && order.session_hash === req.sessionTokenHash)
  );
  if (!authorized) return renderNotFound(req, res);
  const items = getOrderItems(db, order.id);
  const placed = req.query.placed === '1';
  const rate = Number(order.exchange_rate);
  return res.render('order', {
    pageTitle: `${req.lang === 'id' ? 'Pesanan' : 'Order'} ${order.order_number} — Starfall Enigma`,
    metaDescription: '',
    bodyClass: 'page-order',
    activeNav: '',
    pageKey: 'order',
    noindex: true,
    order,
    items,
    placed,
    statusLabel: statusLabel(order.status, req.lang),
    orderMoney: (cents) => formatMoney(Number(cents || 0), order.currency, rate),
    otherMoney: (cents) => formatMoney(
      Number(cents || 0),
      order.currency === 'USD' ? 'IDR' : 'USD',
      rate
    )
  });
});

router.get('/journal', (req, res) => {
  const journal = journalFor(req.lang);
  res.render('journal', {
    pageTitle: res.locals.t('journal.metaTitle'),
    metaDescription: res.locals.t('journal.intro'),
    bodyClass: 'page-journal',
    activeNav: 'journal',
    pageKey: 'journal',
    journal
  });
});

router.get('/journal/:slug', (req, res) => {
  const journal = journalFor(req.lang);
  const article = journal.find((item) => item.slug === req.params.slug);
  if (!article) return renderNotFound(req, res);
  const related = journal.filter((item) => item.slug !== article.slug).slice(0, 2);
  res.render('article', {
    pageTitle: `${article.title} — Starfall Enigma`,
    metaDescription: article.excerpt,
    ogImage: article.image,
    bodyClass: 'page-article',
    activeNav: 'journal',
    pageKey: 'journal',
    article,
    related
  });
});

router.get('/about', (req, res) => {
  res.render('about', {
    pageTitle: res.locals.t('about.metaTitle'),
    metaDescription: res.locals.t('about.intro'),
    ogImage: '/assets/img/editorial/cathedral.jpg',
    bodyClass: 'page-about',
    activeNav: 'about',
    pageKey: 'about'
  });
});

router.get('/stores', (req, res) => {
  res.render('stores', {
    pageTitle: res.locals.t('stores.metaTitle'),
    metaDescription: res.locals.t('stores.intro'),
    ogImage: '/assets/img/editorial/cathedral-detail.jpg',
    bodyClass: 'page-stores',
    activeNav: 'stores',
    pageKey: 'stores'
  });
});

router.get('/client-care', (req, res) => {
  res.render('care', {
    pageTitle: res.locals.t('care.metaTitle'),
    metaDescription: res.locals.t('care.intro'),
    bodyClass: 'page-care',
    activeNav: 'client-care',
    pageKey: 'care'
  });
});

router.get('/legal', (req, res) => {
  res.render('legal', {
    pageTitle: `${res.locals.t('legal.title')} — Starfall Enigma`,
    metaDescription: res.locals.t('legal.privacy').slice(0, 170),
    bodyClass: 'page-legal',
    activeNav: '',
    pageKey: 'legal'
  });
});

router.get('/credits', (req, res) => {
  const credits = CREDITS[req.lang] || CREDITS.en;
  res.render('credits', {
    pageTitle: credits.metaTitle,
    metaDescription: credits.intro,
    bodyClass: 'page-credits',
    activeNav: '',
    pageKey: 'credits',
    credits
  });
});

router.get('/login', (req, res) => {
  if (req.user) return res.redirect(req.user.role === 'admin' ? res.locals.adminBase : '/account');
  const next = safeRedirect(req.query.next, '/account');
  res.render('login', {
    pageTitle: `${res.locals.t('auth.login')} — Starfall Enigma`,
    metaDescription: res.locals.t('auth.loginIntro'),
    bodyClass: 'page-auth',
    activeNav: '',
    pageKey: 'login',
    noindex: true,
    next
  });
});

router.get('/register', (req, res) => {
  if (req.user) return res.redirect(req.user.role === 'admin' ? res.locals.adminBase : '/account');
  res.render('register', {
    pageTitle: `${res.locals.t('auth.register')} — Starfall Enigma`,
    metaDescription: res.locals.t('auth.registerIntro'),
    bodyClass: 'page-auth',
    activeNav: '',
    pageKey: 'register',
    noindex: true,
    next: safeRedirect(req.query.next, '/account')
  });
});

router.get('/account', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const user = db.prepare(
    'SELECT id, email, first_name, last_name, phone, role, created_at FROM users WHERE id = ?'
  ).get(Number(req.user.id));
  if (!user) return res.redirect('/login');
  const addresses = db.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC').all(Number(req.user.id));
  const orders = db.prepare(
    `SELECT o.*, (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
     FROM orders o WHERE o.user_id = ? ORDER BY o.created_at DESC LIMIT 100`
  ).all(Number(req.user.id));
  const wishlistCount = Number(db.prepare('SELECT COUNT(*) AS count FROM wishlists WHERE user_id = ?').get(Number(req.user.id)).count);
  res.render('account', {
    pageTitle: res.locals.t('account.metaTitle'),
    metaDescription: res.locals.t('account.intro'),
    bodyClass: 'page-account',
    activeNav: '',
    pageKey: 'account',
    noindex: true,
    accountUser: user,
    addresses,
    orders,
    wishlistCount,
    statusLabel: (status) => statusLabel(status, req.lang)
  });
});

module.exports = router;
module.exports.renderNotFound = renderNotFound;
module.exports.journalFor = journalFor;
module.exports.COUNTRIES = COUNTRIES;
