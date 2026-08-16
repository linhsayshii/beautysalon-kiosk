import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MobileNotificationsView } from './MobileNotificationsView';

describe('MobileNotificationsView Component', () => {
  it('renders title, unread count, filter tabs, and notifications', () => {
    render(<MobileNotificationsView />);

    expect(screen.getByRole('heading', { name: /Thông báo/i })).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // 2 unread notifications by default

    // Tabs
    expect(screen.getByRole('button', { name: 'Tất cả' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lịch hẹn' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hệ thống' })).toBeInTheDocument();

    // Default notifications
    expect(screen.getByText('Lịch hẹn mới')).toBeInTheDocument();
    expect(screen.getByText('Hóa đơn hoàn thành')).toBeInTheDocument();
    expect(screen.getByText('Nhắc nhở chấm công')).toBeInTheDocument();
  });

  it('filters notifications by appointment tab', () => {
    render(<MobileNotificationsView />);

    fireEvent.click(screen.getByRole('button', { name: 'Lịch hẹn' }));

    expect(screen.getByText('Lịch hẹn mới')).toBeInTheDocument();
    expect(screen.getByText('Lịch hẹn sắp tới')).toBeInTheDocument();
    expect(screen.queryByText('Hóa đơn hoàn thành')).not.toBeInTheDocument();
  });

  it('filters notifications by system tab', () => {
    render(<MobileNotificationsView />);

    fireEvent.click(screen.getByRole('button', { name: 'Hệ thống' }));

    expect(screen.getByText('Hóa đơn hoàn thành')).toBeInTheDocument();
    expect(screen.getByText('Nhắc nhở chấm công')).toBeInTheDocument();
    expect(screen.getByText('Thông báo hệ thống')).toBeInTheDocument();
    expect(screen.queryByText('Lịch hẹn mới')).not.toBeInTheDocument();
  });

  it('marks all notifications as read when clicking "Đọc tất cả"', () => {
    render(<MobileNotificationsView />);

    const markAllBtn = screen.getByRole('button', { name: 'Đọc tất cả' });
    expect(markAllBtn).toBeInTheDocument();

    fireEvent.click(markAllBtn);

    // "Đọc tất cả" button disappears once all are read
    expect(screen.queryByRole('button', { name: 'Đọc tất cả' })).not.toBeInTheDocument();
    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });

  it('marks single notification as read on click', () => {
    render(<MobileNotificationsView />);

    const unreadItem = screen.getByText('Lịch hẹn mới').closest('article');
    expect(unreadItem).toHaveClass('is-unread');

    fireEvent.click(unreadItem!);

    expect(unreadItem).not.toHaveClass('is-unread');
  });
});
