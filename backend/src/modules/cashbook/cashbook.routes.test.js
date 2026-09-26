import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import express from 'express';
import { PGlite } from '@electric-sql/pglite';
import { pool } from '../../db.js';
import { customerDebtMigration } from '../../migrations/customer-debt.js';
import { cashbookMigration } from '../../migrations/cashbook.js';
import { permissions, requirePermissions } from '../auth/auth.permissions.js';
import cashbookRoutes from './cashbook.routes.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((request, response, next) => {
    request.account = { id: 1, branchId: 1, role: request.get('x-role') };
    next();
  });
  // Mirrors the mount in app.js.
  app.use('/cashbook', requirePermissions(permissions.writeCashbook), cashbookRoutes);
  app.use((error, request, response, next) => {
    response.status(error.status ?? 500).json({ error: { code: error.code, message: error.message } });
  });
  return app;
}

test('cashbook routes enforce manager and cashier boundaries', async (t) => {
  const db = new PGlite();
  const originalConnect = pool.connect;
  const originalQuery = pool.query;
  const query = (sql, params = []) => db.query(sql, params);
  pool.connect = async () => ({ query, release() {} });
  pool.query = query;
  const server = buildApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}/cashbook`;
  const call = (role, path, init = {}) => fetch(`${base}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', 'x-role': role, ...(init.headers ?? {}) },
  });
  try {
    await db.exec(readFileSync(new URL('../../../../database/init/001_schema.sql', import.meta.url), 'utf8'));
    await db.exec(`INSERT INTO branches(code,name) VALUES('TEST','Test');
      INSERT INTO user_accounts(branch_id,username,password_hash,display_name,role) VALUES(1,'cashier','unused','Thu ngân','cashier');`);
    await db.exec(customerDebtMigration);
    await db.exec(cashbookMigration);

    await t.test('staff accounts cannot reach the cashbook', async () => {
      assert.equal((await call('staff', '/vouchers')).status, 403);
    });

    await t.test('cashiers cannot read balances, cancel, transfer or set opening balances', async () => {
      assert.equal((await call('cashier', '/summary')).status, 403);
      assert.equal((await call('cashier', '/vouchers/1/cancel', { method: 'POST', body: '{"reason":"x"}' })).status, 403);
      assert.equal((await call('cashier', '/transfers', { method: 'POST', body: '{}' })).status, 403);
      assert.equal((await call('cashier', '/opening-balance', { method: 'POST', body: '{}' })).status, 403);
    });

    await t.test('cashier voucher lists are pinned to today and back-dating is ignored', async () => {
      const list = await (await call('cashier', '/vouchers?dateFrom=2020-01-01&dateTo=2020-01-31')).json();
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
      assert.equal(list.meta.dateFrom, today);
      assert.equal(list.meta.dateTo, today);

      const response = await call('cashier', '/vouchers', {
        method: 'POST',
        body: JSON.stringify({ type: 'expense', fund: 'cash', categoryKey: 'supplies', amount: 20000, occurredAt: '2020-01-01T00:00:00Z', requestKey: 'cashier-voucher-1' }),
      });
      assert.equal(response.status, 201);
      const voucher = (await response.json()).data;
      assert.ok(new Date(voucher.occurredAt).getTime() > Date.now() - 60_000);
    });

    await t.test('managers can read the summary and validation errors are 400s', async () => {
      assert.equal((await call('manager', '/summary?dateFrom=2026-09-01&dateTo=2026-09-30')).status, 200);
      assert.equal((await call('manager', '/summary?dateFrom=2026-09-30&dateTo=2026-09-01')).status, 400);
      assert.equal((await call('manager', '/vouchers?fund=wallet')).status, 400);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    pool.connect = originalConnect;
    pool.query = originalQuery;
    await db.close();
  }
});
