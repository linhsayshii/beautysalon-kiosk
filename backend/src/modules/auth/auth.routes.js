import { Router } from 'express';
import { config } from '../../config.js';
import { asyncRoute, HttpError, parseEnum, parsePositiveInteger } from '../../lib/http.js';
import { createRateLimiter, loginRateLimitKey } from '../../lib/security.js';
import { requireAuth } from './auth.middleware.js';
import { permissions, requirePermissions } from './auth.permissions.js';
import { changeOwnPassword, clearedSessionCookie, createAccount, listAccounts, login, logout, readSessionCookie, sessionCookie, switchOwnBranch, updateAccount, updateOwnProfile } from './auth.service.js';
import { accountFromToken } from './auth.service.js';

const router = Router();
const roles = ['manager', 'cashier', 'staff'];
const clean = (value, max = 160) => String(value ?? '').trim().slice(0, max);
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60_000,
  max: config.http.loginRateLimit,
  key: loginRateLimitKey,
  skipSuccessfulRequests: true,
});
export const validatePassword = (password, label = 'Mật khẩu') => {
  if (password.length < 12 || password.length > 128
    || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    throw new HttpError(400, 'INVALID_PASSWORD', `${label} cần 12–128 ký tự, gồm chữ thường, chữ hoa và số`);
  }
};

router.post('/login', loginLimiter, asyncRoute(async (request, response) => {
  const username = clean(request.body.username, 80);
  const password = String(request.body.password ?? '');
  if (!username || !password) throw new HttpError(400, 'CREDENTIALS_REQUIRED', 'Vui lòng nhập tên đăng nhập và mật khẩu');
  if (password.length > 128) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Tên đăng nhập hoặc mật khẩu không đúng');
  const result = await login(username, password);
  response.setHeader('Set-Cookie', sessionCookie(result.token, result.expiresAt));
  response.json({ data: result.account });
}));

router.post('/logout', asyncRoute(async (request, response) => {
  await logout(readSessionCookie(request));
  response.setHeader('Set-Cookie', clearedSessionCookie());
  response.status(204).end();
}));

router.get('/me', requireAuth, (request, response) => response.json({ data: request.account }));

router.patch('/me', requireAuth, asyncRoute(async (request, response) => {
  const username = clean(request.body.username, 80);
  const displayName = clean(request.body.displayName);
  const phone = clean(request.body.phone, 30);
  const email = clean(request.body.email, 160);
  if (!/^[a-zA-Z0-9._-]{3,80}$/.test(username)) throw new HttpError(400, 'INVALID_USERNAME', 'Tên đăng nhập cần từ 3 ký tự, chỉ gồm chữ, số, dấu chấm, gạch ngang hoặc gạch dưới');
  if (!displayName) throw new HttpError(400, 'DISPLAY_NAME_REQUIRED', 'Tên hiển thị là bắt buộc');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'INVALID_EMAIL', 'Email không hợp lệ');
  await updateOwnProfile({ accountId: request.account.id, username, displayName, phone, email });
  const data = await accountFromToken(readSessionCookie(request));
  response.json({ data });
}));

router.post('/me/password', requireAuth, asyncRoute(async (request, response) => {
  const currentPassword = String(request.body.currentPassword ?? '');
  const newPassword = String(request.body.newPassword ?? '');
  validatePassword(newPassword, 'Mật khẩu mới');
  if (currentPassword === newPassword) throw new HttpError(400, 'PASSWORD_UNCHANGED', 'Mật khẩu mới cần khác mật khẩu hiện tại');
  await changeOwnPassword({ accountId: request.account.id, currentPassword, newPassword, currentToken: readSessionCookie(request) });
  response.json({ data: { changed: true } });
}));

router.put('/me/branch', requireAuth, requirePermissions(permissions.manageBranches), asyncRoute(async (request, response) => {
  await switchOwnBranch({ accountId: request.account.id, branchId: parsePositiveInteger(request.body.branchId, 'branchId') });
  const data = await accountFromToken(readSessionCookie(request));
  response.json({ data });
}));

router.get('/accounts', requireAuth, requirePermissions(permissions.manageAccounts), asyncRoute(async (request, response) => {
  const data = await listAccounts(request.account.branchId);
  response.json({ data, meta: { total: data.length } });
}));

router.post('/accounts', requireAuth, requirePermissions(permissions.manageAccounts), asyncRoute(async (request, response) => {
  const username = clean(request.body.username, 80);
  const password = String(request.body.password ?? '');
  const displayName = clean(request.body.displayName);
  const role = parseEnum(request.body.role, 'role', roles);
  if (!/^[a-zA-Z0-9._-]{3,80}$/.test(username)) throw new HttpError(400, 'INVALID_USERNAME', 'Tên đăng nhập cần từ 3 ký tự, chỉ gồm chữ, số, dấu chấm, gạch ngang hoặc gạch dưới');
  validatePassword(password);
  if (!displayName || !role) throw new HttpError(400, 'INVALID_ACCOUNT', 'Tên hiển thị và loại tài khoản là bắt buộc');
  const staffId = request.body.staffId ? parsePositiveInteger(request.body.staffId, 'staffId') : null;
  if (role === 'staff' && !staffId) throw new HttpError(400, 'STAFF_REQUIRED', 'Tài khoản nhân viên phải liên kết với hồ sơ nhân viên');
  const data = await createAccount({ branchId: request.account.branchId, staffId, username, password, displayName, role });
  response.status(201).json({ data });
}));

router.patch('/accounts/:id', requireAuth, requirePermissions(permissions.manageAccounts), asyncRoute(async (request, response) => {
  const id = parsePositiveInteger(request.params.id, 'id');
  if (id === request.account.id && (request.body.active === false || (request.body.role && request.body.role !== 'manager'))) {
    throw new HttpError(400, 'CANNOT_RESTRICT_SELF', 'Không thể tự khóa hoặc hạ quyền tài khoản đang đăng nhập');
  }
  const password = request.body.password === undefined ? '' : String(request.body.password);
  if (id === request.account.id && password) {
    throw new HttpError(400, 'USE_PASSWORD_CHANGE', 'Hãy dùng chức năng đổi mật khẩu và nhập mật khẩu hiện tại');
  }
  if (password) validatePassword(password);
  const role = request.body.role === undefined ? null : parseEnum(request.body.role, 'role', roles);
  const active = typeof request.body.active === 'boolean' ? request.body.active : null;
  const data = await updateAccount({ id, branchId: request.account.branchId, active, role, password });
  response.json({ data });
}));

export default router;
