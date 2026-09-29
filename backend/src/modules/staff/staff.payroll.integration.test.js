import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pool, runMigrations } from '../../db.js';
import { ensureMonthlyPayrollPeriods, getPayrollPeriodDetail, listCommissions, recalculatePayrollPeriod, updatePayrollRecords } from './staff.service.js';

test('payroll standard work days follow the branch work-day settings', async () => {
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
      INSERT INTO staff(branch_id,code,name,role) VALUES(1,'NV000001','Hậu','Kỹ thuật viên');
      INSERT INTO staff_settings(staff_id,salary_type,base_salary) VALUES(1,'monthly',6000000);
      INSERT INTO branch_work_schedule_settings(branch_id,active_work_days,holidays)
        VALUES(1,'["T2","T3","T4","T5","T6","T7"]'::jsonb,'[]'::jsonb);
      INSERT INTO payroll_periods(branch_id,code,name,period_type,starts_on,ends_on,status,creator_type,creator_name)
        VALUES(1,'BL202609','Bảng lương tháng 9/2026','monthly','2026-09-01','2026-09-30','draft','auto','Auto');`);

    await recalculatePayrollPeriod({ branchId: 1, periodId: 1 });

    // September 2026 has 30 days, 4 of them Sundays: Monday–Saturday gives 26.
    const { rows } = await db.query('SELECT standard_work_days FROM payroll_records WHERE staff_id = 1');
    assert.equal(Number(rows[0].standard_work_days), 26);
  } finally {
    pool.connect = originalConnect;
    pool.query = originalQuery;
    await db.close();
  }
});

test('monthly payroll names use a two-digit month, including periods named before the fix', async () => {
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
      INSERT INTO payroll_periods(branch_id,code,name,period_type,starts_on,ends_on,status,creator_type,creator_name)
        VALUES(1,'BL202509','Bảng lương tháng 9/2025','monthly','2025-09-01','2025-09-30','draft','auto','Auto'),
              (1,'BL202510','Bảng lương tháng 10/2025','monthly','2025-10-01','2025-10-31','draft','auto','Auto'),
              (1,'BL-RIENG','Lương thưởng 9/2025','monthly','2025-09-01','2025-09-30','draft','staff','Quản lý');`);
    await runMigrations();
    pool.query = query;
    await ensureMonthlyPayrollPeriods(1);

    const { rows } = await db.query("SELECT code, name FROM payroll_periods ORDER BY code");
    const names = Object.fromEntries(rows.map((row) => [row.code, row.name]));
    assert.equal(names.BL202509, 'Bảng lương tháng 09/2025');
    assert.equal(names.BL202510, 'Bảng lương tháng 10/2025');
    assert.equal(names['BL-RIENG'], 'Lương thưởng 9/2025');
    for (const [code, name] of Object.entries(names)) {
      if (code.startsWith('BL2')) assert.match(name, /^Bảng lương tháng \d{2}\/\d{4}$/);
    }
  } finally {
    pool.connect = originalConnect;
    pool.query = originalQuery;
    await db.close();
  }
});

test('tour commission is paid in its own payroll column', async () => {
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
      INSERT INTO staff(branch_id,code,name,role) VALUES(1,'NV000001','Hậu','Kỹ thuật viên');
      INSERT INTO staff_settings(staff_id,salary_type,base_salary) VALUES(1,'monthly',0);
      INSERT INTO payroll_periods(branch_id,code,name,period_type,starts_on,ends_on,status,creator_type,creator_name)
        VALUES(1,'BL202609','Bảng lương tháng 09/2026','monthly','2026-09-01','2026-09-30','draft','auto','Auto');
      INSERT INTO commission_records(branch_id,staff_id,source_name,revenue,rate,amount,occurred_on,commission_type) VALUES
        (1,1,'Tua dịch vụ',1000000,50000,50000,'2026-09-10','tour'),
        (1,1,'Tư vấn bán dịch vụ',300000,0.1,30000,'2026-09-11','consulting'),
        (1,1,'Thực hiện dịch vụ',100000,0.1,10000,'2026-09-12','service');`);

    await recalculatePayrollPeriod({ branchId: 1, periodId: 1 });
    let detail = await getPayrollPeriodDetail({ branchId: 1, periodId: 1 });
    let [record] = detail.records;
    assert.deepEqual([record.commission, record.tourCommission, record.totalIncome], [40000, 50000, 90000]);
    assert.equal(detail.summary.totalTourCommission, 50000);

    await updatePayrollRecords({ branchId: 1, periodId: 1, records: [{ id: record.id, tourCommission: 70000 }] });
    detail = await getPayrollPeriodDetail({ branchId: 1, periodId: 1 });
    [record] = detail.records;
    assert.deepEqual([record.tourCommission, record.totalIncome, record.netSalary], [70000, 110000, 110000]);
    await assert.rejects(
      updatePayrollRecords({ branchId: 1, periodId: 1, records: [{ id: record.id, tourCommission: -1 }] }),
      { code: 'INVALID_PAYROLL_AMOUNT' },
    );

    const commissions = await listCommissions({ branchId: 1, dateFrom: '2026-09-01', dateTo: '2026-09-30' });
    const [summary] = commissions.staffSummary;
    assert.deepEqual(
      [summary.tourAmount, summary.consultingAmount, summary.serviceAmount, summary.totalAmount],
      [50000, 30000, 10000, 90000],
    );
    assert.deepEqual(commissions.rows.map((row) => row.commissionType), ['service', 'consulting', 'tour']);
  } finally {
    pool.connect = originalConnect;
    pool.query = originalQuery;
    await db.close();
  }
});
