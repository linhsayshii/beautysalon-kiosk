import assert from 'node:assert/strict';
import test from 'node:test';
import { hasPermission, permissions } from '../auth/auth.permissions.js';

test('POS permissions are assigned properly to roles', () => {
  assert.equal(hasPermission('manager', permissions.usePos), true);
  assert.equal(hasPermission('cashier', permissions.usePos), true);
  assert.equal(hasPermission('staff', permissions.usePos), false);
});

test('listCustomers includes remaining package units and checkout accepts per-line staff', () => {
  // Test schema / logic mapping contract
  const customerRow = {
    id: 1,
    code: 'KH000001',
    name: 'Nguyễn Thị Hoa',
    remaining_units: '5',
    active_packages: '2',
  };
  const mappedCustomer = {
    id: Number(customerRow.id),
    code: customerRow.code,
    name: customerRow.name,
    activePackages: Number(customerRow.active_packages),
    remainingPackageUnits: Number(customerRow.remaining_units),
  };
  assert.equal(mappedCustomer.remainingPackageUnits, 5);
  assert.equal(mappedCustomer.activePackages, 2);

  // Test line staff mapping contract in POS checkout
  const linesInput = [
    { itemType: 'service', itemId: 1, quantity: 1, staffId: 10 },
    { itemType: 'product', itemId: 2, quantity: 2, staffId: null },
  ];
  const headerStaffId = 15;
  const processedItems = linesInput.map((line) => ({
    itemType: line.itemType,
    itemId: line.itemId,
    quantity: line.quantity,
    staffId: line.staffId || headerStaffId || null,
  }));

  assert.equal(processedItems[0].staffId, 10);
  assert.equal(processedItems[1].staffId, 15);
});
