import { describe, expect, it } from 'vitest';
import { formatMoney, formatNumber, formatPercent, initials, parseMoney } from './format';

describe('format helpers', () => {
  it('formats salon money values consistently with dot separator', () => {
    expect(formatMoney(1250000)).toBe('1.250.000đ');
    expect(formatNumber(1250000)).toBe('1.250.000');
  });

  it('parses formatted money strings to integers', () => {
    expect(parseMoney('1.250.000')).toBe(1250000);
    expect(parseMoney('1.250.000đ')).toBe(1250000);
    expect(parseMoney('500000')).toBe(500000);
    expect(parseMoney('')).toBe(0);
    expect(parseMoney(undefined)).toBe(0);
  });

  it('formats decimal commission rates as percentages', () => {
    expect(formatPercent(0.15)).toBe('15%');
  });

  it('creates initials from the last two name segments', () => {
    expect(initials('Nguyễn Thu Hằng')).toBe('TH');
  });
});
