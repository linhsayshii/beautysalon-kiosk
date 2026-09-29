import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pool, runMigrations } from '../../db.js';
import { getDashboard } from './dashboard.service.js';

test('dashboard counts customers served today from appointments and POS sales, once each', async () => {
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
    await db.exec(`
      INSERT INTO branches(code,name) VALUES ('A','A');
      INSERT INTO customers(branch_id,code,name,customer_type) VALUES
        (1,'KH1','Khách hẹn','returning'),(1,'KH2','Khách vãng lai','new'),(1,'KH3','Khách hôm qua','new');
      INSERT INTO services(branch_id,code,name,price,duration_minutes) VALUES (1,'DV1','Gội đầu',100,30);
      -- 2026-09-29 in Asia/Ho_Chi_Minh runs from 2026-09-28T17:00Z to 2026-09-29T17:00Z.
      INSERT INTO appointments(branch_id,customer_id,service_id,starts_at,ends_at,status)
        VALUES (1,1,1,'2026-09-29T02:00:00Z','2026-09-29T02:30:00Z','completed');
      INSERT INTO invoices(branch_id,customer_id,code,status,subtotal,total,issued_at) VALUES
        (1,1,'APPT1','paid',100,100,'2026-09-29T03:00:00Z'),
        (1,2,'POS1','paid',100,100,'2026-09-28T19:38:00Z'),
        (1,3,'OLD1','paid',100,100,'2026-09-28T10:00:00Z'),
        (1,NULL,'WALKIN','paid',100,100,'2026-09-29T04:00:00Z');
    `);

    const dashboard = await getDashboard({ branchId: 1, date: '2026-09-29' });

    assert.deepEqual(dashboard.summary.customers, { total: 2, new: 1, returning: 1, walkIn: 0 });
  } finally {
    pool.connect = originalConnect;
    pool.query = originalQuery;
    await db.close();
  }
});
