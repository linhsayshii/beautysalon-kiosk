import { apiRequest, toQueryString } from '@/services/api-client';
import type { ApiEnvelope } from '@/services/api-client';
import type { ApiRecord, Pagination } from '@/types/api';

export interface InventoryMeta { pagination: Pagination; summary?: ApiRecord; pricebook?: ApiRecord | null; pricebooks?: ApiRecord[]; categories?: string[] }

export type InventoryItemType = 'product' | 'service' | 'package' | 'account_card';

export interface CreateInventoryItemInput extends ApiRecord {
  type: InventoryItemType;
  name: string;
}

export const getProducts = (filters: ApiRecord) => apiRequest<ApiEnvelope<ApiRecord[], InventoryMeta>>(`/inventory/products?${toQueryString(filters)}`);
export const createInventoryItem = (body: CreateInventoryItemInput) => apiRequest<ApiEnvelope<ApiRecord>>('/inventory/items', { method: 'POST', body: JSON.stringify(body) });
export const updateInventoryItem = (itemType: string, itemId: number, body: ApiRecord) =>
  apiRequest<ApiEnvelope<ApiRecord>>(`/inventory/items/${itemType}/${itemId}`, { method: 'PUT', body: JSON.stringify(body) });
export const getPricebooks = (filters: ApiRecord) => apiRequest<ApiEnvelope<ApiRecord[], InventoryMeta>>(`/inventory/pricebooks?${toQueryString(filters)}`);
export const updatePrice = (pricebookId: number, itemType: string, itemId: number, salePrice: number) => apiRequest(`/inventory/pricebooks/${pricebookId}/items/${itemType}/${itemId}`, { method: 'PATCH', body: JSON.stringify({ salePrice }) });
export const getPurchaseOrders = (filters: ApiRecord) => apiRequest<ApiEnvelope<ApiRecord[], InventoryMeta>>(`/inventory/purchase-orders?${toQueryString(filters)}`);
export const getPurchaseOrder = (id: number) => apiRequest<ApiEnvelope<ApiRecord>>(`/inventory/purchase-orders/${id}`);
export const getSuppliers = () => apiRequest<ApiEnvelope<ApiRecord[]>>('/inventory/suppliers');
export const createPurchaseOrder = (body: ApiRecord) => apiRequest<ApiEnvelope<ApiRecord>>('/inventory/purchase-orders', { method: 'POST', body: JSON.stringify(body) });
