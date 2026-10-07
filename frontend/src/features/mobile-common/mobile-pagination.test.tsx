import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MobileOrdersView } from '../mobile-orders/MobileOrdersView';
import { MobileCustomersView } from '../mobile-operations/MobileCustomersView';
import { MobileCustomerCardsView } from '../mobile-operations/MobileCustomerCardsView';
import { MobilePurchaseOrdersView } from '../mobile-inventory/MobilePurchaseOrdersView';
import * as operations from '@/features/operations/operations.api';
import * as inventory from '@/features/inventory/inventory.api';
vi.mock('@/features/auth/AuthProvider', () => ({ useAuth: () => ({ account: { role: 'manager' } }) }));
vi.mock('@/components/ui/Toast/ToastProvider', () => ({ useToast: () => ({ notify: vi.fn() }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const cases = [
  { View: MobileOrdersView, api: operations, method: 'getOrders', summary: { paidRevenue: 123456789 }, expected: '123.456.789đ', sort: 'Giá trị cao', sortKey: 'total_desc' },
  { View: MobileCustomersView, api: operations, method: 'getCustomers', summary: { totalDebt: 123456789 }, expected: '123.456.789đ', sort: 'Nợ cao nhất', sortKey: 'debt_desc' },
  { View: MobileCustomerCardsView, api: operations, method: 'getCustomerCards', summary: {}, expected: '101 gói/thẻ', sort: 'Giá bán cao', sortKey: 'price_desc' },
  { View: MobilePurchaseOrdersView, api: inventory, method: 'getPurchaseOrders', summary: { totalDue: 123456789 }, expected: '123.456.789đ', sort: 'Giá trị cao', sortKey: 'total_desc' },
] as const;
describe('mobile list pagination', () => {
  it.each(cases)('$method loads page 2, retains global totals, and resets page on sorting', async ({ View, api, method, summary, expected, sort, sortKey }) => {
    const spy = vi.spyOn(api as any, method).mockImplementation(async (filters: any) => {
      const page = filters.page ?? 1;
      return { data: [{ id: page, code: `ROW-${page}`, name: `Customer-${page}`, itemName: `Card-${page}`, itemType: 'package', status: 'paid', total: 1, amountDue: 1, customer: { name: `Customer-${page}` } }], meta: { pagination: { page, pageSize: 100, total: 101, totalPages: 2 }, summary } };
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><View /></MemoryRouter></QueryClientProvider>);
    await waitFor(() => expect(screen.getByText((content) => content.includes(expected))).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    await waitFor(() => expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Trang sau' })).toBeDisabled());
    expect(screen.getByText((content) => content.includes(expected))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sắp xếp theo' }));
    fireEvent.click(screen.getByRole('option', { name: sort }));
    await waitFor(() => expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, sort: sortKey })));
  });
});
it.each(cases)('$method displays a retryable API error instead of an empty list', async ({ View, api, method }) => {
  vi.spyOn(api as any, method).mockRejectedValue(new Error('Kết nối thất bại'));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><View /></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByText('Kết nối thất bại')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  expect(screen.queryByText(/Không tìm thấy .*nào/)).not.toBeInTheDocument();
});
it.each([cases[0], cases[3]])('$method requests exactly seven inclusive calendar days', async ({ View, api, method }) => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-15T12:00:00+07:00'));
  try {
    const spy = vi.spyOn(api as any, method).mockResolvedValue({ data: [] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><View /></MemoryRouter></QueryClientProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Mở bộ lọc' }));
    fireEvent.click(screen.getByRole('button', { name: 'Khoảng thời gian' }));
    fireEvent.click(screen.getByRole('option', { name: '7 ngày qua' }));
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
    await waitFor(() => expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ dateFrom: '2026-09-09', dateTo: '2026-09-15' })));
  } finally { vi.useRealTimers(); }
});
it.each([
  { View: MobileOrdersView, api: operations, list: 'getOrders', detail: 'getOrder', label: /ROW-1/ },
  { View: MobileCustomersView, api: operations, list: 'getCustomers', detail: 'getCustomer', label: 'Customer-1' },
  { View: MobileCustomerCardsView, api: operations, list: 'getCustomerCards', detail: 'getCustomerCard', label: 'Card-1' },
  { View: MobilePurchaseOrdersView, api: inventory, list: 'getPurchaseOrders', detail: 'getPurchaseOrder', label: 'ROW-1' },
])('$detail exposes a retryable failure inside the detail sheet', async ({ View, api, list, detail, label }) => {
  vi.spyOn(api as any, list).mockResolvedValue({ data: [{ id: 1, code: 'ROW-1', name: 'Customer-1', itemName: 'Card-1', itemType: 'package', status: 'active', customer: { name: 'Customer' } }] });
  const spy = vi.spyOn(api as any, detail).mockRejectedValue(new Error('Không tải được chi tiết'));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><View /></MemoryRouter></QueryClientProvider>);
  fireEvent.click(await screen.findByText(label));
  expect(await screen.findByText('Không tải được chi tiết')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
});
