export type AccountRole = 'manager' | 'cashier' | 'staff';

export type AppPermission =
  | 'accounts:manage'
  | 'attendance:manage'
  | 'attendance:self'
  | 'branches:manage'
  | 'dashboard:read'
  | 'customers:manage'
  | 'inventory:manage'
  | 'orders:read'
  | 'pos:use'
  | 'staff:manage';

const managerPermissions: AppPermission[] = [
  'accounts:manage', 'attendance:manage', 'branches:manage', 'dashboard:read', 'customers:manage',
  'inventory:manage', 'orders:read', 'pos:use', 'staff:manage',
];

export const rolePermissions: Readonly<Record<AccountRole, readonly AppPermission[]>> = Object.freeze({
  manager: Object.freeze(managerPermissions),
  cashier: Object.freeze(['pos:use'] as AppPermission[]),
  staff: Object.freeze(['attendance:self'] as AppPermission[]),
});

export const homeForRole = (role: AccountRole, isMobile = false) => {
  if (isMobile) {
    return role === 'manager' ? '/m/dashboard' : role === 'cashier' ? '/m/pos' : '/m/attendance';
  }
  return role === 'manager' ? '/dashboard' : role === 'cashier' ? '/pos' : '/attendance';
};

export function hasPermission(role: AccountRole, permission: AppPermission) {
  return rolePermissions[role].includes(permission);
}

export function permissionForPath(pathname: string): AppPermission | null {
  // Desktop and mobile paths
  if (pathname === '/pos' || pathname === '/m/pos' || pathname === '/m/invoices/new') return 'pos:use';
  if (pathname === '/m/appointments/new' || pathname === '/m/appointments') return 'pos:use';
  if (pathname === '/attendance/qr' || pathname === '/m/attendance/qr') return 'attendance:manage';
  if (pathname === '/attendance' || pathname === '/m/attendance') return 'attendance:self';
  if (pathname === '/dashboard' || pathname === '/m/dashboard') return 'dashboard:read';
  if (pathname === '/m/more') return 'dashboard:read';
  if (pathname === '/m/notifications') return null; // open for all authenticated roles
  if (pathname === '/orders' || pathname === '/m/orders') return 'orders:read';
  if (pathname === '/customers' || pathname === '/customer-cards' || pathname === '/m/customers' || pathname === '/m/customers/new' || pathname === '/m/customer-cards') return 'customers:manage';
  if (pathname === '/products' || pathname === '/pricebooks' || pathname.startsWith('/purchase-orders') || pathname === '/m/products' || pathname === '/m/pricebooks' || pathname.startsWith('/m/purchase-orders')) return 'inventory:manage';
  if (pathname === '/staff/attendance' || pathname === '/m/staff/attendance') return 'attendance:manage';
  if (pathname === '/staff' || pathname.startsWith('/staff/') || pathname === '/m/staff' || pathname.startsWith('/m/staff/')) return 'staff:manage';
  if (pathname === '/m/schedule' || pathname === '/m/salary') return 'attendance:self';
  if (pathname === '/branches') return 'branches:manage';
  return null;
}

export function canAccessPath(role: AccountRole, pathname: string) {
  const permission = permissionForPath(pathname);
  return permission === null || hasPermission(role, permission);
}
