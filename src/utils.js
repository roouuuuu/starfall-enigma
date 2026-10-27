'use strict';

const crypto = require('crypto');

class AppError extends Error {
  constructor(status, message, code = '') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function parseCookies(header = '') {
  const out = {};
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    if (!key) continue;
    let value = part.slice(index + 1).trim();
    try {
      value = decodeURIComponent(value);
    } catch (_) {
      // Keep malformed values as-is; they will fail their own validation.
    }
    out[key] = value;
  }
  return out;
}

function cookie(value, options = {}) {
  const parts = [`${options.name || 'cookie'}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || '/'}`);
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  parts.push(`SameSite=${options.sameSite || 'Lax'}`);
  if (options.httpOnly !== false) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}

function appendCookie(res, value) {
  const current = res.getHeader('Set-Cookie');
  if (!current) res.setHeader('Set-Cookie', [value]);
  else res.setHeader('Set-Cookie', Array.isArray(current) ? [...current, value] : [current, value]);
}

function token(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

function hashToken(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(String(password), salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt.toString('hex')}$${derived.toString('hex')}`;
}

function verifyPassword(password, stored) {
  try {
    const [algorithm, N, r, p, saltHex, hashHex] = String(stored).split('$');
    if (algorithm !== 'scrypt') return false;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(String(password), salt, expected.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024
    });
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch (_) {
    return false;
  }
}

function safeRedirect(value, fallback = '/') {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) return fallback;
  if (trimmed.length > 2000) return fallback;
  return trimmed;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isEmail(value) {
  const email = normalizeEmail(value);
  return email.length >= 5 && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function cleanText(value, max = 500) {
  return String(value == null ? '' : value).trim().replace(/\u0000/g, '').slice(0, max);
}

function cleanMultiline(value, max = 2000) {
  return cleanText(value, max).replace(/\r\n/g, '\n');
}

function toInt(value, fallback = 0) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function parsePositiveInt(value, fallback = 1, max = 999) {
  const parsed = toInt(value, fallback);
  return clamp(parsed, 1, max);
}

function pagination(query, { defaultLimit = 24, maxLimit = 100 } = {}) {
  const page = parsePositiveInt(query.page, 1, 100000);
  const limit = parsePositiveInt(query.limit, defaultLimit, maxLimit);
  return { page, limit, offset: (page - 1) * limit };
}

function moneyIdr(cents, rate) {
  return Math.max(0, Math.round((Number(cents || 0) / 100) * Number(rate || 0)));
}

function formatIdr(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(Number(amount || 0));
}

function formatUsd(cents) {
  const value = Number(cents || 0) / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatMoney(cents, currency, rate) {
  return currency === 'IDR' ? formatIdr(moneyIdr(cents, rate)) : formatUsd(cents);
}

function dateOnly(value = new Date()) {
  if (value instanceof Date) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(value);
    const part = (type) => parts.find((item) => item.type === type)?.value || '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  }
  return String(value).slice(0, 10);
}

function shiftDateOnly(dateString, days = 0) {
  const [year, month, day] = String(dateString).slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function businessDayStart(dateString) {
  return new Date(`${String(dateString).slice(0, 10)}T00:00:00+07:00`).toISOString();
}

function businessDayEnd(dateString) {
  return businessDayStart(shiftDateOnly(dateString, 1));
}

function isDateOnly(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function formatDate(value, lang = 'en') {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(lang === 'id' ? 'id-ID' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

function statusLabel(status, lang = 'en') {
  const labels = {
    paid: { en: 'Paid', id: 'Dibayar' },
    processing: { en: 'Processing', id: 'Diproses' },
    shipped: { en: 'Shipped', id: 'Dikirim' },
    completed: { en: 'Completed', id: 'Selesai' },
    cancelled: { en: 'Cancelled', id: 'Dibatalkan' }
  };
  return labels[status]?.[lang] || status;
}

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(String(value));
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch (_) {
    return false;
  }
}

function addUtm(url, platform) {
  const parsed = new URL(url);
  parsed.searchParams.set('utm_source', 'starfall_enigma');
  parsed.searchParams.set('utm_medium', 'social');
  parsed.searchParams.set('utm_campaign', 'storefront');
  parsed.searchParams.set('utm_content', platform);
  return parsed.toString();
}

function csvCell(value) {
  let text = String(value == null ? '' : value);
  // Guard against spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function csvRow(values) {
  return values.map(csvCell).join(',') + '\r\n';
}

function safeJson(value) {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}

function escapeXml(value) {
  return String(value == null ? '' : value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name || '',
    phone: row.phone || '',
    role: row.role,
    createdAt: row.created_at
  };
}

function parseJson(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

function getClientIp(req) {
  return String(req.ip || req.socket?.remoteAddress || 'local');
}

function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 10, key = (req) => getClientIp(req) } = {}) {
  const entries = new Map();
  return function rateLimiter(req, res, next) {
    const now = Date.now();
    const bucketKey = `${key(req)}`;
    let item = entries.get(bucketKey);
    if (!item || item.resetAt <= now) {
      item = { count: 0, resetAt: now + windowMs };
      entries.set(bucketKey, item);
    }
    item.count += 1;
    if (item.count > max) {
      const retry = Math.ceil((item.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retry));
      return next(new AppError(429, 'Too many attempts. Please wait and try again.', 'rate_limited'));
    }
    if (entries.size > 5000) {
      for (const [k, value] of entries) {
        if (value.resetAt <= now) entries.delete(k);
      }
    }
    return next();
  };
}

function noCache(res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
}

module.exports = {
  AppError,
  parseCookies,
  cookie,
  appendCookie,
  token,
  hashToken,
  hashPassword,
  verifyPassword,
  safeRedirect,
  normalizeEmail,
  isEmail,
  cleanText,
  cleanMultiline,
  toInt,
  clamp,
  parsePositiveInt,
  pagination,
  moneyIdr,
  formatIdr,
  formatUsd,
  formatMoney,
  dateOnly,
  shiftDateOnly,
  businessDayStart,
  businessDayEnd,
  isDateOnly,
  formatDate,
  statusLabel,
  isValidHttpUrl,
  addUtm,
  csvRow,
  escapeXml,
  safeJson,
  publicUser,
  parseJson,
  getClientIp,
  createRateLimiter,
  noCache
};
