import { apiRequest, toQueryString } from '@/services/api-client';
import type { ApiEnvelope } from '@/services/api-client';
import type { ApiRecord, Pagination } from '@/types/api';

export interface InventoryMeta { pagination: Pagination; summary?: ApiRecord; pricebook?: ApiRecord | null; pricebooks?: ApiRecord[]; categories?: string[] }

export type InventoryItemType = 'product' | 'service' | 'package' | 'account_card';

export interface Pricebook {
  id: number;
  code: string;
  name: string;
  active: boolean;
  isDefault: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  createdAt: string;
}

export interface CreatePricebookInput {
  code: string;
  name: string;
  active?: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  copyFromDefault?: boolean;
}

export interface UpdatePricebookInput {
  name?: string;
  active?: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}

export interface CreateInventoryItemInput extends ApiRecord {
  type: InventoryItemType;
  name: string;
  commissionType?: 'percent' | 'fixed' | null;
  commissionRate?: number;
}

export const getProducts = (filters: ApiRecord) => apiRequest<ApiEnvelope<ApiRecord[], InventoryMeta>>(`/inventory/products?${toQueryString(filters)}`);
export const getInventoryItem = (itemType: string, itemId: number) => apiRequest<ApiEnvelope<ApiRecord>>(`/inventory/items/${itemType}/${itemId}`);
export const createInventoryItem = (body: CreateInventoryItemInput) => apiRequest<ApiEnvelope<ApiRecord>>('/inventory/items', { method: 'POST', body: JSON.stringify(body) });
export const updateInventoryItem = (itemType: string, itemId: number, body: ApiRecord) =>
  apiRequest<ApiEnvelope<ApiRecord>>(`/inventory/items/${itemType}/${itemId}`, { method: 'PUT', body: JSON.stringify(body) });
export const getPricebooks = (filters: ApiRecord) => apiRequest<ApiEnvelope<ApiRecord[], InventoryMeta>>(`/inventory/pricebooks?${toQueryString(filters)}`);
export const getPricebook = (pricebookId: number) => apiRequest<ApiEnvelope<Pricebook>>(`/inventory/pricebooks/${pricebookId}`);
export const createPricebook = (body: CreatePricebookInput) => apiRequest<ApiEnvelope<Pricebook>>('/inventory/pricebooks', { method: 'POST', body: JSON.stringify(body) });
export const updatePricebook = (pricebookId: number, body: UpdatePricebookInput) => apiRequest<ApiEnvelope<Pricebook>>(`/inventory/pricebooks/${pricebookId}`, { method: 'PUT', body: JSON.stringify(body) });
export const deletePricebook = (pricebookId: number) => apiRequest<ApiEnvelope<{ deleted: boolean }>>(`/inventory/pricebooks/${pricebookId}`, { method: 'DELETE' });
export const updatePrice = (pricebookId: number, itemType: string, itemId: number, salePrice: number) => apiRequest(`/inventory/pricebooks/${pricebookId}/items/${itemType}/${itemId}`, { method: 'PATCH', body: JSON.stringify({ salePrice }) });
export const getPurchaseOrders = (filters: ApiRecord) => apiRequest<ApiEnvelope<ApiRecord[], InventoryMeta>>(`/inventory/purchase-orders?${toQueryString(filters)}`);
export const getPurchaseOrder = (id: number) => apiRequest<ApiEnvelope<ApiRecord>>(`/inventory/purchase-orders/${id}`);
export const getSuppliers = () => apiRequest<ApiEnvelope<ApiRecord[]>>('/inventory/suppliers');
export const createPurchaseOrder = (body: ApiRecord) => apiRequest<ApiEnvelope<ApiRecord>>('/inventory/purchase-orders', { method: 'POST', body: JSON.stringify(body) });
