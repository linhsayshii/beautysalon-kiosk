import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MobileCustomersView } from './MobileCustomersView';
import * as opsApi from '@/features/operations/operations.api';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { WebSocketProvider } from '@/context/WebSocketContext';
import { ToastProvider } from '@/components/ui/Toast/ToastProvider';

vi.mock('@/services/websocket', () => ({
  createPosSocketConnection: vi.fn(() => ({
    isConnected: () => true,
    disconnect: vi.fn(),
  })),
}));

describe('MobileCustomersView Component', () => {
  let queryClient: QueryClient;

  const mockCustomersResponse = {
    data: [
      {
        id: 1,
        name: 'Nguyễn Văn A',
        code: 'KH001',
        phone: '0901234567',
        group: 'Cá nhân',
        activePackages: 2,
        totalSpent: 5000000,
        debtBalance: 200000,
        lastVisit: '2026-08-15T09:00:00Z',
      },
      {
        id: 2,
        name: 'Công ty TNHH B',
        code: 'KH002',
        phone: '0987654321',
        group: 'Công ty',
        activePackages: 0,
        totalSpent: 12000000,
        debtBalance: 0,
        lastVisit: '2026-08-10T14:00:00Z',
      },
    ],
    meta: {
      pagination: { page: 1, pageSize: 50, total: 2, totalPages: 1 },
      summary: {
        totalCustomers: 2,
        customersInDebt: 1,
        totalDebt: 200000,
      },
    },
  };

  const mockCustomerDetail = {
    data: {
      id: 1,
      name: 'Nguyễn Văn A',
      code: 'KH001',
      phone: '0901234567',
      email: 'nguyenvana@gmail.com',
      group: 'Cá nhân',
      activePackages: 2,
      totalSpent: 5000000,
      debtBalance: 200000,
      cardBalance: 1500000,
      visitCount: 6,
      lastVisit: '2026-08-15T09:00:00Z',
      address: '123 Đường ABC, Quận 1',
      createdAt: '2026-01-10T00:00:00Z',
      notes: 'Khách VIP thích massage vai gáy',
    },
  };

  const mockOrdersActivity = {
    data: [
      {
        id: 101,
        code: 'HD001',
        occurredAt: '2026-08-15T09:30:00Z',
        paymentMethod: 'bank_transfer',
        amount: 850000,
        status: 'paid',
      },
    ],
  };

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(opsApi, 'getCustomers').mockResolvedValue(mockCustomersResponse as any);
    vi.spyOn(opsApi, 'getCustomer').mockResolvedValue(mockCustomerDetail as any);
    vi.spyOn(opsApi, 'getCustomerActivity').mockResolvedValue(mockOrdersActivity as any);
  });

  it('renders header title, search/sort triggers, summary bar and customer rows without metric boxes', async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <WebSocketProvider>
            <AuthProvider>
              <MobileCustomersView />
            </AuthProvider>
          </WebSocketProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Khách hàng' })).toBeInTheDocument();

    // Ensure NO metric cards/summary boxes exist
    expect(screen.queryByText('Tổng khách hàng')).not.toBeInTheDocument();
    expect(screen.queryByText('Khách đang nợ')).not.toBeInTheDocument();
    expect(screen.queryByText('Tổng công nợ')).not.toBeInTheDocument();

    // Summary bar & FAB
    expect(screen.getByLabelText('Thêm khách hàng')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/2 khách/)).toBeInTheDocument();
      // Customer items
      expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
      expect(screen.getByText('Công ty TNHH B')).toBeInTheDocument();


    });
  });

  it('retains server sorting across customer groups', async () => {
    vi.mocked(opsApi.getCustomers).mockResolvedValue({ ...mockCustomersResponse, data: [
      mockCustomersResponse.data[0], mockCustomersResponse.data[1], { ...mockCustomersResponse.data[0], id: 3, name: 'Khách thứ ba' },
    ] } as any);
    const { container } = render(<MemoryRouter><QueryClientProvider client={queryClient}><WebSocketProvider><AuthProvider><MobileCustomersView /></AuthProvider></WebSocketProvider></QueryClientProvider></MemoryRouter>);
    await screen.findByText('Khách thứ ba');
    expect(Array.from(container.querySelectorAll('.m-list-title')).map(row => row.textContent)).toEqual(['Nguyễn Văn A', 'Công ty TNHH B', 'Khách thứ ba']);
  });

  it('opens and applies filter sheet' , async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <WebSocketProvider>
            <AuthProvider>
              <MobileCustomersView />
            </AuthProvider>
          </WebSocketProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );

    const filterBtn = screen.getByLabelText('Mở bộ lọc');
    fireEvent.click(filterBtn);

    expect(screen.getByText('Bộ lọc khách hàng')).toBeInTheDocument();
    expect(screen.getByText('Nhóm khách hàng')).toBeInTheDocument();
    expect(screen.getByText('Tình trạng công nợ')).toBeInTheDocument();

    // Click Apply
    const applyBtn = screen.getByRole('button', { name: 'Áp dụng' });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(screen.queryByText('Bộ lọc khách hàng')).not.toBeInTheDocument();
    });
  });

  it('opens customer detail sheet when customer row is clicked', async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <WebSocketProvider>
            <AuthProvider>
              <MobileCustomersView />
            </AuthProvider>
          </WebSocketProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    });

    const customerRow = screen.getByText('Nguyễn Văn A').closest('.m-list-row');
    fireEvent.click(customerRow!);

    await waitFor(() => {
      expect(screen.getByText('Hồ sơ khách hàng')).toBeInTheDocument();
      expect(screen.getByText('Sổ công nợ')).toBeInTheDocument();
      expect(screen.getByText('Lịch sử & Gói dịch vụ')).toBeInTheDocument();
      expect(screen.getByText('nguyenvana@gmail.com')).toBeInTheDocument();
    });

    // Verify activity list in detail sheet
    await waitFor(() => {
      expect(screen.getByText('HD001')).toBeInTheDocument();
    });
  });
  it('shows the saved phone in the open detail sheet after editing', async () => {
    vi.spyOn(opsApi, 'updateCustomer').mockResolvedValue({ data: { ...mockCustomerDetail.data, phone: '0934000111' } } as any);
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <WebSocketProvider>
            <AuthProvider>
              <ToastProvider>
                <MobileCustomersView />
              </ToastProvider>
            </AuthProvider>
          </WebSocketProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );
    fireEvent.click((await screen.findByText('Nguyễn Văn A')).closest('.m-list-row')!);
    fireEvent.click(await screen.findByRole('button', { name: 'Sửa' }));
    vi.mocked(opsApi.getCustomer).mockResolvedValue({ data: { ...mockCustomerDetail.data, phone: '0934000111' } } as any);
    fireEvent.change(screen.getByPlaceholderText('Nhập số điện thoại'), { target: { value: '0934000111' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findAllByText('0934000111')).not.toHaveLength(0);
  });
});
