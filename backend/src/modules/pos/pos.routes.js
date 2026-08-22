import { Router } from 'express';
import { asyncRoute, HttpError, parseDateTime, parseEnum, parseIsoDate, parsePositiveInteger } from '../../lib/http.js';
import { listProducts } from '../inventory/inventory.service.js';
import { createCustomer, listCustomers } from '../customers/customers.service.js';
import { listStaff } from '../staff/staff.service.js';
import { createAppointments, listAppointments, updateAppointment } from '../dashboard/dashboard.service.js';
import { checkoutPosInvoice, listPosPaymentRequests } from './pos.service.js';
import { pool } from '../../db.js';
import { getOrder } from '../orders/orders.service.js';

const router = Router();
const itemTypes = ['product', 'service', 'package', 'account_card'];
const appointmentStatuses = ['pending', 'confirmed', 'waiting', 'in_service', 'completed', 'cancelled'];
const paymentMethods = ['cash', 'bank_transfer', 'card', 'wallet', 'mixed'];
const text = (value, maximum = 120) => String(value ?? '').trim().slice(0, maximum);

router.get('/catalog', asyncRoute(async (request, response) => {
  const result = await listProducts({
    branchId: request.account.branchId, search: text(request.query.search),
    type: parseEnum(request.query.type, 'type', itemTypes), category: '', stockStatus: '', status: 'active',
    page: 1, pageSize: 100, offset: 0,
  });
  response.json({ data: result.rows, meta: { pagination: result.pagination } });
}));

router.get('/customers', asyncRoute(async (request, response) => {
  const result = await listCustomers({
    branchId: request.account.branchId, search: text(request.query.search), group: '', debtStatus: '',
    page: 1, pageSize: 6, offset: 0,
  });
  response.json({ data: result.rows, meta: { pagination: result.pagination } });
}));

// API lấy các gói dịch vụ khả dụng của khách hàng (Bảo mật: Xác thực branchId và customerId chặt chẽ)
router.get('/customers/:id/available-packages', asyncRoute(async (request, response) => {
  const customerId = parsePositiveInteger(request.params.id, 'id');
  const branchId = request.account.branchId;

  // Kiểm tra khách hàng có thuộc chi nhánh hiện tại không (tránh IDOR / stranger access)
  const custCheck = await pool.query(
    'SELECT id, name FROM customers WHERE id = $1 AND branch_id = $2',
    [customerId, branchId],
  );
  if (!custCheck.rows[0]) {
    throw new HttpError(404, 'CUSTOMER_NOT_FOUND', 'Không tìm thấy thông tin khách hàng tại chi nhánh này');
  }

  // Lấy các gói dịch vụ còn lượt và chưa hết hạn
  const result = await pool.query(
    `SELECT cp.id AS customer_package_id,
            cp.package_code,
            sp.id AS package_id,
            sp.name AS package_name,
            cp.total_units,
            cp.used_units,
            (cp.total_units - cp.used_units) AS remaining_units,
            cp.expires_at,
            cp.status,
            s.id AS service_id,
            s.name AS service_name,
            s.code AS service_code,
            s.price AS service_sale_price
     FROM customer_packages cp
     JOIN service_packages sp ON sp.id = cp.package_id
     JOIN service_package_items spi ON spi.package_id = cp.package_id
     JOIN services s ON s.id = spi.service_id
     WHERE cp.branch_id = $1
       AND cp.customer_id = $2
       AND cp.status = 'active'
       AND cp.used_units < cp.total_units
       AND (cp.expires_at IS NULL OR cp.expires_at > NOW())
     ORDER BY cp.created_at DESC, cp.id DESC`,
    [branchId, customerId],
  );

  response.json({
    data: result.rows.map((row) => ({
      customerPackageId: Number(row.customer_package_id),
      packageCode: row.package_code,
      packageId: Number(row.package_id),
      packageName: row.package_name,
      totalUnits: Number(row.total_units),
      usedUnits: Number(row.used_units),
      remainingUnits: Number(row.remaining_units),
      expiresAt: row.expires_at,
      status: row.status,
      service: {
        id: Number(row.service_id),
        name: row.service_name,
        code: row.service_code,
        salePrice: Number(row.service_sale_price),
      },
    })),
  });
}));

