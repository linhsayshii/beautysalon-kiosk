import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pool, runMigrations } from '../../db.js';
import { createAppointments, getAppointmentEditor, updateAppointment } from '../dashboard/dashboard.service.js';
import { getOrder } from '../orders/orders.service.js';
import { checkoutPosInvoice } from './pos.service.js';

test('tour commission for performers and original commission for consultants', async (t) => {
  const db = new PGlite();
  const originalConnect = pool.connect;
  const originalQuery = pool.query;
  const query = (sql, params = []) => db.query(sql, params);
  pool.connect = async () => ({ query, release() {} });
  pool.query = (sql, params = []) => (params.length ? db.query(sql, params) : db.exec(sql));
  try {
    await db.exec(readFileSync(new URL('../../../../database/init/001_schema.sql', import.meta.url), 'utf8'));
    await runMigrations();
    // Upgrading an existing database runs the same migrations again.
    await runMigrations();
    await db.exec(`INSERT INTO branches(code,name) VALUES('TEST','Test'),('OTHER','Other');
      INSERT INTO user_accounts(branch_id,username,password_hash,display_name,role) VALUES(1,'test','unused','Thu ngân','cashier');
      INSERT INTO customers(branch_id,code,name) VALUES(1,'C1','Khách một');
      INSERT INTO staff(branch_id,code,name,role) VALUES
        (1,'NV1','Người làm','staff'),(1,'NV2','Người tư vấn','staff'),(2,'NV3','Chi nhánh khác','staff'),(1,'NV4','Người làm thay','staff');
      INSERT INTO services(branch_id,code,name,price,duration_minutes,commission_type,commission_rate,tour_commission_type,tour_commission_rate) VALUES
        (1,'S1','Nâng cơ',1000000,60,'percent',0.1,'fixed',50000),
        (1,'S2','Gội đầu',400000,30,'percent',0.1,'percent',0.05);
      INSERT INTO products(branch_id,sku,name,sale_price,cost_price,commission_type,commission_rate) VALUES
        (1,'P1','Serum',150000,50000,'fixed',20000);
      INSERT INTO inventory_balances(branch_id,product_id,quantity) VALUES(1,1,10);
      INSERT INTO service_packages(branch_id,code,name,total_units,list_price) VALUES(1,'G1','Gói gội',10,3000000);
      INSERT INTO service_package_items(package_id,service_id,units) VALUES(1,2,10);
      INSERT INTO customer_packages(branch_id,package_code,package_id,customer_id,sale_price,total_units,sold_at)
        VALUES(1,'PKG1',1,1,3000000,10,NOW());`);

    const commissions = async (invoiceId) => (await query(
      `SELECT s.code, cr.commission_type, cr.source_name, cr.revenue::float AS revenue, cr.amount::float AS amount
       FROM commission_records cr JOIN staff s ON s.id = cr.staff_id
       WHERE cr.invoice_id = $1 ORDER BY cr.id`,
      [invoiceId],
    )).rows.map((row) => [row.code, row.commission_type, row.source_name, row.revenue, row.amount]);
    let requestNumber = 0;
    const checkout = (lines, extra = {}) => checkoutPosInvoice({
      branchId: 1, actorAccountId: 1, customerId: 1, paymentMethod: 'cash', discount: 0, amountPaid: null,
      allowDebt: false, requestKey: `tour-request-${requestNumber += 1}`, lines, ...extra,
    });

    await t.test('the performer earns tour and the consultant earns the original commission', async () => {
      const receipt = await checkout([{ itemType: 'service', itemId: 1, quantity: 1, staffId: 1, consultantStaffId: 2 }]);
      assert.deepEqual(await commissions(receipt.id), [
        ['NV1', 'tour', 'Tua dịch vụ', 1000000, 50000],
        ['NV2', 'consulting', 'Tư vấn bán dịch vụ', 1000000, 100000],
      ]);
      const item = (await query('SELECT consultant_staff_id FROM invoice_items WHERE invoice_id = $1', [receipt.id])).rows[0];
      assert.equal(Number(item.consultant_staff_id), 2);
    });

    await t.test('without a consultant only the tour is recorded', async () => {
      const receipt = await checkout([{ itemType: 'service', itemId: 1, quantity: 1, staffId: 1 }]);
      assert.deepEqual(await commissions(receipt.id), [['NV1', 'tour', 'Tua dịch vụ', 1000000, 50000]]);
    });

    await t.test('a percent tour on package sessions uses the service list price', async () => {
      const receipt = await checkout([{
        itemType: 'service', itemId: 2, quantity: 2, staffId: 1, consultantStaffId: 2, usePackageId: 1, usePackageServiceId: 2,
      }]);
      assert.deepEqual(await commissions(receipt.id), [['NV1', 'tour', 'Tua dịch vụ', 800000, 40000]]);
    });

    await t.test('a product still pays its seller, labelled as a sale', async () => {
      const receipt = await checkout([{ itemType: 'product', itemId: 1, quantity: 2, staffId: 2 }]);
      assert.deepEqual(await commissions(receipt.id), [['NV2', 'consulting', 'Bán sản phẩm', 300000, 40000]]);
    });

    await t.test('a consultant must work at the branch and only applies to services', async () => {
      await assert.rejects(
        checkout([{ itemType: 'service', itemId: 1, quantity: 1, staffId: 1, consultantStaffId: 3 }]),
        { code: 'STAFF_NOT_FOUND' },
      );
      await assert.rejects(
        checkout([{ itemType: 'product', itemId: 1, quantity: 1, staffId: 1, consultantStaffId: 2 }]),
        { code: 'CONSULTANT_NOT_ALLOWED' },
      );
    });

    await t.test('an appointment keeps its consultant until the invoice is paid', async () => {
      const startsAt = new Date('2026-10-01T02:00:00Z');
      const endsAt = new Date('2026-10-01T03:00:00Z');
      const created = await createAppointments({
        branchId: 1, customerId: 1, status: 'confirmed', note: '', actorAccountId: 1,
        items: [{ serviceId: 1, staffId: 1, consultantStaffId: 2, quantity: 1, startsAt, endsAt }],
      });
      const appointmentId = created.appointments[0].id;
      const invoiceId = created.invoice.id;

      const editor = await getAppointmentEditor({ branchId: 1, id: appointmentId });
      assert.deepEqual([editor.items[0].consultantStaffId, editor.items[0].consultantStaffName], [2, 'Người tư vấn']);

      // Changing the performer on the schedule keeps the consultant.
      await updateAppointment({ branchId: 1, id: appointmentId, staffId: 4 });
      const order = await getOrder({ branchId: 1, id: invoiceId });
      assert.deepEqual(
        [order.items[0].staffId, order.items[0].consultantStaffId, order.items[0].consultantStaffName],
        [4, 2, 'Người tư vấn'],
      );
      assert.deepEqual([order.items[0].tourCommissionType, order.items[0].tourCommissionRate], ['fixed', 50000]);

      const lines = order.items.map((item) => ({
        itemType: item.itemType, itemId: item.serviceId, quantity: item.quantity,
        staffId: item.staffId, consultantStaffId: item.consultantStaffId,
      }));
      await checkout(lines, { invoiceId });
      assert.deepEqual(await commissions(invoiceId), [
        ['NV4', 'tour', 'Tua dịch vụ', 1000000, 50000],
        ['NV2', 'consulting', 'Tư vấn bán dịch vụ', 1000000, 100000],
      ]);
    });

    await t.test('editing one appointment can change or remove its consultant', async () => {
      const created = await createAppointments({
        branchId: 1, customerId: 1, status: 'confirmed', note: '', actorAccountId: 1,
        items: [{
          serviceId: 1, staffId: 1, consultantStaffId: null, quantity: 1,
          startsAt: new Date('2026-10-03T02:00:00Z'), endsAt: new Date('2026-10-03T03:00:00Z'),
        }],
      });
      const id = created.appointments[0].id;
      const consultantOf = async () => (await getOrder({ branchId: 1, id: created.invoice.id })).items[0].consultantStaffId;

      await updateAppointment({ branchId: 1, id, consultantStaffId: 2 });
      assert.equal(await consultantOf(), 2);
      await updateAppointment({ branchId: 1, id, note: 'Chỉ đổi ghi chú' });
      assert.equal(await consultantOf(), 2);
      await updateAppointment({ branchId: 1, id, consultantStaffId: null });
      assert.equal(await consultantOf(), null);
      await assert.rejects(updateAppointment({ branchId: 1, id, consultantStaffId: 3 }), { code: 'STAFF_NOT_FOUND' });
    });

    await t.test('an appointment consultant must work at the branch', async () => {
      await assert.rejects(createAppointments({
        branchId: 1, customerId: 1, status: 'confirmed', note: '', actorAccountId: 1,
        items: [{
          serviceId: 1, staffId: null, consultantStaffId: 3, quantity: 1,
          startsAt: new Date('2026-10-02T02:00:00Z'), endsAt: new Date('2026-10-02T03:00:00Z'),
        }],
      }), { code: 'STAFF_NOT_FOUND' });
    });
  } finally {
    pool.connect = originalConnect;
    pool.query = originalQuery;
    await db.close();
  }
});
