import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pool, runMigrations } from '../../db.js';
import { createAppointments } from './dashboard.service.js';

test('a new appointment invoice gets the same HD code format as a POS invoice', async () => {
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
    await db.exec(`INSERT INTO branches(code,name) VALUES ('TEST','Test');
      INSERT INTO customers(branch_id,code,name) VALUES (1,'KH1','Vũ Hải Yến');
      INSERT INTO services(branch_id,code,name,price,duration_minutes) VALUES (1,'DV1','Gội đầu',100000,60);
      INSERT INTO staff(branch_id,code,name,role) VALUES (1,'NV1','Hậu','Kỹ thuật viên');`);

    await createAppointments({
      branchId: 1, customerId: 1, status: 'confirmed', note: '',
      items: [{ serviceId: 1, staffId: 1, quantity: 1, startsAt: new Date('2026-10-02T02:00:00Z'), endsAt: new Date('2026-10-02T03:00:00Z') }],
    });

    const { rows } = await db.query('SELECT code FROM invoices');
    assert.equal(rows.length, 1);
    assert.match(rows[0].code, /^HD\d{6}-\d{4}$/);
  } finally {
    pool.connect = originalConnect;
    pool.query = originalQuery;
    await db.close();
  }
});
