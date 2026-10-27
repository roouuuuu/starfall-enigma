'use strict';

// The test suite runs against the same custom server that production uses.
// Building into a separate directory keeps tests from clobbering the dev
// server's `.next` folder when both run at once.
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

process.env.NEXT_DIST_DIR = process.env.NEXT_DIST_DIR || '.next-test';

execFileSync(
  process.execPath,
  [path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next'), 'build'],
  { cwd: ROOT, stdio: 'inherit', env: process.env }
);
