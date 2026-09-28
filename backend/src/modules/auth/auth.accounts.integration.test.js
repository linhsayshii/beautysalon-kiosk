import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pool } from '../../db.js';
import { listAccounts, updateAccount } from './auth.service.js';

test('managers can edit account details and change account type', async (t) => {
  const db = new PGlite();
  const originalConnect = pool.connect;
  const originalQuery = pool.query;
  const query = (sql, params = []) => db.query(sql, params);
  pool.connect = async () => ({ query, release() {} });
  pool.query = query;
  try {
    await db.exec(readFileSync(new URL('../../../../database/init/001_schema.sql', import.meta.url), 'utf8'));
    await db.exec(`INSERT INTO branches(code,name) VALUES('TEST','Test'),('OTHER','Other');
      INSERT INTO staff(branch_id,code,name,role) VALUES(1,'NV1','Trang','KTV'),(1,'NV2','Hậu','KTV'),(2,'NV3','Huệ','KTV');
      INSERT INTO user_accounts(branch_id,staff_id,username,password_hash,display_name,role) VALUES
        (1,NULL,'admin','unused','Quản lý','manager'),
        (1,1,'trang','unused','Trang','staff'),
        (1,NULL,'thungan','unused','Thu ngân','cashier');`);
    const session = () => db.exec(`INSERT INTO auth_sessions(account_id,token_hash,expires_at) VALUES(2,'${Math.random()}',NOW() + INTERVAL '1 day')`);
    const sessionCount = async () => Number((await db.query('SELECT COUNT(*)::int AS n FROM auth_sessions WHERE account_id = 2')).rows[0].n);

    await t.test('profile edits keep the session', async () => {
      await session();
      const data = await updateAccount({ id: 2, branchId: 1, displayName: 'Trang Vũ', username: 'trangvu', role: 'staff', staffId: 1 });
      assert.deepEqual(data, { id: 2, username: 'trangvu', displayName: 'Trang Vũ', role: 'staff', active: true, staffId: 1, sessionsRevoked: false });
      assert.equal(await sessionCount(), 1);
    });

    await t.test('changing the account type revokes sessions', async () => {
      const data = await updateAccount({ id: 2, branchId: 1, role: 'cashier', staffId: null });
      assert.equal(data.role, 'cashier');
      assert.equal(data.staffId, null);
      assert.equal(data.sessionsRevoked, true);
      assert.equal(await sessionCount(), 0);
    });

    await t.test('staff accounts must link a staff profile from the same branch', async () => {
      await assert.rejects(updateAccount({ id: 2, branchId: 1, role: 'staff' }), { code: 'STAFF_REQUIRED' });
      await assert.rejects(updateAccount({ id: 2, branchId: 1, role: 'staff', staffId: 3 }), { code: 'INVALID_STAFF' });
      const data = await updateAccount({ id: 2, branchId: 1, role: 'staff', staffId: 2 });
      assert.equal(data.staffId, 2);
    });

    await t.test('duplicate usernames are rejected case-insensitively', async () => {
      await assert.rejects(updateAccount({ id: 2, branchId: 1, username: 'ADMIN' }), { code: 'ACCOUNT_EXISTS' });
    });

    await t.test('the last active manager cannot be downgraded', async () => {
      await assert.rejects(updateAccount({ id: 1, branchId: 1, role: 'cashier' }), { code: 'LAST_MANAGER_REQUIRED' });
      await updateAccount({ id: 3, branchId: 1, role: 'manager' });
      assert.equal((await updateAccount({ id: 1, branchId: 1, role: 'cashier' })).role, 'cashier');
    });

    await t.test('accounts from another branch are not found', async () => {
      await assert.rejects(updateAccount({ id: 2, branchId: 2, displayName: 'X' }), { code: 'ACCOUNT_NOT_FOUND' });
      const rows = await listAccounts(1);
      assert.equal(rows.find((row) => row.id === 2).displayName, 'Trang Vũ');
    });
  } finally {
    pool.connect = originalConnect;
    pool.query = originalQuery;
    await db.close();
  }
});
