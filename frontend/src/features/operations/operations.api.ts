import { apiRequest, toQueryString } from '@/services/api-client';
import type { ApiEnvelope } from '@/services/api-client';
import type { ApiRecord, Pagination } from '@/types/api';

export interface PagedMeta { pagination: Pagination; summary: ApiRecord; groups?: string[] }

export function getOrders(filters: ApiRecord) {
  return apiRequest<ApiEnvelope<ApiRecord[], PagedMeta>>(`/orders?${toQueryString(filters)}`);
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

export function getCustomerActivity(id: number, kind: string) {
  return apiRequest<ApiEnvelope<ApiRecord[]>>(`/customers/${id}/activity/${kind}`);
}

export function getCustomerCards(filters: ApiRecord) {
  return apiRequest<ApiEnvelope<ApiRecord[], PagedMeta>>(`/customers/packages?${toQueryString(filters)}`);
}

export function getCustomerCard(itemType: string, id: number) {
  return apiRequest<ApiEnvelope<ApiRecord>>(`/customers/packages/${itemType}/${id}`);
}
