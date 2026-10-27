'use strict';

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { getDb, getSettings } = require('./db');
const { sessionMiddleware, cleanupSessions } = require('./auth');
const { contextMiddleware } = require('./context');
const { csrfProtection } = require('./auth');
const { resolveAdminSlug } = require('./admin-access');
const { AppError, parseCookies, appendCookie, cookie, safeRedirect, cleanText, addUtm, isValidHttpUrl, escapeXml } = require('./utils');
const { normalizeLanguage, normalizeCurrency } = require('./i18n');
const { mountLiveReload } = require('./live-reload');
const { createAssetHelper } = require('./assets');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = Number(process.env.PORT || 3000);

// Express only renders the admin workspace now. Page errors and unknown page
// URLs use this plain page unless the custom server hands over to Next.js.
function fallbackPage({ lang, status, title, heading, message }) {
  const home = lang === 'id' ? 'Beranda' : 'Home';
  const shop = lang === 'id' ? 'Lihat semua' : 'Shop all';
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><link rel="stylesheet" href="/css/storefront.css"><title>${escapeXml(title)}</title></head><body><main id="main-content" class="error-page"><p class="eyebrow">SE / ${status}</p><h1>${escapeXml(heading)}</h1><p>${escapeXml(message)}</p><div class="error-actions"><a class="button button--solid" href="/">${home}</a><a class="button button--outline" href="/shop">${shop}</a></div></main></body></html>`;
}

function renderFallbackNotFound(req, res) {
  const lang = req.lang === 'id' ? 'id' : 'en';
  return res.status(404).type('html').send(fallbackPage({
    lang,
    status: 404,
    title: lang === 'id' ? 'Halaman tidak ditemukan — Starfall Enigma' : 'Page not found — Starfall Enigma',
    heading: lang === 'id' ? 'Halaman ini telah menghilang.' : 'This page has vanished.',
    message: lang === 'id' ? 'Halaman yang Anda cari tidak ada.' : 'The page you are looking for does not exist.'
  }));
}

function securityHeaders(req, res, next) {
  const nonce = crypto.randomBytes(16).toString('base64');
  const adminBase = req.app.get('adminBase') || '';
  res.locals.nonce = nonce;
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}'`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "form-action 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'"
    ].join('; ')
  );
  const isAdminPath = req.path.startsWith('/admin') || req.path === '/setup' ||
    (adminBase && (req.path === adminBase || req.path.startsWith(`${adminBase}/`)));
  if (isAdminPath) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  }
  return next();
}

