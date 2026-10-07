import { Router } from 'express';
import { asyncRoute, parseEnum, parseIsoDate } from '../../lib/http.js';
import { getDashboard } from './dashboard.service.js';

const router = Router();

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
