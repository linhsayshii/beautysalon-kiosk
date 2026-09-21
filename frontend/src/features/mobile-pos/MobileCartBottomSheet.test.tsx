import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MobileCartBottomSheet } from './MobileCartBottomSheet';
import * as posApi from '@/features/pos/pos.api';

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
function show(overrides: Partial<typeof props> = {}) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><MobileCartBottomSheet {...props} {...overrides} /></QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(posApi, 'getPosStaff').mockResolvedValue({ data: [{ id: 2, name: 'Em Huệ' }], meta: {} });
});
describe('Mobile checkout identity and payment safety', () => {
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
});
