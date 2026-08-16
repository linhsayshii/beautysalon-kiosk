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

export const homeForRole = (role: AccountRole) => role === 'manager' ? '/dashboard' : role === 'cashier' ? '/pos' : '/attendance';

export function hasPermission(role: AccountRole, permission: AppPermission) {
  return rolePermissions[role].includes(permission);
}

export function permissionForPath(pathname: string): AppPermission | null {
  if (pathname === '/pos') return 'pos:use';
  if (pathname === '/attendance/qr') return 'attendance:manage';
  if (pathname === '/attendance') return 'attendance:self';
  if (pathname === '/dashboard') return 'dashboard:read';
  if (pathname === '/orders') return 'orders:read';
  if (pathname === '/customers' || pathname === '/customer-cards') return 'customers:manage';
  if (pathname === '/products' || pathname === '/pricebooks' || pathname.startsWith('/purchase-orders')) return 'inventory:manage';
  if (pathname === '/staff' || pathname.startsWith('/staff/')) return 'staff:manage';
  if (pathname === '/branches') return 'branches:manage';
  return null;
}

export function canAccessPath(role: AccountRole, pathname: string) {
  const permission = permissionForPath(pathname);
  return permission === null || hasPermission(role, permission);
}
