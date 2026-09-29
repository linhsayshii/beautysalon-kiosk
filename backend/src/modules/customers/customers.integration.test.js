import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pool } from '../../db.js';
import { customerDebtMigration } from '../../migrations/customer-debt.js';
import { cashbookMigration } from '../../migrations/cashbook.js';
import { createCustomer, getCustomer, getCustomerActivity, listCustomers } from './customers.service.js';

test('customer service', async (t) => {
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

    await t.test('a new customer gets the next KH code even when another code is a long number', async () => {
      await db.exec(`INSERT INTO customers(branch_id,code,name) VALUES
        (1,'KH000006','Đỗ Mỹ Linh'),
        (1,'0934567890123','Mã nhập tay');`);
      const created = await createCustomer({ branchId: 1, name: 'Khách mới' });
      assert.equal(created.code, 'KH000007');
    });
    await t.test('the customer detail returns every field the edit form saves', async () => {
      await db.exec(`INSERT INTO customers(branch_id,code,name,phone,dob,gender,email,facebook,customer_group)
        VALUES (1,'KH000050','Chị Lan','0901000050','1990-05-12','Nữ','lan@example.com','fb.com/lan','Công ty');`);
      const { rows } = await db.query("SELECT id FROM customers WHERE code='KH000050'");
      const customer = await getCustomer({ branchId: 1, id: Number(rows[0].id) });
      assert.deepEqual(
        { dob: customer.dob, gender: customer.gender, email: customer.email, facebook: customer.facebook, group: customer.group },
        { dob: '1990-05-12', gender: 'Nữ', email: 'lan@example.com', facebook: 'fb.com/lan', group: 'Công ty' },
      );
    });
    await t.test('POS sales count as visits and service history, once per day', async () => {
      await db.exec(`
        INSERT INTO customers(branch_id,code,name) VALUES (1,'KH000100','Khách vãng lai');
        INSERT INTO staff(branch_id,code,name,role) VALUES (1,'NV1','Hậu','Kỹ thuật viên');
        INSERT INTO services(branch_id,code,name,price,duration_minutes) VALUES (1,'DV1','Gội đầu',100,30),(1,'DV2','Nano White Lưng',200,60);
        INSERT INTO appointments(branch_id,customer_id,service_id,staff_id,starts_at,ends_at,status)
          VALUES (1,(SELECT id FROM customers WHERE code='KH000100'),1,1,'2026-09-20T02:00:00Z','2026-09-20T02:30:00Z','completed');
        INSERT INTO invoices(branch_id,customer_id,code,status,subtotal,total,issued_at) VALUES
          (1,(SELECT id FROM customers WHERE code='KH000100'),'APPT1','paid',100,100,'2026-09-20T03:00:00Z'),
          (1,(SELECT id FROM customers WHERE code='KH000100'),'POS1','paid',200,200,'2026-09-28T19:38:00Z'),
          (1,(SELECT id FROM customers WHERE code='KH000100'),'DRAFT1','draft',200,200,'2026-09-29T05:00:00Z');
        INSERT INTO invoice_items(invoice_id,item_type,service_id,staff_id,appointment_id,description,quantity,unit_price,line_total) VALUES
          ((SELECT id FROM invoices WHERE code='APPT1'),'service',1,1,(SELECT id FROM appointments LIMIT 1),'Gội đầu',1,100,100),
          ((SELECT id FROM invoices WHERE code='POS1'),'service',2,1,NULL,'Nano White Lưng',1,200,200),
          ((SELECT id FROM invoices WHERE code='DRAFT1'),'service',2,1,NULL,'Nano White Lưng',1,200,200);
      `);
      const { rows } = await db.query("SELECT id FROM customers WHERE code='KH000100'");
      const id = Number(rows[0].id);

      const customer = await getCustomer({ branchId: 1, id });
      // Two days with a visit: the appointment day and the POS sale; the draft is not a visit.
      assert.equal(customer.visitCount, 2);
      assert.equal(new Date(customer.lastVisit).toISOString(), '2026-09-28T19:38:00.000Z');

      const listed = await listCustomers({ branchId: 1, search: 'Khách vãng lai', group: '', debtStatus: '', page: 1, pageSize: 20, offset: 0, sort: '' });
      assert.equal(new Date(listed.rows[0].lastVisit).toISOString(), '2026-09-28T19:38:00.000Z');

      const history = await getCustomerActivity({ branchId: 1, id, kind: 'appointments' });
      assert.deepEqual(history.map((row) => [row.serviceName, row.staffName, row.status]), [
        ['Nano White Lưng', 'Hậu', 'completed'],
        ['Gội đầu', 'Hậu', 'completed'],
      ]);
    });
  } finally {
    pool.connect = originalConnect;
    pool.query = originalQuery;
    await db.close();
  }
});
