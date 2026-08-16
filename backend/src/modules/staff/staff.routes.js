import { Router } from 'express';
import { asyncRoute, HttpError, parseEnum, parseIsoDate, parsePositiveInteger, parseTime } from '../../lib/http.js';
import {
  createStaff,
  createShift,
  assignShiftSchedule,
  getPayroll,
  getPayrollPeriodDetail,
  listPayrollPeriods,
  recalculatePayrollPeriod,
  updatePayrollRecords,
  approvePayrollPeriod,
  cancelPayrollPeriod,
  createPayrollPayment,
  getSchedule,
  listAttendance,
  listCommissions,
  listStaff,
  listWorkShifts,
  updateStaff,
} from './staff.service.js';

const router = Router();

function currentDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function addDays(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

const text = (value, maximum = 120) => String(value ?? '').trim().slice(0, maximum);
const nonNegative = (value, field) => {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new HttpError(400, 'INVALID_ARGUMENT', `${field} phải là số không âm`);
  }
  return parsed;
};

router.post('/', asyncRoute(async (request, response) => {
  const name = text(request.body.name, 160);
  const role = text(request.body.role, 120);
  const code = text(request.body.code, 30).toUpperCase();
  if (!name) throw new HttpError(400, 'NAME_REQUIRED', 'Tên nhân viên là bắt buộc');
  if (!role) throw new HttpError(400, 'ROLE_REQUIRED', 'Vai trò nhân viên là bắt buộc');
  if (code && !/^[A-Z0-9._-]+$/.test(code)) {
    throw new HttpError(400, 'INVALID_CODE', 'Mã nhân viên chỉ gồm chữ, số, dấu chấm, gạch ngang hoặc gạch dưới');
  }
  const defaultCommissionRate = nonNegative(request.body.defaultCommissionRate, 'defaultCommissionRate');
  if (defaultCommissionRate > 1) {
    throw new HttpError(400, 'INVALID_COMMISSION_RATE', 'Hoa hồng mặc định không được lớn hơn 100%');
  }

  const data = await createStaff({
    branchId: request.account.branchId,
    name,
    role,
    code,
    avatarTone: parseEnum(request.body.avatarTone, 'avatarTone', ['blue', 'violet', 'green', 'orange', 'pink'], 'blue'),
    active: typeof request.body.active === 'boolean' ? request.body.active : true,
    salaryType: parseEnum(request.body.salaryType, 'salaryType', ['monthly', 'hourly', 'shift'], 'monthly'),
    baseSalary: nonNegative(request.body.baseSalary, 'baseSalary'),
    hourlyRate: nonNegative(request.body.hourlyRate, 'hourlyRate'),
    defaultCommissionRate,
    canSell: typeof request.body.canSell === 'boolean' ? request.body.canSell : true,
    canManageInventory: request.body.canManageInventory === true,
  });
  response.status(201).json({ data });
}));

router.get('/', asyncRoute(async (request, response) => {
  const branchId = request.account.branchId;
  const activeValue = parseEnum(request.query.active, 'active', ['true', 'false']);
  const rows = await listStaff({
    branchId,
    search: String(request.query.search ?? '').trim().slice(0, 120),
    active: activeValue === '' ? null : activeValue === 'true',
  });
  response.json({ data: rows, meta: { total: rows.length } });
}));

router.get('/shifts', asyncRoute(async (request, response) => {
  const branchId = request.account.branchId;
  const shifts = await listWorkShifts(branchId);
  response.json({ data: shifts });
}));

router.post('/shifts', asyncRoute(async (request, response) => {
  const branchId = request.account.branchId;
  const name = text(request.body.name, 80);
  const startsAt = parseTime(request.body.startsAt, 'startsAt');
  const endsAt = parseTime(request.body.endsAt, 'endsAt');
  const allowCheckInFrom = parseTime(request.body.allowCheckInFrom || startsAt, 'allowCheckInFrom');
  const allowCheckInTo = parseTime(request.body.allowCheckInTo || endsAt, 'allowCheckInTo');
  if (!name) throw new HttpError(400, 'SHIFT_NAME_REQUIRED', 'Tên ca là bắt buộc');
  if (endsAt <= startsAt) throw new HttpError(400, 'INVALID_TIME_RANGE', 'Giờ kết thúc phải sau giờ bắt đầu');
  const shift = await createShift({ branchId, name, startsAt, endsAt, allowCheckInFrom, allowCheckInTo });
  response.status(201).json({ data: shift });
}));

