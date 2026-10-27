'use strict';

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { getDb, getSettings } = require('./db');
const { sessionMiddleware, cleanupSessions } = require('./auth');
const { contextMiddleware } = require('./context');
const { csrfProtection } = require('./auth');
const { AppError, parseCookies, appendCookie, cookie, safeRedirect, cleanText, addUtm, isValidHttpUrl, escapeXml } = require('./utils');
const { normalizeLanguage, normalizeCurrency } = require('./i18n');
const { renderNotFound } = require('./routes/pages');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = Number(process.env.PORT || 3000);

function securityHeaders(req, res, next) {
  const nonce = crypto.randomBytes(16).toString('base64');
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
  if (req.path.startsWith('/admin') || req.path === '/setup') {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  }
  return next();
}

function createApp(options = {}) {
  const db = getDb(options.dbPath || process.env.DB_PATH);
  const app = express();
  app.set('db', db);
  app.set('settings', getSettings(db));
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.set('trust proxy', false);
  app.disable('x-powered-by');
  cleanupSessions(db);

  app.use(securityHeaders);
  app.use(express.static(PUBLIC_DIR, { index: false, maxAge: '1h' }));
  app.use(express.json({ limit: '512kb' }));
  app.use(express.urlencoded({ extended: false, limit: '64kb' }));
  app.use(sessionMiddleware(db));
  app.use(contextMiddleware(db));

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
      'Disallow: /api/',
      'Disallow: /account',
      'Disallow: /checkout',
      'Disallow: /order/',
      'Disallow: /setup',
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
  app.use(require('./routes/pages'));

  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next(new AppError(404, 'API endpoint not found.', 'not_found'));
    return renderNotFound(req, res);
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
    return res.status(safeStatus).render('error', {
      pageTitle: safeStatus === 404
        ? (lang === 'id' ? 'Halaman tidak ditemukan — Starfall Enigma' : 'Page not found — Starfall Enigma')
        : (lang === 'id' ? 'Terjadi kesalahan — Starfall Enigma' : 'Something went wrong — Starfall Enigma'),
      metaDescription: '',
      bodyClass: 'page-error',
      activeNav: '',
      noindex: true,
      status: safeStatus,
      message: safeStatus === 404
        ? (lang === 'id' ? 'Halaman yang Anda cari tidak ada.' : 'The page you are looking for does not exist.')
        : message
    });
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  const server = app.listen(PORT, () => {
    const db = app.get('db');
    const adminCount = Number(db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get().count);
    console.log(`\nSTARFALL ENIGMA — http://localhost:${PORT}`);
    if (adminCount === 0) console.log(`First-run setup: http://localhost:${PORT}/setup\n`);
    else console.log(`Admin: http://localhost:${PORT}/admin\n`);
  });
  const cleanupTimer = setInterval(() => {
    try { cleanupSessions(app.get('db')); } catch (_) { /* noop */ }
  }, 6 * 60 * 60 * 1000);
  cleanupTimer.unref();
  const shutdown = () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = { createApp };
