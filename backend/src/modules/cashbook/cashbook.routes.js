import { Router } from 'express';
import { domainOptions } from '../../domain-options.js';
import { asyncRoute, HttpError, parseDateTime, parseEnum, parseIsoDate, parsePagination, parsePositiveInteger } from '../../lib/http.js';
import { hasPermission, permissions, requirePermissions } from '../auth/auth.permissions.js';
import {
  cancelVoucher,
  createOpeningBalance,
  createTransfer,
  createVoucher,
  getCashbookSummary,
  getVoucher,
  listVouchers,
} from './cashbook.service.js';

const router = Router();
const { funds, voucherTypes, statuses, categories } = domainOptions.cashbook;
const categoryKeys = categories.map((category) => category.key);
const requireFinance = requirePermissions(permissions.readFinance);

function today() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function monthStart() {
  return `${today().slice(0, 8)}01`;
}

function text(value, maximumLength) {
  return String(value ?? '').trim().slice(0, maximumLength);
}

function dateRange(query) {
  const dateFrom = parseIsoDate(query.dateFrom, 'dateFrom', monthStart());
  const dateTo = parseIsoDate(query.dateTo, 'dateTo', today());
  if (dateFrom > dateTo) throw new HttpError(400, 'INVALID_ARGUMENT', 'Ngày bắt đầu phải trước ngày kết thúc');
  return { dateFrom, dateTo };
}

function optionalDateTime(value) {
  return value ? parseDateTime(value, 'occurredAt') : null;
}

const canReadFinance = (request) => hasPermission(request.account.role, permissions.readFinance);

router.get('/summary', requireFinance, asyncRoute(async (request, response) => {
  response.json({ data: await getCashbookSummary({ branchId: request.account.branchId, ...dateRange(request.query) }) });
}));

router.get('/vouchers', asyncRoute(async (request, response) => {
  // Cashiers only see the current day's vouchers.
  const range = canReadFinance(request) ? dateRange(request.query) : { dateFrom: today(), dateTo: today() };
  const result = await listVouchers({
    branchId: request.account.branchId,
    ...range,
    type: parseEnum(request.query.type, 'type', voucherTypes),
    fund: parseEnum(request.query.fund, 'fund', funds),
    category: parseEnum(request.query.category, 'category', categoryKeys),
    status: parseEnum(request.query.status, 'status', statuses),
    search: text(request.query.search, 120),
    ...parsePagination(request.query),
  });
  response.json({ data: result.items, meta: { pagination: result.pagination, summary: result.summary, ...range } });
}));

router.get('/vouchers/:id', asyncRoute(async (request, response) => {
  response.json({ data: await getVoucher({ branchId: request.account.branchId, id: parsePositiveInteger(request.params.id, 'id') }) });
}));

router.post('/vouchers', asyncRoute(async (request, response) => {
  const body = request.body ?? {};
  // Cashiers record what happens now; only managers may back-date a voucher.
  const occurredAt = canReadFinance(request) ? optionalDateTime(body.occurredAt) : null;
  const data = await createVoucher({
    branchId: request.account.branchId,
    actorAccountId: request.account.id,
    type: parseEnum(body.type, 'type', voucherTypes),
    fund: parseEnum(body.fund, 'fund', funds),
    categoryKey: parseEnum(body.categoryKey, 'categoryKey', categoryKeys),
    amount: body.amount,
    occurredAt,
    counterpartyName: text(body.counterpartyName, 200),
    note: text(body.note, 500),
    requestKey: body.requestKey,
  });
  response.status(201).json({ data });
}));

router.post('/vouchers/:id/cancel', requireFinance, asyncRoute(async (request, response) => {
  const data = await cancelVoucher({
    branchId: request.account.branchId,
    actorAccountId: request.account.id,
    id: parsePositiveInteger(request.params.id, 'id'),
    reason: text(request.body?.reason, 300),
  });
  response.json({ data });
}));

router.post('/transfers', requireFinance, asyncRoute(async (request, response) => {
  const body = request.body ?? {};
  const data = await createTransfer({
    branchId: request.account.branchId,
    actorAccountId: request.account.id,
    fromFund: parseEnum(body.fromFund, 'fromFund', funds),
    toFund: parseEnum(body.toFund, 'toFund', funds),
    amount: body.amount,
    occurredAt: optionalDateTime(body.occurredAt),
    note: text(body.note, 500),
    requestKey: body.requestKey,
  });
  response.status(201).json({ data });
}));

router.post('/opening-balance', requireFinance, asyncRoute(async (request, response) => {
  const body = request.body ?? {};
  const data = await createOpeningBalance({
    branchId: request.account.branchId,
    actorAccountId: request.account.id,
    fund: parseEnum(body.fund, 'fund', funds),
    amount: body.amount,
    occurredAt: optionalDateTime(body.occurredAt),
    note: text(body.note, 500),
    requestKey: body.requestKey,
  });
  response.status(201).json({ data });
}));

export default router;