router.post('/schedule/assign', asyncRoute(async (request, response) => {
  const branchId = request.account.branchId;
  const staffId = parsePositiveInteger(request.body.staffId, 'staffId');
  const shiftDate = parseIsoDate(request.body.shiftDate, 'shiftDate');
  const startsAt = parseTime(request.body.startsAt, 'startsAt');
  const endsAt = parseTime(request.body.endsAt, 'endsAt');
  const shiftName = text(request.body.shiftName, 80);
  if (!shiftName || endsAt <= startsAt) throw new HttpError(400, 'INVALID_SHIFT', 'Tên ca và khung giờ hợp lệ là bắt buộc');
  const status = parseEnum(request.body.status, 'status', ['scheduled', 'confirmed', 'leave', 'cancelled'], 'scheduled');
  const assigned = await assignShiftSchedule({ branchId, staffId, shiftDate, shiftName, startsAt, endsAt, status });
  response.json({ data: assigned });
}));

router.get('/schedule', asyncRoute(async (request, response) => {
  const branchId = request.account.branchId;
  const startDate = parseIsoDate(request.query.startDate, 'startDate', '2026-08-03');
  response.json({ data: await getSchedule({ branchId, startDate }) });
}));

router.get('/attendance', asyncRoute(async (request, response) => {
  const branchId = request.account.branchId;
  const dateTo = parseIsoDate(request.query.dateTo, 'dateTo', currentDate());
  const dateFrom = parseIsoDate(request.query.dateFrom, 'dateFrom', addDays(dateTo, -8));
  response.json({ data: await listAttendance({ branchId, dateFrom, dateTo }), meta: { dateFrom, dateTo } });
}));

// ============================================================================
// PAYROLL ENDPOINTS
// ============================================================================

router.get('/payroll', asyncRoute(async (request, response) => {
  const branchId = request.account.branchId;
  const search = text(request.query.search, 120);
  const periodType = text(request.query.periodType, 40);
  let status = request.query.status;
  if (typeof status === 'string' && status.includes(',')) {
    status = status.split(',').map((s) => s.trim()).filter(Boolean);
  }

  const data = await listPayrollPeriods({
    branchId,
    search,
    status,
    periodType,
  });
  response.json({ data: data.rows, summary: data.summary });
}));

router.get('/payroll/:id', asyncRoute(async (request, response) => {
  const branchId = request.account.branchId;
  const periodId = parsePositiveInteger(request.params.id, 'id');
  const data = await getPayrollPeriodDetail({ branchId, periodId });
  response.json({ data });
}));

router.post('/payroll/:id/recalculate', asyncRoute(async (request, response) => {
  const branchId = request.account.branchId;
  const periodId = parsePositiveInteger(request.params.id, 'id');
  const data = await recalculatePayrollPeriod({ branchId, periodId });
  response.json({ data, message: 'Đã cập nhật lại số liệu bảng lương' });
}));

router.put('/payroll/:id', asyncRoute(async (request, response) => {
  const branchId = request.account.branchId;
  const periodId = parsePositiveInteger(request.params.id, 'id');
  const { records, note } = request.body;
  const data = await updatePayrollRecords({ branchId, periodId, records, note });
  response.json({ data, message: 'Đã lưu thay đổi bảng lương' });
}));

router.post('/payroll/:id/approve', asyncRoute(async (request, response) => {
  const branchId = request.account.branchId;
  const periodId = parsePositiveInteger(request.params.id, 'id');
  const staffId = request.account.staffId || null;
  const staffName = request.account.displayName || 'Quản lý';
  const data = await approvePayrollPeriod({ branchId, periodId, staffId, staffName });
  response.json({ data, message: 'Đã chốt bảng lương thành công' });
}));

