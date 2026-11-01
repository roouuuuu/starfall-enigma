'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// libsql keeps a Windows file lock until the process exits, so the round-trip
// runs in a child process and the parent removes the temp directory afterwards.
test('remote backup dump round-trips the schema and every row', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starfall-dump-'));
  try {
    const output = execFileSync(
      process.execPath,
      [path.join(__dirname, 'fixtures', 'sql-dump-roundtrip.js'), dir],
      {
        cwd: path.resolve(__dirname, '..'),
        env: { ...process.env, DB_PATH: path.join(dir, 'unused.sqlite') },
        stdio: ['ignore', 'pipe', 'pipe']
      }
    ).toString().trim();
    const result = JSON.parse(output.split(/\r?\n/).pop());
    assert.ok(result.tables > 0);
    assert.ok(result.bytes > 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 8, retryDelay: 120 });
  }
});
