import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pool } from '../../db.js';
import { customerDebtMigration } from '../../migrations/customer-debt.js';
import { cashbookMigration } from '../../migrations/cashbook.js';
import { createInventoryItem, getInventoryItem, listPosProducts, listProducts, updateInventoryItem } from './inventory.service.js';

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

    await t.test('POS catalog and goods list find a product by its barcode', async () => {
      await db.exec(`INSERT INTO products(branch_id,sku,name,barcode,sale_price,cost_price) VALUES
        (1,'SP000600','Toner hoa hồng','8931234567890',150000,80000),
        (1,'SP000601','Toner mini','8931234567000',90000,40000);`);
      const pos = await listPosProducts({ branchId: 1, customerId: null, search: '8931234567890', type: '' });
      assert.deepEqual(pos.rows.map((row) => [row.code, row.barcode]), [['SP000600', '8931234567890']]);

      const partial = await listPosProducts({ branchId: 1, customerId: null, search: '89312345678', type: '' });
      assert.equal(partial.rows.length, 1);

      const goods = await listProducts({ branchId: 1, search: '8931234567000', type: '', category: '', stockStatus: '', status: '', page: 1, pageSize: 20, offset: 0 });
      assert.deepEqual(goods.rows.map((row) => row.code), ['SP000601']);
    });

    await t.test('an exact code or barcode match is listed first in the POS catalog', async () => {
      await db.exec(`INSERT INTO products(branch_id,sku,name,barcode,sale_price,cost_price) VALUES
        (1,'SP000700','Sữa rửa mặt','4006381333931',100000,50000),
        (1,'SP000701','Sữa rửa mặt mini','40063813339310',50000,20000);`);
      const pos = await listPosProducts({ branchId: 1, customerId: null, search: '4006381333931', type: '' });
      assert.deepEqual(pos.rows.map((row) => row.code), ['SP000700', 'SP000701']);
    });

    await t.test('a service keeps its tour commission; other goods have none', async () => {
      const service = await createInventoryItem({
        ...productInput, type: 'service', name: 'Gội đầu dưỡng sinh', durationMinutes: 60,
        tourCommissionType: 'fixed', tourCommissionRate: 50000,
      });
      const detail = await getInventoryItem({ branchId: 1, type: 'service', id: service.itemId });
      assert.deepEqual([detail.tourCommissionType, detail.tourCommissionRate], ['fixed', 50000]);

      await updateInventoryItem({
        ...productInput, type: 'service', id: service.itemId, name: 'Gội đầu dưỡng sinh', durationMinutes: 60,
        tourCommissionType: 'percent', tourCommissionRate: 0.05,
      });
      const pos = await listPosProducts({ branchId: 1, customerId: null, search: 'Gội đầu dưỡng sinh', type: 'service' });
      assert.deepEqual([pos.rows[0].tourCommissionType, pos.rows[0].tourCommissionRate], ['percent', 0.05]);

      const products = await listPosProducts({ branchId: 1, customerId: null, search: 'SP000700', type: '' });
      assert.deepEqual([products.rows[0].tourCommissionType, products.rows[0].tourCommissionRate], [null, 0]);
    });
  } finally {
    pool.connect = originalConnect;
    pool.query = originalQuery;
    await db.close();
  }
});
