import { resynchronizeRealtimeQueries } from '@/context/RealtimeQuerySynchronizer';
import { PartialPaymentFields } from '@/features/debts/PartialPaymentFields';
import { CustomerDebtPanel } from '@/features/debts/CustomerDebtPanel';
import { usePaymentRequestKey } from '@/features/debts/debts.api';
import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatMoney } from '@/lib/format';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { Select } from '@/components/ui/Select/Select';
import { searchPosCustomers, checkoutPosInvoice, getPosStaff, type PosReceiptData } from '@/features/pos/pos.api';
import { BottomSheet } from '@/components/ui/Sheet/BottomSheet';
import { PAYMENT_METHOD_LABELS } from '@/lib/payment-methods';
import { expectedLineCommission } from '@/features/pos/commission';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/DataState';
import { MobileSearchBar } from '@/features/mobile-common/MobileSearchBar';

interface PosLine {
  itemId: number;
  itemType: 'product' | 'service' | 'package' | 'account_card';
  code: string;
  name: string;
  category: string;
  unit: string;
  salePrice: number;
  quantity: number;
  staffId?: number | null;
  consultantStaffId?: number | null;
  usePackageId?: number | null;
  usePackageServiceId?: number | null;
  commissionType: 'percent' | 'fixed' | null;
  commissionRate: number;
  tourCommissionType?: 'percent' | 'fixed' | null;
  tourCommissionRate?: number;
}

/** A package session and a paid line for the same service are separate lines. */
export const posLineKey = (line: Pick<PosLine, 'itemType' | 'itemId' | 'usePackageId'>) => `${line.itemType}:${line.itemId}:${line.usePackageId ?? ''}`;

interface PosCustomer {
  id: number;
  name: string;
  phone?: string;
}

interface MobileCartBottomSheetProps {
  lines: PosLine[];
  customer: PosCustomer | null;
  appointmentId?: number | null;
  invoiceId?: number | null;
  invoiceCode?: string;
  customerLocked?: boolean;
  initialDiscount?: number;
  incompleteServiceCount?: number;
  onSelectCustomer: (cust: PosCustomer | null) => void;
  onUpdateQuantity: (lineKey: string, delta: number) => void;
  onUpdateLineStaff: (lineKey: string, staffId: number | null) => void;
  onUpdateLineConsultant?: (lineKey: string, consultantStaffId: number | null) => void;
  onClose: () => void;
  onSuccess: (receipt: PosReceiptData) => void;
}

type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'wallet';

