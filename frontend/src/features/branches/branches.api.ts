import { apiRequest, type ApiEnvelope } from '@/services/api-client';
import type { ApiRecord } from '@/types/api';
export const getBranches = () => apiRequest<ApiEnvelope<ApiRecord[]>>('/branches');
export const createBranch = (body: ApiRecord) => apiRequest<ApiEnvelope<ApiRecord>>('/branches', { method: 'POST', body: JSON.stringify(body) });
export const updateBranch = (id: number, body: ApiRecord) => apiRequest<ApiEnvelope<ApiRecord>>(`/branches/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const deactivateBranch = (id: number) => apiRequest<ApiEnvelope<ApiRecord>>(`/branches/${id}`, { method: 'DELETE' });
