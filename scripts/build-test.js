'use strict';

// The test suite runs against the same custom server that production uses.
// Building into a separate directory keeps tests from clobbering the dev
// server's `.next` folder when both run at once.
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const envTypes = path.join(ROOT, 'next-env.d.ts');
const before = fs.existsSync(envTypes) ? fs.readFileSync(envTypes, 'utf8') : null;

process.env.NEXT_DIST_DIR = process.env.NEXT_DIST_DIR || '.next-test';

try {
  execFileSync(
    process.execPath,
    [path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next'), 'build'],
    { cwd: ROOT, stdio: 'inherit', env: process.env }
  );
} finally {
  // Next rewrites next-env.d.ts to point at the active distDir. Keep the
  // checked-in file aimed at `.next` so editors and `npm run build` agree.
  if (before !== null && fs.existsSync(envTypes) && fs.readFileSync(envTypes, 'utf8') !== before) {
    fs.writeFileSync(envTypes, before);
  }
}
