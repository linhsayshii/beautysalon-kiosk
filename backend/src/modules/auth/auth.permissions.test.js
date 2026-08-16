import assert from 'node:assert/strict';
import test from 'node:test';
import { hasPermission, permissions, requirePermissions } from './auth.permissions.js';

test('roles receive only their intended permissions', () => {
  assert.equal(hasPermission('manager', permissions.manageAccounts), true);
  assert.equal(hasPermission('manager', permissions.usePos), true);
  assert.equal(hasPermission('cashier', permissions.usePos), true);
  assert.equal(hasPermission('cashier', permissions.readDashboard), false);
  assert.equal(hasPermission('staff', permissions.useOwnAttendance), true);
  assert.equal(hasPermission('staff', permissions.manageAttendance), false);
  assert.equal(hasPermission('unknown', permissions.usePos), false);
});

test('permission middleware distinguishes unauthenticated and forbidden requests', () => {
  const middleware = requirePermissions(permissions.manageInventory);
  let received;
  middleware({}, {}, (error) => { received = error; });
  assert.equal(received.status, 401);

  middleware({ account: { role: 'cashier' } }, {}, (error) => { received = error; });
  assert.equal(received.status, 403);

  middleware({ account: { role: 'manager' } }, {}, (error) => { received = error; });
  assert.equal(received, undefined);
});
