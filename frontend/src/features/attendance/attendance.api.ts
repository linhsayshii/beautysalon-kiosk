import { apiRequest, type ApiEnvelope } from '@/services/api-client';
import type { ApiRecord } from '@/types/api';

export const getAttendanceChallenge = () => apiRequest<ApiEnvelope<ApiRecord>>('/attendance/challenge');
export const getAttendanceLocation = () => apiRequest<ApiEnvelope<ApiRecord>>('/attendance/location');
export const updateAttendanceLocation = (body: ApiRecord) => apiRequest<ApiEnvelope<ApiRecord>>('/attendance/location', { method: 'PUT', body: JSON.stringify(body) });
export const getMyAttendance = () => apiRequest<ApiEnvelope<ApiRecord | null>>('/attendance/me');
export const scanAttendance = (body: ApiRecord) => apiRequest<ApiEnvelope<ApiRecord>>('/attendance/scan', { method: 'POST', body: JSON.stringify(body) });

/**
 * Poll the rotating QR when the current token expires, not every second:
 * a salon behind one public IP shares the API rate limit with every device.
 */
export const challengeRefetchInterval = (query: { state: { data?: unknown } }) => {
  const expiresAt = (query.state.data as { data?: { expiresAt?: string } } | undefined)?.data?.expiresAt;
  if (!expiresAt) return 1_000;
  return Math.min(15_000, Math.max(500, new Date(expiresAt).getTime() - Date.now() + 250));
};
