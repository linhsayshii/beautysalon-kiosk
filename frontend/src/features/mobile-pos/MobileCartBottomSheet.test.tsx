import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MobileCartBottomSheet, posLineKey } from './MobileCartBottomSheet';
import * as posApi from '@/features/pos/pos.api';
import type { ComponentProps } from 'react';

vi.mock('@/services/metadata', () => ({ useMetadata: () => ({ data: { data: { system: {} } } }) }));
vi.mock('@/features/debts/debts.api', () => ({
  getCustomerDebt: vi.fn(async () => ({ data: { balance: 150000 } })),
  usePaymentRequestKey: () => () => 'checkout-test-key',
}));
const props = {
  lines: [{ itemId: 1, itemType: 'service' as const, code: 'DV1', name: 'Lăn kim tái tạo', category: '', unit: 'lần', salePrice: 1800000, quantity: 1, staffId: 2, commissionType: null, commissionRate: 0 }],
  customer: { id: 1, name: 'Hoàng Khánh Linh', phone: '0978901234' },
  invoiceId: 4, invoiceCode: 'HD00004', customerLocked: true,
  onSelectCustomer: vi.fn(), onUpdateQuantity: vi.fn(), onUpdateLineStaff: vi.fn(), onClose: vi.fn(), onSuccess: vi.fn(),
};
function show(overrides: Partial<ComponentProps<typeof MobileCartBottomSheet>> = {}) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><MobileCartBottomSheet {...props} {...overrides} /></QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(posApi, 'getPosStaff').mockResolvedValue({ data: [{ id: 2, name: 'Em Huệ' }], meta: {} });
});
describe('Mobile checkout identity and payment safety', () => {
  it('focuses customer search, clears without closing, and selects the matching customer', async () => {
    vi.spyOn(posApi, 'searchPosCustomers').mockResolvedValue({ data: [{ id: 9, name: 'Linh Nguyễn', phone: '0901234567' }], meta: {} });
    show({ customer: null, customerLocked: false });
    fireEvent.click(screen.getByRole('button', { name: 'Chọn khách hàng' }));
    const input = screen.getByRole('searchbox', { name: 'Tìm khách hàng theo tên hoặc số điện thoại' });
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: 'Linh' } });
    await screen.findByRole('button', { name: /Linh Nguyễn 0901234567/ });
    fireEvent.click(screen.getByRole('button', { name: 'Xóa tìm kiếm' }));
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: '0901234567' } });
    fireEvent.click(await screen.findByRole('button', { name: /Linh Nguyễn 0901234567/ }));
    expect(props.onSelectCustomer).toHaveBeenCalledWith({ id: 9, name: 'Linh Nguyễn', phone: '0901234567' });
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });
  it('distinguishes a failed customer search from no matches and allows retrying', async () => {
    const search = vi.spyOn(posApi, 'searchPosCustomers').mockRejectedValue(new Error('Không thể tải khách hàng'));
    show({ customer: null, customerLocked: false });
    fireEvent.click(screen.getByRole('button', { name: 'Chọn khách hàng' }));
    fireEvent.change(screen.getByLabelText('Tìm khách hàng theo tên hoặc số điện thoại'), { target: { value: 'không khớp' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tải khách hàng');
    expect(screen.queryByText('Không tìm thấy khách hàng')).not.toBeInTheDocument();
    search.mockResolvedValue({ data: [], meta: {} });
    fireEvent.click(screen.getByRole('button', { name: /Thử lại/ }));
    expect(await screen.findByText('Không tìm thấy khách hàng')).toBeInTheDocument();
  });
  it('keeps invoice/customer visible and prevents removing a scheduled customer', async () => {
    show();
    const dialog = screen.getByRole('dialog', { name: 'Thanh toán' });
    expect(within(dialog).getByText(/HD00004/)).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /Bỏ chọn/ })).not.toBeInTheDocument();
    expect(screen.getByText('Theo lịch hẹn')).toBeInTheDocument();
    expect(screen.getAllByText('Lăn kim tái tạo')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Xác nhận thanh toán' }).closest('.mobile-cart-sheet-content')).toBeNull();
  });
  it('still allows changing a customer on a new sale', () => {
    show({ customerLocked: false });
    fireEvent.click(screen.getByRole('button', { name: /Bỏ chọn khách hàng/ }));
    expect(props.onSelectCustomer).toHaveBeenCalledWith(null);
  });
  it('keeps an entered partial payment and reports checkout failure without closing', async () => {
    const checkout = vi.spyOn(posApi, 'checkoutPosInvoice').mockRejectedValue(new Error('Mất kết nối. Hãy thử lại.'));
    show();
    fireEvent.change(screen.getByLabelText('Khách thanh toán lần này (VNĐ)'), { target: { value: '1000000' } });
    expect(screen.getByRole('button', { name: 'Xác nhận thanh toán' })).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Cho phép ghi nợ phần còn lại'));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận thanh toán' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Mất kết nối'));
    expect(checkout).toHaveBeenCalledWith(expect.objectContaining({ invoiceId: 4, customerId: 1, amountPaid: 1000000, allowDebt: true }));
    expect(screen.getByLabelText('Khách thanh toán lần này (VNĐ)')).toHaveValue('1.000.000');
    expect(props.onClose).not.toHaveBeenCalled();
  });
  it('sends the consultant of a service line and shows tour plus consulting commission', async () => {
    const checkout = vi.spyOn(posApi, 'checkoutPosInvoice').mockRejectedValue(new Error('stop'));
    const line = {
      ...props.lines[0], consultantStaffId: 2,
      commissionType: 'percent' as const, commissionRate: 0.1, tourCommissionType: 'fixed' as const, tourCommissionRate: 50000,
    };
    show({ lines: [line], onUpdateLineConsultant: vi.fn() } as Partial<typeof props>);
    expect(screen.getByLabelText('Hoa hồng Lăn kim tái tạo: 230.000đ')).toBeInTheDocument();
    expect(screen.getByLabelText('Nhân viên tư vấn Lăn kim tái tạo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận thanh toán' }));
    await waitFor(() => expect(checkout).toHaveBeenCalled());
    expect(checkout.mock.calls[0][0].lines[0]).toMatchObject({ staffId: 2, consultantStaffId: 2 });
  });
});

describe('posLineKey', () => {
  it('keeps a package session apart from a paid line for the same service', () => {
    expect(posLineKey({ itemType: 'service', itemId: 7 })).not.toBe(posLineKey({ itemType: 'service', itemId: 7, usePackageId: 3 }));
    expect(posLineKey({ itemType: 'service', itemId: 7, usePackageId: null })).toBe(posLineKey({ itemType: 'service', itemId: 7 }));
  });
});
