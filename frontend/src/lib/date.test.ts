import { describe, expect, it } from 'vitest';
import {
  addCalendarDays,
  localDateTimeFromInstant,
  startOfIsoWeek,
  zonedLocalDateTimeToIso,
} from './date';

describe('date-only calendar helpers', () => {
  it('keeps calendar days stable across month and leap-year boundaries', () => {
    expect(addCalendarDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addCalendarDays('2024-02-29', 1)).toBe('2024-03-01');
    expect(startOfIsoWeek('2026-08-23')).toBe('2026-08-17');
  });
});

describe('branch-local appointment time helpers', () => {
  it('round-trips a branch-local value without depending on the device timezone', () => {
    const localValue = '2026-08-17T14:45';
    const iso = zonedLocalDateTimeToIso(localValue, 'Asia/Ho_Chi_Minh');

    expect(iso).toBe('2026-08-17T07:45:00.000Z');
    expect(localDateTimeFromInstant(iso!, 'Asia/Ho_Chi_Minh')).toBe(localValue);
  });
});
