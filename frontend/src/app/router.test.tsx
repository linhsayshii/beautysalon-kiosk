import { describe, it, expect } from 'vitest';
import { canAccessPath, homeForRole } from '@/features/auth/authorization';

describe('Role Authorization for Mobile Routes', () => {
  it('allows manager to access all mobile routes', () => {
    expect(canAccessPath('manager', '/m/dashboard')).toBe(true);
    expect(canAccessPath('manager', '/m/pos')).toBe(true);
    expect(canAccessPath('manager', '/m/staff')).toBe(true);
  });

  it('restricts staff to mobile attendance, schedule and salary', () => {
    expect(canAccessPath('staff', '/m/attendance')).toBe(true);
    expect(canAccessPath('staff', '/m/schedule')).toBe(true);
    expect(canAccessPath('staff', '/m/salary')).toBe(true);
    expect(canAccessPath('staff', '/m/dashboard')).toBe(false);
    expect(canAccessPath('staff', '/m/pos')).toBe(false);
  });

  it('determines correct home path for role in mobile mode', () => {
    expect(homeForRole('manager', true)).toBe('/m/dashboard');
    expect(homeForRole('cashier', true)).toBe('/m/pos');
    expect(homeForRole('staff', true)).toBe('/m/attendance');
  });
});
