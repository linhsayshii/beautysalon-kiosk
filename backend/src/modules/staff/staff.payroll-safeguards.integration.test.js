import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pool, runMigrations } from '../../db.js';
import {
  approvePayrollPeriod,
  cancelPayrollPeriod,
  createPayrollPayment,
  ensureMonthlyPayrollPeriods,
  getPayrollPeriodDetail,
  recalculatePayrollPeriod,
  updatePayrollRecords,
} from './staff.service.js';

async function withDatabase(run) {
  const db = new PGlite();
  const originalConnect = pool.connect;
  const originalQuery = pool.query;
  const query = (sql, params = []) => db.query(sql, params);
  pool.connect = async () => ({ query, release() {} });
  pool.query = (sql, params = []) => (params.length ? db.query(sql, params) : db.exec(sql));
  try {
    await db.exec(readFileSync(new URL('../../../../database/init/001_schema.sql', import.meta.url), 'utf8'));
    await runMigrations();
    pool.query = query;
    await db.exec(`INSERT INTO branches(code,name) VALUES('A','Chi nhánh A'),('B','Chi nhánh B');
      INSERT INTO staff(branch_id,code,name,role) VALUES(1,'NV000001','Hậu','Kỹ thuật viên'),(2,'NV000002','Yến','Kỹ thuật viên');
      INSERT INTO staff_settings(staff_id,salary_type,base_salary) VALUES(1,'monthly',6000000),(2,'monthly',6000000);`);
    await run(db);
  } finally {
    pool.connect = originalConnect;
    pool.query = originalQuery;
    await db.close();
  }
}

async function currentPeriod(db, branchId) {
  const { rows } = await db.query(
    'SELECT id, code FROM payroll_periods WHERE branch_id = $1 ORDER BY starts_on DESC LIMIT 1',
    [branchId],
  );
  return { id: Number(rows[0].id), code: rows[0].code };
}

test('a manager edit survives the automatic refresh; an explicit recalculation replaces it', async () => {
  await withDatabase(async (db) => {
    await ensureMonthlyPayrollPeriods(1);
    const period = await currentPeriod(db, 1);
    let [record] = (await getPayrollPeriodDetail({ branchId: 1, periodId: period.id })).records;
    await updatePayrollRecords({ branchId: 1, periodId: period.id, records: [{ id: record.id, baseSalary: 5000000, deduction: 100000, allowance: 200000 }] });

    await ensureMonthlyPayrollPeriods(1);
    [record] = (await getPayrollPeriodDetail({ branchId: 1, periodId: period.id })).records;
    assert.deepEqual([record.baseSalary, record.deduction, record.allowance, record.netSalary], [5000000, 100000, 200000, 5100000]);

    // No attendance this month: the automatic base salary and deduction are 0.
    await recalculatePayrollPeriod({ branchId: 1, periodId: period.id });
    [record] = (await getPayrollPeriodDetail({ branchId: 1, periodId: period.id })).records;
    assert.deepEqual([record.baseSalary, record.deduction, record.allowance, record.netSalary], [0, 0, 200000, 200000]);
    const { rows } = await db.query('SELECT adjusted_at FROM payroll_records WHERE id = $1', [record.id]);
    assert.equal(rows[0].adjusted_at, null);
  });
});

test('salary is paid only from an approved period, within the remaining amount and the fund balance', async () => {
  await withDatabase(async (db) => {
    await ensureMonthlyPayrollPeriods(1);
    const period = await currentPeriod(db, 1);
    const [record] = (await getPayrollPeriodDetail({ branchId: 1, periodId: period.id })).records;
    await updatePayrollRecords({ branchId: 1, periodId: period.id, records: [{ id: record.id, baseSalary: 1000000 }] });
    await db.exec(`INSERT INTO cash_transactions(branch_id,transaction_type,category,amount,occurred_at,fund,status)
      VALUES(1,'income','Thu khác',500000,NOW(),'cash','active')`);
    const pay = (amount, extra = {}) => createPayrollPayment({ branchId: 1, periodId: period.id, staffId: 1, amount, paymentMethod: 'cash', ...extra });

    await assert.rejects(pay(100000), { code: 'PAYROLL_NOT_APPROVED' });
    await approvePayrollPeriod({ branchId: 1, periodId: period.id, staffId: null, staffName: 'Quản lý' });
    await assert.rejects(approvePayrollPeriod({ branchId: 1, periodId: period.id, staffId: null }), { code: 'PAYROLL_NOT_DRAFT' });
    await assert.rejects(updatePayrollRecords({ branchId: 1, periodId: period.id, records: [{ id: record.id, baseSalary: 1 }] }), { code: 'PAYROLL_ALREADY_APPROVED' });

    await assert.rejects(pay(1000001), { code: 'PAYMENT_EXCEEDS_REMAINING' });
    await assert.rejects(pay(600000), { code: 'INSUFFICIENT_FUND_BALANCE' });
    await assert.rejects(
      createPayrollPayment({ branchId: 2, periodId: period.id, staffId: 1, amount: 1000, paymentMethod: 'cash' }),
      { code: 'RECORD_NOT_FOUND' },
    );

    await pay(400000);
    const [paid] = (await getPayrollPeriodDetail({ branchId: 1, periodId: period.id })).records;
    assert.deepEqual([paid.paidAmount, paid.remainingAmount], [400000, 600000]);
    const voucher = await db.query(`SELECT amount, fund FROM cash_transactions WHERE source_type = 'payroll_payment'`);
    assert.deepEqual([Number(voucher.rows[0].amount), voucher.rows[0].fund], [400000, 'cash']);

    await assert.rejects(cancelPayrollPeriod({ branchId: 1, periodId: period.id }), { code: 'PAYROLL_HAS_PAYMENTS' });
  });
});

test('every branch gets its own monthly period although period codes are unique system-wide', async () => {
  await withDatabase(async (db) => {
    await ensureMonthlyPayrollPeriods(1);
    await ensureMonthlyPayrollPeriods(2);
    await ensureMonthlyPayrollPeriods(2);
    const first = await currentPeriod(db, 1);
    const second = await currentPeriod(db, 2);
    assert.equal(second.code, `${first.code}-2`);
    const { rows } = await db.query('SELECT COUNT(*)::int AS count FROM payroll_periods WHERE branch_id = 2');
    assert.equal(rows[0].count, 7);
  });
});
