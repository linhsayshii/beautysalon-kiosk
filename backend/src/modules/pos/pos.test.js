import assert from 'node:assert/strict';
import test from 'node:test';
import { hasPermission, permissions, rolePermissions } from '../auth/auth.permissions.js';

test('POS permissions are assigned properly to roles', () => {
  assert.equal(hasPermission('manager', permissions.usePos), true);
  assert.equal(hasPermission('cashier', permissions.usePos), true);
  assert.equal(hasPermission('staff', permissions.usePos), false);
});
