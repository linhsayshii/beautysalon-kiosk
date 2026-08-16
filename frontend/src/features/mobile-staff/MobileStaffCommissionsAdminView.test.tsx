import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MobileStaffCommissionsAdminView } from './MobileStaffCommissionsAdminView';
import * as staffApi from '@/features/staff/staff.api';

describe('MobileStaffCommissionsAdminView Component', () => {
  let queryClient: QueryClient;

  const mockCommissionsResponse = {
    data: {
      rows: [
        {
          id: 1,
          invoiceCode: 'HD00109',
          staffId: 4,
          staffName: 'Thu Phương',
          staffCode: 'NV000016',
          commissionType: 'service',
          itemName: 'Gội đầu dưỡng sinh thảo dược',
          revenue: 250000,
          amount: 50000,
          ratePercent: 20,
          createdAt: '2026-08-17 10:30',
        },
        {
          id: 2,
          invoiceCode: 'HD00110',
          staffId: 4,
          staffName: 'Thu Phương',
          staffCode: 'NV000016',
          commissionType: 'consulting',
          itemName: 'Serum Dưỡng Trắng Innisfree',
          revenue: 450000,
          amount: 45000,
          ratePercent: 10,
          createdAt: '2026-08-17 11:15',
        },
      ],
      byStaff: [
        {
          staffId: 4,
          staffName: 'Thu Phương',
          staffCode: 'NV000016',
          staffRole: 'Kỹ thuật viên chính',
          serviceCommission: 2400000,
          consultingCommission: 800000,
          totalCommission: 3200000,
          totalRevenue: 16000000,
          itemCount: 42,
        },
      ],
    },
  };

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(staffApi, 'getCommissions').mockResolvedValue(mockCommissionsResponse as any);
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MobileStaffCommissionsAdminView />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('renders title, summary text and staff commission rows without metric cards', async () => {
    renderComponent();

    expect(screen.getByText('Bảng hoa hồng')).toBeInTheDocument();

    // Underline tabs
    expect(screen.getByRole('tab', { name: /Theo nhân viên/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Chi tiết giao dịch/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Thu Phương')).toBeInTheDocument();
      expect(screen.getByText('NV000016')).toBeInTheDocument();
    });
  });

  it('switches to transaction details tab and displays invoice items', async () => {
    renderComponent();

    const detailsTab = screen.getByRole('tab', { name: /Chi tiết giao dịch/i });
    fireEvent.click(detailsTab);

    await waitFor(() => {
      expect(screen.getByText('Gội đầu dưỡng sinh thảo dược')).toBeInTheDocument();
      expect(screen.getByText('Serum Dưỡng Trắng Innisfree')).toBeInTheDocument();
    });
  });

  it('opens staff summary bottom sheet on row click', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Thu Phương')).toBeInTheDocument();
    });

    const staffRow = screen.getByText('Thu Phương').closest('.mobile-grouped-row');
    fireEvent.click(staffRow!);

    await waitFor(() => {
      expect(screen.getByText('Tổng hợp hoa hồng nhân viên')).toBeInTheDocument();
      expect(screen.getByText('Chi tiết phân loại hoa hồng')).toBeInTheDocument();
      expect(screen.getByText('Hoa hồng làm dịch vụ')).toBeInTheDocument();
    });
  });
});
