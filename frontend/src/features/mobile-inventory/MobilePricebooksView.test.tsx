import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast/ToastProvider';
import { MobilePricebooksView } from './MobilePricebooksView';
import * as inventoryApi from '@/features/inventory/inventory.api';

describe('MobilePricebooksView Component', () => {
  let queryClient: QueryClient;

  const mockPricebooksResponse = {
    data: [
      {
        itemId: 1,
        itemType: 'product',
        code: 'SP001',
        name: 'Serum Dưỡng Trắng Da',
        category: 'Mỹ phẩm',
        costPrice: 280000,
        lastPurchasePrice: 275000,
        salePrice: 450000,
        bookPrice: 450000,
      },
      {
        itemId: 2,
        itemType: 'service',
        code: 'DV001',
        name: 'Gội Đầu Dưỡng Sinh 60p',
        category: 'Dịch vụ tóc',
        costPrice: 0,
        lastPurchasePrice: 0,
        salePrice: 199000,
        bookPrice: 220000,
      },
    ],
    meta: {
      pagination: { page: 1, pageSize: 50, total: 2, totalPages: 1 },
      pricebook: { id: 1, name: 'Bảng giá chung' },
      pricebooks: [
        { id: 1, name: 'Bảng giá chung' },
        { id: 2, name: 'Bảng giá VIP' },
      ],
      categories: ['Mỹ phẩm', 'Dịch vụ tóc'],
    },
  };

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(inventoryApi, 'getPricebooks').mockResolvedValue(mockPricebooksResponse as any);
    vi.spyOn(inventoryApi, 'updatePrice').mockResolvedValue({} as any);
  });

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <MobilePricebooksView />
          </ToastProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );

  it('renders header, filter strip, grouped categories, and quick money input', async () => {
    renderComponent();

    expect(screen.getByRole('heading', { level: 1, name: 'Thiết lập giá' })).toBeInTheDocument();
    expect(screen.getByText(/Bảng giá: Bảng giá chung/)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Mỹ phẩm (1)')).toBeInTheDocument();
      expect(screen.getByText('Dịch vụ tóc (1)')).toBeInTheDocument();
      expect(screen.getByText('Serum Dưỡng Trắng Da')).toBeInTheDocument();
      expect(screen.getByText('Gội Đầu Dưỡng Sinh 60p')).toBeInTheDocument();
      expect(screen.getByLabelText('Giá bán Serum Dưỡng Trắng Da')).toBeInTheDocument();
    });
  });

  it('updates price when changing MoneyInput value', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByLabelText('Giá bán Serum Dưỡng Trắng Da')).toBeInTheDocument();
    });

    const priceInput = screen.getByLabelText('Giá bán Serum Dưỡng Trắng Da');
    fireEvent.change(priceInput, { target: { value: '480000' } });
    fireEvent.blur(priceInput);

    await waitFor(() => {
      expect(inventoryApi.updatePrice).toHaveBeenCalledWith(1, 'product', 1, 480000);
    });
  });

  it('opens detail bottom sheet with price comparison and margin', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Serum Dưỡng Trắng Da')).toBeInTheDocument();
    });

    const rowTop = screen.getByText('Serum Dưỡng Trắng Da').closest('.mobile-pricebook-row-top');
    fireEvent.click(rowTop!);

    await waitFor(() => {
      expect(screen.getByText('SO SÁNH BẢNG GIÁ')).toBeInTheDocument();
      expect(screen.getByText('Biên lợi nhuận ước tính:')).toBeInTheDocument();
      expect(screen.queryByText('Xem chi tiết hàng hóa')).not.toBeInTheDocument();
    });
  });
});
