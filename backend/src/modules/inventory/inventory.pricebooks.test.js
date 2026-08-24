import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveApplicablePricebook, resolvePricebookItemPrice, validatePricebookScope } from './inventory.service.js';

test('pricebook scope requires a complete period when no customer is assigned', () => {
  assert.throws(
    () => validatePricebookScope({ customerIds: [], effectiveFrom: null, effectiveTo: null }),
    (error) => error.code === 'PRICEBOOK_SCOPE_REQUIRED',
  );
  assert.doesNotThrow(() => validatePricebookScope({
    customerIds: [], effectiveFrom: '2026-08-01', effectiveTo: '2026-08-31',
  }));
  assert.doesNotThrow(() => validatePricebookScope({
    customerIds: [12], effectiveFrom: null, effectiveTo: null,
  }));
});

test('pricebook scope rejects an inverted period', () => {
  assert.throws(
    () => validatePricebookScope({ customerIds: [12], effectiveFrom: '2026-09-01', effectiveTo: '2026-08-31' }),
    (error) => error.code === 'INVALID_DATE_RANGE',
  );
});

test('applicable pricebook resolver maps the selected customer-specific book', async () => {
  const calls = [];
  const client = {
    query: async (sql, parameters) => {
      calls.push({ sql, parameters });
      return { rows: [{ id: '9', code: 'VIP', name: 'Khách VIP', is_default: false, customer_specific: true }] };
    },
  };
  const result = await resolveApplicablePricebook(client, { branchId: 1, customerId: 12 });
  assert.deepEqual(result, { id: 9, code: 'VIP', name: 'Khách VIP', isDefault: false, customerSpecific: true });
  assert.deepEqual(calls[0].parameters, [1, 12]);
  assert.match(calls[0].sql, /WHEN EXISTS[\s\S]+THEN 2/);
});

test('item price resolver uses the resolved price returned by the database', async () => {
  const client = { query: async () => ({ rows: [{ sale_price: '125000.00' }] }) };
  const price = await resolvePricebookItemPrice(client, {
    branchId: 1, pricebookId: 9, itemType: 'service', itemId: 4, basePrice: 150000,
  });
  assert.equal(price, 125000);
});
