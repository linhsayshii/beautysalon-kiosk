import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MobileProductsView } from './MobileProductsView';
import * as inventoryApi from '@/features/inventory/inventory.api';

describe('MobileProductsView Component', () => {
  let queryClient: QueryClient;

  const mockProductsResponse = {
    data: [
      {
        itemId: 1,
        itemType: 'product',
        code: 'SP001',
        barcode: '8931234567890',
        name: 'Serum Dưỡng Trắng Da',
        category: 'Mỹ phẩm',
        unit: 'Chai',
        salePrice: 450000,
        costPrice: 280000,
        stockQuantity: 5,
        minStock: 10,
        maxStock: 50,
        brand: 'Innisfree',
        active: true,
        description: 'Serum chiết xuất tự nhiên',
      },
      {
        itemId: 2,
        itemType: 'service',
        code: 'DV001',
        barcode: '',
        name: 'Gội Đầu Dưỡng Sinh 60p',
        category: 'Dịch vụ tóc',
        unit: 'Lượt',
        salePrice: 199000,
        costPrice: 0,
        stockQuantity: null,
        minStock: 0,
        durationMinutes: 60,
        active: true,
      },
      {
        itemId: 3,
        itemType: 'package',
        code: 'GOI001',
        name: 'Liệu Trình Chăm Sóc Da 5 Buổi',
        category: 'Gói chăm sóc',
        unit: 'Gói',
        salePrice: 1500000,
        costPrice: 0,
        stockQuantity: null,
        active: true,
      },
    ],
    meta: {
      pagination: { page: 1, pageSize: 50, total: 3, totalPages: 1 },
      categories: ['Mỹ phẩm', 'Dịch vụ tóc', 'Gói chăm sóc'],
      summary: {
        total: 3,
        products: 1,
        services: 1,
        packages: 1,
        account_cards: 0,
        low_stock: 1,
      },
    },
  };

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(inventoryApi, 'getProducts').mockResolvedValue(mockProductsResponse as any);
  });

  it('renders title, summary, and product grouped row items', async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <MobileProductsView />
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Hàng hóa' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/3 hàng hóa/)).toBeInTheDocument();
      expect(screen.getByText('Serum Dưỡng Trắng Da')).toBeInTheDocument();
      expect(screen.getByText('Gội Đầu Dưỡng Sinh 60p')).toBeInTheDocument();
      expect(screen.getByText('Liệu Trình Chăm Sóc Da 5 Buổi')).toBeInTheDocument();
    });
  });

  it('opens filter sheet and allows category/type filtering', async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <MobileProductsView />
        </QueryClientProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Serum Dưỡng Trắng Da')).toBeInTheDocument();
    });

    const filterBtn = screen.getByLabelText('Mở bộ lọc');
    fireEvent.click(filterBtn);

    expect(screen.getByText('Bộ lọc hàng hóa')).toBeInTheDocument();
    expect(screen.getByText('Loại hàng')).toBeInTheDocument();
    expect(screen.getByText('Nhóm hàng')).toBeInTheDocument();
    expect(screen.getAllByText('Tồn kho').length).toBeGreaterThan(0);

    // Click Apply
    const applyBtn = screen.getByRole('button', { name: 'Áp dụng' });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(screen.queryByText('Bộ lọc hàng hóa')).not.toBeInTheDocument();
    });
  });

  it('opens detail bottom sheet when clicking an item row', async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <MobileProductsView />
        </QueryClientProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Serum Dưỡng Trắng Da')).toBeInTheDocument();
    });

    const itemRow = screen.getByText('Serum Dưỡng Trắng Da').closest('.mobile-inventory-row-item');
    fireEvent.click(itemRow!);

    await waitFor(() => {
      expect(screen.getByText('Thông tin cơ bản')).toBeInTheDocument();
      expect(screen.getByText('SP001')).toBeInTheDocument();
      expect(screen.getByText('Cho phép bán')).toBeInTheDocument();
      expect(screen.getByText('Đang kinh doanh')).toBeInTheDocument();
      expect(screen.getByText('Thời hạn')).toBeInTheDocument();
      expect(screen.getByText('Phạm vi thanh toán')).toBeInTheDocument();
    });
  });
});

