import { describe, expect, it } from 'vitest';
import { calculateShiftHours, calculateStaffShiftSalary } from './salary-calc';

describe('calculateShiftHours', () => {
  it('calculates duration for regular day shifts', () => {
    // 09:00 - 21:00 = 12 hours
    expect(calculateShiftHours('09:00', '21:00')).toBe(12);

    // 09:00 - 20:00 = 11 hours
    expect(calculateShiftHours('09:00', '20:00')).toBe(11);

    // 18:00 - 22:00 = 4 hours
    expect(calculateShiftHours('18:00', '22:00')).toBe(4);

    // 09:30 - 18:00 = 8.5 hours
    expect(calculateShiftHours('09:30', '18:00')).toBe(8.5);
  });

  it('handles overnight shifts crossing midnight', () => {
    // 22:00 to 06:00 = 8 hours
    expect(calculateShiftHours('22:00', '06:00')).toBe(8);
  });
});

describe('calculateStaffShiftSalary', () => {
  it('calculates salary according to standard workdays in month (monthly / standard day)', () => {
    const setting = {
      salaryType: 'monthly',
      baseSalary: 5871000,
      hourlyRate: 0,
    };

    // 7 shifts in a 26-day month: (5871000 / 26) * 7 = 225807.69 * 7 = 1580654
    const shifts7 = Array.from({ length: 7 }, () => ({ startsAt: '09:00', endsAt: '21:00' }));
    const result26 = calculateStaffShiftSalary(setting, shifts7, 26);
    expect(result26.expectedSalary).toBe(1580654);
    expect(result26.totalShifts).toBe(7);
    expect(result26.salaryType).toBe('monthly');

    // In a 24-day month: (5871000 / 24) * 7 = 244625 * 7 = 1712375
    const result24 = calculateStaffShiftSalary(setting, shifts7, 24);
    expect(result24.expectedSalary).toBe(1712375);

    // 0 shifts worked -> 0 expected salary
    const result0 = calculateStaffShiftSalary(setting, [], 26);
    expect(result0.expectedSalary).toBe(0);
    expect(result0.totalShifts).toBe(0);
  });

  it('calculates salary according to hourly rate (hourly)', () => {
    const setting = {
      salaryType: 'hourly',
      baseSalary: 0,
      hourlyRate: 35000,
    };

    // 5 part-time shifts (18:00 - 22:00 = 4h each) = 20h total -> 20 * 35000 = 700000
    const partimeShifts = Array.from({ length: 5 }, () => ({ startsAt: '18:00', endsAt: '22:00' }));
    const result = calculateStaffShiftSalary(setting, partimeShifts, 26);
    expect(result.expectedSalary).toBe(700000);
    expect(result.totalHours).toBe(20);
    expect(result.totalShifts).toBe(5);
    expect(result.salaryType).toBe('hourly');
  });

  it('returns null expectedSalary for unconfigured staff', () => {
    const unconfigured = {
      salaryType: undefined,
      baseSalary: null,
      hourlyRate: null,
    };

    const shifts = [{ startsAt: '09:00', endsAt: '17:00' }];
    const result = calculateStaffShiftSalary(unconfigured, shifts, 26);
    expect(result.expectedSalary).toBeNull();
    expect(result.salaryType).toBe('none');
  });
});
