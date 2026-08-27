import { apiRequest, type ApiEnvelope } from '@/services/api-client';

export interface NotificationRecord {
  id: number;
  type: 'appointment' | 'invoice' | 'system' | 'attendance';
  title: string;
  detail: string;
  targetPath: string | null;
  createdAt: string;
  isRead: boolean;
}

interface NotificationMeta {
  unreadCount: number;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

const getPage = (page: number) => apiRequest<ApiEnvelope<NotificationRecord[], NotificationMeta>>(
  `/notifications?page=${page}&pageSize=100`,
);

export async function getNotifications() {
  const first = await getPage(1);
  const totalPages = first.meta.pagination.totalPages;
  if (totalPages <= 1) return first;
  const rest = await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => getPage(index + 2)));
  return { ...first, data: [first, ...rest].flatMap((response) => response.data) };
}

export const markNotificationRead = (id: number) => apiRequest<ApiEnvelope<{ success: boolean }>>(`/notifications/${id}/read`, { method: 'POST' });
export const markAllNotificationsRead = () => apiRequest<ApiEnvelope<{ success: boolean }>>('/notifications/read-all', { method: 'POST' });
