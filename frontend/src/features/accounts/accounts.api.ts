import { apiRequest, type ApiEnvelope } from '@/services/api-client';
import type { ApiRecord } from '@/types/api';

export const getAccounts = () => apiRequest<ApiEnvelope<ApiRecord[]>>('/auth/accounts');
export const createAccount = (body: ApiRecord) => apiRequest<ApiEnvelope<ApiRecord>>('/auth/accounts', { method: 'POST', body: JSON.stringify(body) });
export const updateAccount = (id: number, body: ApiRecord) => apiRequest<ApiEnvelope<ApiRecord>>(`/auth/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
