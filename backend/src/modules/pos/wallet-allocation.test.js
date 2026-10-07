import assert from 'node:assert/strict';
import test from 'node:test';
import { allocateWalletPayment, cardCovers, walletLines } from './wallet-allocation.js';

const card = (id, balance, { products = true, services = true, packages = true, scope = [] } = {}) => ({
  id, balance, allowProducts: products, allowServices: services, allowPackages: packages, scope,
});

test('the invoice discount is spread over lines and sums to the invoice total', () => {
  const lines = walletLines([
    { itemType: 'service', itemId: 1, name: 'Gội', lineTotal: 300000 },
    { itemType: 'product', itemId: 2, name: 'Serum', lineTotal: 100000 },
    { itemType: 'service', itemId: 3, name: 'Từ gói', lineTotal: 0 },
  ], 100001);
  assert.deepEqual(lines.map((line) => line.amount), [224999, 75000]);
});

test('a card pays only for allowed types and, when it lists goods of a type, only those goods', () => {
  const servicesOnly = card(1, 1, { products: false });
  assert.equal(cardCovers(servicesOnly, { itemType: 'product', itemId: 2 }), false);
  assert.equal(cardCovers(servicesOnly, { itemType: 'service', itemId: 9 }), true);
  const listed = card(2, 1, { scope: ['product:5'] });
  assert.equal(cardCovers(listed, { itemType: 'product', itemId: 5 }), true);
  assert.equal(cardCovers(listed, { itemType: 'product', itemId: 6 }), false);
  assert.equal(cardCovers(listed, { itemType: 'service', itemId: 6 }), true);
  assert.equal(cardCovers(card(3, 1), { itemType: 'account_card', itemId: 1 }), false);
});

test('a services-only card cannot pay for a product', () => {
  const result = allocateWalletPayment(
    [{ itemType: 'product', itemId: 2, name: 'Serum', amount: 100 }],
    [card(1, 1000, { products: false })],
  );
  assert.deepEqual(result.uncovered, ['Serum']);
});

test('the narrow card is spent first so the general card can cover the rest', () => {
  const lines = [
    { itemType: 'service', itemId: 1, name: 'Gội', amount: 100 },
    { itemType: 'product', itemId: 2, name: 'Serum', amount: 100 },
  ];
  const general = card(1, 100);
  const servicesOnly = card(2, 100, { products: false });
  const result = allocateWalletPayment(lines, [general, servicesOnly]);
  assert.deepEqual(result.uncovered, []);
  assert.deepEqual([...result.deductions], [[2, 100], [1, 100]]);
});
