import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pool } from '../../db.js';
import { customerDebtMigration } from '../../migrations/customer-debt.js';
import { cashbookMigration } from '../../migrations/cashbook.js';
import {
  cancelVoucher,
  createOpeningBalance,
  createTransfer,
  createVoucher,
  getCashbookSummary,
  getVoucher,
  listVouchers,
} from './cashbook.service.js';
import { collectCustomerDebt } from '../debts/debts.service.js';
import { checkoutPosInvoice } from '../pos/pos.service.js';

const page = { page: 1, pageSize: 20, offset: 0 };
const fund = (summary, name) => summary.funds.find((candidate) => candidate.fund === name);

test('cashbook service keeps fund balances, vouchers and cancellations consistent', async (t) => {
  const db = new PGlite();
  const originalConnect = pool.connect;
  const originalQuery = pool.query;
  const query = (sql, params = []) => db.query(sql, params);
  pool.connect = async () => ({ query, release() {} });
  pool.query = query;
  try {
    await db.exec(readFileSync(new URL('../../../../database/init/001_schema.sql', import.meta.url), 'utf8'));
    await db.exec(`INSERT INTO branches(code,name) VALUES('TEST','Test'),('OTHER','Other');
      INSERT INTO user_accounts(branch_id,username,password_hash,display_name,role) VALUES(1,'manager','unused','Quản lý','manager');
      INSERT INTO customers(branch_id,code,name,debt_balance) VALUES(1,'C1','Chị Lan',0);
      INSERT INTO services(branch_id,code,name,price,duration_minutes) VALUES(1,'S1','Gội đầu',1000,60);`);
    await db.exec(customerDebtMigration);
    await db.exec(cashbookMigration);

    const earlier = new Date('2026-08-15T03:00:00Z');
    const inRange = new Date('2026-09-10T03:00:00Z');
    const range = { branchId: 1, dateFrom: '2026-09-01', dateTo: '2026-09-30' };

    await t.test('opening balance before the range becomes the opening of the period', async () => {
      await createOpeningBalance({ branchId: 1, actorAccountId: 1, fund: 'cash', amount: 5000, occurredAt: earlier, requestKey: 'opening-cash-1' });
      const summary = await getCashbookSummary(range);
      assert.deepEqual(fund(summary, 'cash'), { fund: 'cash', opening: 5000, income: 0, expense: 0, closing: 5000, currentBalance: 5000 });
      assert.equal(fund(summary, 'bank').closing, 0);
    });

    let rent;
    await t.test('manual vouchers are numbered, replay-safe and change the right fund', async () => {
      const input = { branchId: 1, actorAccountId: 1, type: 'expense', fund: 'cash', categoryKey: 'rent', amount: 1200, occurredAt: inRange, counterpartyName: 'Chủ nhà', note: 'Tháng 9', requestKey: 'voucher-rent-1' };
      rent = await createVoucher(input);
      assert.equal(rent.code, 'PC000001');
      assert.equal(rent.categoryLabel, 'Tiền thuê mặt bằng');
      assert.equal(rent.createdByName, 'Quản lý');
      assert.equal(rent.cancellable, true);
      assert.equal(rent.paymentMethod, 'cash');
      assert.deepEqual(await createVoucher(input), JSON.parse(JSON.stringify(rent)));
      await assert.rejects(createVoucher({ ...input, amount: 1300 }), { code: 'REQUEST_KEY_CONFLICT' });
      await createVoucher({ ...input, type: 'income', fund: 'bank', categoryKey: 'other_income', amount: 300, counterpartyName: 'Bán phế liệu', note: '', requestKey: 'voucher-other-1' });
      const summary = await getCashbookSummary(range);
      assert.equal(fund(summary, 'cash').expense, 1200);
      assert.equal(fund(summary, 'cash').closing, 3800);
      assert.equal(fund(summary, 'bank').income, 300);
      assert.equal(summary.total.closing, 4100);
    });

    await t.test('automatic categories, wrong types, bad amounts and future dates are rejected', async () => {
      const base = { branchId: 1, actorAccountId: 1, type: 'income', fund: 'cash', amount: 100, requestKey: 'voucher-bad-1' };
      await assert.rejects(createVoucher({ ...base, categoryKey: 'sales' }), { code: 'INVALID_CASH_CATEGORY' });
      await assert.rejects(createVoucher({ ...base, categoryKey: 'rent' }), { code: 'INVALID_CASH_CATEGORY' });
      await assert.rejects(createVoucher({ ...base, categoryKey: 'other_income', amount: 0 }), { code: 'INVALID_AMOUNT' });
      await assert.rejects(createVoucher({ ...base, categoryKey: 'other_income', occurredAt: new Date(Date.now() + 86_400_000) }), { code: 'INVALID_ARGUMENT' });
    });

    await t.test('a transfer moves money between funds without changing combined totals', async () => {
      const before = await getCashbookSummary(range);
      const transfer = await createTransfer({ branchId: 1, actorAccountId: 1, fromFund: 'cash', toFund: 'bank', amount: 1000, occurredAt: inRange, requestKey: 'transfer-0001' });
      assert.deepEqual(transfer.vouchers.map((voucher) => [voucher.type, voucher.fund, voucher.categoryKey]), [
        ['expense', 'cash', 'fund_transfer_out'],
        ['income', 'bank', 'fund_transfer_in'],
      ]);
      const after = await getCashbookSummary(range);
      assert.equal(fund(after, 'cash').closing, fund(before, 'cash').closing - 1000);
      assert.equal(fund(after, 'bank').closing, fund(before, 'bank').closing + 1000);
      assert.deepEqual(after.total, before.total);
      await assert.rejects(createTransfer({ branchId: 1, actorAccountId: 1, fromFund: 'cash', toFund: 'cash', amount: 1, requestKey: 'transfer-same' }), { code: 'INVALID_ARGUMENT' });

      // Cancelling one half cancels the pair.
      await cancelVoucher({ branchId: 1, actorAccountId: 1, id: transfer.vouchers[1].id, reason: 'Nhập nhầm' });
      assert.equal((await getVoucher({ branchId: 1, id: transfer.vouchers[0].id })).status, 'cancelled');
      assert.deepEqual(await getCashbookSummary(range), before);
    });

    await t.test('cancelling keeps the voucher but removes it from balances', async () => {
      await assert.rejects(cancelVoucher({ branchId: 1, actorAccountId: 1, id: rent.id, reason: '' }), { code: 'CANCEL_REASON_REQUIRED' });
      const cancelled = await cancelVoucher({ branchId: 1, actorAccountId: 1, id: rent.id, reason: 'Trùng phiếu' });
      assert.equal(cancelled.status, 'cancelled');
      assert.equal(cancelled.cancelReason, 'Trùng phiếu');
      assert.equal(cancelled.cancellable, false);
      await assert.rejects(cancelVoucher({ branchId: 1, actorAccountId: 1, id: rent.id, reason: 'Lần 2' }), { code: 'VOUCHER_ALREADY_CANCELLED' });
      assert.equal(fund(await getCashbookSummary(range), 'cash').closing, 5000);
      const list = await listVouchers({ ...range, status: 'cancelled', ...page });
      assert.ok(list.items.some((voucher) => voucher.id === rent.id));
    });

    await t.test('POS sales and debt collections appear as linked, non-cancellable receipts', async () => {
      const sale = await checkoutPosInvoice({ branchId: 1, actorAccountId: 1, customerId: 1, lines: [{ itemType: 'service', itemId: 1, quantity: 1 }], discount: 0, paymentMethod: 'bank_transfer', amountPaid: 600, allowDebt: true, requestKey: 'checkout-cashbook-1' });
      const collection = await collectCustomerDebt({ branchId: 1, customerId: 1, actorAccountId: 1, amount: 400, paymentMethod: 'cash', requestKey: 'collect-cashbook-1' });
      assert.match(collection.voucherCode, /^PT\d{6}$/);
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
      const list = await listVouchers({ branchId: 1, dateFrom: today, dateTo: today, ...page });
      const saleVoucher = list.items.find((voucher) => voucher.categoryKey === 'sales');
      assert.equal(saleVoucher.sourceCode, sale.code);
      assert.equal(saleVoucher.fund, 'bank');
      assert.equal(saleVoucher.counterpartyName, 'Chị Lan');
      assert.equal(saleVoucher.cancellable, false);
      await assert.rejects(cancelVoucher({ branchId: 1, actorAccountId: 1, id: saleVoucher.id, reason: 'x' }), { code: 'VOUCHER_HAS_SOURCE' });
      const debtVoucher = list.items.find((voucher) => voucher.categoryKey === 'debt_collection');
      assert.equal(debtVoucher.code, collection.voucherCode);
      assert.equal(list.summary.income, 1000);
    });

    await t.test('list filters by type, fund, category and search', async () => {
      const all = await listVouchers({ ...range, ...page });
      assert.ok(all.items.length >= 4);
      const bankIncome = await listVouchers({ ...range, type: 'income', fund: 'bank', ...page });
      assert.ok(bankIncome.items.every((voucher) => voucher.type === 'income' && voucher.fund === 'bank'));
      const search = await listVouchers({ ...range, search: 'Chủ nhà', ...page });
      assert.deepEqual(search.items.map((voucher) => voucher.id), [rent.id]);
      const paged = await listVouchers({ ...range, page: 2, pageSize: 1, offset: 1 });
      assert.equal(paged.items.length, 1);
      assert.equal(paged.pagination.total, all.pagination.total);
    });

    await t.test('other branches see nothing and cannot touch vouchers', async () => {
      const other = await getCashbookSummary({ ...range, branchId: 2 });
      assert.equal(other.total.currentBalance, 0);
      assert.equal((await listVouchers({ ...range, branchId: 2, ...page })).items.length, 0);
      await assert.rejects(getVoucher({ branchId: 2, id: rent.id }), { code: 'VOUCHER_NOT_FOUND' });
      await assert.rejects(cancelVoucher({ branchId: 2, actorAccountId: 1, id: rent.id, reason: 'x' }), { code: 'VOUCHER_NOT_FOUND' });
    });

    await t.test('a failure after the insert rolls back the voucher and its request key', async () => {
      const count = async () => Number((await query('SELECT COUNT(*) AS n FROM cash_transactions')).rows[0].n);
      const before = await count();
      pool.connect = async () => ({ release() {}, query: async (sql, params) => {
        if (sql.startsWith('UPDATE payment_requests')) throw new Error('simulated failure');
        return query(sql, params);
      } });
      await assert.rejects(createVoucher({ branchId: 1, actorAccountId: 1, type: 'expense', fund: 'cash', categoryKey: 'utilities', amount: 50, requestKey: 'voucher-rollback' }), /simulated failure/);
      pool.connect = async () => ({ query, release() {} });
      assert.equal(await count(), before);
      assert.equal((await query("SELECT * FROM payment_requests WHERE request_key='voucher-rollback'")).rows.length, 0);
    });
  } finally {
    await new Promise((resolve) => setImmediate(resolve));
    pool.connect = originalConnect;
    pool.query = originalQuery;
    await db.close();
  }
});