router.post('/payroll/:id/cancel', asyncRoute(async (request, response) => {
  const branchId = request.account.branchId;
  const periodId = parsePositiveInteger(request.params.id, 'id');
  const data = await cancelPayrollPeriod({ branchId, periodId });
  response.json({ data, message: 'Đã hủy bảng lương' });
}));

router.post('/payroll/:id/pay', asyncRoute(async (request, response) => {
  const branchId = request.account.branchId;
  const periodId = parsePositiveInteger(request.params.id, 'id');
  const staffId = parsePositiveInteger(request.body.staffId, 'staffId');
  const amount = nonNegative(request.body.amount, 'amount');
  if (amount <= 0) throw new HttpError(400, 'INVALID_AMOUNT', 'Số tiền thanh toán phải lớn hơn 0');
  const paymentMethod = parseEnum(request.body.paymentMethod, 'paymentMethod', ['cash', 'transfer'], 'transfer');
  const note = text(request.body.note, 250);
  const actorStaffId = request.account.staffId || null;

  const data = await createPayrollPayment({
    branchId,
    periodId,
    staffId,
    amount,
    paymentMethod,
    note,
    actorStaffId,
  });
  response.json({ data, message: 'Thanh toán lương thành công' });
}));

router.get('/commissions', asyncRoute(async (request, response) => {
  const branchId = request.account.branchId;
  const dateTo = parseIsoDate(request.query.dateTo, 'dateTo', currentDate());
  const dateFrom = parseIsoDate(request.query.dateFrom, 'dateFrom', `${dateTo.slice(0, 8)}01`);
  response.json({ data: await listCommissions({ branchId, dateFrom, dateTo }), meta: { dateFrom, dateTo } });
}));

router.patch('/:id', asyncRoute(async (request, response) => {
  const name = text(request.body.name, 160);
  const role = text(request.body.role, 120);
  const code = text(request.body.code, 30).toUpperCase();
  if (!name) throw new HttpError(400, 'NAME_REQUIRED', 'Tên nhân viên là bắt buộc');
  if (!role) throw new HttpError(400, 'ROLE_REQUIRED', 'Vai trò nhân viên là bắt buộc');
  if (!code) throw new HttpError(400, 'CODE_REQUIRED', 'Mã nhân viên là bắt buộc');
  if (!/^[A-Z0-9._-]+$/.test(code)) {
    throw new HttpError(400, 'INVALID_CODE', 'Mã nhân viên chỉ gồm chữ, số, dấu chấm, gạch ngang hoặc gạch dưới');
  }
  const defaultCommissionRate = nonNegative(request.body.defaultCommissionRate, 'defaultCommissionRate');
  if (defaultCommissionRate > 1) {
    throw new HttpError(400, 'INVALID_COMMISSION_RATE', 'Hoa hồng mặc định không được lớn hơn 100%');
  }

  const data = await updateStaff({
    branchId: request.account.branchId,
    staffId: parsePositiveInteger(request.params.id, 'id'),
    name,
    role,
    code,
    avatarTone: parseEnum(request.body.avatarTone, 'avatarTone', ['blue', 'violet', 'green', 'orange', 'pink'], 'blue'),
    active: typeof request.body.active === 'boolean' ? request.body.active : true,
    salaryType: parseEnum(request.body.salaryType, 'salaryType', ['monthly', 'hourly', 'shift'], 'monthly'),
    baseSalary: nonNegative(request.body.baseSalary, 'baseSalary'),
    hourlyRate: nonNegative(request.body.hourlyRate, 'hourlyRate'),
    defaultCommissionRate,
    canSell: typeof request.body.canSell === 'boolean' ? request.body.canSell : true,
    canManageInventory: request.body.canManageInventory === true,
  });
  response.json({ data });
}));

export default router;
