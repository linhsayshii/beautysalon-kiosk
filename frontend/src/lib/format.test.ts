import { describe, expect, it } from 'vitest';
import { formatMoney, formatPercent, initials } from './format';

describe('format helpers', () => {
  it('formats salon money values consistently', () => {
    expect(formatMoney(1250000)).toBe('1,250,000đ');
  });

  it('formats decimal commission rates as percentages', () => {
    expect(formatPercent(0.15)).toBe('15%');
  });

  it('creates initials from the last two name segments', () => {
    expect(initials('Nguyễn Thu Hằng')).toBe('TH');
  });
});
