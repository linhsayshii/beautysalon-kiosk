import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast/ToastProvider';
import { GoodsCreateDialog } from './GoodsCreateDialog';

describe('GoodsCreateDialog', () => {
  it('keeps save enabled when creating a new product without an item detail request', () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ToastProvider>
          <GoodsCreateDialog type="product" onClose={() => {}} />
        </ToastProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('button', { name: 'Lưu' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Đang tải...' })).not.toBeInTheDocument();
  });
});
