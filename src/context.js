'use strict';

const { getSettings } = require('./db');
const { normalizeLanguage, normalizeCurrency, translator, clientStrings } = require('./i18n');
const { formatMoney, formatDate, formatIdr, safeJson, parseCookies } = require('./utils');
const { CATEGORY_LIST, COLLECTIONS } = require('./catalog');

function readCookiePreferences(req) {
  const cookies = req.cookies || {};
  const lang = normalizeLanguage(cookies.se_lang || 'en');
  const currency = normalizeCurrency(cookies.se_currency || 'USD');
  return { lang, currency };
}

function preferenceUrl(req, changes = {}) {
  const url = new URL('/preferences', `${req.protocol}://${req.get('host') || 'localhost'}`);
  url.searchParams.set('lang', changes.lang || req.lang);
  url.searchParams.set('currency', changes.currency || req.currency);
  url.searchParams.set('redirect', req.originalUrl || '/');
  return `${url.pathname}${url.search}`;
}

function contextMiddleware(db) {
  return function attachContext(req, res, next) {
    try {
      req.cookies = parseCookies(req.headers.cookie || '');
      const isAdminArea = req.path.startsWith('/admin') || req.path.startsWith('/api/admin') || req.path === '/setup';
      const prefs = readCookiePreferences(req);
      const lang = isAdminArea ? 'id' : prefs.lang;
      const currency = prefs.currency;
      const settings = getSettings(db);
      const rate = Number(settings.exchange_rate || 0) || 16000;
      const t = translator(lang);

      req.lang = lang;
      req.currency = currency;
      req.exchangeRate = rate;
      req.settings = settings;
      res.locals.lang = lang;
      res.locals.currency = currency;
      res.locals.exchangeRate = rate;
      res.locals.settings = settings;
      res.locals.t = t;
      res.locals.clientStrings = clientStrings(lang);
      res.locals.clientState = null;
      res.locals.safeJson = safeJson;
      res.locals.money = (cents) => formatMoney(Number(cents || 0), currency, rate);
      res.locals.moneyIdr = (amount) => formatIdr(amount);
      res.locals.formatDate = (value) => formatDate(value, lang);
      res.locals.currentUrl = req.originalUrl || '/';
      res.locals.currentPath = req.path;
      res.locals.baseUrl = `${req.protocol}://${req.get('host') || 'localhost'}`;
      res.locals.canonical = `${res.locals.baseUrl}${req.path}`;
      res.locals.year = new Date().getFullYear();
      res.locals.navCategories = CATEGORY_LIST.map((category) => ({
        ...category,
        label: lang === 'id' ? category.label_id : category.label_en,
        description: lang === 'id' ? category.description_id : category.description_en
      }));
      res.locals.clothingCategories = CATEGORY_LIST.filter((category) => category.group === 'clothing').map((category) => ({
        ...category,
        label: lang === 'id' ? category.label_id : category.label_en
      }));
      res.locals.featureCategories = res.locals.clothingCategories.slice(0, 6);
      res.locals.collections = COLLECTIONS.map((collection) => ({
        ...collection,
        label: lang === 'id' ? collection.label_id || collection.label : collection.label
      }));
      res.locals.langSwitchUrl = preferenceUrl(req, { lang: lang === 'en' ? 'id' : 'en' });
      res.locals.currencySwitchUrl = preferenceUrl(req, { currency: currency === 'USD' ? 'IDR' : 'USD' });
      res.locals.langAlt = lang === 'en' ? 'ID' : 'EN';
      res.locals.currencyAlt = currency === 'USD' ? 'IDR' : 'USD';
      res.locals.announcement = lang === 'id' ? settings.announcement_id : settings.announcement_en;
      res.locals.brandEmail = settings.brand_email || 'concierge@starfallenigma.com';
      res.locals.supportPhone = settings.support_phone || '';
      res.locals.isAdminArea = isAdminArea;
      res.locals.pageTitle = '';
      res.locals.metaDescription = '';
      res.locals.ogImage = '/assets/img/editorial/model-03.jpg';
      res.locals.bodyClass = '';
      res.locals.activeNav = '';

      if (req.user) {
        res.locals.wishlistIds = db.prepare('SELECT product_id FROM wishlists WHERE user_id = ?').all(Number(req.user.id)).map((row) => Number(row.product_id));
      } else {
        res.locals.wishlistIds = [];
      }

      res.locals.socials = db.prepare('SELECT platform, label, url FROM social_links WHERE active = 1 ORDER BY platform ASC').all()
        .filter((row) => /^https?:\/\//i.test(row.url))
        .map((row) => ({
          ...row,
          href: `/go/${encodeURIComponent(row.platform)}?from=${encodeURIComponent(req.path)}`
        }));

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  contextMiddleware,
  readCookiePreferences,
  preferenceUrl
};
