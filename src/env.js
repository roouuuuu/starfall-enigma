'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * The Express process does not get Next.js's automatic .env loading, so the
 * VPS entry point reads the same .env.local file. Existing process variables
 * always win, which keeps tests and systemd/pm2 overrides intact.
 */
function loadEnv(file = path.join(process.cwd(), '.env.local')) {
  if (!fs.existsSync(file)) return false;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || match[1].startsWith('#')) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
  return true;
}

module.exports = { loadEnv };
