import assert from 'node:assert/strict';
import test from 'node:test';
import { pool, runMigrations } from './db.js';

test('runtime migrations never seed or reset user accounts', async () => {
  const originalQuery = pool.query;
  const queries = [];
  pool.query = async (query) => {
    queries.push(String(query));
    return { rows: [] };
  };

  try {
    await runMigrations();
  } finally {
    pool.query = originalQuery;
  }

  assert.equal(queries.some((query) => /\b(?:INSERT|UPDATE)\s+user_accounts\b/i.test(query)), false);
});
