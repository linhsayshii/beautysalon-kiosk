import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pool } from '../../db.js';
import { customerDebtMigration } from '../../migrations/customer-debt.js';
import { cashbookMigration } from '../../migrations/cashbook.js';
import { createInventoryItem } from './inventory.service.js';

const productInput = {
  branchId: 1, type: 'product', name: 'Serum mới', category: 'Sản phẩm', salePrice: 350000, costPrice: 200000,
  active: true, unit: 'chai', initialStock: 0, minStock: 0, maxStock: null, commissionType: null, commissionRate: 0,
};

test('inventory item codes', async (t) => {
  const db = new PGlite();
  const originalConnect = pool.connect;
  const originalQuery = pool.query;
  const query = (sql, params = []) => db.query(sql, params);
  pool.connect = async () => ({ query, release() {} });
  pool.query = query;
  try {
    await db.exec(readFileSync(new URL('../../../../database/init/001_schema.sql', import.meta.url), 'utf8'));
    await db.exec(customerDebtMigration);
    await db.exec(cashbookMigration);
    await db.exec(`INSERT INTO branches(code,name) VALUES('TEST','Test');`);

    await t.test('a new product gets the next SP code even when other SKUs are 13-digit barcodes', async () => {
      await db.exec(`INSERT INTO products(branch_id,sku,name,sale_price,cost_price) VALUES
        (1,'SP000497','Kem cũ',100000,50000),
        (1,'8936134271875','Isotretinoin 10mg',100000,50000),
        (1,'Meso','meso p-cell',100000,50000);`);
      const created = await createInventoryItem(productInput);
      assert.equal(created.code, 'SP000498');
    });

    await t.test('the SP sequence is shared with imported services, packages and cards', async () => {
      // KiotViet imports give every item type SP codes; the list shows them together.
      await db.exec(`INSERT INTO services(branch_id,code,name,price,duration_minutes) VALUES (1,'SP000502','Ngoáy tai',10000,30);`);
      const created = await createInventoryItem({ ...productInput, name: 'Serum khác' });
      assert.equal(created.code, 'SP000503');
    });
  } finally {
    pool.connect = originalConnect;
    pool.query = originalQuery;
    await db.close();
  }
});
