import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/Toast/ToastProvider';
import { getCustomers } from '@/features/operations/operations.api';
import { MobileCustomerSelectSheet, type MobileCustomer } from './MobileCustomerSelectSheet';

const mockCustomers: MobileCustomer[] = [
  {
    id: 1,
    code: 'KH000001',
    name: 'Nguyễn Thị Hoa',
    phone: '0901234567',
    debtBalance: 225000,
    remainingPackageUnits: 18,
  },
  {
    id: 2,
    code: 'KH000002',
    name: 'Trần Văn Bình',
    phone: '0912345678',
    debtBalance: 0,
    remainingPackageUnits: 0,
  },
];

vi.mock('@/features/operations/operations.api', () => ({
  getCustomers: vi.fn().mockImplementation(() =>
    Promise.resolve({
      data: mockCustomers,
      meta: {
        pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
      },
    })
  ),
  createCustomer: vi.fn().mockResolvedValue({
    data: { id: 3, code: 'KH000003', name: 'Lê Thuỳ Dung', phone: '0988776655' },
  }),
}));

function renderWithClient(ui: React.ReactElement) {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={testQueryClient}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>
  );
}

describe('MobileCustomerSelectSheet', () => {
  it('renders an accessible customer picker without an inactive scanner action', async () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();

    renderWithClient(
      <MobileCustomerSelectSheet isOpen={true} onClose={onClose} onSelectCustomer={onSelect} />
    );

    expect(screen.getByPlaceholderText('Tìm khách hàng')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đóng' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /chọn khách hàng/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /quét mã|qr|barcode/i })).not.toBeInTheDocument();
  });

  it('mounts above the page scroller and locks the background while open', () => {
    const { unmount } = renderWithClient(
      <MobileCustomerSelectSheet isOpen={true} onClose={vi.fn()} onSelectCustomer={vi.fn()} />
    );

    const backdrop = screen.getByRole('dialog', { name: /chọn khách hàng/i }).closest('.sheet-backdrop');
    expect(backdrop?.parentElement).toBe(document.body);
    expect(document.body).toHaveClass('mobile-overlay-open');

    unmount();
    expect(document.body).not.toHaveClass('mobile-overlay-open');
  });

  it('renders customer list with remaining package units and debt badges', async () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();

    renderWithClient(
      <MobileCustomerSelectSheet isOpen={true} onClose={onClose} onSelectCustomer={onSelect} />
    );

    await waitFor(() => {
      expect(screen.getByText('Nguyễn Thị Hoa')).toBeInTheDocument();
    });

    // Check package units badge (Còn: 18 Buổi DV)
    expect(screen.getByText(/Còn: 18 Buổi DV/i)).toBeInTheDocument();

    // Check debt badge (Nợ: 225.000 or 225,000)
    expect(screen.getByText('Nợ: 225.000đ')).toBeInTheDocument();

    // Check second customer without badges
    expect(screen.getByText('Trần Văn Bình')).toBeInTheDocument();
  });

  it('debounces search and keeps the current list visible while the new result loads', async () => {
    let resolveSearch: ((value: {
      data: MobileCustomer[];
      meta: { pagination: { page: number; pageSize: number; total: number; totalPages: number } };
    }) => void) | undefined;
    const mockedGetCustomers = vi.mocked(getCustomers);

    renderWithClient(
      <MobileCustomerSelectSheet isOpen={true} onClose={vi.fn()} onSelectCustomer={vi.fn()} />
    );
    await waitFor(() => expect(screen.getByText('Nguyễn Thị Hoa')).toBeInTheDocument());

    const callsBeforeSearch = mockedGetCustomers.mock.calls.length;
    mockedGetCustomers.mockImplementationOnce(() => new Promise((resolve) => {
      resolveSearch = resolve;
    }));

    const input = screen.getByPlaceholderText('Tìm khách hàng');
    fireEvent.change(input, { target: { value: 'n' } });
    fireEvent.change(input, { target: { value: 'ng' } });
    fireEvent.change(input, { target: { value: 'nguyen' } });

    expect(mockedGetCustomers).toHaveBeenCalledTimes(callsBeforeSearch);
    expect(screen.getByText('Nguyễn Thị Hoa')).toBeInTheDocument();
    expect(screen.queryByText('Đang tải danh sách khách hàng...')).not.toBeInTheDocument();

    await waitFor(() => expect(mockedGetCustomers).toHaveBeenCalledTimes(callsBeforeSearch + 1), { timeout: 1000 });
    expect(mockedGetCustomers.mock.calls.at(-1)?.[0]).toMatchObject({ search: 'nguyen' });
    expect(screen.getByText('Nguyễn Thị Hoa')).toBeInTheDocument();
    expect(screen.queryByText('Đang tải danh sách khách hàng...')).not.toBeInTheDocument();

    resolveSearch?.({
      data: [mockCustomers[0]],
      meta: { pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } },
    });
    await waitFor(() => expect(screen.queryByText('Trần Văn Bình')).not.toBeInTheDocument());
  });

  it('calls onSelectCustomer and onClose when a customer card is clicked', async () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();

    renderWithClient(
      <MobileCustomerSelectSheet isOpen={true} onClose={onClose} onSelectCustomer={onSelect} />
    );

    await waitFor(() => {
      expect(screen.getByText('Nguyễn Thị Hoa')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Nguyễn Thị Hoa'));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
      id: 1,
      name: 'Nguyễn Thị Hoa',
      phone: '0901234567',
    }));
    expect(onClose).toHaveBeenCalled();
  });

  it('opens CustomerCreateDialog when floating (+) button is clicked', async () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();

    renderWithClient(
      <MobileCustomerSelectSheet isOpen={true} onClose={onClose} onSelectCustomer={onSelect} />
    );

    const addBtn = screen.getByRole('button', { name: /thêm khách hàng mới/i });
    expect(addBtn).toBeInTheDocument();

    fireEvent.click(addBtn);

    // Dialog title should appear
    expect(screen.getByText('Thêm khách hàng')).toBeInTheDocument();
  });
});
