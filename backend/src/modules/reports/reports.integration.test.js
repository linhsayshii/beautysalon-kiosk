import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pool } from '../../db.js';
import { customerDebtMigration } from '../../migrations/customer-debt.js';
import { cashbookMigration } from '../../migrations/cashbook.js';
import { recordCashEntry } from '../cashbook/cashbook.ledger.js';
import { defaultGroupBy, getProfitReport } from './reports.service.js';

test('default grouping switches to months for long ranges', () => {
  assert.equal(defaultGroupBy('2026-09-01', '2026-09-30'), 'day');
  assert.equal(defaultGroupBy('2026-01-01', '2026-09-30'), 'month');
});

test('profit report recognises revenue, cost and expenses by the documented rules', async (t) => {
  const db = new PGlite();
  const originalConnect = pool.connect;
  const originalQuery = pool.query;
  const query = (sql, params = []) => db.query(sql, params);
  pool.connect = async () => ({ query, release() {} });
  pool.query = query;
  try {
    await db.exec(readFileSync(new URL('../../../../database/init/001_schema.sql', import.meta.url), 'utf8'));
    await db.exec(`INSERT INTO branches(code,name) VALUES('TEST','Test'),('OTHER','Other');
      INSERT INTO services(branch_id,code,name,price,duration_minutes,cost_price) VALUES
        (1,'DV1','Gội đầu',600,60,200),(1,'DV2','Massage',300,60,0);
      INSERT INTO products(branch_id,sku,name,unit,sale_price,cost_price) VALUES(1,'SP1','Serum','chai',200,50);
      INSERT INTO service_packages(branch_id,code,name,total_units,list_price,cost_price) VALUES(1,'GDV1','Gói 10 lần',10,800,300);
      INSERT INTO account_cards(branch_id,code,name,sale_price,face_value) VALUES(1,'TTK1','Thẻ 200k',200,200);
      INSERT INTO customers(branch_id,code,name) VALUES(1,'KH1','Chị Lan');
      INSERT INTO customer_packages(branch_id,package_code,package_id,customer_id,sale_price,total_units,sold_at) VALUES(1,'PKG1',1,1,800,10,NOW());
      INSERT INTO invoices(branch_id,code,status,subtotal,discount,total,payment_method,issued_at) VALUES
        (1,'A','paid',1000,100,900,'cash','2026-09-05T03:00:00Z'),
        (1,'B','paid',1000,0,1000,'bank_transfer','2026-09-06T03:00:00Z'),
        (1,'C','paid',300,0,300,'wallet','2026-09-07T03:00:00Z'),
        (1,'D','draft',5000,0,5000,'cash','2026-09-08T03:00:00Z'),
        (1,'E','cancelled',700,0,700,'cash','2026-09-08T03:00:00Z'),
        (1,'F','paid',700,0,700,'cash','2026-09-30T17:30:00Z'),
        (1,'G','paid',500,0,500,'cash','2026-08-31T17:30:00Z'),
        (2,'H','paid',9000,0,9000,'cash','2026-09-05T03:00:00Z');
      INSERT INTO invoice_items(invoice_id,item_type,service_id,product_id,package_id,account_card_id,customer_package_id,description,quantity,unit_price,line_total) VALUES
        (1,'service',1,NULL,NULL,NULL,NULL,'Gội đầu',1,600,600),
        (1,'product',NULL,1,NULL,NULL,NULL,'Serum',2,200,400),
        (2,'package',NULL,NULL,1,NULL,NULL,'Gói 10 lần',1,800,800),
        (2,'account_card',NULL,NULL,NULL,1,NULL,'Thẻ 200k',1,200,200),
        (3,'service',1,NULL,NULL,NULL,1,'Gội đầu (dùng gói)',1,0,0),
        (3,'service',2,NULL,NULL,NULL,NULL,'Massage',1,300,300),
        (4,'service',1,NULL,NULL,NULL,NULL,'Gội đầu',1,5000,5000),
        (5,'service',1,NULL,NULL,NULL,NULL,'Gội đầu',1,700,700),
        (6,'service',1,NULL,NULL,NULL,NULL,'Gội đầu',1,700,700),
        (7,'service',1,NULL,NULL,NULL,NULL,'Gội đầu',1,500,500),
        (8,'service',1,NULL,NULL,NULL,NULL,'Gội đầu',1,9000,9000);`);
    await db.exec(customerDebtMigration);
    await db.exec(cashbookMigration);
    const client = { query };
    const at = new Date('2026-09-10T03:00:00Z');
    await recordCashEntry(client, { branchId: 1, type: 'expense', categoryKey: 'rent', amount: 400, fund: 'cash', occurredAt: at });
    await recordCashEntry(client, { branchId: 1, type: 'expense', categoryKey: 'supplier_payment', amount: 999, fund: 'bank', occurredAt: at });
    await recordCashEntry(client, { branchId: 1, type: 'expense', categoryKey: 'fund_transfer_out', amount: 777, fund: 'cash', occurredAt: at });
    await recordCashEntry(client, { branchId: 1, type: 'income', categoryKey: 'other_income', amount: 50, fund: 'cash', occurredAt: at });
    const cancelled = await recordCashEntry(client, { branchId: 1, type: 'expense', categoryKey: 'rent', amount: 1000, fund: 'cash', occurredAt: at });
    await query("UPDATE cash_transactions SET status='cancelled' WHERE id=$1", [cancelled.id]);
    await recordCashEntry(client, { branchId: 2, type: 'expense', categoryKey: 'rent', amount: 5000, fund: 'cash', occurredAt: at });

    const report = await getProfitReport({ branchId: 1, dateFrom: '2026-09-01', dateTo: '2026-09-30' });

    await t.test('summary allocates discounts, excludes card deposits and applies branch-local dates', () => {
      assert.deepEqual(report.summary, {
        grossSales: 2600,
        discount: 100,
        netRevenue: 2500,
        cogs: 800,
        grossProfit: 1700,
        grossMargin: 0.68,
        operatingExpenses: 400,
        otherIncome: 50,
        netProfit: 1350,
        netMargin: 0.54,
        invoiceCount: 4,
        prepaidCardSales: 200,
        missingCostCount: 1,
      });
    });

    await t.test('item types and top items carry revenue, cost and margin', () => {
      assert.deepEqual(report.byItemType.map((row) => [row.itemType, row.revenue, row.cogs]), [
        ['service', 1340, 400],
        ['package', 800, 300],
        ['product', 360, 100],
      ]);
      const serum = report.topItems.find((item) => item.code === 'SP1');
      assert.deepEqual(serum, { itemType: 'product', itemId: 1, code: 'SP1', name: 'Serum', quantity: 2, revenue: 360, cogs: 100, profit: 260, margin: 0.7222 });
      assert.equal(report.topItems.some((item) => item.itemType === 'account_card'), false);
    });

    await t.test('daily series is complete and places a late-night sale on the local day', () => {
      assert.equal(report.series.length, 30);
      assert.deepEqual(report.series[0], { key: '2026-09-01', label: '01/09', revenue: 500, cogs: 200, grossProfit: 300, expenses: 0, netProfit: 300 });
      const tenth = report.series.find((row) => row.key === '2026-09-10');
      assert.equal(tenth.expenses, 400);
      assert.equal(tenth.netProfit, -350);
    });

    await t.test('expenses list only profit-affecting categories', () => {
      assert.deepEqual(report.expensesByCategory, [{ categoryKey: 'rent', label: 'Tiền thuê mặt bằng', amount: 400 }]);
      assert.deepEqual(report.otherIncomeByCategory, [{ categoryKey: 'other_income', label: 'Thu khác', amount: 50 }]);
    });

    await t.test('monthly grouping and empty branches', async () => {
      const monthly = await getProfitReport({ branchId: 1, dateFrom: '2026-08-15', dateTo: '2026-10-05', groupBy: 'month' });
      assert.deepEqual(monthly.series.map((row) => [row.key, row.revenue]), [['2026-08', 0], ['2026-09', 2500], ['2026-10', 700]]);
      const empty = await getProfitReport({ branchId: 2, dateFrom: '2026-10-01', dateTo: '2026-10-31' });
      assert.equal(empty.summary.netRevenue, 0);
      assert.equal(empty.summary.grossMargin, 0);
    });
  } finally {
    pool.connect = originalConnect;
    pool.query = originalQuery;
    await db.close();
  }
});
