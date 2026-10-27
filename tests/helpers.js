'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');

// The admin workspace is served from a private slug. Tests pin it so assertions
// stay deterministic; Client rewrites legacy /admin URLs onto the slug.
const ADMIN_SLUG = process.env.ADMIN_SLUG || 'ops-test-9f3a2c';
process.env.ADMIN_SLUG = ADMIN_SLUG;
const ADMIN_BASE = `/${ADMIN_SLUG}`;

const LEGACY_ADMIN_PATTERNS = [
  [/^\/admin(?=\/|$|\?)/, `${ADMIN_BASE}`],
  [/^\/api\/admin(?=\/|$|\?)/, `${ADMIN_BASE}/api/admin`],
  [/^\/setup(?=\?|$)/, `${ADMIN_BASE}/setup`],
  [/^\/api\/setup(?=\?|$)/, `${ADMIN_BASE}/api/setup`]
];

function toAdminUrl(urlPath) {
  if (typeof urlPath !== 'string') return urlPath;
  for (const [pattern, replacement] of LEGACY_ADMIN_PATTERNS) {
    if (pattern.test(urlPath)) return urlPath.replace(pattern, replacement);
  }
  return urlPath;
}

function createSeededDatabase() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starfall-enigma-test-'));
  const dbPath = path.join(dir, 'starfall.sqlite');
  execFileSync(process.execPath, ['scripts/seed.js', '--reset'], {
    cwd: ROOT,
    env: { ...process.env, DB_PATH: dbPath },
    stdio: 'pipe'
  });
  return { dir, dbPath };
}

function removeTempDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 8, retryDelay: 120 });
}

class Client {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookies = new Map();
    this.lastSetCookies = [];
  }

  cookieHeader() {
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  storeCookies(headers) {
    this.lastSetCookies = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [];
    for (const line of this.lastSetCookies) {
      const first = line.split(';')[0];
      const index = first.indexOf('=');
      if (index > 0) this.cookies.set(first.slice(0, index), first.slice(index + 1));
    }
  }

  async request(urlPath, options = {}) {
    const target = options.raw ? urlPath : toAdminUrl(urlPath);
    const headers = new Headers(options.headers || {});
    const cookie = this.cookieHeader();
    if (cookie) headers.set('cookie', cookie);
    let body = options.body;
    if (body !== undefined && body !== null && typeof body === 'object') {
      headers.set('content-type', 'application/json');
      body = JSON.stringify(body);
    }
    if (!headers.has('accept')) headers.set('accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
    if (options.csrf) headers.set('x-csrf-token', options.csrf);
    const response = await fetch(this.baseUrl + target, {
      method: options.method || 'GET',
      headers,
      body,
      redirect: 'manual'
    });
    this.storeCookies(response.headers);
    return response;
  }

  async text(urlPath, options = {}) {
    const response = await this.request(urlPath, options);
    return { response, status: response.status, text: await response.text() };
  }

  async json(urlPath, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set('accept', 'application/json');
    const response = await this.request(urlPath, { ...options, headers });
    const raw = await response.text();
    let data = null;
    try { data = JSON.parse(raw); } catch (_) { /* non-JSON error pages are reported by callers */ }
    return { response, status: response.status, data, raw };
  }
}

function csrfFrom(html) {
  const json = html.match(/csrfToken"?\s*:\s*"([^"]+)"/);
  if (json) return json[1];
  const meta = html.match(/name="csrf-token"\s+content="([^"]+)"/i);
  return meta ? meta[1] : '';
}

async function startTestServer(dbPath) {
  const { createApp } = require('../src/server');
  const app = createApp({ dbPath });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const address = server.address();
  return {
    app,
    server,
    db: app.get('db'),
    baseUrl: `http://127.0.0.1:${address.port}`
  };
}

async function stopTestServer(server, db) {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (db) {
    try { db.close(); } catch (_) { /* already closed */ }
  }
}

module.exports = {
  ROOT,
  ADMIN_BASE,
  ADMIN_SLUG,
  Client,
  createSeededDatabase,
  removeTempDir,
  startTestServer,
  stopTestServer,
  csrfFrom
};
