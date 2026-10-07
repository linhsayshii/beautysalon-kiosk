import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pool } from '../db.js';
import { cashbookMigration } from '../migrations/cashbook.js';
import { customerDebtMigration } from '../migrations/customer-debt.js';
import { createCustomer } from './customers/customers.service.js';
import { createInventoryItem, createPurchaseOrder } from './inventory/inventory.service.js';

// Goods, customer and purchase-order codes are UNIQUE across all branches in
// the schema, so a second branch must continue the shared sequence.
test('a second branch continues the shared code sequences instead of colliding', async () => {
  const db = new PGlite();
  const originalQuery = pool.query;
  const originalConnect = pool.connect;
  const query = (sql, params = []) => db.query(sql, params);
  pool.query = query;
  pool.connect = async () => ({ query, release() {} });
  try {
    await db.exec(readFileSync(new URL('../../../database/init/001_schema.sql', import.meta.url), 'utf8'));
    await db.exec(cashbookMigration);
    await db.exec(customerDebtMigration);
    await db.exec(`INSERT INTO branches(code,name) VALUES('A','Salon A'),('B','Salon B');
      INSERT INTO suppliers(branch_id,code,name) VALUES(1,'NCC1','NCC A'),(2,'NCC2','NCC B');`);

    const product = (branchId, name) => createInventoryItem({
      branchId, type: 'product', name, category: 'Sản phẩm', salePrice: 1000, costPrice: 500,
      active: true, unit: 'chai', initialStock: 0, minStock: 0, maxStock: null, commissionType: null, commissionRate: 0,
    });
    assert.equal((await product(1, 'Serum A')).code, 'SP000001');
    assert.equal((await product(2, 'Serum B')).code, 'SP000002');

    const customer = (branchId, name) => createCustomer({ branchId, name, phone: null });
    assert.equal((await customer(1, 'Khách A')).code, 'KH000001');
    assert.equal((await customer(2, 'Khách B')).code, 'KH000002');

    const order = (branchId, supplierId, productId) => createPurchaseOrder({
      branchId, supplierId, status: 'draft', discount: 0, otherCost: 0, amountPaid: 0, paymentMethod: 'cash', note: '',
      items: [{ productId, quantity: 1, unitCost: 500, discount: 0 }],
    });
    await order(1, 1, 1);
    await order(2, 2, 2);
    const { rows } = await db.query('SELECT branch_id, code FROM purchase_orders ORDER BY id');
    assert.deepEqual(rows.map((row) => [Number(row.branch_id), row.code]), [[1, 'PN000001'], [2, 'PN000002']]);
  } finally {
    pool.query = originalQuery;
    pool.connect = originalConnect;
    await db.close();
  }
});
