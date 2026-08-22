import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MobileOrdersView } from './MobileOrdersView';
import * as operationsApi from '@/features/operations/operations.api';

describe('MobileOrdersView Component', () => {
  let queryClient: QueryClient;

  const mockOrders = [
    {
      id: 1,
      code: 'HD007176',
      status: 'paid',
      salesChannel: 'salon',
      paymentMethod: 'cash',
      issuedAt: '2026-08-17T14:30:00.000Z',
      createdAt: '2026-08-17T14:30:00.000Z',
      branchName: 'Chi nhánh Quận 1',
      staff: { id: 1, name: 'Nguyễn Thu Ngân' },
      customer: { id: 101, name: 'Nguyễn Thị Hoa', phone: '0901234567' },
      subtotal: 500000,
      discount: 50000,
      total: 450000,
      paidAmount: 450000,
      items: [
        {
          id: 1,
          name: 'Chăm sóc da mặt chuyên sâu',
          quantity: 1,
          unitPrice: 500000,
          discount: 50000,
          lineTotal: 450000,
        },
      ],
    },
    {
      id: 2,
      code: 'HD007175',
      status: 'draft',
      salesChannel: 'online',
      paymentMethod: 'bank_transfer',
      issuedAt: '2026-08-16T10:15:00.000Z',
      createdAt: '2026-08-16T10:15:00.000Z',
      branchName: 'Chi nhánh Quận 1',
      staff: { id: 2, name: 'Trần Kỹ Thuật' },
      customer: { id: 102, name: 'Lê Văn Nam', phone: '0912345678' },
      subtotal: 200000,
      discount: 0,
      total: 200000,
      paidAmount: 0,
      debtAmount: 200000,
      items: [
        {
          id: 2,
          name: 'Gội đầu thảo dược dưỡng sinh',
          quantity: 1,
          unitPrice: 200000,
          discount: 0,
          lineTotal: 200000,
        },
      ],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.spyOn(operationsApi, 'getOrders').mockResolvedValue({
      data: mockOrders as any,
      meta: {
        pagination: { page: 1, pageSize: 100, total: 2, totalPages: 1 },
        summary: {},
      } as any,
    });

    vi.spyOn(operationsApi, 'getOrder').mockImplementation((id: number) => {
      const found = mockOrders.find((o) => o.id === id);
      return Promise.resolve({
        data: found as any,
      } as any);
    });
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MobileOrdersView />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('renders header, filter strip, summary bar, grouped list, and FAB', async () => {
    renderComponent();

    // Header title
    expect(screen.getByRole('heading', { name: /Đơn hàng/i })).toBeInTheDocument();

    // Search trigger
    expect(screen.getByLabelText('Tìm kiếm')).toBeInTheDocument();

    // Summary bar
    await waitFor(() => {
      expect(screen.getByText(/2 đơn hàng/i)).toBeInTheDocument();
    });

    // Orders in list
    expect(screen.getByText('HD007176')).toBeInTheDocument();
    expect(screen.getByText('Nguyễn Thị Hoa')).toBeInTheDocument();
    expect(screen.getByText('HD007175')).toBeInTheDocument();
    expect(screen.getByText('Lê Văn Nam')).toBeInTheDocument();

    // Floating action button for new invoice
    const fab = screen.getByRole('link', { name: /Tạo hóa đơn mới/i });
    expect(fab).toBeInTheDocument();
    expect(fab).toHaveAttribute('href', '/m/invoices/new');
  });

  it('opens search bar and filters list by code or customer name', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('HD007176')).toBeInTheDocument();
    });

    // Open search
    const searchTrigger = screen.getByLabelText('Tìm kiếm');
    fireEvent.click(searchTrigger);

    const searchInput = screen.getByPlaceholderText(/Tìm theo mã đơn/i);
    expect(searchInput).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'Hoa' } });

    await waitFor(() => {
      expect(screen.getByText('Nguyễn Thị Hoa')).toBeInTheDocument();
      expect(screen.queryByText('Lê Văn Nam')).not.toBeInTheDocument();
    });
  });

  it('opens inset detail sheet when an order item is clicked', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('HD007176')).toBeInTheDocument();
    });

    const orderRow = screen.getByText('HD007176').closest('.mobile-orders-row-item');
    expect(orderRow).toBeTruthy();
    fireEvent.click(orderRow!);

    await waitFor(() => {
      // Check detail sheet header card
      expect(screen.getByRole('heading', { name: /Chi tiết đơn hàng/i })).toBeInTheDocument();
      // 2x2 grid content
      expect(screen.getByText('Kênh bán')).toBeInTheDocument();
      expect(screen.getByText('Chi nhánh')).toBeInTheDocument();
      expect(screen.getByText('Thu ngân / Thợ')).toBeInTheDocument();
      // Item list
      expect(screen.getByText('Chăm sóc da mặt chuyên sâu')).toBeInTheDocument();
      // Payment details breakdown
      expect(screen.getByText('CHI TIẾT THANH TOÁN')).toBeInTheDocument();
      expect(screen.getByText('Tổng tiền hàng:')).toBeInTheDocument();
      // Action buttons
      expect(screen.getByRole('button', { name: /In hóa đơn/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Xem chi tiết/i })).not.toBeInTheDocument();
    });
  });
});
