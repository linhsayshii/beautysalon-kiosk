import assert from 'node:assert/strict';
import test from 'node:test';
import { getStandardWorkDaysForMonth } from './staff.service.js';

test('getStandardWorkDaysForMonth calculates standard days correctly', () => {
  // August 2026 has 31 days (starts on Saturday Aug 1, ends on Monday Aug 31)
  // All 7 days active (Mon-Sun: [1, 2, 3, 4, 5, 6, 0]) -> 31 days
  const allDays = getStandardWorkDaysForMonth(2026, 8, [1, 2, 3, 4, 5, 6, 0]);
  assert.equal(allDays, 31);

  // 6 days active (Mon-Sat: [1, 2, 3, 4, 5, 6], excluding Sun: 0)
  // Aug 2026 has 5 Sundays (Aug 2, 9, 16, 23, 30) -> 31 - 5 = 26 days
  const sixDays = getStandardWorkDaysForMonth(2026, 8, [1, 2, 3, 4, 5, 6]);
  assert.equal(sixDays, 26);

  // February 2026 has 28 days
  const febAll = getStandardWorkDaysForMonth(2026, 2, [1, 2, 3, 4, 5, 6, 0]);
  assert.equal(febAll, 28);
});
