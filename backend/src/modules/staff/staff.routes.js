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
  getStaffPayrollHistory,
  getStaffSchedule,
  listAttendance,
  listCommissions,
  listStaff,
  listWorkShifts,
  getWorkScheduleSettings,
  updateWorkScheduleSettings,
  updateStaff,
} from './staff.service.js';
import { listAppointments, transitionAppointmentWorkStatus } from '../dashboard/dashboard.service.js';
import { listOrders } from '../orders/orders.service.js';

const router = Router();
export const staffSelfRoutes = Router();

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
const staffProfile = (body) => (body.profile && typeof body.profile === 'object' && !Array.isArray(body.profile) ? body.profile : undefined);
const accountId = (value) => (value === undefined ? undefined : (value === null || value === '' ? null : parsePositiveInteger(value, 'accountId')));

function requireLinkedStaff(request) {
  if (request.account.role !== 'staff' || !request.account.staffId) {
    throw new HttpError(403, 'STAFF_ACCOUNT_REQUIRED', 'Chức năng này chỉ dành cho tài khoản nhân viên đã liên kết hồ sơ');
  }
  return request.account.staffId;
}

staffSelfRoutes.get('/payroll', asyncRoute(async (request, response) => {
  const staffId = requireLinkedStaff(request);
  response.json({ data: await getStaffPayrollHistory({ branchId: request.account.branchId, staffId }) });
}));

staffSelfRoutes.get('/schedule', asyncRoute(async (request, response) => {
  const staffId = requireLinkedStaff(request);
  const startDate = parseIsoDate(request.query.startDate, 'startDate', currentDate());
  response.json({ data: await getStaffSchedule({ branchId: request.account.branchId, staffId, startDate }) });
}));

// Keep an employee's daily agenda behind the self-service boundary.  The
// corresponding POS and orders endpoints are deliberately broader and are not
// available to the staff role.
staffSelfRoutes.get('/work-items', asyncRoute(async (request, response) => {
  const staffId = requireLinkedStaff(request);
  const dateFrom = parseIsoDate(request.query.dateFrom, 'dateFrom', currentDate());
  const dateTo = parseIsoDate(request.query.dateTo, 'dateTo', dateFrom);
  if (dateTo < dateFrom) {
    throw new HttpError(400, 'INVALID_DATE_RANGE', 'dateTo phải cùng hoặc sau dateFrom');
  }

  const [appointments, drafts] = await Promise.all([
    listAppointments({ branchId: request.account.branchId, dateFrom, dateTo }),
    listOrders({
      branchId: request.account.branchId,
      search: '',
      status: 'draft',
      paymentMethod: '',
      staffId,
      dateFrom,
      dateTo,
      page: 1,
      pageSize: 100,
      offset: 0,
    }),
  ]);

  const staffAppointments = appointments.filter((appointment) => appointment.staff?.id === staffId);
  const appointmentInvoiceIds = new Set(
    staffAppointments.flatMap((appointment) => appointment.invoiceId ? [Number(appointment.invoiceId)] : []),
  );
  response.json({
    data: {
      appointments: staffAppointments,
      // An appointment and its linked draft are one work item in the employee
      // agenda. The invoice remains available to POS, but is not a duplicate
      // card in My Schedule.
      drafts: drafts.rows.filter((draft) => !appointmentInvoiceIds.has(Number(draft.id))),
    },
  });
}));

staffSelfRoutes.patch('/work-items/:id/status', asyncRoute(async (request, response) => {
  const staffId = requireLinkedStaff(request);
  const id = parsePositiveInteger(request.params.id, 'id');
  const status = parseEnum(request.body.status, 'status', ['in_service', 'completed']);
  response.json({
    data: await transitionAppointmentWorkStatus({
      branchId: request.account.branchId,
      staffId,
      id,
      status,
    }),
  });
}));

router.post('/', asyncRoute(async (request, response) => {
  const name = text(request.body.name, 160);
  const role = text(request.body.role, 120);
  const code = text(request.body.code, 30).toUpperCase();
  if (!name) throw new HttpError(400, 'NAME_REQUIRED', 'Tên nhân viên là bắt buộc');
  if (!role) throw new HttpError(400, 'ROLE_REQUIRED', 'Vai trò nhân viên là bắt buộc');
  if (code && !/^[A-Z0-9._-]+$/.test(code)) {
    throw new HttpError(400, 'INVALID_CODE', 'Mã nhân viên chỉ gồm chữ, số, dấu chấm, gạch ngang hoặc gạch dưới');
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
    canSell: typeof request.body.canSell === 'boolean' ? request.body.canSell : true,
    canManageInventory: request.body.canManageInventory === true,
    profile: staffProfile(request.body),
    accountId: accountId(request.body.accountId),
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

router.get('/work-schedule-settings', asyncRoute(async (request, response) => {
  response.json({ data: await getWorkScheduleSettings(request.account.branchId) });
}));

router.put('/work-schedule-settings', asyncRoute(async (request, response) => {
  const allowedDays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const activeWorkDays = Array.isArray(request.body.activeWorkDays)
    ? [...new Set(request.body.activeWorkDays.filter((day) => allowedDays.includes(day)))].sort((a, b) => allowedDays.indexOf(a) - allowedDays.indexOf(b))
    : [];
  if (!activeWorkDays.length) throw new HttpError(400, 'WORK_DAYS_REQUIRED', 'Cần chọn ít nhất một ngày làm việc');
  const holidays = Array.isArray(request.body.holidays) ? request.body.holidays.slice(0, 100).map((holiday, index) => ({
    id: String(holiday?.id ?? index), name: text(holiday?.name, 160), fromDate: text(holiday?.fromDate, 20),
    toDate: text(holiday?.toDate, 20), daysCount: nonNegative(holiday?.daysCount, `holidays[${index}].daysCount`),
  })) : [];
  if (holidays.some((holiday) => !holiday.name)) throw new HttpError(400, 'INVALID_HOLIDAY', 'Tên kỳ nghỉ là bắt buộc');
  response.json({ data: await updateWorkScheduleSettings({ branchId: request.account.branchId, activeWorkDays, holidays }) });
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
    canSell: typeof request.body.canSell === 'boolean' ? request.body.canSell : true,
    canManageInventory: request.body.canManageInventory === true,
    profile: staffProfile(request.body),
    accountId: accountId(request.body.accountId),
  });
  response.json({ data });
}));

export default router;
