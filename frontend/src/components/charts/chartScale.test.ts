import { describe, expect, it } from 'vitest';
import { axisLabel, niceCountMaximum, visibleLabelIndexes } from './chartScale';

describe('chart axis labels', () => {
  it('uses the Vietnamese decimal comma for compact money and counts', () => {
    expect(axisLabel(3_800_000, true)).toBe('3,8tr');
    expect(axisLabel(7_500_000, true)).toBe('7,5tr');
    expect(axisLabel(2_500, true)).toBe('2,5k');
    expect(axisLabel(0.5)).toBe('0,5');
  });
});

describe('count axis maximum', () => {
  it('keeps every gridline on a whole number of customers', () => {
    for (const values of [[0], [1], [2], [3], [7], [13], [50], [240]]) {
      const maximum = niceCountMaximum(values);
      expect(maximum).toBeGreaterThanOrEqual(Math.max(...values));
      for (const rate of [0.25, 0.5, 0.75, 1]) expect(Number.isInteger(maximum * rate)).toBe(true);
    }
    expect(niceCountMaximum([1])).toBe(4);
    expect(niceCountMaximum([7])).toBe(8);
  });
});

describe('x-axis label spacing', () => {
  it('shows every label for a week', () => {
    expect(visibleLabelIndexes(7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
  it('spaces 24 hourly labels so neighbours cannot overlap', () => {
    expect(visibleLabelIndexes(24)).toEqual([0, 4, 8, 12, 16, 20]);
  });
  it('spaces the days of a month', () => {
    expect(visibleLabelIndexes(30)).toEqual([0, 5, 10, 15, 20, 25]);
  });
});
