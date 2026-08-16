import { Router } from 'express';
import { asyncRoute, HttpError, parsePositiveInteger } from '../../lib/http.js';
import { permissions, requirePermissions } from '../auth/auth.permissions.js';
import { createBranch, deactivateBranch, getBranch, listBranches, updateBranch } from './branches.service.js';

const router = Router();
router.use(requirePermissions(permissions.manageBranches));
const text = (value, max = 300) => String(value ?? '').trim().slice(0, max);
const nullableCoordinate = (value, field, min, max) => {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new HttpError(400, 'INVALID_LOCATION', `${field} không hợp lệ`);
  return number;
};
const radius = (value, fallback = 100) => {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(number) || number < 10 || number > 1000) throw new HttpError(400, 'INVALID_RADIUS', 'Bán kính phải từ 10 đến 1000 mét');
  return number;
};
const email = (value) => {
  const result = text(value, 160);
  if (result && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw new HttpError(400, 'INVALID_EMAIL', 'Email không hợp lệ');
  return result;
};
const payload = (body, partial = false) => {
  const code = body.code === undefined && partial ? null : text(body.code, 30).toUpperCase();
  const name = body.name === undefined && partial ? null : text(body.name, 160);
  if (!partial && (!code || !name)) throw new HttpError(400, 'BRANCH_REQUIRED', 'Mã và tên chi nhánh là bắt buộc');
  if (code && !/^[A-Z0-9._-]+$/.test(code)) throw new HttpError(400, 'INVALID_BRANCH_CODE', 'Mã chi nhánh chỉ gồm chữ, số, dấu chấm, gạch ngang hoặc gạch dưới');
  const latitude = nullableCoordinate(body.latitude, 'Vĩ độ', -90, 90);
  const longitude = nullableCoordinate(body.longitude, 'Kinh độ', -180, 180);
  if ((latitude === null) !== (longitude === null)) throw new HttpError(400, 'INVALID_LOCATION', 'Cần nhập đủ vĩ độ và kinh độ');
  return {
    code, name, address: text(body.address), phone: text(body.phone, 30), email: email(body.email),
    timezone: body.timezone === undefined && partial ? null : text(body.timezone, 64) || 'Asia/Ho_Chi_Minh',
    latitude, longitude, attendanceRadiusMeters: radius(body.attendanceRadiusMeters),
    active: typeof body.active === 'boolean' ? body.active : null,
  };
};

router.get('/', asyncRoute(async (request, response) => response.json({ data: await listBranches() })));
router.get('/:id', asyncRoute(async (request, response) => response.json({ data: await getBranch(parsePositiveInteger(request.params.id, 'id')) })));
router.post('/', asyncRoute(async (request, response) => response.status(201).json({ data: await createBranch(payload(request.body)) })));
router.patch('/:id', asyncRoute(async (request, response) => {
  const id = parsePositiveInteger(request.params.id, 'id');
  const current = await getBranch(id);
  response.json({ data: await updateBranch(id, payload({ ...current, ...request.body })) });
}));
router.delete('/:id', asyncRoute(async (request, response) => response.json({ data: await deactivateBranch(parsePositiveInteger(request.params.id, 'id'), request.account.branchId) })));

export default router;
