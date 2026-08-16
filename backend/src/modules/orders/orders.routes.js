import { Router } from 'express';
import { domainOptions } from '../../domain-options.js';
import { asyncRoute, parseEnum, parseIsoDate, parsePagination, parsePositiveInteger } from '../../lib/http.js';
import { getOrder, listOrders } from './orders.service.js';

const router = Router();
const { statuses, paymentMethods } = domainOptions.filters.orders;

router.get('/', asyncRoute(async (request, response) => {
  const branchId = request.account.branchId;
  const pagination = parsePagination(request.query);
  const status = parseEnum(request.query.status, 'status', statuses);
  const paymentMethod = parseEnum(request.query.paymentMethod, 'paymentMethod', paymentMethods);
  const dateFrom = request.query.dateFrom ? parseIsoDate(request.query.dateFrom, 'dateFrom') : null;
  const dateTo = request.query.dateTo ? parseIsoDate(request.query.dateTo, 'dateTo') : null;
  const result = await listOrders({
    branchId,
    search: String(request.query.search ?? '').trim().slice(0, 120),
    status,
    paymentMethod,
    dateFrom,
    dateTo,
    ...pagination,
  });
  response.json({ data: result.rows, meta: { pagination: result.pagination, summary: result.summary } });
}));

router.get('/:id', asyncRoute(async (request, response) => {
  const data = await getOrder({
    branchId: request.account.branchId,
    id: parsePositiveInteger(request.params.id, 'id'),
  });
  response.json({ data });
}));

export default router;
