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

  it('renders the shared list and keeps price editing inside a detail sheet', async () => {
    renderComponent();

    expect(screen.getByRole('heading', { level: 1, name: 'Thiết lập giá' })).toBeInTheDocument();
    expect(screen.getByText(/Bảng giá: Bảng giá chung/)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/SP001 · Mỹ phẩm/)).toBeInTheDocument();
      expect(screen.getByText(/DV001 · Dịch vụ tóc/)).toBeInTheDocument();
      expect(screen.getByText('Serum Dưỡng Trắng Da')).toBeInTheDocument();
      expect(screen.getByText('Gội Đầu Dưỡng Sinh 60p')).toBeInTheDocument();
      expect(screen.queryByLabelText('Giá bán Serum Dưỡng Trắng Da')).not.toBeInTheDocument();
    });
  });

  it('preserves an unsaved book name when its detail refreshes', async () => {
    const book = { id: 1, code: 'BG1', name: 'Bảng giá chung', isDefault: true, active: true, customers: [] };
    vi.spyOn(inventoryApi, 'getPricebook').mockResolvedValue({ data: book } as any);
    renderComponent();
    await screen.findByText(/SP001 · Mỹ phẩm/);
    fireEvent.click(screen.getByRole('button', { name: 'Sửa bảng giá đang chọn' }));
    const name = await screen.findByRole('textbox', { name: /Tên bảng giá/ });
    await waitFor(() => expect(name).toHaveValue('Bảng giá chung'));
    fireEvent.change(name, { target: { value: 'Tên đang sửa' } });
    vi.mocked(inventoryApi.getPricebook).mockResolvedValue({ data: { ...book, name: 'Tên từ phiên khác' } } as any);
    await queryClient.refetchQueries({ queryKey: ['pricebook-detail', 1] });
    expect(name).toHaveValue('Tên đang sửa');
  });

  it('saves a changed price only after an explicit save', async () => {
    renderComponent();

    fireEvent.click(await screen.findByRole('button', { name: /Serum Dưỡng Trắng Da/ }));

    const priceInput = screen.getByLabelText('Giá bán Serum Dưỡng Trắng Da');
    fireEvent.change(priceInput, { target: { value: '480000' } });
    fireEvent.blur(priceInput);
    expect(inventoryApi.updatePrice).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu giá' }));

    await waitFor(() => {
      expect(inventoryApi.updatePrice).toHaveBeenCalledWith(1, 'product', 1, 480000);
    });
  });

  it('opens the price editor with cost and retail price', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Serum Dưỡng Trắng Da')).toBeInTheDocument();
    });

    const rowTop = screen.getByText('Serum Dưỡng Trắng Da').closest('.m-list-row');
    fireEvent.click(rowTop!);

    await waitFor(() => {
      expect(screen.getByText('Giá vốn')).toBeInTheDocument();
      expect(screen.getByText('Giá niêm yết')).toBeInTheDocument();
      expect(screen.queryByText('Xem chi tiết hàng hóa')).not.toBeInTheDocument();
    });
  });
});
