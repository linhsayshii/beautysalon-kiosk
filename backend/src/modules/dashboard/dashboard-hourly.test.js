import test from 'node:test';
import assert from 'node:assert/strict';
import { fillHourly } from './dashboard.service.js';
test('hourly charts cover all 24 hours and preserve revenue outside salon hours', () => {
  const result = fillHourly([
    { period: 'hour', bucket: '1', revenue: '1800000' },
    { period: 'hour', bucket: '23', revenue: '200000' },
    { period: 'day', bucket: '2026-09-15', revenue: '2000000' },
  ], 'revenue');
  assert.equal(result.length, 24);
  assert.deepEqual(result[0], { label: '00:00', value: 0 });
  assert.deepEqual(result[1], { label: '01:00', value: 1800000 });
  assert.deepEqual(result[23], { label: '23:00', value: 200000 });
  assert.equal(result.reduce((sum, item) => sum + item.value, 0), 2000000);
});
