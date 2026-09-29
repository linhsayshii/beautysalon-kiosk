import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pool } from '../../db.js';
import { customerDebtMigration } from '../../migrations/customer-debt.js';
import { listOrders } from './orders.service.js';

test('order list shows and filters by the staff chosen on POS lines', async (t) => {
  const db = new PGlite();
  const originalQuery = pool.query;
  pool.query = (sql, params = []) => db.query(sql, params);
  try {
    await db.exec(readFileSync(new URL('../../../../database/init/001_schema.sql', import.meta.url), 'utf8'));
    await db.exec(customerDebtMigration);
    await db.exec(`
      INSERT INTO branches(code,name) VALUES ('A','A');
      INSERT INTO staff(branch_id,code,name,role) VALUES (1,'NV1','Hậu','Kỹ thuật viên'),(1,'NV2','Em Huệ','Kỹ thuật viên');
      INSERT INTO services(branch_id,code,name,price,duration_minutes) VALUES (1,'S1','Gội đầu',100,30);
      INSERT INTO invoices(branch_id,code,status,subtotal,total,issued_at) VALUES (1,'POS1','paid',200,200,NOW()),(1,'POS2','paid',100,100,NOW());
      INSERT INTO invoice_items(invoice_id,item_type,service_id,staff_id,description,quantity,unit_price,line_total) VALUES
        (1,'service',1,1,'Gội đầu',1,100,100),
        (1,'service',1,2,'Gội đầu',1,100,100),
        (2,'service',1,NULL,'Gội đầu',1,100,100);
    `);
    const base = { branchId: 1, search: '', status: '', paymentMethod: '', staffId: null, dateFrom: null, dateTo: null, salesChannel: '', page: 1, pageSize: 20, offset: 0 };

    await t.test('the staff column lists every line staff member', async () => {
      const { rows } = await listOrders(base);
      const byCode = Object.fromEntries(rows.map((row) => [row.code, row.staffName]));
      assert.equal(byCode.POS1, 'Em Huệ, Hậu');
      assert.equal(byCode.POS2, null);
    });

    await t.test('filtering by staff finds invoices where they served a line', async () => {
      const { rows } = await listOrders({ ...base, staffId: 1 });
      assert.deepEqual(rows.map((row) => row.code), ['POS1']);
    });
  } finally {
    pool.query = originalQuery;
    await db.close();
  }
});
