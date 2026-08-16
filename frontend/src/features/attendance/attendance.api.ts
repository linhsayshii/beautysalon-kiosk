import { apiRequest, type ApiEnvelope } from '@/services/api-client';
import type { ApiRecord } from '@/types/api';

export const getAttendanceChallenge = () => apiRequest<ApiEnvelope<ApiRecord>>('/attendance/challenge');
export const getAttendanceLocation = () => apiRequest<ApiEnvelope<ApiRecord>>('/attendance/location');
export const updateAttendanceLocation = (body: ApiRecord) => apiRequest<ApiEnvelope<ApiRecord>>('/attendance/location', { method: 'PUT', body: JSON.stringify(body) });
export const getMyAttendance = () => apiRequest<ApiEnvelope<ApiRecord | null>>('/attendance/me');
export const scanAttendance = (body: ApiRecord) => apiRequest<ApiEnvelope<ApiRecord>>('/attendance/scan', { method: 'POST', body: JSON.stringify(body) });
