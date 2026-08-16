import { HttpError } from '../../lib/http.js';

export const permissions = Object.freeze({
  manageAccounts: 'accounts:manage',
  manageAttendance: 'attendance:manage',
  useOwnAttendance: 'attendance:self',
  manageBranches: 'branches:manage',
  readDashboard: 'dashboard:read',
  manageCustomers: 'customers:manage',
  manageInventory: 'inventory:manage',
  readOrders: 'orders:read',
  usePos: 'pos:use',
  manageStaff: 'staff:manage',
});

const managerPermissions = Object.values(permissions).filter((permission) => permission !== permissions.useOwnAttendance);

export const rolePermissions = Object.freeze({
  manager: Object.freeze(managerPermissions),
  cashier: Object.freeze([permissions.usePos]),
  staff: Object.freeze([permissions.useOwnAttendance]),
});

export function hasPermission(role, permission) {
  return rolePermissions[role]?.includes(permission) ?? false;
}

export function requirePermissions(...requiredPermissions) {
  return (request, response, next) => {
    if (!request.account) {
      return next(new HttpError(401, 'AUTH_REQUIRED', 'Vui lòng đăng nhập để tiếp tục'));
    }
    if (!requiredPermissions.every((permission) => hasPermission(request.account.role, permission))) {
      return next(new HttpError(403, 'ACCESS_DENIED', 'Tài khoản không có quyền thực hiện thao tác này'));
    }
    return next();
  };
}
