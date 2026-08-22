import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MobileNotificationsView } from './MobileNotificationsView';

describe('MobileNotificationsView Component', () => {
  it('renders title and filter tabs', () => {
    render(<MobileNotificationsView />);

    expect(screen.getByRole('heading', { name: /Thông báo/i })).toBeInTheDocument();

    // Tabs
    expect(screen.getByRole('button', { name: 'Tất cả' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lịch hẹn' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hệ thống' })).toBeInTheDocument();
  });

  it('shows empty state when no notifications', () => {
    render(<MobileNotificationsView />);

    expect(screen.getByText('Không có thông báo nào')).toBeInTheDocument();
    expect(screen.getByText('Bạn đã cập nhật tất cả thông báo mới nhất.')).toBeInTheDocument();
  });

  it('shows empty state when switching tabs with no notifications', () => {
    render(<MobileNotificationsView />);

    fireEvent.click(screen.getByRole('button', { name: 'Lịch hẹn' }));
    expect(screen.getByText('Không có thông báo nào')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hệ thống' }));
    expect(screen.getByText('Không có thông báo nào')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tất cả' }));
    expect(screen.getByText('Không có thông báo nào')).toBeInTheDocument();
  });
});
