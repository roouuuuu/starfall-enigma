'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { resolveTarget } = require('../src/db');

test('DB_PATH wins over a remote libSQL URL', () => {
  const previous = {
    DB_PATH: process.env.DB_PATH,
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL
  };
  try {
    delete process.env.DB_PATH;
    process.env.TURSO_DATABASE_URL = 'libsql://example.turso.io';

    const remote = resolveTarget();
    assert.equal(remote.kind, 'remote');
    assert.equal(remote.url, 'libsql://example.turso.io');

    const local = resolveTarget('data/isolated.sqlite');
    assert.equal(local.kind, 'file');
    assert.equal(local.path, path.resolve(process.cwd(), 'data', 'isolated.sqlite'));
  } finally {
    if (previous.DB_PATH === undefined) delete process.env.DB_PATH;
    else process.env.DB_PATH = previous.DB_PATH;
    if (previous.TURSO_DATABASE_URL === undefined) delete process.env.TURSO_DATABASE_URL;
    else process.env.TURSO_DATABASE_URL = previous.TURSO_DATABASE_URL;
  }
});

test('file: URLs resolve to a local SQLite path', () => {
  const previous = {
    DB_PATH: process.env.DB_PATH,
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL
  };
  try {
    delete process.env.DB_PATH;
    process.env.TURSO_DATABASE_URL = 'file:data/from-env.sqlite';

    const target = resolveTarget();
    assert.equal(target.kind, 'file');
    assert.equal(target.path, path.resolve(process.cwd(), 'data', 'from-env.sqlite'));
  } finally {
    if (previous.DB_PATH === undefined) delete process.env.DB_PATH;
    else process.env.DB_PATH = previous.DB_PATH;
    if (previous.TURSO_DATABASE_URL === undefined) delete process.env.TURSO_DATABASE_URL;
    else process.env.TURSO_DATABASE_URL = previous.TURSO_DATABASE_URL;
  }
});
