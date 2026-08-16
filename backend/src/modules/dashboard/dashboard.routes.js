import { Router } from 'express';
import { asyncRoute, HttpError, parseDateTime, parseEnum, parseIsoDate, parsePositiveInteger } from '../../lib/http.js';
import { createAppointment, getDashboard, listAppointments, updateAppointment } from './dashboard.service.js';

const router = Router();
const appointmentStatuses = ['pending', 'confirmed', 'waiting', 'in_service', 'completed', 'cancelled'];
const text = (value, maximum = 500) => String(value ?? '').trim().slice(0, maximum);
router.post('/appointments', asyncRoute(async (request, response) => {
  const startsAt = parseDateTime(request.body.startsAt, 'startsAt');
  const endsAt = parseDateTime(request.body.endsAt, 'endsAt');
  if (endsAt <= startsAt) throw new HttpError(400, 'INVALID_TIME_RANGE', 'Giờ kết thúc phải sau giờ bắt đầu');
  if (endsAt.getTime() - startsAt.getTime() > 8 * 60 * 60 * 1000) throw new HttpError(400, 'INVALID_DURATION', 'Lịch hẹn không được dài quá 8 giờ');

  const data = await createAppointment({
    branchId: request.account.branchId,
    customerId: parsePositiveInteger(request.body.customerId, 'customerId'),
    serviceId: parsePositiveInteger(request.body.serviceId, 'serviceId'),
    staffId: request.body.staffId ? parsePositiveInteger(request.body.staffId, 'staffId') : null,
    startsAt,
    endsAt,
    status: parseEnum(request.body.status, 'status', appointmentStatuses, 'confirmed'),
    note: text(request.body.note),
  });
  response.status(201).json({ data });
}));

router.get('/appointments', asyncRoute(async (request, response) => {
  const branchId = request.account.branchId;
  const dateFrom = parseIsoDate(request.query.dateFrom, 'dateFrom');
  const dateTo = parseIsoDate(request.query.dateTo, 'dateTo');
  const data = await listAppointments({ branchId, dateFrom, dateTo });
  response.json({ data });
}));

router.get('/', asyncRoute(async (request, response) => {
  const branchId = request.account.branchId;
  const defaultDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const date = parseIsoDate(request.query.date, 'date', defaultDate);
  const period = parseEnum(request.query.period, 'period', ['today', 'yesterday', 'last_7_days', 'this_month', 'last_month'], 'this_month');
  const dashboard = await getDashboard({ branchId, date, period });
  response.json({ data: dashboard });
}));

export default router;