function createApp(options = {}) {
  const dbPath = options.dbPath || process.env.DB_PATH;
  const db = getDb(dbPath);
  const app = express();
  const adminSlug = resolveAdminSlug(db, dbPath);
  const adminBase = `/${adminSlug}`;
  app.set('db', db);
  app.set('settings', getSettings(db));
  app.set('adminSlug', adminSlug);
  app.set('adminBase', adminBase);
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.set('trust proxy', false);
  app.disable('x-powered-by');
  cleanupSessions(db);

  app.use(securityHeaders);
  app.use(express.static(PUBLIC_DIR, {
    index: false,
    etag: true,
    // Revalidate on every load so a changed stylesheet or script is picked up
    // without a hard refresh. Unchanged files still answer 304 with no body.
    maxAge: 0,
    setHeaders(res) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }));

  const liveReload = options.liveReload !== undefined
    ? Boolean(options.liveReload)
    : process.env.NODE_ENV !== 'production';
  app.locals.devReload = liveReload;
  app.locals.asset = createAssetHelper();
  if (liveReload) app.set('liveReload', mountLiveReload(app));

  // The admin workspace is mounted at a secret slug. Every starter URL is dead:
  // /admin, /api/admin and /setup always answer 404, and only requests that
  // arrive through the slug are rewritten onto the internal /admin routes.
  app.use((req, res, next) => {
    const url = req.url;
    const queryIndex = url.indexOf('?');
    const pathname = queryIndex === -1 ? url : url.slice(0, queryIndex);
    const search = queryIndex === -1 ? '' : url.slice(queryIndex);

    res.locals.adminBase = adminBase;

    const isLegacyAdminPath = pathname === '/admin'
      || pathname.startsWith('/admin/')
      || pathname === '/api/admin'
      || pathname.startsWith('/api/admin/')
      || pathname === '/setup';
    if (isLegacyAdminPath) {
      req.seAdminHidden = true;
      return next();
    }

    if (pathname === adminBase || pathname.startsWith(`${adminBase}/`)) {
      const rest = pathname.slice(adminBase.length);
      const isApiPath = rest === '/api' || rest.startsWith('/api/');
      req.url = (isApiPath || rest === '/setup') ? rest + search : `/admin${rest}${search}`;
    }
    return next();
  });

  app.use(express.json({ limit: '512kb' }));
  app.use(express.urlencoded({ extended: false, limit: '64kb' }));
  app.use(sessionMiddleware(db));
  app.use(contextMiddleware(db));

  app.use((req, res, next) => {
    if (!req.seAdminHidden) return next();
    if (req.path.startsWith('/api/')) {
      return next(new AppError(404, 'API endpoint not found.', 'not_found'));
    }
    return renderFallbackNotFound(req, res);
  });

  app.get('/favicon.ico', (req, res) => {
    res.type('image/svg+xml');
    res.sendFile(path.join(PUBLIC_DIR, 'assets', 'img', 'favicon.svg'));
  });

  app.get('/health', (req, res) => {
    res.json({ ok: true, service: 'starfall-enigma', time: new Date().toISOString() });
  });

  app.get('/preferences', (req, res) => {
    const current = parseCookies(req.headers.cookie || '');
    const lang = normalizeLanguage(req.query.lang || current.se_lang || 'en');
    const currency = normalizeCurrency(req.query.currency || current.se_currency || 'USD');
    const maxAge = 365 * 24 * 60 * 60 * 1000;
    appendCookie(res, cookie(lang, { name: 'se_lang', httpOnly: true, sameSite: 'Lax', maxAge }));
    appendCookie(res, cookie(currency, { name: 'se_currency', httpOnly: true, sameSite: 'Lax', maxAge }));
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, safeRedirect(req.query.redirect, '/'));
  });

  app.get('/go/:platform', (req, res) => {
    const platform = cleanText(req.params.platform, 30).toLowerCase();
    const link = db.prepare('SELECT * FROM social_links WHERE platform = ? AND active = 1').get(platform);
    if (!link || !isValidHttpUrl(link.url)) {
      return res.redirect(302, '/');
    }
    const fromPath = typeof req.query.from === 'string' && req.query.from.startsWith('/')
      ? cleanText(req.query.from, 500)
      : req.path;
    try {
      db.prepare(
        `INSERT INTO social_clicks (platform, clicked_at, referrer, path, user_id)
         VALUES (?, ?, ?, ?, ?)`
      ).run(
        platform,
        new Date().toISOString(),
        cleanText(req.get('referer') || '', 500),
        fromPath,
        req.user ? Number(req.user.id) : null
      );
    } catch (error) {
      // A click must never be blocked by analytics.
      console.error('Social click tracking failed:', error.message);
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, addUtm(link.url, platform));
  });

  app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send([
      'User-agent: *',
      'Disallow: /admin',
      'Disallow: /setup',
      'Disallow: /api/',
      'Disallow: /account',
      'Disallow: /checkout',
      'Disallow: /order/',
      'Disallow: /login',
      'Disallow: /register',
      'Allow: /assets/',
      `Sitemap: ${req.protocol}://${req.get('host')}/sitemap.xml`
    ].join('\n'));
  });

  app.get('/sitemap.xml', (req, res) => {
    const base = `${req.protocol}://${req.get('host')}`;
    const staticPaths = ['/', '/shop', '/journal', '/about', '/stores', '/client-care', '/legal', '/credits'];
    const products = db.prepare('SELECT slug FROM products WHERE published = 1 ORDER BY id').all();
    const articles = require('./content').JOURNAL;
    const urls = [
      ...staticPaths.map((url) => ({ loc: `${base}${url}`, priority: url === '/' ? '1.0' : '0.7' })),
      ...products.map((product) => ({ loc: `${base}/product/${product.slug}`, priority: '0.8' })),
      ...articles.map((article) => ({ loc: `${base}/journal/${article.slug}`, priority: '0.6' }))
    ];
    res.type('application/xml');
    res.send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls.map((item) => `  <url><loc>${escapeXml(item.loc)}</loc><priority>${item.priority}</priority></url>`).join('\n') +
      `\n</urlset>`
    );
  });

  const api = express.Router();
  api.use(csrfProtection());
  api.use(require('./routes/api-auth'));
  api.use(require('./routes/api-public'));
  api.use(require('./routes/api-account'));
  api.use('/admin', require('./routes/api-admin'));
  api.use((req, res, next) => next(new AppError(404, 'API endpoint not found.', 'not_found')));
  app.use('/api', api);

  app.use(require('./routes/pages-admin'));

  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next(new AppError(404, 'API endpoint not found.', 'not_found'));
    // The custom server hands its Next handler to Express so unmatched page
    // URLs still render the React 404 page. Tests run without a handler and
    // keep the Express template.
    const nextNotFound = req.app.get('nextNotFound');
    if (nextNotFound && req.accepts('html')) {
      req.headers['x-se-path'] = req.path;
      req.headers['x-se-url'] = req.originalUrl || req.path;
      return nextNotFound(req, res);
    }
    return renderFallbackNotFound(req, res);
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = Number(error.status || error.statusCode || 500);
    const safeStatus = status >= 400 && status <= 599 ? status : 500;
    const isApi = req.path.startsWith('/api/') || req.path === '/api';
    const lang = req.lang || 'en';
    if (safeStatus >= 500) console.error(error);
    const message = safeStatus >= 500
      ? (lang === 'id' ? 'Terjadi kesalahan. Silakan coba lagi.' : 'Something went wrong. Please try again.')
      : (error.message || (lang === 'id' ? 'Permintaan tidak dapat diproses.' : 'The request could not be completed.'));
    if (isApi) {
      return res.status(safeStatus).json({
        ok: false,
        error: {
          message,
          code: error.code || (safeStatus === 500 ? 'server_error' : 'request_error')
        }
      });
    }
    return res.status(safeStatus).type('html').send(fallbackPage({
      lang,
      status: safeStatus,
      title: safeStatus === 404
        ? (lang === 'id' ? 'Halaman tidak ditemukan — Starfall Enigma' : 'Page not found — Starfall Enigma')
        : (lang === 'id' ? 'Terjadi kesalahan — Starfall Enigma' : 'Something went wrong — Starfall Enigma'),
      heading: safeStatus === 404
        ? (lang === 'id' ? 'Halaman ini telah menghilang.' : 'This page has vanished.')
        : (lang === 'id' ? 'Langit sedang gelap.' : 'The sky has gone dark.'),
      message: safeStatus === 404
        ? (lang === 'id' ? 'Halaman yang Anda cari tidak ada.' : 'The page you are looking for does not exist.')
        : message
    }));
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  const adminBase = app.get('adminBase');
  const server = app.listen(PORT, () => {
    const db = app.get('db');
    const adminCount = Number(db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get().count);
    console.log(`\nSTARFALL ENIGMA — http://localhost:${PORT}`);
    console.log('Admin URL is private. /admin and /setup always answer 404.');
    if (adminCount === 0) console.log(`First-run setup: http://localhost:${PORT}${adminBase}/setup\n`);
    else console.log(`Admin: http://localhost:${PORT}${adminBase}\n`);
  });
  const cleanupTimer = setInterval(() => {
    try { cleanupSessions(app.get('db')); } catch (_) { /* noop */ }
  }, 6 * 60 * 60 * 1000);
  cleanupTimer.unref();
  const shutdown = () => {
    const liveReload = app.get('liveReload');
    if (liveReload) liveReload.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = { createApp };
