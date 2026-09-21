import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pool } from '../../db.js';
import { customerDebtMigration } from '../../migrations/customer-debt.js';
import { createAppointments, getAppointmentEditor, completeAppointmentInvoice } from '../dashboard/dashboard.service.js';
import { checkoutPosInvoice } from './pos.service.js';
import { getOrder } from '../orders/orders.service.js';

test('appointment group editing and checkout preserve invoice identity and customer', async t => {
  const db = new PGlite();
  const originalConnect = pool.connect, originalQuery = pool.query;
  const query = (sql, params = []) => db.query(sql, params);
  pool.connect = async () => ({ query, release() {} });
  pool.query = query;
  try {
    await db.exec(readFileSync(new URL('../../../../database/init/001_schema.sql', import.meta.url), 'utf8'));
    await db.exec(customerDebtMigration);
    await db.exec(`INSERT INTO branches(code,name) VALUES ('TEST','Test'),('OTHER','Other');
      INSERT INTO user_accounts(branch_id,username,password_hash,display_name,role) VALUES(1,'test','unused','Thu ngân','cashier');
      INSERT INTO customers(branch_id,code,name) VALUES(1,'C1','Khách một'),(1,'C2','Khách hai');
      INSERT INTO services(branch_id,code,name,price,duration_minutes) VALUES(1,'S1','Dịch vụ một',1000,60),(1,'S2','Dịch vụ hai',2000,60);
      INSERT INTO staff(branch_id,code,name,role) VALUES(1,'NV1','Nhân viên một','staff');
      INSERT INTO invoices(branch_id,customer_id,code,status,subtotal,discount,total,issued_at) VALUES(1,1,'EDIT-01','draft',3000,0,3000,NOW());
      INSERT INTO appointments(branch_id,customer_id,service_id,staff_id,starts_at,ends_at,status,note,invoice_id) VALUES
        (1,1,1,1,'2026-09-15T09:00:00Z','2026-09-15T10:00:00Z','confirmed','Ghi chú một',1),
        (1,1,2,1,'2026-09-16T09:00:00Z','2026-09-16T10:00:00Z','waiting','Ghi chú hai',1);
      INSERT INTO invoice_items(invoice_id,item_type,service_id,appointment_id,quantity,unit_price,line_total,description) VALUES
        (1,'service',1,1,1,1000,1000,'Dịch vụ một'),(1,'service',2,2,1,2000,2000,'Dịch vụ hai');`);
    const service = (appointmentId, serviceId, day, quantity = 1) => ({ appointmentId, serviceId, staffId:1, quantity, startsAt:new Date(`2026-09-${day}T09:00:00Z`),endsAt:new Date(`2026-09-${day}T10:00:00Z`) });
    const edit = {branchId:1,customerId:1,editAppointmentId:1,actorAccountId:1,status:'confirmed',note:'Đã sửa',items:[service(1,1,17,2),service(2,2,18)]};
    await t.test('editor loads all services across dates and retains invoice code',async()=>{
      const result = await getAppointmentEditor({branchId:1,id:1});
      assert.equal(result.invoiceCode,'EDIT-01');assert.equal(result.items.length,2);
      assert.equal(result.items[1].note,'Ghi chú hai');assert.equal(result.items[1].status,'waiting');
      assert.equal((await getOrder({branchId:1,id:1})).fromAppointment,true);
      await assert.rejects(getAppointmentEditor({branchId:2,id:1}), {code:'APPOINTMENT_NOT_FOUND'});
    });
    await t.test('edit updates customer, quantity, times and adds/removes services atomically',async()=>{
      const result = await createAppointments(edit);
      assert.equal(result.invoice.id,1);assert.equal(result.invoice.total,4000);
      assert.deepEqual(result.appointments.map(a=>a.id),[1,2]);
      const changed = await createAppointments({...edit,customerId:2,items:[service(1,2,19,2),service(null,1,20)]});
      assert.equal(changed.invoice.total,5000);assert.equal(changed.appointments[0].id,1);
      const editor = await getAppointmentEditor({branchId:1,id:1});
      assert.equal(editor.customer.id,2);assert.equal(editor.items.length,2);
      assert.equal((await query('SELECT status FROM appointments WHERE id=2')).rows[0].status,'cancelled');
      assert.equal(Number((await query('SELECT COUNT(*) AS n FROM invoices')).rows[0].n),1);
    });
    await t.test('a conflict or foreign appointment id rolls back all changes',async()=>{
      const before = await getAppointmentEditor({branchId:1,id:1});
      const items = before.items.map(item=>service(item.appointmentId,item.itemId,21,item.quantity));
      await assert.rejects(createAppointments({...edit,customerId:2,items}),{code:'STAFF_SCHEDULE_CONFLICT'});
      assert.deepEqual(await getAppointmentEditor({branchId:1,id:1}),before);
      await assert.rejects(createAppointments({...edit,items:[service(999,1,21)]}),{code:'INVALID_APPOINTMENT_ITEMS'});
      assert.deepEqual(await getAppointmentEditor({branchId:1,id:1}),before);
    });
    await t.test('prepare checkout completes the group without recording payment and can be retried',async()=>{
      assert.deepEqual(await completeAppointmentInvoice({branchId:1,id:1,actorAccountId:1}),{invoiceId:1});
      assert.deepEqual(await completeAppointmentInvoice({branchId:1,id:1,actorAccountId:1}),{invoiceId:1});
      const order = await getOrder({branchId:1,id:1});
      assert.equal(order.status,'draft');assert.equal(order.amountPaid,0);assert.equal(order.serviceProgress.completed,2);
      assert.ok((await query('SELECT payment_requested_at FROM invoices WHERE id=1')).rows[0].payment_requested_at);
      await assert.rejects(completeAppointmentInvoice({branchId:2,id:1,actorAccountId:1}));
    });
    const checkout = {branchId:1,customerId:2,actorAccountId:1,invoiceId:1,paymentMethod:'cash',discount:0,amountPaid:5000,allowDebt:false,lines:[{itemType:'service',itemId:2,quantity:2,staffId:1},{itemType:'service',itemId:1,quantity:1,staffId:1}]};
    await t.test('checkout rejects a different customer and records nothing',async()=>{
      await assert.rejects(checkoutPosInvoice({...checkout,customerId:1,requestKey:'wrong-customer'}),{code:'INVOICE_CUSTOMER_LOCKED'});
      assert.equal((await getOrder({branchId:1,id:1})).status,'draft');
      assert.equal(Number((await query('SELECT COUNT(*) AS n FROM customer_payments')).rows[0].n),0);
    });
    await t.test('checkout pays existing invoice once and paid invoice cannot be edited',async()=>{
      const receipt = await checkoutPosInvoice({...checkout,requestKey:'correct-customer'});
      assert.equal(receipt.id,1);assert.equal(receipt.paymentStatus,'paid');
      const order = await getOrder({branchId:1,id:1});
      assert.equal(order.code,'EDIT-01');assert.equal(order.customer.id,2);assert.equal(order.serviceProgress.completed,2);
      await assert.rejects(createAppointments(edit),{code:'INVOICE_NOT_EDITABLE'});
      await assert.rejects(completeAppointmentInvoice({branchId:1,id:1}),{code:'INVOICE_NOT_DRAFT'});
    });
  } finally { pool.connect=originalConnect;pool.query=originalQuery;await db.close(); }
});
