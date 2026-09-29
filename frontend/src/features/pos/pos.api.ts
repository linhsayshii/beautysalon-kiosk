import { apiRequest, type ApiEnvelope } from '@/services/api-client';
import type { ApiRecord } from '@/types/api';

type PosCatalogMeta = {
  pricebook?: ApiRecord | null;
  pagination?: { page: number; pageSize: number; total: number; totalPages: number };
};

const getPosCatalogPage = (search: string, type: string, customerId: number | null | undefined, page: number) =>
  apiRequest<ApiEnvelope<ApiRecord[], PosCatalogMeta>>(
    `/pos/catalog?search=${encodeURIComponent(search)}&type=${encodeURIComponent(type)}&page=${page}&pageSize=100${customerId ? `&customerId=${customerId}` : ''}`,
  );

export const getPosCatalog = async (search: string, type: string, customerId?: number | null) => {
  const firstPage = await getPosCatalogPage(search, type, customerId, 1);
  const totalPages = firstPage.meta?.pagination?.totalPages ?? 1;
  if (totalPages <= 1) return firstPage;

  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => getPosCatalogPage(search, type, customerId, index + 2)),
  );
  return {
    ...firstPage,
    data: [firstPage, ...remainingPages].flatMap((response) => response.data),
  };
};

/**
 * Finds the sellable items whose barcode or code equals a scanned value.
 * Imported data can reuse one code on several items, so every exact match is
 * returned. The API lists exact matches first, so the first page is enough.
 */
export const findPosItemsByBarcode = async (code: string, customerId?: number | null) => {
  const needle = code.trim().toLowerCase();
  if (!needle) return [];
  const response = await getPosCatalogPage(code.trim(), '', customerId, 1);
  return response.data.filter((item) => String(item.barcode ?? '').toLowerCase() === needle || String(item.code ?? '').toLowerCase() === needle);
};

export const getPosPriceQuote = (customerId: number | null | undefined, items: Array<{ itemType: string; itemId: number }>) =>
  apiRequest<ApiEnvelope<Array<{ itemType: string; itemId: number; salePrice: number }>, { pricebook?: ApiRecord | null }>>('/pos/price-quote', {
    method: 'POST',
    body: JSON.stringify({ customerId: customerId ?? null, items }),
  });

export const searchPosCustomers = (search: string) => apiRequest<ApiEnvelope<ApiRecord[]>>(
  `/pos/customers?search=${encodeURIComponent(search)}`,
);

export const createPosCustomer = (body: {
  name: string;
  code?: string;
  phone?: string;
  dob?: string | null;
  gender?: string | null;
  email?: string | null;
  facebook?: string | null;
  customerGroup?: string;
}) => apiRequest<ApiEnvelope<ApiRecord>>('/pos/customers', {
  method: 'POST',
  body: JSON.stringify(body),
});

export const getPosAppointments = (dateFrom: string, dateTo: string) => apiRequest<ApiEnvelope<ApiRecord[]>>(
  `/pos/appointments?dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`,
);

export interface PosPaymentRequest {
  id: number;
  code: string;
  total: number;
  issuedAt: string;
  paymentRequestedAt: string;
  requestedByName: string | null;
  customer: { name: string; phone: string | null };
  serviceProgress: { total: number; completed: number };
}

export const getPosPaymentRequests = () => apiRequest<ApiEnvelope<PosPaymentRequest[]>>('/pos/payment-requests');
export const getPosInvoice = (id: number) => apiRequest<ApiEnvelope<ApiRecord>>(`/pos/invoices/${id}`);

export const getPosStaff = () => apiRequest<ApiEnvelope<ApiRecord[]>>('/pos/staff');

export const createPosAppointment = (body: ApiRecord) => apiRequest<ApiEnvelope<ApiRecord>>('/pos/appointments', {
  method: 'POST',
  body: JSON.stringify(body),
});

export const updatePosAppointment = (id: number, body: ApiRecord) => apiRequest<ApiEnvelope<ApiRecord>>(`/pos/appointments/${id}`, {
  method: 'PUT',
  body: JSON.stringify(body),
});

export const getPosCustomerAvailablePackages = (customerId: number) => apiRequest<ApiEnvelope<Array<{
  customerPackageId: number;
  packageCode: string;
  packageId: number;
  packageName: string;
  totalUnits: number;
  usedUnits: number;
  remainingUnits: number;
  expiresAt: string | null;
  status: string;
  service: {
    id: number;
    name: string;
    code: string;
    salePrice: number;
  };
}>>>(`/pos/customers/${customerId}/available-packages`);

export interface ServicePackageOption {
  customerPackageId: number;
  packageCode: string;
  packageId: number;
  packageName: string;
  totalUnits: number;
  usedUnits: number;
  remainingUnits: number;
  expiresAt: string | null;
  status: string;
  services: Array<{
    serviceId: number;
    serviceName: string;
    serviceCode: string;
    totalUnits: number;
    usedCount: number;
    availableUnits: number;
  }>;
}

export const getPosCustomerServicePackages = (customerId: number) => apiRequest<ApiEnvelope<ServicePackageOption[]>>(
  `/pos/customers/${customerId}/service-packages`,
);

export interface PosCheckoutPayload {
  customerId?: number | null;
  staffId?: number | null;
  discount?: number;
  paymentMethod: 'cash' | 'bank_transfer' | 'card' | 'wallet' | 'mixed';
  amountPaid?: number | null;
  allowDebt?: boolean;
  requestKey?: string;
  note?: string;
  appointmentId?: number | null;
  invoiceId?: number | null;
  lines: Array<{
    itemType: 'product' | 'service' | 'package' | 'account_card';
    itemId: number;
    quantity: number;
    staffId?: number | null;
    /** Service lines only: earns the service's original commission. */
    consultantStaffId?: number | null;
    usePackageId?: number | null;
    usePackageServiceId?: number | null;
  }>;
}

export interface PosReceiptData {
  id: number;
  code: string;
  status: string;
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  changeAmount: number;
  tenderedAmount?: number;
  debtAmount?: number;
  paymentStatus?: string;
  customerDebtBalance?: number;
  paymentMethod: string;
  salesChannel: string;
  issuedAt: string;
  note: string;
  branch: {
    name: string;
    address: string;
    phone: string;
  };
  customer: {
    id: number | null;
    code: string | null;
    name: string;
    phone: string | null;
  };
  staff: {
    id: number;
    name: string;
  } | null;
  items: Array<{
    id: number;
    code: string;
    name: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
}

export const checkoutPosInvoice = (body: PosCheckoutPayload) => apiRequest<ApiEnvelope<PosReceiptData>>('/pos/checkout', {
  method: 'POST',
  body: JSON.stringify(body),
});

export const getPosAppointmentEditor = (id: number) => apiRequest<ApiEnvelope<ApiRecord>>(`/pos/appointments/${id}/editor`);
export const savePosAppointmentEditor = (id: number, body: ApiRecord) => apiRequest<ApiEnvelope<ApiRecord>>(`/pos/appointments/${id}/editor`, { method: 'PUT', body: JSON.stringify(body) });
export const prepareAppointmentCheckout = (id: number) => apiRequest<ApiEnvelope<{ invoiceId: number }>>(`/pos/appointments/${id}/prepare-checkout`, { method: 'POST' });
