import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast/ToastProvider';
import { GoodsCreateDialog } from './GoodsCreateDialog';
import { createInventoryItem } from '../inventory.api';

vi.mock('../inventory.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../inventory.api')>()),
  getProducts: vi.fn(async () => ({
    data: [],
    meta: { pagination: { page: 1, pageSize: 1, total: 0, totalPages: 1 }, categories: ['Chăm sóc da', 'Dầu gội'] },
  })),
  createInventoryItem: vi.fn(async () => ({ data: { itemId: 1 } })),
}));

function renderDialog(type: 'product' | 'service') {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider>
        <GoodsCreateDialog type={type} onClose={() => {}} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('GoodsCreateDialog', () => {
  it('keeps save enabled when creating a new product without an item detail request', () => {
    renderDialog('product');

    expect(screen.getByRole('button', { name: 'Lưu' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Đang tải...' })).not.toBeInTheDocument();
  });

  it.each(['product', 'service'] as const)('suggests the existing categories when creating a %s', async (type) => {
    renderDialog(type);

    fireEvent.focus(screen.getByRole('combobox', { name: 'Nhóm hàng' }));

    expect(await screen.findByRole('option', { name: 'Chăm sóc da' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Dầu gội' })).toBeInTheDocument();
  });

  it('saves a service tour commission separately from its consultant commission', async () => {
    renderDialog('service');
    fireEvent.change(screen.getByRole('textbox', { name: /Tên hàng/ }), { target: { value: 'Gội đầu' } });

    const tour = screen.getByRole('group', { name: 'Hoa hồng tua' });
    fireEvent.click(within(tour).getByRole('checkbox', { name: 'Cho phép tính hoa hồng tua' }));
    fireEvent.click(within(tour).getByRole('button', { name: 'Số tiền cố định' }));
    fireEvent.change(within(tour).getByRole('textbox', { name: 'Mức hoa hồng tua' }), { target: { value: '50000' } });

    const consulting = screen.getByRole('group', { name: 'Hoa hồng tư vấn bán' });
    fireEvent.click(within(consulting).getByRole('checkbox', { name: 'Cho phép tính hoa hồng tư vấn bán' }));
    fireEvent.change(within(consulting).getByRole('textbox', { name: 'Mức hoa hồng tư vấn bán' }), { target: { value: '10' } });

    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));

    await waitFor(() => expect(createInventoryItem).toHaveBeenCalled());
    expect(vi.mocked(createInventoryItem).mock.calls[0][0]).toMatchObject({
      type: 'service',
      commissionType: 'percent',
      commissionRate: 0.1,
      tourCommissionType: 'fixed',
      tourCommissionRate: 50000,
    });
  });

  it('has no tour commission for a product', () => {
    renderDialog('product');

    expect(screen.getByRole('group', { name: 'Hoa hồng bán' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Hoa hồng tua' })).not.toBeInTheDocument();
  });
});
