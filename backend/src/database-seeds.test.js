import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pool, runMigrations, assertProductionDatabaseSafety } from './db.js';
import { login, hashPassword } from './modules/auth/auth.service.js';

const schema = readFileSync(new URL('../../database/init/001_schema.sql', import.meta.url), 'utf8');
const seeds = Object.fromEntries(['anna', 'minji'].map(name => [
  name, readFileSync(new URL(`../../database/seeds/${name}_seed.sql`, import.meta.url), 'utf8'),
]));

// Compare all stored rows, including passwords, prices and balances, after rejected seeds.
async function snapshot(db) {
  const { rows: tables } = await db.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
  const result = {};
  for (const { tablename } of tables) {
    const identifier = `"${tablename.replaceAll('"', '""')}"`;
    const { rows } = await db.query(`SELECT to_jsonb(t) AS row FROM ${identifier} t ORDER BY to_jsonb(t)::text`);
    result[tablename] = rows.map(({ row }) => row);
  }
  return result;
}

for (const name of Object.keys(seeds)) {
  test(`${name} seed initializes once, authenticates, and preserves existing data`, async () => {
    const db = new PGlite();
    const originalQuery = pool.query;
    pool.query = async (sql, params) => params ? db.query(sql, params) : (await db.exec(sql)).at(-1);
    try {
      await db.exec(schema);
      assert.ok(Object.values(await snapshot(db)).every(rows => rows.length === 0));
      await db.exec(seeds[name]);
      const initial = await snapshot(db);
      assert.equal(initial.branches.length, 1);
      assert.equal(initial.user_accounts.length, name === 'minji' ? 1 : 7);
      if (name === 'minji') {
        assert.equal(initial.branches[0].name, 'Minji - Mipec Rubik');
        assert.equal(initial.branches[0].address, 'Mipec Rubik 360, 122 Xuân Thủy, Hà Nội');
        assert.equal(initial.branches[0].latitude, null);
        for (const [table, rows] of Object.entries(initial)) {
          if (!['branches', 'user_accounts'].includes(table)) assert.equal(rows.length, 0, table);
        }
      } else {
        assert.ok(initial.products.length > 0);
        assert.ok(initial.services.length > 0);
        assert.ok(initial.inventory_balances.length > 0);
      }
      await runMigrations();
      const { account } = await login('admin', '12345678');
      assert.equal(account.role, 'manager');
      assert.equal(account.branchId, Number(initial.branches[0].id));
      await assert.rejects(assertProductionDatabaseSafety(), /demo account passwords must be changed/);

      const changedHash = await hashPassword('changed-seed-test-password');
      await db.query("UPDATE user_accounts SET password_hash = $1 WHERE username = 'admin'", [changedHash]);
      await db.exec("UPDATE branches SET name = 'Edited salon'");
      const before = await snapshot(db);
      for (const sql of Object.values(seeds)) {
        await assert.rejects(db.exec(sql), /requires an empty database/);
        await db.exec('ROLLBACK');
        assert.deepEqual(await snapshot(db), before);
      }
      await runMigrations();
      const restarted = await snapshot(db);
      assert.deepEqual(restarted.user_accounts, before.user_accounts);
      assert.deepEqual(restarted.branches, before.branches);
    } finally {
      pool.query = originalQuery;
      await db.close();
    }
  });

  test(`${name} seed rolls back all rows on SQL failure and can then be retried`, async () => {
    const db = new PGlite();
    try {
      await db.exec(schema);
      const broken = seeds[name].replace(/COMMIT;\s*$/, 'SELECT 1 / 0;\nCOMMIT;');
      await assert.rejects(db.exec(broken), /division by zero/);
      await db.exec('ROLLBACK');
      assert.ok(Object.values(await snapshot(db)).every(rows => rows.length === 0));
      await db.exec(seeds[name]);
      assert.equal((await db.query('SELECT count(*)::int AS total FROM branches')).rows[0].total, 1);
    } finally {
      await db.close();
    }
  });
}

test('API migrations on an empty schema do not seed accounts or business rows', async () => {
  const db = new PGlite();
  const originalQuery = pool.query;
  pool.query = async (sql, params) => params ? db.query(sql, params) : (await db.exec(sql)).at(-1);
  try {
    await db.exec(schema);
    await runMigrations();
    assert.ok(Object.values(await snapshot(db)).every(rows => rows.length === 0));
    await db.exec(seeds.minji);
    assert.equal((await login('admin', '12345678')).account.role, 'manager');
  } finally {
    pool.query = originalQuery;
    await db.close();
  }
});
