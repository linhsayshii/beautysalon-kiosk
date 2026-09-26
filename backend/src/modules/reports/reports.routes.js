import { Router } from 'express';
import { asyncRoute, HttpError, parseEnum, parseIsoDate } from '../../lib/http.js';
import { defaultGroupBy, getProfitReport } from './reports.service.js';

const router = Router();
const MAX_RANGE_DAYS = 366;

function today() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

router.get('/profit', asyncRoute(async (request, response) => {
  const dateTo = parseIsoDate(request.query.dateTo, 'dateTo', today());
  const dateFrom = parseIsoDate(request.query.dateFrom, 'dateFrom', `${dateTo.slice(0, 8)}01`);
  const days = (Date.parse(`${dateTo}T00:00:00Z`) - Date.parse(`${dateFrom}T00:00:00Z`)) / 86_400_000 + 1;
  if (days < 1) throw new HttpError(400, 'INVALID_ARGUMENT', 'Ngày bắt đầu phải trước ngày kết thúc');
  if (days > MAX_RANGE_DAYS) throw new HttpError(400, 'INVALID_ARGUMENT', 'Khoảng thời gian báo cáo tối đa 366 ngày');
  const groupBy = parseEnum(request.query.groupBy, 'groupBy', ['day', 'month'], defaultGroupBy(dateFrom, dateTo));
  response.json({ data: await getProfitReport({ branchId: request.account.branchId, dateFrom, dateTo, groupBy }) });
}));

export default router;
