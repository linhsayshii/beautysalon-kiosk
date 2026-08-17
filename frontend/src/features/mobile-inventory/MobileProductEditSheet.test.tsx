import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MobileProductEditSheet } from './MobileProductEditSheet';
import * as inventoryApi from '@/features/inventory/inventory.api';

const mockItem = {
  id: 'product:10',
  itemId: 10,
  itemType: 'product',
  name: 'RF Needle Skinlip 1 buổi',
  code: 'SP000470',
  category: 'Chăm sóc da',
  unit: 'cái',
  salePrice: 2500000,
  costPrice: 900000,
  active: true,
};

describe('MobileProductEditSheet', () => {
  const queryClient = new QueryClient();

  it('renders all form cards and inputs correctly from item', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MobileProductEditSheet isOpen={true} item={mockItem} onClose={vi.fn()} />
      </QueryClientProvider>
    );

    expect(screen.getByText('Sửa thông tin cơ bản')).toBeInTheDocument();
    expect(screen.getByLabelText(/Tên hàng/)).toHaveValue('RF Needle Skinlip 1 buổi');
    expect(screen.getByLabelText(/Mã hàng/)).toHaveValue('SP000470');
    expect(screen.getByLabelText(/Giá bán/)).toHaveValue(2500000);
    expect(screen.getByLabelText(/Giá vốn/)).toHaveValue(900000);
    expect(screen.getByText('Cho phép bán')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeInTheDocument();
  });

  it('calls updateInventoryItem when clicking save button', async () => {
    const updateSpy = vi.spyOn(inventoryApi, 'updateInventoryItem').mockResolvedValue({
      data: { itemId: 10, name: 'RF Needle Edited', code: 'SP000470' },
      meta: {} as any,
    });
    const handleClose = vi.fn();
    const handleSuccess = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <MobileProductEditSheet
          isOpen={true}
          item={mockItem}
          onClose={handleClose}
          onSuccess={handleSuccess}
        />
      </QueryClientProvider>
    );

    const nameInput = screen.getByLabelText(/Tên hàng/);
    fireEvent.change(nameInput, { target: { value: 'RF Needle Edited' } });

    const saveBtn = screen.getByRole('button', { name: 'Lưu' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        'product',
        10,
        expect.objectContaining({
          name: 'RF Needle Edited',
          code: 'SP000470',
        })
      );
      expect(handleSuccess).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });
});
