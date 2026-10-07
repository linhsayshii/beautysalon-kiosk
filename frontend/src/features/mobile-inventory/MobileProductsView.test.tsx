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
    vi.spyOn(inventoryApi, 'getInventoryItem').mockResolvedValue({ data: mockProductsResponse.data[0] } as any);
    vi.spyOn(inventoryApi, 'getProducts').mockResolvedValue(mockProductsResponse as any);
  });

  it('renders title, summary, and product list rows', async () => {
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

    const itemRow = screen.getByText('Serum Dưỡng Trắng Da').closest('.m-list-row');
    fireEvent.click(itemRow!);

    await waitFor(() => {
      expect(screen.getByText('Thông tin hàng hóa')).toBeInTheDocument();
      expect(screen.getByText('SP001')).toBeInTheDocument();
      expect(screen.getAllByText('Đang kinh doanh').length).toBeGreaterThan(0);
      expect(screen.queryByText('Thời hạn sử dụng')).not.toBeInTheDocument();
      expect(screen.queryByText('Phạm vi thanh toán')).not.toBeInTheDocument();
    });
  });

  it('shows a failed request as an error instead of an empty inventory', async () => {
    vi.mocked(inventoryApi.getProducts).mockRejectedValue(new Error('Mất kết nối'));
    render(<MemoryRouter><QueryClientProvider client={queryClient}><MobileProductsView /></QueryClientProvider></MemoryRouter>);
    expect(await screen.findByText('Mất kết nối')).toBeInTheDocument();
    expect(screen.queryByText('Chưa có hàng hóa phù hợp')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeEnabled();
  });

  it('loads the next server page instead of stopping at 100 records', async () => {
    vi.mocked(inventoryApi.getProducts).mockImplementation(async ({ page }: any) => ({
      data: [{
        itemId: page, itemType: 'product', code: `SP${page}`, name: page === 2 ? 'Sản phẩm trang hai' : 'Sản phẩm trang một',
        category: 'Mỹ phẩm', salePrice: 100000, stockQuantity: 1,
      }],
      meta: { pagination: { page, pageSize: 100, total: 101, totalPages: 2 }, categories: ['Mỹ phẩm'] },
    } as any));

    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}><MobileProductsView /></QueryClientProvider>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Tải thêm hàng hóa' }));
    expect(await screen.findByText('Sản phẩm trang hai')).toBeInTheDocument();
    expect(inventoryApi.getProducts).toHaveBeenCalledWith(expect.objectContaining({ page: 2, pageSize: 100 }));
  });
});
