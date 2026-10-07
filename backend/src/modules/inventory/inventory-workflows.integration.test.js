import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pool } from '../../db.js';
import { cashbookMigration } from '../../migrations/cashbook.js';
import { customerDebtMigration } from '../../migrations/customer-debt.js';
import { createOpeningBalance } from '../cashbook/cashbook.service.js';
import { completePurchaseOrder, createPurchaseOrder, listProducts, listPricebooks, listPurchaseOrders, updatePricebookItem } from './inventory.service.js';

test('inventory list and draft-receiving workflows', async t => {
  const db = new PGlite();
  const originalQuery = pool.query;
  const originalConnect = pool.connect;
  const query = (sql, params = []) => db.query(sql, params);
  pool.query = query;
  pool.connect = async () => ({ query, release() {} });
  try {
    await db.exec(readFileSync(new URL('../../../../database/init/001_schema.sql', import.meta.url), 'utf8'));
    await db.exec(cashbookMigration);
    await db.exec(customerDebtMigration);
    await db.exec(`
      INSERT INTO branches(code,name) VALUES('A','Salon A'),('B','Salon B');
      INSERT INTO user_accounts(branch_id,username,password_hash,display_name,role) VALUES(1,'manager','unused','Quản lý','manager');
      INSERT INTO suppliers(branch_id,code,name) VALUES(1,'NCC1','Nhà cung cấp');
      INSERT INTO products(branch_id,sku,name,sale_price,cost_price,min_stock) VALUES
        (1,'SP1','Serum',100,30,2),(1,'SP2','Kem',300,40,0),(2,'SP3','Chi nhánh khác',9999,0,0);
      INSERT INTO services(branch_id,code,name,price,duration_minutes) VALUES(1,'DV1','Gội đầu',200,60);
      INSERT INTO pricebooks(branch_id,code,name,is_default) VALUES(1,'BG1','Bảng giá chung',TRUE);
      INSERT INTO pricebook_items(pricebook_id,item_type,item_id,sale_price) VALUES(1,'product',1,500);
    `);
    const filters = { branchId: 1, search: '', type: '', category: '', stockStatus: '', status: '', page: 1, pageSize: 1, offset: 0 };
    await t.test('global goods sorting is stable across pages and excludes other branches', async () => {
      const first = await listProducts({ ...filters, sort: 'price_desc' });
      const second = await listProducts({ ...filters, sort: 'price_desc', page: 2, offset: 1 });
      assert.equal(first.rows[0].code, 'SP2');
      assert.equal(second.rows[0].code, 'DV1');
      assert.equal(first.pagination.total, 3);
      const low = await listProducts({ ...filters, stockStatus: 'low', pageSize: 20 });
      assert.deepEqual(low.rows.map(item => item.code), ['SP1']);
      await listProducts({ ...filters, sort: 'sale_price; DROP TABLE branches' });
    });
    await t.test('pricebook sorting uses its resolved prices and type filter before pagination', async () => {
      const first = await listPricebooks({ ...filters, pricebookId: 1, sort: 'price_desc', type: 'product' });
      assert.equal(first.rows[0].code, 'SP1');
      assert.equal(first.rows[0].bookPrice, 500);
      assert.equal(first.pagination.total, 2);
      const second = await listPricebooks({ ...filters, pricebookId: 1, sort: 'price_desc', type: 'product', page: 2, offset: 1 });
      assert.equal(second.rows[0].code, 'SP2');
    });
    await t.test('default book updates the goods base price while a special book keeps it unchanged', async () => {
      await updatePricebookItem({ branchId: 1, pricebookId: 1, itemType: 'product', itemId: 1, salePrice: 450 });
      assert.equal(Number((await db.query('SELECT sale_price FROM products WHERE id = 1')).rows[0].sale_price), 450);
      await db.exec("INSERT INTO pricebooks(branch_id,code,name) VALUES(1,'BG2','Giá riêng')");
      await updatePricebookItem({ branchId: 1, pricebookId: 2, itemType: 'product', itemId: 1, salePrice: 400 });
      assert.equal(Number((await db.query('SELECT sale_price FROM products WHERE id = 1')).rows[0].sale_price), 450);
      await assert.rejects(updatePricebookItem({ branchId: 2, pricebookId: 1, itemType: 'product', itemId: 1, salePrice: 1 }), { code: 'PRICEBOOK_NOT_FOUND' });
    });
    await t.test('rejects overpayment instead of silently changing the operator amount', async () => {
      await assert.rejects(createPurchaseOrder({ branchId: 1, supplierId: 1, status: 'draft', discount: 0, otherCost: 0,
        amountPaid: 200, paymentMethod: 'cash', note: '', items: [{ productId: 1, quantity: 1, unitCost: 30 }], actorAccountId: 1 }), { code: 'PAYMENT_EXCEEDS_DUE' });
      assert.equal((await db.query('SELECT COUNT(*) AS count FROM purchase_orders')).rows[0].count, 0);
    });
    const draft = await createPurchaseOrder({ branchId: 1, supplierId: 1, status: 'draft', discount: 0, otherCost: 0,
      amountPaid: 100, paymentMethod: 'cash', note: '', items: [{ productId: 1, quantity: 5, unitCost: 30, discount: 0 }], actorAccountId: 1 });
    await t.test('drafts do not create stock, cash expenses or actual supplier debt', async () => {
      assert.equal((await db.query('SELECT COUNT(*) AS count FROM inventory_balances')).rows[0].count, 0);
      assert.equal((await db.query('SELECT COUNT(*) AS count FROM cash_transactions')).rows[0].count, 0);
      const summary = await listPurchaseOrders({ ...filters, dateFrom: null, dateTo: null });
      assert.equal(summary.summary.totalDebt, 0);
      assert.equal(summary.summary.totalDue, 0);
      assert.equal(summary.summary.drafts, 1);
    });
    await t.test('cashbook failure rolls back receiving and stock together', async () => {
      await assert.rejects(completePurchaseOrder({ branchId: 1, id: draft.id, actorAccountId: 1 }), { code: 'INSUFFICIENT_FUND_BALANCE' });
      assert.equal((await db.query('SELECT status FROM purchase_orders WHERE id = $1', [draft.id])).rows[0].status, 'draft');
      assert.equal((await db.query('SELECT COUNT(*) AS count FROM inventory_balances')).rows[0].count, 0);
    });
    await createOpeningBalance({ branchId: 1, actorAccountId: 1, fund: 'cash', amount: 1000, requestKey: 'opening-receive-draft' });
    await t.test('receiving and retrying a draft creates stock and supplier expense only once', async () => {
      await completePurchaseOrder({ branchId: 1, id: draft.id, actorAccountId: 1 });
      await completePurchaseOrder({ branchId: 1, id: draft.id, actorAccountId: 1 });
      assert.equal(Number((await db.query('SELECT quantity FROM inventory_balances WHERE product_id = 1 AND branch_id = 1')).rows[0].quantity), 5);
      assert.equal((await db.query("SELECT COUNT(*) AS count FROM cash_transactions WHERE source_type = 'purchase_order'")).rows[0].count, 1);
      const summary = await listPurchaseOrders({ ...filters, dateFrom: null, dateTo: null });
      assert.equal(summary.summary.totalDebt, 50);
      await assert.rejects(completePurchaseOrder({ branchId: 2, id: draft.id, actorAccountId: 1 }), { code: 'PURCHASE_ORDER_NOT_FOUND' });
    });
  } finally {
    pool.query = originalQuery;
    pool.connect = originalConnect;
    await db.close();
  }
});
