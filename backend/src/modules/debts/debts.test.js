import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pool } from '../../db.js';
import { customerDebtMigration } from '../../migrations/customer-debt.js';
import { collectCustomerDebt, getCustomerDebt, money, settlement } from './debts.service.js';
import { checkoutPosInvoice } from '../pos/pos.service.js';
import { getOrder } from '../orders/orders.service.js';

test('payment validation rejects malformed amounts, requires explicit credit and separates cash change', () => {
  for (const amount of [-1, NaN, Infinity, '', true, {}, '1.001']) assert.throws(()=>money(amount),{code:'INVALID_AMOUNT'});
  assert.throws(()=>settlement(100,30,'cash',false),{code:'DEBT_CONFIRMATION_REQUIRED'});
  assert.throws(()=>settlement(100,30,'wallet',true),{code:'WALLET_FULL_PAYMENT_REQUIRED'});
  assert.throws(()=>settlement(100,110,'card',false),{code:'OVERPAYMENT'});
  assert.deepEqual(settlement(100,130,'cash',false),{paid:100,debt:0,tendered:130,change:30,paymentStatus:'paid'});
  assert.deepEqual(settlement(100,0,'cash',true),{paid:0,debt:100,tendered:0,change:0,paymentStatus:'unpaid'});
});

test('customer debt SQL integration preserves legacy debt and records checkout/collection atomically', async t => {
  const db = new PGlite();
  const originalConnect = pool.connect;
  const originalQuery = pool.query;
  const query = (sql, params=[]) => db.query(sql,params);
  pool.connect = async()=>({query,release(){}});
  pool.query = query;
  try {
    await db.exec(readFileSync(new URL('../../../../database/init/001_schema.sql',import.meta.url),'utf8'));
    await db.exec(`INSERT INTO branches(code,name) VALUES('TEST','Test'),('OTHER','Other');
      INSERT INTO user_accounts(branch_id,username,password_hash,display_name,role) VALUES(1,'test','unused','Thu ngân','cashier');
      INSERT INTO customers(branch_id,code,name,debt_balance) VALUES(1,'C1','Customer',200),(2,'C2','Other',0);
      INSERT INTO services(branch_id,code,name,price,duration_minutes) VALUES(1,'S1','Service',1000,60);
      INSERT INTO invoices(branch_id,customer_id,code,status,subtotal,discount,total,issued_at) VALUES(1,1,'LEGACY','paid',500,0,500,NOW());`);
    await db.exec(customerDebtMigration);
    await t.test('backfill assigns historical paid invoices without changing legacy customer debt',async()=>{
      const debt = await getCustomerDebt({branchId:1,customerId:1});
      assert.equal(debt.balance,200);assert.equal(debt.openingDebt,200);assert.equal(debt.invoices.length,0);
      assert.equal(debt.entries[0].kind,'opening');
    });
    const checkout = {branchId:1,actorAccountId:1,customerId:1,lines:[{itemType:'service',itemId:1,quantity:1}],discount:0,paymentMethod:'cash',amountPaid:300,allowDebt:true,requestKey:'checkout-0001'};
    let receipt;
    await t.test('partial checkout records actual cash and invoice debt; retry never duplicates a sale',async()=>{
      receipt = await checkoutPosInvoice(checkout);
      assert.equal(receipt.amountPaid,300);assert.equal(receipt.debtAmount,700);assert.equal(receipt.customerDebtBalance,900);assert.equal(receipt.paymentStatus,'partial');
      assert.deepEqual(await checkoutPosInvoice(checkout),JSON.parse(JSON.stringify(receipt)));
      const counts = (await query('SELECT (SELECT COUNT(*) FROM invoices) AS invoices,(SELECT SUM(amount) FROM cash_transactions) AS cash')).rows[0];
      assert.equal(Number(counts.invoices),2);assert.equal(Number(counts.cash),300);
      const order = await getOrder({branchId:1,id:receipt.id});
      assert.equal(order.amountPaid,300);assert.equal(order.debtAmount,700);
    });
    const collect = {branchId:1,customerId:1,actorAccountId:1,amount:500,paymentMethod:'bank_transfer',requestKey:'collect-0001'};
    await t.test('collection pays opening debt then oldest invoice; replay and changed payload are safe',async()=>{
      const result = await collectCustomerDebt(collect);
      assert.equal(result.balance,400);assert.deepEqual(result.allocations,[{invoiceId:null,amount:200},{invoiceId:receipt.id,amount:300}]);
      assert.deepEqual(await collectCustomerDebt(collect),result);
      await assert.rejects(collectCustomerDebt({...collect,amount:400}),{code:'REQUEST_KEY_CONFLICT'});
      const debt=await getCustomerDebt({branchId:1,customerId:1});
      assert.equal(debt.openingDebt,0);assert.equal(debt.balance,400);assert.equal(debt.invoices[0].amountPaid,600);
    });
    await t.test('restart migration does not reset partially settled invoices or opening debt',async()=>{
      await db.exec(customerDebtMigration);
      const debt=await getCustomerDebt({branchId:1,customerId:1});
      assert.equal(debt.openingDebt,0);assert.equal(debt.balance,400);assert.equal(debt.invoices[0].amountPaid,600);
      assert.equal(debt.entries.filter(e=>e.kind==='opening').length,1);
    });
    await t.test('overcollection and cross-branch operations roll back',async()=>{
      await assert.rejects(collectCustomerDebt({...collect,amount:401,requestKey:'collect-over'}),{code:'DEBT_CHANGED'});
      await assert.rejects(collectCustomerDebt({...collect,branchId:2,amount:1,requestKey:'collect-other'}),{code:'CUSTOMER_NOT_FOUND'});
      await assert.rejects(getCustomerDebt({branchId:2,customerId:1}),{code:'CUSTOMER_NOT_FOUND'});
      assert.equal((await getCustomerDebt({branchId:1,customerId:1})).balance,400);
    });
    await t.test('final collection settles invoice without new sales or commissions',async()=>{
      await collectCustomerDebt({...collect,amount:400,invoiceId:receipt.id,requestKey:'collect-final'});
      const debt=await getCustomerDebt({branchId:1,customerId:1});assert.equal(debt.balance,0);assert.equal(debt.invoices.length,0);
      const row=(await query('SELECT amount_paid,payment_status FROM invoices WHERE id=$1',[receipt.id])).rows[0];
      assert.equal(Number(row.amount_paid),1000);assert.equal(row.payment_status,'paid');
      assert.equal(Number((await query('SELECT COUNT(*) AS n FROM invoices')).rows[0].n),2);
      assert.equal(Number((await query('SELECT SUM(amount) AS n FROM cash_transactions')).rows[0].n),1200);
    });
    await t.test('zero collection at checkout preserves zero and adds full debt',async()=>{
      const result=await checkoutPosInvoice({...checkout,amountPaid:0,requestKey:'checkout-zero'});
      assert.equal(result.amountPaid,0);assert.equal(result.debtAmount,1000);assert.equal(result.changeAmount,0);
      assert.equal(Number((await query('SELECT SUM(amount) AS n FROM cash_transactions')).rows[0].n),1200);
    });
    await t.test('cash overpayment returns change without paying old debt',async()=>{
      const result=await checkoutPosInvoice({...checkout,amountPaid:1100,requestKey:'checkout-change'});
      assert.equal(result.changeAmount,100);assert.equal(result.amountPaid,1000);assert.equal(result.customerDebtBalance,1000);
    });
    await t.test('one collection allocates across several unpaid invoices',async()=>{
      const second=await checkoutPosInvoice({...checkout,amountPaid:0,requestKey:'checkout-zero-2'});
      const result=await collectCustomerDebt({...collect,amount:1200,requestKey:'collect-multiple'});
      assert.equal(result.allocations.length,2);
      assert.equal(result.allocations[0].amount,1000);
      assert.deepEqual(result.allocations[1],{invoiceId:second.id,amount:200});
      assert.equal(result.balance,800);
    });
    await t.test('an error after allocation rolls back invoice, customer, payment and request key',async()=>{
      const before=await getCustomerDebt({branchId:1,customerId:1});
      pool.connect=async()=>({release(){},query:async(sql,params)=>{
        if(sql.includes('INSERT INTO cash_transactions')) throw new Error('simulated journal failure');
        return query(sql,params);
      }});
      await assert.rejects(collectCustomerDebt({...collect,amount:100,requestKey:'collect-rollback'}),/simulated journal failure/);
      pool.connect=async()=>({query,release(){}});
      assert.deepEqual(await getCustomerDebt({branchId:1,customerId:1}),before);
      assert.equal((await query("SELECT * FROM payment_requests WHERE request_key='collect-rollback'")).rows.length,0);
    });
    await t.test('free invoice is settled without a payment or additional debt',async()=>{
      const result=await checkoutPosInvoice({...checkout,discount:1000,amountPaid:0,requestKey:'checkout-free'});
      assert.equal(result.total,0);assert.equal(result.amountPaid,0);assert.equal(result.debtAmount,0);assert.equal(result.paymentStatus,'paid');
      assert.equal(result.customerDebtBalance,800);
    });
  } finally {
    // Notifications are intentionally asynchronous after checkout commits.
    await new Promise(resolve=>setImmediate(resolve));
    pool.connect=originalConnect;pool.query=originalQuery;await db.close();
  }
});
