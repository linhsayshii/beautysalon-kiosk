import { Router } from 'express';
import { domainOptions } from '../../domain-options.js';
import { asyncRoute, HttpError, parseDateTime, parseEnum, parseIsoDate, parseOptionalHttpUrl, parsePagination, parsePositiveInteger } from '../../lib/http.js';
import {
  createInventoryItem,
  createPurchaseOrder,
  getPurchaseOrder,
  listPricebooks,
  listProducts,
  listPurchaseOrders,
  listSuppliers,
  updateInventoryItem,
  updatePricebookItem,
} from './inventory.service.js';

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
    imageUrl: parseOptionalHttpUrl(request.body.imageUrl, 'imageUrl'),
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
  });
  response.json({ data });
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
    imageUrl: parseOptionalHttpUrl(request.body.imageUrl, 'imageUrl'),
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
  });
  response.status(201).json({ data });
}));

router.get('/products', asyncRoute(async (request, response) => {
  const result = await listProducts({
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
    branchId: request.account.branchId,
    pricebookId: request.query.pricebookId ? parsePositiveInteger(request.query.pricebookId, 'pricebookId') : null,
    search: text(request.query.search), category: text(request.query.category, 100),
    ...parsePagination(request.query),
  });
  response.json({ data: result.rows, meta: { pagination: result.pagination, pricebook: result.pricebook, pricebooks: result.pricebooks, categories: result.categories } });
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

router.get('/suppliers', asyncRoute(async (request, response) => {
  const rows = await listSuppliers({ branchId: request.account.branchId, search: text(request.query.search) });
  response.json({ data: rows });
}));

router.get('/purchase-orders', asyncRoute(async (request, response) => {
  const result = await listPurchaseOrders({
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
