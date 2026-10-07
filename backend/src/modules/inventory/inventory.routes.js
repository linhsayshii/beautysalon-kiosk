import { Router } from 'express';
import { domainOptions } from '../../domain-options.js';
import { asyncRoute, HttpError, parseDateTime, parseEnum, parseIsoDate, parsePagination, parsePositiveInteger } from '../../lib/http.js';
import {
  createInventoryItem,
  createPricebook,
  createPurchaseOrder,
  completePurchaseOrder,
  deletePricebook,
  getInventoryItem,
  getPricebook,
  getPurchaseOrder,
  listPricebooks,
  listPricebookCustomerOptions,
  listProducts,
  listPurchaseOrders,
  listSuppliers,
  updateInventoryItem,
  updatePricebook,
  updatePricebookItem,
} from './inventory.service.js';
import { parseProductImageUrl } from '../media/media.storage.js';

const router = Router();
const itemTypes = domainOptions.filters.products.types;
const { statuses: purchaseStatuses, paymentMethods } = domainOptions.filters.purchaseOrders;

const text = (value, maximum = 120) => String(value ?? '').trim().slice(0, maximum);
const nonNegative = (value, field) => {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) throw new HttpError(400, 'INVALID_ARGUMENT', `${field} phải là số không âm`);
  return parsed;
};
const positive = (value, field) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new HttpError(400, 'INVALID_ARGUMENT', `${field} phải lớn hơn 0`);
  return parsed;
};
const optionalPositive = (value, field) => (value === undefined || value === null || value === '' ? null : positive(value, field));
const boolean = (value, fallback = true) => (typeof value === 'boolean' ? value : fallback);
const commission = (body) => {
  const type = body.commissionType === null ? null : parseEnum(body.commissionType, 'commissionType', ['percent', 'fixed'], null);
  const rate = type ? nonNegative(body.commissionRate, 'commissionRate') : 0;
  if (type === 'percent' && rate > 1) throw new HttpError(400, 'INVALID_COMMISSION_RATE', 'Hoa hồng phần trăm không được lớn hơn 100%');
  return { commissionType: type, commissionRate: rate };
};
// Only a service pays tour commission, to the staff member who performs it.
const tourCommission = (body, itemType) => {
  if (itemType !== 'service') return { tourCommissionType: null, tourCommissionRate: 0 };
  const type = body.tourCommissionType === null ? null : parseEnum(body.tourCommissionType, 'tourCommissionType', ['percent', 'fixed'], null);
  const rate = type ? nonNegative(body.tourCommissionRate, 'tourCommissionRate') : 0;
  if (type === 'percent' && rate > 1) throw new HttpError(400, 'INVALID_TOUR_COMMISSION_RATE', 'Hoa hồng tua phần trăm không được lớn hơn 100%');
  return { tourCommissionType: type, tourCommissionRate: rate };
};

