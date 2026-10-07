import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MobileNotificationsView } from './MobileNotificationsView';
import * as notificationsApi from './notifications.api';

vi.mock('@/features/auth/AuthProvider', () => ({ useAuth: () => ({ account: { role: 'manager' } }) }));

describe('MobileNotificationsView Component', () => {
  beforeEach(() => {
    vi.spyOn(notificationsApi, 'getNotifications').mockResolvedValue({
      data: [],
      meta: { unreadCount: 0, pagination: { page: 1, pageSize: 100, total: 0, totalPages: 1 } },
    });
  });

  const renderView = () => render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MobileNotificationsView />
      </QueryClientProvider>
    </MemoryRouter>,
  );

  it('renders title and filter tabs', () => {
    renderView();

    expect(screen.getByRole('heading', { name: /Thông báo/i })).toBeInTheDocument();

    // Tabs
    expect(screen.getByRole('tab', { name: 'Tất cả' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Lịch hẹn' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Hệ thống' })).toBeInTheDocument();
  });

  it('shows empty state when no notifications', async () => {
    renderView();

    expect(await screen.findByText('Không có thông báo nào')).toBeInTheDocument();
    expect(screen.getByText('Bạn đã cập nhật tất cả thông báo mới nhất.')).toBeInTheDocument();
  });

  it('shows empty state when switching tabs with no notifications', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Không có thông báo nào')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('tab', { name: 'Lịch hẹn' }));
    expect(screen.getByText('Không có thông báo nào')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Hệ thống' }));
    expect(screen.getByText('Không có thông báo nào')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Tất cả' }));
    expect(screen.getByText('Không có thông báo nào')).toBeInTheDocument();
  });
});
