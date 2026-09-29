import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/Toast/ToastProvider';
import * as operationsApi from '../operations.api';
import { CustomersView } from './CustomersView';

vi.mock('../operations.api');
vi.mock('@/services/metadata', () => ({ useMetadata: () => ({ data: undefined }), toOptions: () => [] }));

const customer = {
  id: 7, code: 'KH000007', name: 'Chị Lan', phone: '0901000050', dob: '1990-05-12', gender: 'Nữ',
  email: 'lan@example.com', facebook: 'fb.com/lan', group: 'Cá nhân', branchName: 'Trung tâm',
  totalSpent: 0, visitCount: 0, cardBalance: 0, debtBalance: 0, activePackages: 0, lastVisit: null, createdAt: '2026-09-01T00:00:00Z',
};

describe('CustomersView', () => {
  it('edits a customer from the desktop detail and refreshes the open detail', async () => {
    vi.mocked(operationsApi.getCustomers).mockResolvedValue({ data: [customer], meta: { pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } } });
    vi.mocked(operationsApi.getCustomer).mockResolvedValue({ data: customer, meta: {} });
    vi.mocked(operationsApi.updateCustomer).mockResolvedValue({ data: { ...customer, phone: '0909999999' }, meta: {} });
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ToastProvider><CustomersView /></ToastProvider></QueryClientProvider>);

    fireEvent.click(await screen.findByText('KH000007'));
    fireEvent.click(await screen.findByRole('button', { name: 'Cập nhật' }));

    expect(screen.getByRole('dialog', { name: 'Sửa thông tin khách hàng' })).toBeInTheDocument();
    const phone = screen.getByPlaceholderText('Nhập số điện thoại');
    expect(phone).toHaveValue('0901000050');
    expect(screen.getByPlaceholderText('Nhập email')).toHaveValue('lan@example.com');
    fireEvent.change(phone, { target: { value: '0909999999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));

    await waitFor(() => expect(operationsApi.updateCustomer).toHaveBeenCalledWith(7, expect.objectContaining({
      phone: '0909999999', dob: '1990-05-12', gender: 'Nữ', email: 'lan@example.com', facebook: 'fb.com/lan',
    })));
    await waitFor(() => expect(vi.mocked(operationsApi.getCustomer).mock.calls.length).toBeGreaterThan(1));
  });
});

describe('customer service history', () => {
  it('names appointment statuses like the appointment lists do', async () => {
    const { CustomerDetail } = await import('./CustomerDetail');
    vi.mocked(operationsApi.getCustomer).mockResolvedValue({ data: customer, meta: {} });
    vi.mocked(operationsApi.getCustomerActivity).mockResolvedValue({ data: [
      { id: 1, occurredAt: '2026-09-28T19:38:00Z', serviceCode: 'DV1', serviceName: 'Gội đầu', staffName: 'Hậu', status: 'completed' },
      { id: 2, occurredAt: '2026-09-30T02:00:00Z', serviceCode: 'DV1', serviceName: 'Gội đầu', staffName: 'Hậu', status: 'confirmed' },
    ], meta: {} });
    render(<QueryClientProvider client={new QueryClient()}><CustomerDetail id={7} /></QueryClientProvider>);
    fireEvent.click(await screen.findByRole('tab', { name: 'Lịch làm dịch vụ' }));
    expect(await screen.findByText('Đã xong')).toBeInTheDocument();
    expect(screen.getByText('Chờ phục vụ')).toBeInTheDocument();
    expect(screen.queryByText('Đã dùng hết')).not.toBeInTheDocument();
  });
});