router.put('/items/:itemType/:itemId', asyncRoute(async (request, response) => {
  const type = parseEnum(request.params.itemType, 'itemType', itemTypes);
  const id = parsePositiveInteger(request.params.itemId, 'itemId');
  const name = text(request.body.name, 220);
  if (!name) throw new HttpError(400, 'NAME_REQUIRED', 'Tên hàng là bắt buộc');
  const code = text(request.body.code, 40).toUpperCase();
  if (code && !/^[A-Z0-9._-]+$/.test(code)) throw new HttpError(400, 'INVALID_CODE', 'Mã hàng chỉ gồm chữ, số, dấu chấm, gạch ngang hoặc gạch dưới');

  const packageItems = Array.isArray(request.body.packageItems)
    ? request.body.packageItems.slice(0, 50).map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new HttpError(400, 'INVALID_ITEMS', `packageItems[${index}] phải là một object`);
      return ({
        serviceId: parsePositiveInteger(item.serviceId, `packageItems[${index}].serviceId`),
        units: parsePositiveInteger(item.units, `packageItems[${index}].units`),
      });
    })
    : undefined;

  const allowedTypes = Array.isArray(request.body.allowedTypes)
    ? [...new Set(request.body.allowedTypes.filter((value) => ['product', 'service', 'package'].includes(value)))]
    : undefined;

  const scopeItems = Array.isArray(request.body.scopeItems)
    ? request.body.scopeItems.slice(0, 100).map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new HttpError(400, 'INVALID_ITEMS', `scopeItems[${index}] phải là một object`);
      return ({
        itemType: parseEnum(item.itemType, `scopeItems[${index}].itemType`, ['product', 'service', 'package']),
        itemId: parsePositiveInteger(item.itemId, `scopeItems[${index}].itemId`),
      });
    })
    : undefined;

  const minStock = request.body.minStock !== undefined ? nonNegative(request.body.minStock, 'minStock') : 0;
  const maxStock = optionalPositive(request.body.maxStock, 'maxStock');
  const { commissionType, commissionRate } = commission(request.body);
  const { tourCommissionType, tourCommissionRate } = tourCommission(request.body, type);
  if (maxStock !== null && maxStock < minStock) {
    throw new HttpError(400, 'INVALID_STOCK_RANGE', 'Tồn tối đa phải lớn hơn hoặc bằng tồn tối thiểu');
  }

  const data = await updateInventoryItem({
    branchId: request.account.branchId,
    type,
    id,
    name,
    code,
    category: text(request.body.category, 100) || ({ product: 'Sản phẩm', service: 'Dịch vụ', package: 'Gói dịch vụ', account_card: 'Thẻ tài khoản' })[type],
    brand: text(request.body.brand, 100),
    salePrice: nonNegative(request.body.salePrice, 'salePrice'),
    costPrice: nonNegative(request.body.costPrice, 'costPrice'),
    active: boolean(request.body.active),
    imageUrl: parseProductImageUrl(request.body.imageUrl),
    description: text(request.body.description, 3000),
    note: text(request.body.note, 3000),
    barcode: text(request.body.barcode, 80),
    unit: text(request.body.unit, 30) || 'cái',
    minStock,
    maxStock,
    durationMinutes: type === 'service' ? positive(request.body.durationMinutes, 'durationMinutes') : null,
    validityDays: optionalPositive(request.body.validityDays, 'validityDays'),
    usageSchedule: parseEnum(request.body.usageSchedule, 'usageSchedule', ['flexible', 'scheduled'], 'flexible'),
    packageItems,
    faceValue: type === 'account_card' ? positive(request.body.faceValue, 'faceValue') : 0,
    allowedTypes,
    scopeItems,
    stockQuantity: request.body.initialStock === undefined ? undefined : nonNegative(request.body.initialStock, 'initialStock'),
    commissionType,
    commissionRate,
    tourCommissionType,
    tourCommissionRate,
  });
  response.json({ data });
}));

router.get('/items/:itemType/:itemId', asyncRoute(async (request, response) => {
  const type = parseEnum(request.params.itemType, 'itemType', itemTypes);
  const id = parsePositiveInteger(request.params.itemId, 'itemId');
  response.json({ data: await getInventoryItem({ branchId: request.account.branchId, type, id }) });
}));

