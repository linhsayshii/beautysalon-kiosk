import { useState, useMemo } from 'react';
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

// TODO: Integrate with backend notification API when available
const EMPTY_NOTIFICATIONS: MobileNotificationItem[] = [];

export function MobileNotificationsView() {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [notifications] = useState<MobileNotificationItem[]>(EMPTY_NOTIFICATIONS);

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
        {filteredNotifications.length === 0 ? (
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
