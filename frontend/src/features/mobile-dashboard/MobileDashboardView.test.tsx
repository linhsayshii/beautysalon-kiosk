import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MobileDashboardView } from './MobileDashboardView';
import * as dashApi from '@/features/dashboard/dashboard.api';

describe('MobileDashboardView Component', () => {
  let queryClient: QueryClient;

  const mockFullDashboard = {
    meta: {
      branch: { id: 1, name: 'Chi nhánh Quận 1' },
      availableBranches: [{ id: 1, name: 'Chi nhánh Quận 1' }],
    },
    summary: {
      appointments: { total: 18, completed: 14, changePercent: 5.2, completionRate: 85.5 },
      customers: { total: 32, new: 8, returning: 18, walkIn: 6 },
      cash: { income: 15500000, expense: 3200000 },
    },
    month: {
      customers: 32,
      revenue: 15500000,
      invoices: 12,
      returns: 0,
    },
    charts: {
      customersByHour: [{ label: '08:00', value: 1 }],
      customersByDay: [{ label: '16/08', value: 12 }],
      customersByWeekday: [{ label: 'Thứ 2', value: 12 }],
      revenueByHour: [{ label: '08:00', value: 500000 }],
      revenueByDay: [{ label: '16/08', value: 15500000 }],
      revenueByWeekday: [{ label: 'Thứ 2', value: 15500000 }],
    },
    topGoods: [
      { id: 1, name: 'Gội đầu dưỡng sinh thảo dược', code: 'DV01', revenue: 4200000, quantity: 14, itemType: 'service' },
      { id: 2, name: 'Chăm sóc da mặt Glow Skin', code: 'DV02', revenue: 3800000, quantity: 8, itemType: 'service' },
    ],
    reminders: {
      customersInDebt: 3,
      productsBelowStock: 2,
      productsAboveStock: 0,
    },
    upcomingAppointments: [
      { id: 101, customerName: 'Chị Mai Lan', serviceName: 'Gội đầu dưỡng sinh', time: '14:30' },
    ],
    activities: [
      { id: 1, actorName: 'Nguyễn KTV', description: 'hoàn tất dịch vụ', occurredAt: '2026-08-16T10:00:00Z', avatarTone: 'blue' },
    ],
  };

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(dashApi, 'getDashboard').mockResolvedValue({
      data: mockFullDashboard as any,
      meta: {} as any,
    });
  });

  it('renders all full desktop dashboard cards arranged vertically', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><MobileDashboardView /></MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      // 1. Header & Branch
      expect(screen.getByText('Tổng quan hoạt động')).toBeInTheDocument();
      expect(screen.getByText('Chi nhánh Quận 1')).toBeInTheDocument();

      // 2. Stats cards: Lịch hẹn, Khách hàng, Thu chi
      expect(screen.getByText('Lịch hẹn')).toBeInTheDocument();
      expect(screen.getByText('Khách hàng')).toBeInTheDocument();
      expect(screen.getByText('Thu chi hôm nay')).toBeInTheDocument();

      // 3. Top goods
      expect(screen.getByText('Top 5 hàng hóa bán chạy')).toBeInTheDocument();

      // 4. Reminders & Activities
      expect(screen.getByText('Nhắc việc')).toBeInTheDocument();
      expect(screen.getByText('Hoạt động gần đây')).toBeInTheDocument();
    });
  });
});


