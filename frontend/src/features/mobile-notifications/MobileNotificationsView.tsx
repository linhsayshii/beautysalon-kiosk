import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { relativeTime } from '@/lib/format';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from './notifications.api';
import './mobile-notifications.css';

export interface MobileNotificationItem {
  id: string;
  type: 'appointment' | 'invoice' | 'system' | 'attendance';
  title: string;
  detail: string;
  timeAgo: string;
  isRead: boolean;
  category: 'appointment' | 'system';
}

type FilterTab = 'all' | 'appointment' | 'system';

export function MobileNotificationsView() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    refetchInterval: 30_000,
  });
  const notifications = useMemo<MobileNotificationItem[]>(() => (
    (notificationsQuery.data?.data ?? []).map((item) => ({
      id: String(item.id), type: item.type, title: item.title, detail: item.detail,
      timeAgo: relativeTime(item.createdAt), isRead: item.isRead,
      category: item.type === 'appointment' ? 'appointment' : 'system',
    }))
  ), [notificationsQuery.data]);

  const readMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const readAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const filteredNotifications = useMemo(() => {
    if (activeTab === 'all') return notifications;
    return notifications.filter((item) => item.category === activeTab);
  }, [notifications, activeTab]);

  const unreadCount = useMemo(() => {
    return notifications.filter((item) => !item.isRead).length;
  }, [notifications]);

  const getIconClass = (type: MobileNotificationItem['type']) => {
    switch (type) {
      case 'appointment':
        return 'ph ph-calendar-check';
      case 'invoice':
        return 'ph ph-receipt';
      case 'attendance':
        return 'ph ph-clock-user';
      case 'system':
      default:
        return 'ph ph-bell-ringing';
    }
  };

  return (
    <div className="mobile-notifications-container">
      {/* Header */}
      <header className="mobile-notifications-header">
        <h1 className="mobile-notifications-title">
          Thông báo
          {unreadCount > 0 && (
            <span className="mobile-notifications-unread-count">{unreadCount}</span>
          )}
        </h1>
        {unreadCount > 0 && (
          <button type="button" className="mobile-notifications-readall-btn" onClick={() => readAllMutation.mutate()} disabled={readAllMutation.isPending}>
            Đánh dấu đã đọc
          </button>
        )}
      </header>

      {/* Tabs */}
      <div className="mobile-notifications-tabs">
        <button
          type="button"
          className={`mobile-notifications-tab-btn ${activeTab === 'all' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          Tất cả
        </button>
        <button
          type="button"
          className={`mobile-notifications-tab-btn ${activeTab === 'appointment' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('appointment')}
        >
          Lịch hẹn
        </button>
        <button
          type="button"
          className={`mobile-notifications-tab-btn ${activeTab === 'system' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('system')}
        >
          Hệ thống
        </button>
      </div>

      {/* Notification List */}
      <main className="mobile-notifications-list">
        {notificationsQuery.isPending ? (
          <div className="mobile-notifications-empty"><p className="mobile-notifications-empty-text">Đang tải thông báo…</p></div>
        ) : notificationsQuery.error ? (
          <div className="mobile-notifications-empty"><p className="mobile-notifications-empty-text">Không thể tải thông báo</p></div>
        ) : filteredNotifications.length === 0 ? (
          <div className="mobile-notifications-empty">
            <div className="mobile-notifications-empty-icon">
              <i className="ph ph-bell-slash" />
            </div>
            <p className="mobile-notifications-empty-text">Không có thông báo nào</p>
            <p className="mobile-notifications-empty-subtext">
              Bạn đã cập nhật tất cả thông báo mới nhất.
            </p>
          </div>
        ) : (
          filteredNotifications.map((item) => (
            <article
              key={item.id}
              className={`mobile-notification-card ${!item.isRead ? 'is-unread' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (!item.isRead) readMutation.mutate(Number(item.id));
                const targetPath = notificationsQuery.data?.data.find((record) => String(record.id) === item.id)?.targetPath;
                if (targetPath) navigate(targetPath);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') event.currentTarget.click();
              }}
            >
              <div className={`mobile-notification-icon ${item.type}`}>
                <i className={getIconClass(item.type)} />
              </div>
              <div className="mobile-notification-content">
                <div className="mobile-notification-header-row">
                  <span className="mobile-notification-title-text">{item.title}</span>
                  <span className="mobile-notification-time">{item.timeAgo}</span>
                </div>
                <p className="mobile-notification-detail-text">{item.detail}</p>
              </div>
            </article>
          ))
        )}
      </main>
    </div>
  );
}
