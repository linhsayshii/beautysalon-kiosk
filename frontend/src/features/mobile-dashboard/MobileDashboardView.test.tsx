import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MobileDashboardView } from './MobileDashboardView';
import * as dashApi from '@/features/dashboard/dashboard.api';

describe('MobileDashboardView Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(dashApi, 'getDashboardStats').mockResolvedValue({
      data: {
        revenue: 15500000,
        netRevenue: 14200000,
        completedOrders: 12,
        newCustomers: 4,
        occupancyRate: 85,
        dailyTarget: 20000000,
      } as any,
      meta: {} as any,
    });
    vi.spyOn(dashApi, 'getDashboardCharts').mockResolvedValue({ data: [] as any, meta: {} as any });
  });

  it('renders KPI revenue cards and quick metric list', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><MobileDashboardView /></MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Doanh thu hôm nay')).toBeInTheDocument();
      expect(screen.getByText(/15,500,000/i)).toBeInTheDocument();
      expect(screen.getByText('12 đơn')).toBeInTheDocument();
    });
  });
});