router.post('/items', asyncRoute(async (request, response) => {
  const type = parseEnum(request.body.type, 'type', itemTypes);
  if (!type) throw new HttpError(400, 'TYPE_REQUIRED', 'Loại hàng là bắt buộc');
  const name = text(request.body.name, 220);
  if (!name) throw new HttpError(400, 'NAME_REQUIRED', 'Tên hàng là bắt buộc');
  const code = text(request.body.code, 40).toUpperCase();
  if (code && !/^[A-Z0-9._-]+$/.test(code)) throw new HttpError(400, 'INVALID_CODE', 'Mã hàng chỉ gồm chữ, số, dấu chấm, gạch ngang hoặc gạch dưới');

  const packageItems = Array.isArray(request.body.packageItems)
    ? request.body.packageItems.slice(0, 50).map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new HttpError(400, 'INVALID_ITEMS', `packageItems[${index}] phải là một object`);
      return ({
      serviceId: parsePositiveInteger(item.serviceId, `packageItems[${index}].serviceId`),
      units: parsePositiveInteger(item.units, `packageItems[${index}].units`),
      });
    })
    : [];
  if (type === 'package' && !packageItems.length) throw new HttpError(400, 'PACKAGE_ITEMS_REQUIRED', 'Gói dịch vụ cần ít nhất một dịch vụ');
  if (new Set(packageItems.map((item) => item.serviceId)).size !== packageItems.length) throw new HttpError(400, 'DUPLICATE_PACKAGE_SERVICE', 'Mỗi dịch vụ chỉ được thêm một lần trong gói');

  const allowedTypes = Array.isArray(request.body.allowedTypes)
    ? [...new Set(request.body.allowedTypes.filter((value) => ['product', 'service', 'package'].includes(value)))]
    : [];
  if (type === 'account_card' && !allowedTypes.length) throw new HttpError(400, 'CARD_SCOPE_REQUIRED', 'Thẻ tài khoản cần ít nhất một loại hàng được thanh toán');
  const scopeItems = Array.isArray(request.body.scopeItems)
    ? request.body.scopeItems.slice(0, 100).map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new HttpError(400, 'INVALID_ITEMS', `scopeItems[${index}] phải là một object`);
      return ({
      itemType: parseEnum(item.itemType, `scopeItems[${index}].itemType`, ['product', 'service', 'package']),
      itemId: parsePositiveInteger(item.itemId, `scopeItems[${index}].itemId`),
      });
    })
    : [];
  const uniqueScopeItems = [...new Map(scopeItems.map((item) => [`${item.itemType}:${item.itemId}`, item])).values()];
  const minStock = nonNegative(request.body.minStock, 'minStock');
  const maxStock = optionalPositive(request.body.maxStock, 'maxStock');
  const { commissionType, commissionRate } = commission(request.body);
  const { tourCommissionType, tourCommissionRate } = tourCommission(request.body, type);
  if (maxStock !== null && maxStock < minStock) {
    throw new HttpError(400, 'INVALID_STOCK_RANGE', 'Tồn tối đa phải lớn hơn hoặc bằng tồn tối thiểu');
  }

  const data = await createInventoryItem({
    branchId: request.account.branchId,
    type,
    name,
    code,
    category: text(request.body.category, 100) || ({ product: 'Sản phẩm', service: 'Dịch vụ', package: 'Gói dịch vụ', account_card: 'Thẻ tài khoản' })[type],
    brand: text(request.body.brand, 100),
    salePrice: nonNegative(request.body.salePrice, 'salePrice'),
    costPrice: nonNegative(request.body.costPrice, 'costPrice'),
    active: boolean(request.body.active),
    imageUrl: parseProductImageUrl(request.body.imageUrl),
    description: text(request.body.description, 3000),
    note: text(request.body.note, 3000),
    barcode: text(request.body.barcode, 80),
    unit: text(request.body.unit, 30) || 'cái',
    initialStock: nonNegative(request.body.initialStock, 'initialStock'),
    minStock,
    maxStock,
    durationMinutes: type === 'service' ? positive(request.body.durationMinutes, 'durationMinutes') : null,
    validityDays: optionalPositive(request.body.validityDays, 'validityDays'),
    usageSchedule: parseEnum(request.body.usageSchedule, 'usageSchedule', ['flexible', 'scheduled'], 'flexible'),
    packageItems,
    faceValue: type === 'account_card' ? positive(request.body.faceValue, 'faceValue') : 0,
    allowedTypes,
    scopeItems: uniqueScopeItems,
    commissionType,
    commissionRate,
    tourCommissionType,
    tourCommissionRate,
  });
  response.status(201).json({ data });
}));

router.get('/products', asyncRoute(async (request, response) => {
  const result = await listProducts({
    sort: text(request.query.sort, 40),
    branchId: request.account.branchId,
    search: text(request.query.search),
    type: parseEnum(request.query.type, 'type', itemTypes),
    category: text(request.query.category, 100),
    stockStatus: parseEnum(request.query.stockStatus, 'stockStatus', domainOptions.filters.products.stockStatuses),
    status: parseEnum(request.query.status, 'status', domainOptions.filters.products.statuses),
    ...parsePagination(request.query),
  });
  response.json({ data: result.rows, meta: { pagination: result.pagination, summary: result.summary, categories: result.categories } });
}));

