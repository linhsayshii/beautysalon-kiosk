import { apiRequest, toQueryString } from '@/services/api-client';
import type { ApiEnvelope } from '@/services/api-client';
import type { ApiRecord, Pagination } from '@/types/api';

export interface PagedMeta { pagination: Pagination; summary: ApiRecord; groups?: string[] }

export interface OrderFilters {
  [key: string]: string | number | undefined;
  status?: string;
  staffId?: number;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  salesChannel?: string;
  paymentMethod?: string;
}

export interface OrderListResponse {
  rows: ApiRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export function getOrders(filters?: OrderFilters) {
  return apiRequest<ApiEnvelope<ApiRecord[], PagedMeta>>(`/orders?${toQueryString(filters ?? {})}`);
}

export function getOrder(id: number) {
  return apiRequest<ApiEnvelope<ApiRecord>>(`/orders/${id}`);
}

export function getCustomers(filters: ApiRecord) {
  return apiRequest<ApiEnvelope<ApiRecord[], PagedMeta>>(`/customers?${toQueryString(filters)}`);
}

export function getCustomer(id: number) {
  return apiRequest<ApiEnvelope<ApiRecord>>(`/customers/${id}`);
}

export function createCustomer(body: {
  name: string;
  code?: string;
  phone?: string;
  dob?: string | null;
  gender?: string | null;
  email?: string | null;
  facebook?: string | null;
  customerGroup?: string;
}) {
  return apiRequest<ApiEnvelope<ApiRecord>>('/customers', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateCustomer(
  id: number,
  body: {
    name: string;
    code?: string;
    phone?: string;
    dob?: string | null;
    gender?: string | null;
    email?: string | null;
    facebook?: string | null;
    customerGroup?: string;
  }
) {
  return apiRequest<ApiEnvelope<ApiRecord>>(`/customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function getCustomerActivity(id: number, kind: string) {
  return apiRequest<ApiEnvelope<ApiRecord[]>>(`/customers/${id}/activity/${kind}`);
}

export function getCustomerCards(filters: ApiRecord) {
  return apiRequest<ApiEnvelope<ApiRecord[], PagedMeta>>(`/customers/packages?${toQueryString(filters)}`);
}

export function getCustomerCard(itemType: string, id: number) {
  return apiRequest<ApiEnvelope<ApiRecord>>(`/customers/packages/${itemType}/${id}`);
}
