'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(process.env.STARFALL_ROOT || process.cwd());
const PUBLIC_DIR = path.join(ROOT, 'public');
const VERSIONED_ROOTS = ['css', 'js', 'assets/fonts'];

function newestMtime(dir) {
  let newest = 0;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return newest;
  }
  for (const entry of entries) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      newest = Math.max(newest, newestMtime(target));
    } else if (/\.(css|js)$/.test(entry.name)) {
      try { newest = Math.max(newest, fs.statSync(target).mtimeMs); } catch (_) { /* skip */ }
    }
  }
  return newest;
}

function currentVersion() {
  let newest = 0;
  for (const root of VERSIONED_ROOTS) {
    newest = Math.max(newest, newestMtime(path.join(PUBLIC_DIR, root)));
  }
  return newest > 0 ? Math.floor(newest).toString(36) : '0';
}

/**
 * Builds the `asset()` template helper.
 *
 * Every stylesheet and script URL carries a version derived from the newest
 * file in public/css, public/js and public/assets/fonts. A process restart after
 * a change therefore produces a new URL, which sidesteps any copy a browser or
 * proxy still holds from an older cache policy.
 */
function createAssetHelper() {
  const version = currentVersion();
  return function asset(publicPath) {
    if (typeof publicPath !== 'string' || !publicPath.startsWith('/')) return publicPath;
    const separator = publicPath.includes('?') ? '&' : '?';
    return `${publicPath}${separator}v=${version}`;
  };
}

module.exports = { createAssetHelper };
