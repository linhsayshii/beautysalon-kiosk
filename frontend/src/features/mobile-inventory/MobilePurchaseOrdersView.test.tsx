import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MobilePurchaseOrdersView } from './MobilePurchaseOrdersView';
import * as inventoryApi from '@/features/inventory/inventory.api';

describe('MobilePurchaseOrdersView Component', () => {
  let queryClient: QueryClient;

  const mockPurchaseOrdersResponse = {
    data: [
      {
        id: 1,
        code: 'PN001',
        status: 'completed',
        createdAt: '2026-08-15T09:00:00Z',
        receivedAt: '2026-08-15T10:00:00Z',
        itemCount: 3,
        amountDue: 5000000,
        amountPaid: 3000000,
        supplier: {
          id: 10,
          name: 'Công ty Mỹ Phẩm Hàn Quốc',
          phone: '0909123456',
        },
      },
      {
        id: 2,
        code: 'PN002',
        status: 'draft',
        createdAt: '2026-08-16T14:00:00Z',
        receivedAt: '2026-08-16T15:00:00Z',
        itemCount: 1,
        amountDue: 1200000,
        amountPaid: 0,
        supplier: {
          id: 11,
          name: 'Nhà phân phối Tinh Dầu',
          phone: '0988123456',
        },
      },
    ],
    meta: {
      pagination: { page: 1, pageSize: 50, total: 2, totalPages: 1 },
      summary: {
        totalOrders: 2,
        totalDue: 6200000,
        totalDebt: 3200000,
        drafts: 1,
      },
    },
  };

  const mockOrderDetail = {
    data: {
      id: 1,
      code: 'PN001',
      status: 'completed',
      receivedAt: '2026-08-15T10:00:00Z',
      paymentMethod: 'bank_transfer',
      createdBy: 'Admin',
      note: 'Giao hàng đúng hẹn',
      subtotal: 5000000,
      amountDue: 5000000,
      amountPaid: 3000000,
      supplier: {
        id: 10,
        name: 'Công ty Mỹ Phẩm Hàn Quốc',
        phone: '0909123456',
      },
      items: [
        {
          id: 1,
          sku: 'SP001',
          name: 'Serum Dưỡng Trắng Da',
          quantity: 10,
          unit: 'Chai',
          unitCost: 280000,
          discount: 0,
          lineTotal: 2800000,
        },
      ],
    },
  };

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(inventoryApi, 'getPurchaseOrders').mockResolvedValue(mockPurchaseOrdersResponse as any);
    vi.spyOn(inventoryApi, 'getPurchaseOrder').mockResolvedValue(mockOrderDetail as any);
  });

  it('renders header, filter strip, summary bar, and grouped purchase order list without metric boxes', async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <MobilePurchaseOrdersView />
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Nhập hàng' })).toBeInTheDocument();
    expect(screen.queryByText('Tổng phiếu')).not.toBeInTheDocument();
    expect(screen.queryByText('Giá trị nhập')).not.toBeInTheDocument();

    expect(screen.getByText(/Khoảng ngày:/)).toBeInTheDocument();
    expect(screen.getByText(/Trạng thái:/)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('PN001')).toBeInTheDocument();
      expect(screen.getByText('Công ty Mỹ Phẩm Hàn Quốc')).toBeInTheDocument();
      expect(screen.getByText('PN002')).toBeInTheDocument();
      expect(screen.getByText('Nhà phân phối Tinh Dầu')).toBeInTheDocument();
      expect(screen.getByText(/THÁNG 08\/2026/)).toBeInTheDocument();
    });
  });

  it('opens detail bottom sheet with items breakdown and financial details', async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <MobilePurchaseOrdersView />
        </QueryClientProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('PN001')).toBeInTheDocument();
    });

    const card = screen.getByText('PN001').closest('.mobile-inventory-row-item');
    fireEvent.click(card!);

    await waitFor(() => {
      expect(screen.getByText('DANH SÁCH MẶT HÀNG NHẬP (1)')).toBeInTheDocument();
      expect(screen.getByText('CHI TIẾT TÀI CHÍNH')).toBeInTheDocument();
      expect(screen.getByText('Serum Dưỡng Trắng Da')).toBeInTheDocument();
      expect(screen.getByText('0909123456')).toBeInTheDocument();
      expect(screen.getByText('In phiếu nhập')).toBeInTheDocument();
      expect(screen.getByText('Sửa phiếu')).toBeInTheDocument();
    });
  });
});
