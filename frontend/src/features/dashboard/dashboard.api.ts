import { apiRequest } from '@/services/api-client';
import type { ApiEnvelope } from '@/services/api-client';
import type { ApiRecord } from '@/types/api';

export const getDashboard = (date: string, period: string) => apiRequest<ApiEnvelope<ApiRecord>>(`/dashboard?date=${encodeURIComponent(date)}&period=${encodeURIComponent(period)}`);
export const getDashboardStats = (date?: string, period?: string) => apiRequest<ApiEnvelope<ApiRecord>>(`/dashboard?date=${encodeURIComponent(date || '')}&period=${encodeURIComponent(period || 'today')}`);
export const getDashboardCharts = (date?: string, period?: string) => apiRequest<ApiEnvelope<ApiRecord>>(`/dashboard?date=${encodeURIComponent(date || '')}&period=${encodeURIComponent(period || 'today')}`);

