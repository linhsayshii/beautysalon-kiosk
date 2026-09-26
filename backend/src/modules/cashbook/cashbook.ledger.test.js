import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pool } from '../../db.js';
import { customerDebtMigration } from '../../migrations/customer-debt.js';
import { cashbookMigration } from '../../migrations/cashbook.js';
import { fundForPaymentMethod, recordCashEntry } from './cashbook.ledger.js';
import { createPurchaseOrder } from '../inventory/inventory.service.js';

test('payment methods map to the two funds and wallet stays outside', () => {
  assert.equal(fundForPaymentMethod('cash'), 'cash');
  assert.equal(fundForPaymentMethod('bank_transfer'), 'bank');
  assert.equal(fundForPaymentMethod('card'), 'bank');
  assert.equal(fundForPaymentMethod('transfer'), 'bank');
  assert.equal(fundForPaymentMethod('wallet'), null);
});

test('cashbook migration backfills legacy rows and ledger numbers vouchers per branch', async (t) => {
  const db = new PGlite();
  const originalConnect = pool.connect;
  const originalQuery = pool.query;
  const query = (sql, params = []) => db.query(sql, params);
  pool.connect = async () => ({ query, release() {} });
  pool.query = query;
  try {
    await db.exec(readFileSync(new URL('../../../../database/init/001_schema.sql', import.meta.url), 'utf8'));
    await db.exec(`INSERT INTO branches(code,name) VALUES('TEST','Test'),('OTHER','Other');
      INSERT INTO customers(branch_id,code,name) VALUES(1,'C1','Chị Lan');
      INSERT INTO invoices(branch_id,customer_id,code,status,subtotal,discount,total,issued_at) VALUES(1,1,'HD1','paid',500,0,500,NOW());
      INSERT INTO suppliers(branch_id,code,name) VALUES(1,'NCC1','Nhà cung cấp A');
      INSERT INTO products(branch_id,sku,name,unit,sale_price,cost_price) VALUES(1,'SP1','Serum','chai',300,100);
      INSERT INTO cash_transactions(branch_id,transaction_type,category,amount,note,occurred_at) VALUES
        (1,'income','Thu tiền bán hàng POS',500,'Thu tiền hóa đơn HD1 (bank_transfer)','2026-09-01T03:00:00Z'),
        (1,'income','Thu tiền qua thẻ tài khoản',200,'Thu tiền hóa đơn HD2 qua thẻ tài khoản','2026-09-01T04:00:00Z'),
        (1,'income','Thu công nợ khách hàng',100,'Thu nợ KH #1 · Phiếu #7 (cash) ','2026-09-02T03:00:00Z'),
        (1,'expense','Chi trả lương nhân viên',300,'Chi lương kỳ 1','2026-09-03T03:00:00Z');`);
    await db.exec(customerDebtMigration);
    await db.exec(cashbookMigration);

    await t.test('legacy rows get fund, category, source and sequential codes', async () => {
      const { rows } = await query('SELECT * FROM cash_transactions ORDER BY id');
      assert.deepEqual(rows.map((r) => [r.fund, r.category_key, r.code]), [
        ['bank', 'sales', 'PT000001'],
        [null, 'wallet_payment', null],
        ['cash', 'debt_collection', 'PT000002'],
        ['bank', 'salary', 'PC000001'],
      ]);
      assert.equal(Number(rows[0].source_id), 1);
      assert.equal(rows[0].counterparty_name, 'Chị Lan');
      assert.equal(Number(rows[2].source_id), 7);
    });

    await t.test('re-running the migration changes nothing', async () => {
      const before = (await query('SELECT * FROM cash_transactions ORDER BY id')).rows;
      await db.exec(cashbookMigration);
      assert.deepEqual((await query('SELECT * FROM cash_transactions ORDER BY id')).rows, before);
    });

    await t.test('recordCashEntry continues numbering per branch and prefix', async () => {
      const a = await recordCashEntry({ query }, { branchId: 1, type: 'income', categoryKey: 'other_income', amount: 50, paymentMethod: 'cash' });
      const b = await recordCashEntry({ query }, { branchId: 2, type: 'income', categoryKey: 'other_income', amount: 50, paymentMethod: 'cash' });
      const c = await recordCashEntry({ query }, { branchId: 1, type: 'expense', categoryKey: 'rent', amount: 80, fund: 'bank' });
      assert.equal(a.code, 'PT000003');
      assert.equal(b.code, 'PT000001');
      assert.equal(c.code, 'PC000002');
      assert.equal(c.fund, 'bank');
    });

    await t.test('wallet payments and zero amounts write nothing; wrong category types are rejected', async () => {
      const count = async () => Number((await query('SELECT COUNT(*) AS n FROM cash_transactions')).rows[0].n);
      const before = await count();
      assert.equal(await recordCashEntry({ query }, { branchId: 1, type: 'income', categoryKey: 'sales', amount: 90, paymentMethod: 'wallet' }), null);
      assert.equal(await recordCashEntry({ query }, { branchId: 1, type: 'income', categoryKey: 'sales', amount: 0, paymentMethod: 'cash' }), null);
      assert.equal(await count(), before);
      await assert.rejects(recordCashEntry({ query }, { branchId: 1, type: 'income', categoryKey: 'rent', amount: 10, paymentMethod: 'cash' }), { code: 'INVALID_CASH_CATEGORY' });
    });

    await t.test('a received purchase order writes a supplier payment voucher; a draft does not', async () => {
      const base = { branchId: 1, supplierId: 1, receivedAt: null, discount: 0, otherCost: 0, paymentMethod: 'bank_transfer', note: '', items: [{ productId: 1, quantity: 2, unitCost: 120 }] };
      await createPurchaseOrder({ ...base, status: 'draft', amountPaid: 240 });
      assert.equal(Number((await query("SELECT COUNT(*) AS n FROM cash_transactions WHERE category_key='supplier_payment'")).rows[0].n), 0);
      const order = await createPurchaseOrder({ ...base, status: 'completed', amountPaid: 500 });
      const { rows } = await query("SELECT * FROM cash_transactions WHERE category_key='supplier_payment'");
      assert.equal(rows.length, 1);
      assert.equal(Number(rows[0].amount), 240);
      assert.equal(rows[0].fund, 'bank');
      assert.equal(Number(rows[0].source_id), order.id);
      assert.equal(rows[0].counterparty_name, 'Nhà cung cấp A');
    });
  } finally {
    pool.connect = originalConnect;
    pool.query = originalQuery;
    await db.close();
  }
});
