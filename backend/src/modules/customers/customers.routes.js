import { Router } from 'express';
import { domainOptions } from '../../domain-options.js';
import { asyncRoute, HttpError, parseEnum, parseIsoDate, parsePagination, parsePositiveInteger } from '../../lib/http.js';
import { createCustomer, getCustomer, getCustomerActivity, getCustomerPackage, listCustomerPackages, listCustomers, updateCustomer } from './customers.service.js';

const router = Router();
const text = (value, maximum = 160) => String(value ?? '').trim().slice(0, maximum);

router.put('/:id', asyncRoute(async (request, response) => {
  const branchId = request.account.branchId;
  const id = parsePositiveInteger(request.params.id, 'id');
  const name = text(request.body.name, 160);
  if (!name) throw new HttpError(400, 'NAME_REQUIRED', 'Tên khách hàng không được để trống');
  const code = text(request.body.code, 40);
  const phone = text(request.body.phone, 30);
  const dob = request.body.dob ? parseIsoDate(request.body.dob, 'dob') : null;
  const gender = request.body.gender ? parseEnum(request.body.gender, 'gender', ['male', 'female', 'other', 'Nam', 'Nữ', 'Khác']) : null;
  const email = text(request.body.email, 160);
  const facebook = text(request.body.facebook, 255);
  const customerGroup = text(request.body.customerGroup || request.body.group, 80);

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'INVALID_EMAIL', 'Email không đúng định dạng');
  }

  const data = await updateCustomer({
    branchId,
    id,
    name,
    code,
    phone,
    dob,
    gender,
    email,
    facebook,
    customerGroup,
  });
  response.json({ data });
}));

router.post('/', asyncRoute(async (request, response) => {
  const branchId = request.account.branchId;
  const name = text(request.body.name, 160);
  if (!name) throw new HttpError(400, 'NAME_REQUIRED', 'Tên khách hàng không được để trống');
  const code = text(request.body.code, 40);
  const phone = text(request.body.phone, 30);
  const dob = request.body.dob ? parseIsoDate(request.body.dob, 'dob') : null;
  const gender = request.body.gender ? parseEnum(request.body.gender, 'gender', ['male', 'female', 'other', 'Nam', 'Nữ', 'Khác']) : null;
  const email = text(request.body.email, 160);
  const facebook = text(request.body.facebook, 255);
  const customerGroup = text(request.body.customerGroup || request.body.group, 80) || 'Cá nhân';

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'INVALID_EMAIL', 'Email không đúng định dạng');
  }

  const data = await createCustomer({
    branchId,
    name,
    code,
    phone,
    dob,
    gender,
    email,
    facebook,
    customerGroup,
  });
  response.status(201).json({ data });
}));

router.get('/', asyncRoute(async (request, response) => {
  const branchId = request.account.branchId;
  const pagination = parsePagination(request.query);
  const debtStatus = parseEnum(request.query.debtStatus, 'debtStatus', domainOptions.filters.customers.debtStatuses);
  const result = await listCustomers({
    branchId,
    search: String(request.query.search ?? '').trim().slice(0, 120),
    group: String(request.query.group ?? '').trim().slice(0, 80),
    debtStatus,
    ...pagination,
  });
  response.json({ data: result.rows, meta: { pagination: result.pagination, summary: result.summary, groups: result.groups } });
}));

router.get('/packages', asyncRoute(async (request, response) => {
  const branchId = request.account.branchId;
  const pagination = parsePagination(request.query);
  const status = parseEnum(request.query.status, 'status', domainOptions.filters.customerPackages.statuses);
  const itemType = parseEnum(request.query.itemType, 'itemType', ['package', 'account_card']);
  const result = await listCustomerPackages({
    branchId,
    search: String(request.query.search ?? '').trim().slice(0, 120),
    status,
    itemType,
    ...pagination,
  });
  response.json({ data: result.rows, meta: { pagination: result.pagination, summary: result.summary } });
}));

router.get('/packages/:itemType/:id', asyncRoute(async (request, response) => {
  const itemType = parseEnum(request.params.itemType, 'itemType', ['package', 'account_card']);
  const data = await getCustomerPackage({
    branchId: request.account.branchId,
    itemType,
    id: parsePositiveInteger(request.params.id, 'id'),
  });
  response.json({ data });
}));

router.get('/:id/activity/:kind', asyncRoute(async (request, response) => {
  const kind = parseEnum(request.params.kind, 'kind', ['orders', 'appointments', 'packages', 'cards']);
  const data = await getCustomerActivity({
    branchId: request.account.branchId,
    id: parsePositiveInteger(request.params.id, 'id'),
    kind,
  });
  response.json({ data });
}));

router.get('/:id', asyncRoute(async (request, response) => {
  const data = await getCustomer({
    branchId: request.account.branchId,
    id: parsePositiveInteger(request.params.id, 'id'),
  });
  response.json({ data });
}));

export default router;