router.get('/pricebooks', asyncRoute(async (request, response) => {
  const result = await listPricebooks({
    sort: text(request.query.sort, 40),
    type: parseEnum(request.query.type, 'type', itemTypes),
    branchId: request.account.branchId,
    pricebookId: request.query.pricebookId ? parsePositiveInteger(request.query.pricebookId, 'pricebookId') : null,
    search: text(request.query.search), category: text(request.query.category, 100),
    ...parsePagination(request.query),
  });
  response.json({ data: result.rows, meta: { pagination: result.pagination, pricebook: result.pricebook, pricebooks: result.pricebooks, categories: result.categories } });
}));

router.get('/pricebook-customer-options', asyncRoute(async (request, response) => {
  const selectedIds = String(request.query.selectedIds ?? '')
    .split(',')
    .filter(Boolean)
    .slice(0, 200)
    .map((value) => parsePositiveInteger(value, 'selectedIds'));
  const data = await listPricebookCustomerOptions({
    branchId: request.account.branchId,
    search: text(request.query.search),
    selectedIds,
  });
  response.json({ data });
}));

router.patch('/pricebooks/:pricebookId/items/:itemType/:itemId', asyncRoute(async (request, response) => {
  const itemType = parseEnum(request.params.itemType, 'itemType', itemTypes);
  const result = await updatePricebookItem({
    branchId: request.account.branchId,
    pricebookId: parsePositiveInteger(request.params.pricebookId, 'pricebookId'),
    itemType,
    itemId: parsePositiveInteger(request.params.itemId, 'itemId'),
    salePrice: nonNegative(request.body.salePrice, 'salePrice'),
  });
  response.json({ data: result });
}));

router.get('/pricebooks/:pricebookId', asyncRoute(async (request, response) => {
  const data = await getPricebook({
    branchId: request.account.branchId,
    id: parsePositiveInteger(request.params.pricebookId, 'pricebookId'),
  });
  response.json({ data });
}));

router.post('/pricebooks', asyncRoute(async (request, response) => {
  const code = text(request.body.code, 40).toUpperCase();
  if (!code) throw new HttpError(400, 'CODE_REQUIRED', 'Mã bảng giá là bắt buộc');
  if (!/^[A-Z0-9._-]+$/.test(code)) throw new HttpError(400, 'INVALID_CODE', 'Mã bảng giá chỉ gồm chữ, số, dấu chấm, gạch ngang hoặc gạch dưới');

  const name = text(request.body.name, 160);
  if (!name) throw new HttpError(400, 'NAME_REQUIRED', 'Tên bảng giá là bắt buộc');

  const effectiveFrom = request.body.effectiveFrom ? parseIsoDate(request.body.effectiveFrom, 'effectiveFrom') : null;
  const effectiveTo = request.body.effectiveTo ? parseIsoDate(request.body.effectiveTo, 'effectiveTo') : null;
  const customerIds = Array.isArray(request.body.customerIds)
    ? [...new Set(request.body.customerIds.slice(0, 200).map((id) => parsePositiveInteger(id, 'customerIds')))]
    : [];

  const data = await createPricebook({
    branchId: request.account.branchId,
    code,
    name,
    active: boolean(request.body.active, true),
    effectiveFrom,
    effectiveTo,
    customerIds,
    copyFromDefault: boolean(request.body.copyFromDefault, true),
  });
  response.status(201).json({ data });
}));

