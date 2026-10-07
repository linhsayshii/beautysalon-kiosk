import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pool, runMigrations } from '../../db.js';
import { checkoutPosInvoice } from './pos.service.js';

test('checkout enforces package, prepaid-card and stock limits', async (t) => {
  const db = new PGlite();
  const originalConnect = pool.connect;
  const originalQuery = pool.query;
  const query = (sql, params = []) => db.query(sql, params);
  pool.connect = async () => ({ query, release() {} });
  pool.query = (sql, params = []) => (params.length ? db.query(sql, params) : db.exec(sql));
  try {
    await db.exec(readFileSync(new URL('../../../../database/init/001_schema.sql', import.meta.url), 'utf8'));
    await runMigrations();
    await db.exec(`INSERT INTO branches(code,name) VALUES('TEST','Test');
      INSERT INTO user_accounts(branch_id,username,password_hash,display_name,role) VALUES(1,'test','unused','Thu ngân','cashier');
      INSERT INTO customers(branch_id,code,name) VALUES(1,'C1','Khách một');
      INSERT INTO services(branch_id,code,name,price,duration_minutes) VALUES
        (1,'S1','Chăm sóc da',500000,60),(1,'S2','Massage',300000,60);
      INSERT INTO products(branch_id,sku,name,sale_price,cost_price) VALUES(1,'P1','Serum',200000,50000);
      INSERT INTO inventory_balances(branch_id,product_id,quantity) VALUES(1,1,1);
      INSERT INTO service_packages(branch_id,code,name,total_units,list_price) VALUES(1,'G1','Gói 10 buổi',10,3000000);
      INSERT INTO service_package_items(package_id,service_id,units) VALUES(1,1,2),(1,2,8);
      INSERT INTO customer_packages(branch_id,package_code,package_id,customer_id,sale_price,total_units,sold_at)
        VALUES(1,'PKG1',1,1,3000000,10,NOW());
      INSERT INTO account_cards(branch_id,code,name,sale_price,face_value,allow_products,allow_services,allow_packages)
        VALUES(1,'T1','Thẻ dịch vụ',1000000,1000000,FALSE,TRUE,TRUE);
      INSERT INTO customer_account_cards(branch_id,card_code,account_card_id,customer_id,sale_price,opening_balance,current_balance,sold_at,status)
        VALUES(1,'CARD1',1,1,1000000,1000000,1000000,NOW(),'active');`);

    let requestNumber = 0;
    const checkout = (lines, extra = {}) => checkoutPosInvoice({
      branchId: 1, actorAccountId: 1, customerId: 1, paymentMethod: 'cash', discount: 0, amountPaid: null,
      allowDebt: false, requestKey: `limits-${requestNumber += 1}`, lines, ...extra,
    });
    const session = (serviceId, quantity) => ({ itemType: 'service', itemId: serviceId, quantity, usePackageId: 1, usePackageServiceId: serviceId });

    await t.test('a package service cannot be redeemed beyond its own sessions', async () => {
      await assert.rejects(checkout([session(1, 3)]), { code: 'PACKAGE_SERVICE_LIMIT' });
      // Split over two lines of one checkout, the limit still holds.
      await assert.rejects(checkout([session(1, 2), session(1, 1)]), { code: 'PACKAGE_SERVICE_LIMIT' });
      await checkout([session(1, 2), session(2, 1)]);
      const { rows } = await query('SELECT used_units FROM customer_packages WHERE id = 1');
      assert.equal(Number(rows[0].used_units), 3);
    });

    await t.test('a services-only card pays for a service but not for a product', async () => {
      await assert.rejects(
        checkout([{ itemType: 'product', itemId: 1, quantity: 1 }], { paymentMethod: 'wallet' }),
        { code: 'INSUFFICIENT_BALANCE' },
      );
      await checkout([{ itemType: 'service', itemId: 2, quantity: 1 }], { paymentMethod: 'wallet' });
      const { rows } = await query('SELECT current_balance FROM customer_account_cards WHERE id = 1');
      assert.equal(Number(rows[0].current_balance), 700000);
    });

    await t.test('stock never goes below zero', async () => {
      await checkout([{ itemType: 'product', itemId: 1, quantity: 1 }]);
      await assert.rejects(checkout([{ itemType: 'product', itemId: 1, quantity: 1 }]), { code: 'INSUFFICIENT_STOCK' });
      const { rows } = await query('SELECT quantity FROM inventory_balances WHERE product_id = 1');
      assert.equal(Number(rows[0].quantity), 0);
    });
  } finally {
    pool.connect = originalConnect;
    pool.query = originalQuery;
    await db.close();
  }
});
