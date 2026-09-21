import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pool } from '../../db.js';
import { customerDebtMigration } from '../../migrations/customer-debt.js';
import { listOrders } from './orders.service.js';
import { listCustomers, listCustomerPackages } from '../customers/customers.service.js';
import { listPurchaseOrders } from '../inventory/inventory.service.js';

test('mobile lists sort the complete result before pagination and retain global totals', async t => {
  const db = new PGlite();
  const originalQuery = pool.query;
  pool.query = (sql, params = []) => db.query(sql, params);
  try {
    await db.exec(readFileSync(new URL('../../../../database/init/001_schema.sql', import.meta.url), 'utf8'));
    await db.exec(customerDebtMigration);
    await db.exec(`
      INSERT INTO branches(code,name) VALUES ('A','A'),('B','B');
      INSERT INTO customers(branch_id,code,name,debt_balance)
        SELECT 1,'C'||n,'Customer '||n,n FROM generate_series(1,101) n;
      INSERT INTO invoices(branch_id,code,status,subtotal,total,issued_at)
        SELECT 1,'I'||n,'paid',n,n,NOW() FROM generate_series(1,101) n;
      INSERT INTO purchase_orders(branch_id,code,amount_due)
        SELECT 1,'P'||n,n FROM generate_series(1,101) n;
      INSERT INTO service_packages(branch_id,code,name,total_units,list_price) VALUES(1,'SP','Package',10,100);
      INSERT INTO customer_packages(branch_id,package_code,package_id,customer_id,sale_price,total_units,sold_at)
        SELECT 1,'CP'||n,1,1,n,10,NOW() FROM generate_series(1,101) n;
      INSERT INTO customers(branch_id,code,name,debt_balance) VALUES(2,'OTHER','Other',999999);
      INSERT INTO invoices(branch_id,code,status,subtotal,total,issued_at) VALUES(2,'OTHER','paid',999999,999999,NOW());
      INSERT INTO purchase_orders(branch_id,code,amount_due) VALUES(2,'OTHER',999999);
      INSERT INTO customer_packages(branch_id,package_code,package_id,customer_id,sale_price,total_units,sold_at)
        VALUES(2,'OTHER',1,102,999999,10,NOW());
    `);
    await db.exec("UPDATE invoices SET sales_channel = 'online' WHERE code = 'I101'");
    const base = { branchId: 1, search: '', status: '', group: '', debtStatus: '', itemType: '', paymentMethod: '', staffId: null, dateFrom: null, dateTo: null, page: 1, pageSize: 100, offset: 0 };
    const online = await listOrders({ ...base, salesChannel: 'online' });
    assert.equal(online.pagination.total, 1);
    assert.equal(online.summary.paidRevenue, 101);
    assert.equal(online.rows[0].code, 'I101');
    for (const [fn, sort, value, summary] of [
      [listOrders,'total_desc','total','paidRevenue'],
      [listCustomers,'debt_desc','debtBalance','totalDebt'],
      [listCustomerPackages,'price_desc','salePrice',null],
      [listPurchaseOrders,'total_desc','amountDue','totalDue'],
    ]) {
      await t.test(fn.name, async () => {
        const first = await fn({...base,sort});
        const second = await fn({...base,sort,page:2,offset:100});
        assert.equal(first.rows.length,100);
        assert.equal(first.rows[0][value],101);
        assert.equal(second.rows.length,1);
        assert.equal(second.rows[0][value],1);
        assert.equal(second.pagination.total,101);
        assert.equal(second.pagination.totalPages,2);
        if (summary) {
          assert.equal(first.summary[summary],5151);
          assert.equal(second.summary[summary],5151);
        }
        const ascending = await fn({...base,sort:sort.replace('_desc','_asc')});
        assert.equal(ascending.rows[0][value],1);
        await fn({...base,sort:'invalid; DROP TABLE branches'});
      });
    }
  } finally {
    pool.query = originalQuery;
    await db.close();
  }
});
