import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pool } from '../../db.js';
import { customerDebtMigration } from '../../migrations/customer-debt.js';
import { cashbookMigration } from '../../migrations/cashbook.js';
import { cancelVoucher, createOpeningBalance, createTransfer, createVoucher, getCashbookSummary } from './cashbook.service.js';

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const balance = async (fund) => (await getCashbookSummary({ branchId: 1, dateFrom: today(), dateTo: today() }))
  .funds.find((candidate) => candidate.fund === fund).currentBalance;

test('cashbook never lets a fund go below zero', async (t) => {
  const db = new PGlite();
  const originalConnect = pool.connect;
  const originalQuery = pool.query;
  const query = (sql, params = []) => db.query(sql, params);
  pool.connect = async () => ({ query, release() {} });
  pool.query = query;
  try {
    await db.exec(readFileSync(new URL('../../../../database/init/001_schema.sql', import.meta.url), 'utf8'));
    await db.exec(`INSERT INTO branches(code,name) VALUES('TEST','Test');
      INSERT INTO user_accounts(branch_id,username,password_hash,display_name,role) VALUES(1,'manager','unused','Quản lý','manager');`);
    await db.exec(customerDebtMigration);
    await db.exec(cashbookMigration);
    const opening = await createOpeningBalance({ branchId: 1, actorAccountId: 1, fund: 'cash', amount: 1000, requestKey: 'opening-balance-1' });

    await t.test('a transfer larger than the source fund is rejected and writes nothing', async () => {
      await assert.rejects(
        createTransfer({ branchId: 1, actorAccountId: 1, fromFund: 'cash', toFund: 'bank', amount: 1001, requestKey: 'transfer-too-big' }),
        { status: 409, code: 'INSUFFICIENT_FUND_BALANCE' },
      );
      assert.equal(await balance('cash'), 1000);
      assert.equal(await balance('bank'), 0);
    });

    await t.test('a payment voucher larger than the fund is rejected', async () => {
      await assert.rejects(
        createVoucher({ branchId: 1, actorAccountId: 1, type: 'expense', fund: 'cash', categoryKey: 'rent', amount: 1500, requestKey: 'voucher-too-big' }),
        { status: 409, code: 'INSUFFICIENT_FUND_BALANCE' },
      );
      assert.equal(await balance('cash'), 1000);
    });

    await t.test('spending exactly the balance is allowed', async () => {
      await createTransfer({ branchId: 1, actorAccountId: 1, fromFund: 'cash', toFund: 'bank', amount: 400, requestKey: 'transfer-ok' });
      await createVoucher({ branchId: 1, actorAccountId: 1, type: 'expense', fund: 'cash', categoryKey: 'rent', amount: 600, requestKey: 'voucher-ok' });
      assert.equal(await balance('cash'), 0);
      assert.equal(await balance('bank'), 400);
    });

    await t.test('cancelling income that has already been spent is rejected', async () => {
      await assert.rejects(
        cancelVoucher({ branchId: 1, actorAccountId: 1, id: opening.id, reason: 'Nhập nhầm' }),
        { status: 409, code: 'INSUFFICIENT_FUND_BALANCE' },
      );
      assert.equal(await balance('cash'), 0);
    });
  } finally {
    await new Promise((resolve) => setImmediate(resolve));
    pool.connect = originalConnect;
    pool.query = originalQuery;
    await db.close();
  }
});
