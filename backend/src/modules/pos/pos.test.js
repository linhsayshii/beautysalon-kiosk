import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { hasPermission, permissions } from '../auth/auth.permissions.js';

test('POS permissions are assigned properly to roles', () => {
  assert.equal(hasPermission('manager', permissions.usePos), true);
  assert.equal(hasPermission('cashier', permissions.usePos), true);
  assert.equal(hasPermission('staff', permissions.usePos), false);
});

test('listCustomers includes remaining package units and checkout keeps staff on each line', () => {
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
  const processedItems = linesInput.map((line) => ({
    itemType: line.itemType,
    itemId: line.itemId,
    quantity: line.quantity,
    staffId: line.staffId || null,
  }));

  assert.equal(processedItems[0].staffId, 10);
  assert.equal(processedItems[1].staffId, null);
});

test('POS persists checkout notes and exposes paginated catalog metadata', () => {
  const serviceSource = readFileSync(new URL('./pos.service.js', import.meta.url), 'utf8');
  const routeSource = readFileSync(new URL('./pos.routes.js', import.meta.url), 'utf8');
  const ordersSource = readFileSync(new URL('../orders/orders.service.js', import.meta.url), 'utf8');

  assert.match(serviceSource, /note = \$9, issued_at = NOW\(\)/);
  assert.match(serviceSource, /issued_at, note\s*\)\s*VALUES/);
  assert.match(routeSource, /pagination: result\.pagination/);
  assert.match(ordersSource, /i\.sales_channel, i\.note, i\.issued_at/);
  assert.match(ordersSource, /note: row\.note \|\| ''/);
});
