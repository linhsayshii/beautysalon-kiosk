import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pool, runMigrations } from '../../db.js';
import { createStaff } from './staff.service.js';

const input = {
  branchId: 1, name: 'Nhân viên mới', role: 'Kỹ thuật viên', avatarTone: 'blue', active: true,
  salaryType: 'monthly', baseSalary: 0, hourlyRate: 0, canSell: true, canManageInventory: false, profile: {}, accountId: null,
};

test('a new staff member gets the next six-digit NV code', async () => {
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
    await db.exec(`INSERT INTO branches(code,name) VALUES('TEST','Test');
      INSERT INTO staff(branch_id,code,name,role) VALUES
        (1,'NV000009','Yến','Kỹ thuật viên'),(1,'NV000016','Hậu','Kỹ thuật viên'),
        (1,'NV0007','Thử','Kỹ thuật viên'),(1,'LETAN01','Lễ tân','Lễ tân');`);

    const created = await createStaff(input);

    assert.equal(created.code, 'NV000017');
  } finally {
    pool.connect = originalConnect;
    pool.query = originalQuery;
    await db.close();
  }
});