router.put('/pricebooks/:pricebookId', asyncRoute(async (request, response) => {
  const effectiveFrom = request.body.effectiveFrom === undefined
    ? undefined
    : (request.body.effectiveFrom ? parseIsoDate(request.body.effectiveFrom, 'effectiveFrom') : null);
  const effectiveTo = request.body.effectiveTo === undefined
    ? undefined
    : (request.body.effectiveTo ? parseIsoDate(request.body.effectiveTo, 'effectiveTo') : null);
  const customerIds = Array.isArray(request.body.customerIds)
    ? [...new Set(request.body.customerIds.slice(0, 200).map((id) => parsePositiveInteger(id, 'customerIds')))]
    : undefined;

  const data = await updatePricebook({
    branchId: request.account.branchId,
    id: parsePositiveInteger(request.params.pricebookId, 'pricebookId'),
    name: text(request.body.name, 160) || undefined,
    active: request.body.active !== undefined ? boolean(request.body.active) : undefined,
    effectiveFrom,
    effectiveTo,
    customerIds,
  });
  response.json({ data });
}));

router.delete('/pricebooks/:pricebookId', asyncRoute(async (request, response) => {
  const data = await deletePricebook({
    branchId: request.account.branchId,
    id: parsePositiveInteger(request.params.pricebookId, 'pricebookId'),
  });
  response.json({ data });
}));

router.get('/suppliers', asyncRoute(async (request, response) => {
  const rows = await listSuppliers({ branchId: request.account.branchId, search: text(request.query.search) });
  response.json({ data: rows });
}));

router.get('/purchase-orders', asyncRoute(async (request, response) => {
  const result = await listPurchaseOrders({
    sort: String(request.query.sort ?? ''),
    branchId: request.account.branchId, search: text(request.query.search),
    status: parseEnum(request.query.status, 'status', purchaseStatuses),
    dateFrom: request.query.dateFrom ? parseIsoDate(request.query.dateFrom, 'dateFrom') : null,
    dateTo: request.query.dateTo ? parseIsoDate(request.query.dateTo, 'dateTo') : null,
    ...parsePagination(request.query),
  });
  response.json({ data: result.rows, meta: { pagination: result.pagination, summary: result.summary } });
}));

router.get('/purchase-orders/:id', asyncRoute(async (request, response) => {
  const data = await getPurchaseOrder({ branchId: request.account.branchId, id: parsePositiveInteger(request.params.id, 'id') });
  response.json({ data });
}));

router.post('/purchase-orders/:id/complete', asyncRoute(async (request, response) => {
  const data = await completePurchaseOrder({ branchId: request.account.branchId, id: parsePositiveInteger(request.params.id, 'id'), actorAccountId: request.account.id });
  response.json({ data });
}));

router.post('/purchase-orders', asyncRoute(async (request, response) => {
  if (!Array.isArray(request.body.items) || !request.body.items.length || request.body.items.length > 100) {
    throw new HttpError(400, 'INVALID_ITEMS', 'Phiếu nhập phải có từ 1 đến 100 sản phẩm');
  }
  if (request.body.items.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
    throw new HttpError(400, 'INVALID_ITEMS', 'Mỗi dòng sản phẩm phải là một object');
  }
  const status = parseEnum(request.body.status, 'status', purchaseStatuses.filter((value) => value !== 'cancelled'), 'draft');
  const data = await createPurchaseOrder({
    branchId: request.account.branchId,
    actorAccountId: request.account.id,
    supplierId: parsePositiveInteger(request.body.supplierId, 'supplierId'),
    status,
    receivedAt: request.body.receivedAt ? parseDateTime(request.body.receivedAt, 'receivedAt') : null,
    discount: nonNegative(request.body.discount, 'discount'),
    otherCost: nonNegative(request.body.otherCost, 'otherCost'),
    amountPaid: nonNegative(request.body.amountPaid, 'amountPaid'),
    paymentMethod: parseEnum(request.body.paymentMethod, 'paymentMethod', paymentMethods, 'cash'),
    note: text(request.body.note, 1000),
    items: request.body.items.map((item, index) => ({
      productId: parsePositiveInteger(item.productId, `items[${index}].productId`),
      quantity: positive(item.quantity, `items[${index}].quantity`),
      unitCost: nonNegative(item.unitCost, `items[${index}].unitCost`),
      discount: nonNegative(item.discount, `items[${index}].discount`),
    })),
  });
  response.status(201).json({ data });
}));

export default router;
