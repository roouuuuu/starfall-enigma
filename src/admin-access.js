'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { getSettings, setSetting, resolveDbPath } = require('./db');

/**
 * The admin workspace is never served from /admin. It lives behind an unguessable
 * slug that is resolved once and then kept stable for this installation.
 *
 * Resolution order:
 *   1. ADMIN_SLUG environment variable (pins the value for this process)
 *   2. admin-slug.txt next to the database file (survives seed:reset)
 *   3. the admin_slug settings row (older installs)
 *   4. a freshly generated slug
 *
 * The resolved slug is written back to both the file and the database.
 */

const SETTING_KEY = 'admin_slug';
const SLUG_FILE = 'admin-slug.txt';

const RESERVED_SLUGS = new Set([
  'admin', 'api', 'setup', 'shop', 'product', 'journal', 'about', 'stores',
  'client-care', 'legal', 'credits', 'wishlist', 'account', 'login', 'logout',
  'register', 'checkout', 'cart', 'order', 'search', 'assets', 'css', 'js',
  'health', 'robots.txt', 'sitemap.xml', 'favicon.ico', 'social', 'go', 'img'
]);

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{2,58}[a-z0-9]$/;

function isValidSlug(value) {
  return typeof value === 'string'
    && SLUG_PATTERN.test(value)
    && !RESERVED_SLUGS.has(value)
    && !value.includes('--');
}

function generateSlug() {
  return `ops-${crypto.randomBytes(6).toString('hex')}`;
}

function readStoredSlug(db) {
  try {
    const stored = getSettings(db)[SETTING_KEY];
    return isValidSlug(stored) ? stored : null;
  } catch (_) {
    return null;
  }
}

function slugFilePath(dbPath) {
  return path.join(path.dirname(resolveDbPath(dbPath)), SLUG_FILE);
}

function readSlugFile(dbPath) {
  try {
    const raw = fs.readFileSync(slugFilePath(dbPath), 'utf8').trim().toLowerCase();
    return isValidSlug(raw) ? raw : null;
  } catch (_) {
    return null;
  }
}

function writeSlugFile(dbPath, slug) {
  try {
    const target = slugFilePath(dbPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${slug}\n`, 'utf8');
    return true;
  } catch (_) {
    return false;
  }
}

function resolveAdminSlug(db, dbPath) {
  const fromEnv = String(process.env.ADMIN_SLUG || '').trim().toLowerCase();
  let slug;

  if (fromEnv) {
    if (!isValidSlug(fromEnv)) {
      throw new Error(
        'ADMIN_SLUG must be 4-60 characters of lowercase letters, digits or hyphens, ' +
        'must not start or end with a hyphen and must not reuse a public route name.'
      );
    }
    slug = fromEnv;
  } else {
    slug = readSlugFile(dbPath) || readStoredSlug(db) || generateSlug();
  }

  if (readStoredSlug(db) !== slug) setSetting(db, SETTING_KEY, slug);
  writeSlugFile(dbPath, slug);
  return slug;
}

module.exports = {
  resolveAdminSlug,
  isValidSlug,
  generateSlug,
  slugFilePath,
  SETTING_KEY,
  SLUG_FILE,
  RESERVED_SLUGS
};