router.post('/customers', asyncRoute(async (request, response) => {
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
    branchId: request.account.branchId,
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

router.get('/staff', asyncRoute(async (request, response) => {
  const data = await listStaff({ branchId: request.account.branchId, search: '', active: true });
  response.json({ data, meta: { total: data.length } });
}));

router.get('/appointments', asyncRoute(async (request, response) => {
  const dateFrom = parseIsoDate(request.query.dateFrom, 'dateFrom');
  const dateTo = parseIsoDate(request.query.dateTo, 'dateTo');
  response.json({ data: await listAppointments({ branchId: request.account.branchId, dateFrom, dateTo }) });
}));

router.get('/payment-requests', asyncRoute(async (request, response) => {
  response.json({ data: await listPosPaymentRequests({ branchId: request.account.branchId }) });
}));

router.get('/invoices/:id', asyncRoute(async (request, response) => {
  response.json({
    data: await getOrder({
      branchId: request.account.branchId,
      id: parsePositiveInteger(request.params.id, 'id'),
    }),
  });
}));

router.post('/appointments', asyncRoute(async (request, response) => {
  const rawItems = Array.isArray(request.body.items) ? request.body.items : [request.body];
  const items = rawItems.map((item) => {
    const startsAt = parseDateTime(item.startsAt || request.body.startsAt, 'startsAt');
    const endsAt = parseDateTime(item.endsAt || request.body.endsAt, 'endsAt');
    if (endsAt <= startsAt || endsAt.getTime() - startsAt.getTime() > 8 * 60 * 60 * 1000) {
      throw new HttpError(400, 'INVALID_TIME_RANGE', 'Thời gian lịch hẹn không hợp lệ');
    }
    return {
      serviceId: parsePositiveInteger(item.serviceId, 'serviceId'),
      staffId: item.staffId ? parsePositiveInteger(item.staffId, 'staffId') : null,
      quantity: Math.max(1, Math.floor(Number(item.quantity || 1))),
      startsAt,
      endsAt,
    };
  });
  const data = await createAppointments({
    branchId: request.account.branchId,
    customerId: parsePositiveInteger(request.body.customerId, 'customerId'),
    invoiceId: request.body.invoiceId ? parsePositiveInteger(request.body.invoiceId, 'invoiceId') : null,
    items,
    status: parseEnum(request.body.status, 'status', appointmentStatuses, 'confirmed'),
    note: text(request.body.note, 500),
  });
  response.status(201).json({ data });
}));

router.put('/appointments/:id', asyncRoute(async (request, response) => {
  const id = parsePositiveInteger(request.params.id, 'id');
  const startsAt = request.body.startsAt ? parseDateTime(request.body.startsAt, 'startsAt') : undefined;
  const endsAt = request.body.endsAt ? parseDateTime(request.body.endsAt, 'endsAt') : undefined;
  if (startsAt && endsAt && (endsAt <= startsAt || endsAt.getTime() - startsAt.getTime() > 8 * 60 * 60 * 1000)) {
    throw new HttpError(400, 'INVALID_TIME_RANGE', 'Thời gian lịch hẹn không hợp lệ');
  }

  const data = await updateAppointment({
    branchId: request.account.branchId,
    id,
    customerId: request.body.customerId !== undefined ? parsePositiveInteger(request.body.customerId, 'customerId') : undefined,
    serviceId: request.body.serviceId !== undefined ? (request.body.serviceId ? parsePositiveInteger(request.body.serviceId, 'serviceId') : null) : undefined,
    staffId: request.body.staffId !== undefined ? (request.body.staffId ? parsePositiveInteger(request.body.staffId, 'staffId') : null) : undefined,
    startsAt,
    endsAt,
    status: request.body.status ? parseEnum(request.body.status, 'status', appointmentStatuses) : undefined,
    note: request.body.note !== undefined ? text(request.body.note, 500) : undefined,
  });

  response.json({ data });
}));

router.post('/checkout', asyncRoute(async (request, response) => {
  const branchId = request.account.branchId;
  const actorAccountId = request.account.id;
  const actorStaffId = request.account.staffId;

  const customerId = request.body.customerId ? parsePositiveInteger(request.body.customerId, 'customerId') : null;
  const staffId = request.body.staffId ? parsePositiveInteger(request.body.staffId, 'staffId') : null;
  const invoiceId = request.body.invoiceId ? parsePositiveInteger(request.body.invoiceId, 'invoiceId') : null;
  const appointmentId = request.body.appointmentId ? parsePositiveInteger(request.body.appointmentId, 'appointmentId') : null;
  const discount = Math.max(0, Number(request.body.discount || 0));
  const amountPaid = request.body.amountPaid !== undefined && request.body.amountPaid !== null
    ? Math.max(0, Number(request.body.amountPaid))
    : null;
  const paymentMethod = parseEnum(request.body.paymentMethod, 'paymentMethod', paymentMethods, 'cash');
  const note = text(request.body.note, 300);

  if (!Array.isArray(request.body.lines) || request.body.lines.length === 0) {
    throw new HttpError(400, 'EMPTY_CART', 'Hóa đơn phải có ít nhất một mặt hàng');
  }

  const lines = request.body.lines.map((line) => ({
    itemType: parseEnum(line.itemType, 'itemType', itemTypes),
    itemId: parsePositiveInteger(line.itemId, 'itemId'),
    quantity: Math.max(1, Math.floor(Number(line.quantity || 1))),
    staffId: line.staffId ? parsePositiveInteger(line.staffId, 'staffId') : null,
  }));

  const data = await checkoutPosInvoice({
    branchId,
    actorAccountId,
    actorStaffId,
    customerId,
    staffId,
    lines,
    discount,
    paymentMethod,
    amountPaid,
    note,
    appointmentId,
    invoiceId,
  });

  response.status(201).json({ data });
}));

export default router;
