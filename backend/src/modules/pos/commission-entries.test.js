import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCommissionEntries } from './commission-entries.js';

const service = {
  itemType: 'service',
  staffId: 1,
  consultantStaffId: 2,
  quantity: 2,
  lineTotal: 2000000,
  listPrice: 1000000,
  isPackageRedemption: false,
  commissionType: 'percent',
  commissionRate: 0.1,
  tourCommissionType: 'fixed',
  tourCommissionRate: 50000,
};

test('a service pays tour to its performer and the original commission to its consultant', () => {
  assert.deepEqual(buildCommissionEntries(service), [
    { staffId: 1, commissionType: 'tour', sourceName: 'Tua dịch vụ', revenue: 2000000, rate: 50000, amount: 100000 },
    { staffId: 2, commissionType: 'consulting', sourceName: 'Tư vấn bán dịch vụ', revenue: 2000000, rate: 0.1, amount: 200000 },
  ]);
});

test('without a consultant nobody earns the original service commission', () => {
  assert.deepEqual(
    buildCommissionEntries({ ...service, consultantStaffId: null }).map((entry) => [entry.staffId, entry.commissionType]),
    [[1, 'tour']],
  );
});

test('the performer and the consultant may be the same person', () => {
  const entries = buildCommissionEntries({ ...service, consultantStaffId: 1 });
  assert.deepEqual(entries.map((entry) => [entry.staffId, entry.commissionType]), [[1, 'tour'], [1, 'consulting']]);
});

test('a percent tour on a package session uses the list price', () => {
  const entries = buildCommissionEntries({
    ...service,
    lineTotal: 0,
    listPrice: 400000,
    isPackageRedemption: true,
    tourCommissionType: 'percent',
    tourCommissionRate: 0.05,
  });
  assert.deepEqual(entries, [
    { staffId: 1, commissionType: 'tour', sourceName: 'Tua dịch vụ', revenue: 800000, rate: 0.05, amount: 40000 },
  ]);
});

test('a percent amount is rounded to whole dong', () => {
  const [entry] = buildCommissionEntries({ ...service, consultantStaffId: null, quantity: 1, lineTotal: 333, tourCommissionType: 'percent', tourCommissionRate: 0.1 });
  assert.equal(entry.amount, 33);
});

test('a product pays its seller as a consulting commission', () => {
  assert.deepEqual(buildCommissionEntries({
    itemType: 'product', staffId: 2, consultantStaffId: null, quantity: 2, lineTotal: 300000, listPrice: 150000,
    isPackageRedemption: false, commissionType: 'fixed', commissionRate: 20000, tourCommissionType: null, tourCommissionRate: 0,
  }), [
    { staffId: 2, commissionType: 'consulting', sourceName: 'Bán sản phẩm', revenue: 300000, rate: 20000, amount: 40000 },
  ]);
});

test('packages, cards, unassigned lines and zero amounts record nothing', () => {
  assert.deepEqual(buildCommissionEntries({ ...service, itemType: 'package' }), []);
  assert.deepEqual(buildCommissionEntries({ ...service, itemType: 'account_card' }), []);
  assert.deepEqual(buildCommissionEntries({ ...service, staffId: null, consultantStaffId: null }), []);
  assert.deepEqual(buildCommissionEntries({ ...service, tourCommissionType: null, commissionType: null }), []);
});
