import { apiRequest } from '@/services/api-client';
import type { AuthAccount } from '@/features/auth/AuthProvider';
export const updateMyProfile = (body: Pick<AuthAccount, 'username' | 'displayName' | 'phone' | 'email'>) => apiRequest<{ data: AuthAccount }>('/auth/me', { method: 'PATCH', body: JSON.stringify(body) });
export const changeMyPassword = (body: { currentPassword: string; newPassword: string }) => apiRequest<{ data: { changed: boolean } }>('/auth/me/password', { method: 'POST', body: JSON.stringify(body) });
