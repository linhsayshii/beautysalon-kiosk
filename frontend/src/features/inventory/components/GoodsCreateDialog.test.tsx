import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast/ToastProvider';
import { GoodsCreateDialog } from './GoodsCreateDialog';

vi.mock('../inventory.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../inventory.api')>()),
  getProducts: vi.fn(async () => ({
    data: [],
    meta: { pagination: { page: 1, pageSize: 1, total: 0, totalPages: 1 }, categories: ['Chăm sóc da', 'Dầu gội'] },
  })),
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
});
