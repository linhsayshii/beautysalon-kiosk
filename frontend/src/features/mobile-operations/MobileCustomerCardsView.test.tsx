import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MobileCustomerCardsView } from './MobileCustomerCardsView';
import * as opsApi from '@/features/operations/operations.api';

describe('MobileCustomerCardsView Component', () => {
  let queryClient: QueryClient;

  const mockCardsResponse = {
    data: [
      {
        id: 1,
        code: 'GOI001',
        itemName: 'Combo Gội Đầu Dưỡng Sinh 10 Buổi',
        itemType: 'package',
        status: 'active',
        soldAt: '2026-08-01T10:00:00Z',
        expiresAt: '2026-12-31T00:00:00Z',
        salePrice: 2500000,
        usedUnits: 4,
        totalUnits: 10,
        remainingUnits: 6,
        customer: { id: 1, name: 'Nguyễn Văn A', code: 'KH001', phone: '0901234567' },
      },
      {
        id: 2,
        code: 'THE001',
        itemName: 'Thẻ VIP Trả Trước 5 Triệu',
        itemType: 'account_card',
        status: 'active',
        soldAt: '2026-07-15T14:00:00Z',
        expiresAt: '2027-07-15T00:00:00Z',
        salePrice: 5000000,
        openingBalance: 5000000,
        currentBalance: 3200000,
        customer: { id: 2, name: 'Trần Thị B', code: 'KH002', phone: '0988888888' },
      },
    ],
    meta: {
      pagination: { page: 1, pageSize: 50, total: 2, totalPages: 1 },
      summary: {
        totalUsed: 4,
        totalBalance: 3200000,
      },
    },
  };

  const mockCardDetail = {
    data: {
      id: 1,
      code: 'GOI001',
      itemName: 'Combo Gội Đầu Dưỡng Sinh 10 Buổi',
      itemType: 'package',
      status: 'active',
      soldAt: '2026-08-01T10:00:00Z',
      expiresAt: '2026-12-31T00:00:00Z',
      salePrice: 2500000,
      usedUnits: 4,
      totalUnits: 10,
      remainingUnits: 6,
      customer: { id: 1, name: 'Nguyễn Văn A', code: 'KH001', phone: '0901234567' },
      services: [
        { id: 10, code: 'DV01', name: 'Gội đầu dưỡng sinh thảo dược', unitPrice: 250000 },
      ],
      usages: [
        {
          id: 101,
          occurredAt: '2026-08-05T11:00:00Z',
          serviceName: 'Gội đầu dưỡng sinh thảo dược',
          unitsUsed: 1,
          invoiceCode: 'HD001',
          note: 'Trừ 1 buổi',
        },
      ],
    },
  };

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(opsApi, 'getCustomerCards').mockResolvedValue(mockCardsResponse as any);
    vi.spyOn(opsApi, 'getCustomerCard').mockResolvedValue(mockCardDetail as any);
  });

  it('renders header title, search/sort triggers, summary bar and grouped card list without metric boxes', async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <MobileCustomerCardsView />
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Gói & Thẻ đã bán' })).toBeInTheDocument();

    // Ensure NO metric cards exist
    expect(screen.queryByText('Tổng gói/thẻ đã bán')).not.toBeInTheDocument();
    expect(screen.queryByText('Lượt đã dùng')).not.toBeInTheDocument();
    expect(screen.queryByText('Số dư thẻ')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('2 gói, thẻ đã bán')).toBeInTheDocument();
      expect(screen.getByText('GÓI DỊCH VỤ')).toBeInTheDocument();
      expect(screen.getByText('THẺ TÀI KHOẢN')).toBeInTheDocument();
      expect(screen.getByText('Combo Gội Đầu Dưỡng Sinh 10 Buổi')).toBeInTheDocument();
      expect(screen.getByText('Thẻ VIP Trả Trước 5 Triệu')).toBeInTheDocument();
      expect(screen.getByText('4/10 lượt')).toBeInTheDocument();
      expect(screen.getByText('Còn 6 lượt')).toBeInTheDocument();
    });
  });

  it('opens and applies filter sheet for card types and status', async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <MobileCustomerCardsView />
        </QueryClientProvider>
      </MemoryRouter>
    );

    const filterBtn = screen.getByLabelText('Mở bộ lọc');
    fireEvent.click(filterBtn);

    expect(screen.getByText('Bộ lọc gói thẻ')).toBeInTheDocument();
    expect(screen.getByText('Loại hàng')).toBeInTheDocument();
    expect(screen.getAllByText('Trạng thái').length).toBeGreaterThan(0);

    const applyBtn = screen.getByRole('button', { name: 'Áp dụng' });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(screen.queryByText('Bộ lọc gói thẻ')).not.toBeInTheDocument();
    });
  });

  it('opens detail sheet with package information and usage history when card item is clicked', async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <MobileCustomerCardsView />
        </QueryClientProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Combo Gội Đầu Dưỡng Sinh 10 Buổi')).toBeInTheDocument();
    });

    const cardRow = screen.getByText('Combo Gội Đầu Dưỡng Sinh 10 Buổi').closest('.mobile-operations-row-item');
    fireEvent.click(cardRow!);

    await waitFor(() => {
      expect(screen.getByText('Dịch vụ trong gói')).toBeInTheDocument();
      expect(screen.getByText('Lịch sử sử dụng')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/HD001/)).toBeInTheDocument();
      expect(screen.getByText('-1 lượt')).toBeInTheDocument();
    });
  });
});
