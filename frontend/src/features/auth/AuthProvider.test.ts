import { describe, expect, it } from 'vitest';
import { canAccessPath, hasPermission, homeForRole, permissionForPath } from './authorization';

describe('role home routing', () => {
  it('routes each account to its only/default workspace', () => {
    expect(homeForRole('manager')).toBe('/dashboard');
    expect(homeForRole('cashier')).toBe('/pos');
    expect(homeForRole('staff')).toBe('/attendance');
  });
});

describe('route authorization', () => {
  it('maps protected pages to explicit permissions', () => {
    expect(permissionForPath('/purchase-orders/new')).toBe('inventory:manage');
    expect(permissionForPath('/attendance/qr')).toBe('attendance:manage');
    expect(permissionForPath('/account/settings')).toBeNull();
  });

  it('enforces least privilege for each role', () => {
    expect(hasPermission('manager', 'accounts:manage')).toBe(true);
    expect(canAccessPath('cashier', '/pos')).toBe(true);
    expect(canAccessPath('cashier', '/dashboard')).toBe(false);
    expect(canAccessPath('staff', '/attendance')).toBe(true);
    expect(canAccessPath('staff', '/attendance/qr')).toBe(false);
  });
});