export function MobileCartBottomSheet({
  lines,
  customer,
  appointmentId,
  invoiceId,
  invoiceCode,
  customerLocked = false,
  initialDiscount = 0,
  incompleteServiceCount = 0,
  onSelectCustomer,
  onUpdateQuantity,
  onUpdateLineStaff,
  onUpdateLineConsultant,
  onClose,
  onSuccess,
}: MobileCartBottomSheetProps) {
  const [amountInput, setAmountInput] = useState<number | null>(null);
  const [allowDebt, setAllowDebt] = useState(false);
  const [showDebt, setShowDebt] = useState(false);
  const requestKey = usePaymentRequestKey();
  const queryClient = useQueryClient();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [discountValue, setDiscountValue] = useState<number>(initialDiscount);
  const [customerQuery, setCustomerQuery] = useState('');
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);

  // Fetch staff list
  const { data: staffResponse } = useQuery({
    queryKey: ['pos-staff'],
    queryFn: getPosStaff,
  });
  const staffList = staffResponse?.data || [];

  // Customer search query
  const customerSearch = useQuery({
    queryKey: ['pos-customer-search', customerQuery],
    queryFn: () => searchPosCustomers(customerQuery),
    enabled: showCustomerSearch && customerQuery.trim().length >= 1,
  });
  const customerResults = customerSearch.data;

  const subtotal = useMemo(() => {
    return lines.reduce((sum, line) => sum + line.salePrice * line.quantity, 0);
  }, [lines]);

  const total = Math.max(0, subtotal - discountValue);

  const lineCommission = (line: PosLine) => expectedLineCommission({
    ...line,
    unitPrice: line.salePrice,
    isPackageRedemption: Boolean(line.usePackageId),
  });
  const calculateExpectedCommission = (line: PosLine): string => formatMoney(lineCommission(line).total);

  // Calculate total expected commission
  const totalCommission = useMemo(() => {
    return lines.reduce((sum, line) => sum + lineCommission(line).total, 0);
  }, [lines]);

  const amountPaid = paymentMethod === 'wallet' ? total : amountInput ?? total;
  const checkoutMutation = useMutation({
    mutationFn: (payload: Parameters<typeof checkoutPosInvoice>[0]) => checkoutPosInvoice({...payload,requestKey:requestKey(payload)}),
    onSuccess: (res) => {
      resynchronizeRealtimeQueries(queryClient);
      onSuccess(res.data);
    },
  });

  const handleCheckout = () => {
    if (checkoutMutation.isPending || (amountPaid < total && !allowDebt) || (paymentMethod !== 'cash' && amountPaid > total)) return;
    if (lines.length === 0) return;
    if (!customer) return;
    if (incompleteServiceCount > 0 && !window.confirm(
      `Hóa đơn còn ${incompleteServiceCount} dịch vụ chưa hoàn thành. Bạn vẫn muốn thanh toán?`,
    )) return;
    checkoutMutation.mutate({
      customerId: customer.id,
      staffId: null,
      discount: discountValue,
      paymentMethod,
      amountPaid,
      allowDebt,
      appointmentId,
      invoiceId,
      lines: lines.map((l) => ({
        itemId: l.itemId,
        itemType: l.itemType,
        quantity: l.quantity,
        staffId: l.staffId || null,
        consultantStaffId: l.itemType === 'service' ? l.consultantStaffId || null : null,
        usePackageId: l.usePackageId ?? undefined,
        usePackageServiceId: l.usePackageServiceId ?? undefined,
      })),
    } as any);
  };

  return (
    <BottomSheet
      open
      onClose={() => { if (!checkoutMutation.isPending) onClose(); }}
      title="Thanh toán"
      subtitle={`${customer?.name || 'Chưa chọn khách hàng'}${invoiceId ? ` · ${invoiceCode || `Hóa đơn #${invoiceId}`}` : ''}`}
      height="full"
      className="mobile-checkout-sheet"
      closeOnBackdrop={!checkoutMutation.isPending}
      footer={(
        <div className="mobile-checkout-footer">
          <div className="checkout-collect-total"><span>Thu hóa đơn lần này</span><strong>{formatMoney(Math.min(total, amountPaid))}</strong></div>
          {checkoutMutation.isError && <p role="alert">{checkoutMutation.error instanceof Error ? checkoutMutation.error.message : 'Không thể thanh toán. Vui lòng thử lại.'}</p>}
          <button
            type="button"
            className="btn btn-primary btn-lg btn-block"
            disabled={checkoutMutation.isPending || lines.length === 0 || !customer || (amountPaid < total && !allowDebt) || (paymentMethod !== 'cash' && amountPaid > total)}
            onClick={handleCheckout}
          >
            {checkoutMutation.isPending ? (
              <span>Đang xử lý thanh toán...</span>
            ) : (
              <>
                <i className="ph ph-check-circle" />
                <span>Xác nhận thanh toán</span>
              </>
            )}
          </button>
        </div>
      )}
    >
      <div className="mobile-cart-sheet-content" inert={checkoutMutation.isPending}>
        <section className="m-section">
          <span className="m-section-title">Khách hàng</span>
          {customer ? (
            <div className="checkout-customer-card">
              <i className="ph ph-user-circle" />
              <div className="checkout-customer-copy">
                <strong>{customer.name}</strong>
                {customer.phone && <small>{customer.phone}</small>}
              </div>
              {!customerLocked && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm text-danger"
                  aria-label={`Bỏ chọn khách hàng ${customer.name}`}
                  onClick={() => onSelectCustomer(null)}
                >
                  Bỏ chọn
                </button>
              )}
              {customerLocked && <span className="checkout-customer-locked"><i className="ph ph-lock" /> Theo lịch hẹn</span>}
            </div>
          ) : !showCustomerSearch ? (
            <button type="button" className="checkout-customer-add" onClick={() => setShowCustomerSearch(true)}>
              <i className="ph ph-user-plus" /> Chọn khách hàng
            </button>
          ) : (
            <>
              <MobileSearchBar
                value={customerQuery}
                onChange={setCustomerQuery}
                placeholder="Tên hoặc SĐT"
                ariaLabel="Tìm khách hàng theo tên hoặc số điện thoại"
                autoFocus
                action={<button type="button" className="btn btn-ghost" onClick={() => { setShowCustomerSearch(false); setCustomerQuery(''); }} aria-label="Đóng tìm khách hàng">Hủy</button>}
              />

              {customerQuery.trim() && (customerSearch.isPending ? <LoadingState compact />
                : customerSearch.error ? <ErrorState compact error={customerSearch.error} onRetry={() => customerSearch.refetch()} />
                : !customerResults?.data.length ? <EmptyState compact title="Không tìm thấy khách hàng" message={null} /> : (
                <div className="m-list checkout-customer-results">
                  {customerResults.data.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      className="m-list-row"
                      onClick={() => {
                        onSelectCustomer({ id: c.id, name: c.name, phone: c.phone });
                        setShowCustomerSearch(false);
                        setCustomerQuery('');
                      }}
                    >
                      <span className="m-list-avatar" aria-hidden="true"><i className="ph ph-user-circle" /></span>
                      <span className="m-list-copy"><strong>{c.name}</strong><small>{c.phone}</small></span>
                      <i className="ph ph-caret-right" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              ))}
            </>
          )}
        </section>

        {/* Cart Item List */}
        <section className="m-section">
          <span className="m-section-title">Dịch vụ, sản phẩm ({lines.length})</span>
          <div className="checkout-line-list">
            {lines.map((line) => (
              <div key={posLineKey(line)} className="mobile-cart-item-row">
                <div className="mobile-cart-item-copy">
                  <div className="mobile-cart-item-title">{line.name}</div>
                  <div className="mobile-cart-item-unitprice">{formatMoney(line.salePrice)} / {line.unit || 'món'}</div>
                </div>

                <div className="mobile-cart-qty-ctrl">
                  <button
                    type="button"
                    className="mobile-cart-qty-btn"
                    aria-label={`Giảm số lượng ${line.name}`}
                    onClick={() => onUpdateQuantity(posLineKey(line), -1)}
                  >
                    <i className="ph ph-minus" />
                  </button>
                  <span className="mobile-cart-qty-val">{line.quantity}</span>
                  <button
                    type="button"
                    className="mobile-cart-qty-btn"
                    aria-label={`Tăng số lượng ${line.name}`}
                    onClick={() => onUpdateQuantity(posLineKey(line), 1)}
                  >
                    <i className="ph ph-plus" />
                  </button>
                </div>

                <div className="checkout-line-amounts">
                  {line.itemType === 'service' && (line.staffId != null || line.consultantStaffId != null) && (
                    <span className="checkout-commission" aria-label={`Hoa hồng ${line.name}: ${calculateExpectedCommission(line)}`} title="Hoa hồng nhân viên">
                      {calculateExpectedCommission(line)}
                    </span>
                  )}
                  <strong>{formatMoney(line.salePrice * line.quantity)}</strong>
                </div>
                {line.itemType === 'service' && <div className="checkout-line-staff">
                  <span>Nhân viên</span><Select<number | string> aria-label={`Nhân viên thực hiện ${line.name}`} value={line.staffId ?? ''}
                    onChange={value => onUpdateLineStaff(posLineKey(line), value === '' ? null : Number(value))}
                    size="sm" options={[{ value: '', label: 'Chọn nhân viên' }, ...staffList.map(staff => ({ value: staff.id, label: staff.name }))]} />
                </div>}
                {line.itemType === 'service' && onUpdateLineConsultant && <div className="checkout-line-staff">
                  <span>Tư vấn</span><Select<number | string> aria-label={`Nhân viên tư vấn ${line.name}`} value={line.consultantStaffId ?? ''}
                    onChange={value => onUpdateLineConsultant(posLineKey(line), value === '' ? null : Number(value))}
                    size="sm" options={[{ value: '', label: 'Không có' }, ...staffList.map(staff => ({ value: staff.id, label: staff.name }))]} />
                </div>}
              </div>
            ))}
          </div>
        </section>

        <section className="m-section">
          <span className="m-section-title">Giảm giá (VNĐ)</span>
          <MoneyInput
            aria-label="Giảm giá"
            disabled={checkoutMutation.isPending}
            placeholder="0"
            value={discountValue}
            onChange={(val) => setDiscountValue(val)}
            suffix="đ"
            wrapperClassName="input-suffix mobile-money-input"
          />
        </section>

        {/* Summary */}
        <div className="mobile-checkout-summary">
          <div className="mobile-summary-row">
            <span className="text-muted">Tạm tính:</span>
            <strong>{formatMoney(subtotal)}</strong>
          </div>
          {discountValue > 0 && (
            <div className="mobile-summary-row text-danger">
              <span>Giảm giá:</span>
              <span>-{formatMoney(discountValue)}</span>
            </div>
          )}
          {totalCommission > 0 && <div className="mobile-summary-row checkout-commission"><span>Hoa hồng dự kiến:</span><span>{formatMoney(totalCommission)}</span></div>}
          <div className="mobile-summary-row total-row">
            <span>Tổng hóa đơn:</span>
            <span className="text-primary">{formatMoney(total)}</span>
          </div>
        </div>

        {/* Payment Method */}
        <section className="m-section">
          <span className="m-section-title">Phương thức thanh toán</span>
          <div className="mobile-payment-methods">
            <button
              type="button"
              aria-pressed={paymentMethod === 'cash'}
              className={`mobile-pay-method-btn ${paymentMethod === 'cash' ? 'is-active' : ''}`}
              onClick={() => setPaymentMethod('cash')}
            >
              <i className="ph ph-money" />
              {PAYMENT_METHOD_LABELS.cash}
            </button>
            <button
              type="button"
              aria-pressed={paymentMethod === 'bank_transfer'}
              className={`mobile-pay-method-btn ${paymentMethod === 'bank_transfer' ? 'is-active' : ''}`}
              onClick={() => setPaymentMethod('bank_transfer')}
            >
              <i className="ph ph-qr-code" />
              {PAYMENT_METHOD_LABELS.bank_transfer}
            </button>
            <button
              type="button"
              aria-pressed={paymentMethod === 'card'}
              className={`mobile-pay-method-btn ${paymentMethod === 'card' ? 'is-active' : ''}`}
              onClick={() => setPaymentMethod('card')}
            >
              <i className="ph ph-credit-card" />
              {PAYMENT_METHOD_LABELS.card}
            </button>
            <button
              type="button"
              aria-pressed={paymentMethod === 'wallet'}
              className={`mobile-pay-method-btn ${paymentMethod === 'wallet' ? 'is-active' : ''}`}
              onClick={() => setPaymentMethod('wallet')}
            >
              <i className="ph ph-wallet" />
              {PAYMENT_METHOD_LABELS.wallet}
            </button>
          </div>
        </section>

        <PartialPaymentFields customerId={customer?.id} total={total} amount={amountPaid} onAmountChange={setAmountInput} allowDebt={allowDebt} onAllowDebtChange={setAllowDebt} method={paymentMethod} compact disabled={checkoutMutation.isPending} />
        {customer && <><button className="checkout-debt-toggle" type="button" onClick={()=>setShowDebt(!showDebt)}>{showDebt ? 'Ẩn công nợ' : 'Xem chi tiết công nợ / Thu nợ cũ'}</button>{showDebt && <CustomerDebtPanel key={customer.id} customerId={customer.id} />}</>}
      </div>
    </BottomSheet>
  );
}
