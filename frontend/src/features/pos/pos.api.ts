import { apiRequest, type ApiEnvelope } from '@/services/api-client';
import type { ApiRecord } from '@/types/api';

export const getPosCatalog = (search: string, type: string) => apiRequest<ApiEnvelope<ApiRecord[]>>(
  `/pos/catalog?search=${encodeURIComponent(search)}&type=${encodeURIComponent(type)}`,
);

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

export interface PosCheckoutPayload {
  customerId?: number | null;
  staffId?: number | null;
  discount?: number;
  paymentMethod: 'cash' | 'bank_transfer' | 'card' | 'wallet' | 'mixed';
  amountPaid?: number | null;
  note?: string;
  appointmentId?: number | null;
  invoiceId?: number | null;
  lines: Array<{
    itemType: 'product' | 'service' | 'package' | 'account_card';
    itemId: number;
    quantity: number;
    staffId?: number | null;
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
