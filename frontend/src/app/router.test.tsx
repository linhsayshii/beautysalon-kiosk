import { describe, it, expect } from 'vitest';
import { canAccessPath, homeForRole, permissionForPath } from '@/features/auth/authorization';
import { router } from './router';

describe('Mobile Routes and Authorization', () => {
  it('registers all mobile routes in router config', () => {
    const mobileRoute = router.routes.find((r) => r.path === '/m');
    expect(mobileRoute).toBeDefined();
    const childrenPaths = mobileRoute?.children?.map((c) => c.path).filter(Boolean);

    expect(childrenPaths).toContain('dashboard');
    expect(childrenPaths).toContain('pos');
    expect(childrenPaths).toContain('invoices/new');
    expect(childrenPaths).toContain('appointments');
    expect(childrenPaths).toContain('appointments/new');
    expect(childrenPaths).toContain('orders');
    expect(childrenPaths).toContain('customers');
    expect(childrenPaths).toContain('customer-cards');
    expect(childrenPaths).toContain('products');
    expect(childrenPaths).toContain('pricebooks');
    expect(childrenPaths).toContain('purchase-orders');
    expect(childrenPaths).toContain('purchase-orders/new');
    expect(childrenPaths).toContain('staff');
    expect(childrenPaths).toContain('staff/schedule');
    expect(childrenPaths).toContain('staff/attendance');
    expect(childrenPaths).toContain('staff/payroll');
    expect(childrenPaths).toContain('staff/commissions');
    expect(childrenPaths).toContain('schedule');
    expect(childrenPaths).toContain('salary');
    expect(childrenPaths).toContain('attendance');
    expect(childrenPaths).toContain('attendance/qr');
    expect(childrenPaths).toContain('more');
    expect(childrenPaths).toContain('notifications');
    expect(childrenPaths).toContain('account');
  });

  it('correctly maps mobile paths to required permissions', () => {
    expect(permissionForPath('/m/more')).toBe('dashboard:read');
    expect(permissionForPath('/m/notifications')).toBe(null);
    expect(permissionForPath('/m/appointments')).toBe('pos:use');
    expect(permissionForPath('/m/appointments/new')).toBe('pos:use');
    expect(permissionForPath('/m/products')).toBe('inventory:manage');
    expect(permissionForPath('/m/pricebooks')).toBe('inventory:manage');
    expect(permissionForPath('/m/purchase-orders')).toBe('inventory:manage');
    expect(permissionForPath('/m/purchase-orders/new')).toBe('inventory:manage');
    expect(permissionForPath('/m/customer-cards')).toBe('customers:manage');
    expect(permissionForPath('/m/staff/schedule')).toBe('staff:manage');
    expect(permissionForPath('/m/staff/attendance')).toBe('attendance:manage');
    expect(permissionForPath('/m/staff/payroll')).toBe('staff:manage');
    expect(permissionForPath('/m/staff/commissions')).toBe('staff:manage');
    expect(permissionForPath('/m/attendance/qr')).toBe('attendance:manage');
  });

  it('allows manager to access all mobile routes', () => {
    expect(canAccessPath('manager', '/m/dashboard')).toBe(true);
    expect(canAccessPath('manager', '/m/pos')).toBe(true);
    expect(canAccessPath('manager', '/m/invoices/new')).toBe(true);
    expect(canAccessPath('manager', '/m/appointments')).toBe(true);
    expect(canAccessPath('manager', '/m/appointments/new')).toBe(true);
    expect(canAccessPath('manager', '/m/orders')).toBe(true);
    expect(canAccessPath('manager', '/m/customers')).toBe(true);
    expect(canAccessPath('manager', '/m/customer-cards')).toBe(true);
    expect(canAccessPath('manager', '/m/products')).toBe(true);
    expect(canAccessPath('manager', '/m/pricebooks')).toBe(true);
    expect(canAccessPath('manager', '/m/purchase-orders')).toBe(true);
    expect(canAccessPath('manager', '/m/purchase-orders/new')).toBe(true);
    expect(canAccessPath('manager', '/m/staff')).toBe(true);
    expect(canAccessPath('manager', '/m/staff/schedule')).toBe(true);
    expect(canAccessPath('manager', '/m/staff/attendance')).toBe(true);
    expect(canAccessPath('manager', '/m/staff/payroll')).toBe(true);
    expect(canAccessPath('manager', '/m/staff/commissions')).toBe(true);
    expect(canAccessPath('manager', '/m/attendance/qr')).toBe(true);
    expect(canAccessPath('manager', '/m/more')).toBe(true);
    expect(canAccessPath('manager', '/m/notifications')).toBe(true);
  });

  it('allows cashier to access pos, invoices, appointments, and notifications', () => {
    expect(canAccessPath('cashier', '/m/pos')).toBe(true);
    expect(canAccessPath('cashier', '/m/invoices/new')).toBe(true);
    expect(canAccessPath('cashier', '/m/appointments')).toBe(true);
    expect(canAccessPath('cashier', '/m/appointments/new')).toBe(true);
    expect(canAccessPath('cashier', '/m/notifications')).toBe(true);
    expect(canAccessPath('cashier', '/m/dashboard')).toBe(false);
    expect(canAccessPath('cashier', '/m/staff')).toBe(false);
    expect(canAccessPath('cashier', '/m/products')).toBe(false);
    expect(canAccessPath('cashier', '/m/more')).toBe(false);
  });

  it('restricts staff to mobile attendance, schedule, salary, and notifications', () => {
    expect(canAccessPath('staff', '/m/attendance')).toBe(true);
    expect(canAccessPath('staff', '/m/schedule')).toBe(true);
    expect(canAccessPath('staff', '/m/salary')).toBe(true);
    expect(canAccessPath('staff', '/m/notifications')).toBe(true);
    expect(canAccessPath('staff', '/m/dashboard')).toBe(false);
    expect(canAccessPath('staff', '/m/pos')).toBe(false);
    expect(canAccessPath('staff', '/m/invoices/new')).toBe(false);
    expect(canAccessPath('staff', '/m/appointments')).toBe(false);
    expect(canAccessPath('staff', '/m/appointments/new')).toBe(false);
    expect(canAccessPath('staff', '/m/more')).toBe(false);
    expect(canAccessPath('staff', '/m/staff')).toBe(false);
  });

  it('determines correct home path for role in mobile mode', () => {
    expect(homeForRole('manager', true)).toBe('/m/dashboard');
    expect(homeForRole('cashier', true)).toBe('/m/pos');
    expect(homeForRole('staff', true)).toBe('/m/attendance');
  });
});
