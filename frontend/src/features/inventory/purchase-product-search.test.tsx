import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { PurchaseOrderCreateView } from './components/PurchaseOrderCreateView';
import { MobilePurchaseOrderCreateView } from '../mobile-inventory/MobilePurchaseOrderCreateView';
import * as api from './inventory.api';
vi.mock('@/services/metadata', () => ({ useMetadata: () => ({}), toOptions: () => [] }));
vi.mock('@/components/ui/Toast/ToastProvider', () => ({ useToast: () => ({ notify: vi.fn() }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it.each([PurchaseOrderCreateView, MobilePurchaseOrderCreateView])('%s searches the server and retains the draft through search errors', async View => {
  vi.spyOn(api, 'getSuppliers').mockResolvedValue({ data: [] });
  const spy = vi.spyOn(api, 'getProducts').mockImplementation(async filters => {
    if (filters.search === 'error') throw new Error('Lỗi tìm kiếm');
    return { data: [{ itemId: 101, code: 'SP101', name: 'Sản phẩm thứ 101', costPrice: 100, stockQuantity: 10 }] };
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><View /></MemoryRouter></QueryClientProvider>);
  const search = await screen.findByRole('searchbox');
  expect(spy).not.toHaveBeenCalled();
  fireEvent.change(search, { target: { value: 'SP101' } });
  await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.objectContaining({ search: 'SP101' }), expect.objectContaining({ signal: expect.any(AbortSignal) })));
  fireEvent.click(await screen.findByRole('button', { name: /Sản phẩm thứ 101/ }));
  expect(search).toHaveValue('');
  fireEvent.change(search, { target: { value: 'error' } });
  expect(await screen.findByText('Lỗi tìm kiếm')).toBeInTheDocument();
  expect(screen.getByText('Sản phẩm thứ 101')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
});
