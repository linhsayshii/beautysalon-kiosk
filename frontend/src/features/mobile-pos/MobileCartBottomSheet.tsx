import { resynchronizeRealtimeQueries } from '@/context/RealtimeQuerySynchronizer';
import { PartialPaymentFields } from '@/features/debts/PartialPaymentFields';
import { CustomerDebtPanel } from '@/features/debts/CustomerDebtPanel';
import { usePaymentRequestKey } from '@/features/debts/debts.api';
import { useState, useMemo } from 'react';
import type { RefObject } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatMoney } from '@/lib/format';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { Select } from '@/components/ui/Select/Select';
import { searchPosCustomers, checkoutPosInvoice, getPosStaff, type PosReceiptData } from '@/features/pos/pos.api';
import { useMobileDialog } from '@/features/mobile-common/useMobileDialog';
import { MobileDialogPortal } from '@/features/mobile-common/MobileDialogPortal';

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
  usePackageId?: number | null;
  usePackageServiceId?: number | null;
  commissionType: 'percent' | 'fixed' | null;
  commissionRate: number;
}

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
  onUpdateQuantity: (itemId: number, itemType: string, delta: number) => void;
  onUpdateLineStaff: (itemId: number, itemType: string, staffId: number | null) => void;
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
  const { dialogRef, titleId } = useMobileDialog({ isOpen: true, onClose: () => { if (!checkoutMutation.isPending) onClose(); } });

  // Fetch staff list
  const { data: staffResponse } = useQuery({
    queryKey: ['pos-staff'],
    queryFn: getPosStaff,
  });
  const staffList = staffResponse?.data || [];

  // Customer search query
  const { data: customerResults } = useQuery({
    queryKey: ['pos-customer-search', customerQuery],
    queryFn: () => searchPosCustomers(customerQuery),
    enabled: customerQuery.trim().length >= 1,
  });

  const subtotal = useMemo(() => {
    return lines.reduce((sum, line) => sum + line.salePrice * line.quantity, 0);
  }, [lines]);

  const total = Math.max(0, subtotal - discountValue);

  // Calculate expected commission for a line
  const calculateExpectedCommission = (line: PosLine): string => {
    if (!line.staffId) return '-';
    if (!line.commissionType || !line.commissionRate) return '0đ';

    const revenue = line.salePrice * line.quantity;
    let amount = 0;

    if (line.commissionType === 'percent') {
      amount = revenue * line.commissionRate / 100;
    } else {
      amount = line.quantity * line.commissionRate;
    }

    return formatMoney(Math.round(amount));
  };

  // Calculate total expected commission
  const totalCommission = useMemo(() => {
    return lines.reduce((sum, line) => {
      if (!line.staffId) return sum;
      if (!line.commissionType || !line.commissionRate) return sum;

      const revenue = line.salePrice * line.quantity;
      let amount = 0;

      if (line.commissionType === 'percent') {
        amount = revenue * line.commissionRate / 100;
      } else {
        amount = line.quantity * line.commissionRate;
      }

      return sum + amount;
    }, 0);
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
        usePackageId: l.usePackageId ?? undefined,
        usePackageServiceId: l.usePackageServiceId ?? undefined,
      })),
    } as any);
  };

  return (
    <MobileDialogPortal>
    <div className="mobile-bottom-sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !checkoutMutation.isPending) onClose(); }}>
      <div ref={dialogRef as RefObject<HTMLDivElement>} className="mobile-bottom-sheet mobile-checkout-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="mobile-sheet-drag-handle" />

        <div className="mobile-cart-sheet-header">
          <div><h2 id={titleId} className="mobile-cart-sheet-title">Thanh toán</h2>
            <div className="checkout-invoice-identity"><strong>{customer?.name || 'Chưa chọn khách hàng'}</strong>{invoiceId && <small>{invoiceCode || `Hóa đơn #${invoiceId}`}</small>}</div></div>
          <button type="button" className="mobile-pos-search-clear" onClick={onClose} disabled={checkoutMutation.isPending} aria-label="Đóng">
            <i className="ph ph-x" />
          </button>
        </div>

        <div className="mobile-cart-sheet-content" inert={checkoutMutation.isPending}>
          {/* Customer Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-700)' }}>Khách hàng</span>
            {customer ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: '#eff6ff',
                borderRadius: 12,
                border: '1px solid #bfdbfe'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="ph ph-user-circle" style={{ fontSize: 20, color: '#2563eb' }} />
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{customer.name}</div>
                    {customer.phone && <div style={{ fontSize: 11.5, color: '#64748b' }}>{customer.phone}</div>}
                  </div>
                </div>
                {!customerLocked && <button
                  type="button"
                  aria-label={`Bỏ chọn khách hàng ${customer.name}`}
                  style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                  onClick={() => onSelectCustomer(null)}
                >
                  Bỏ chọn
                </button>}
                {customerLocked && <span className="checkout-customer-locked"><i className="ph ph-lock" /> Theo lịch hẹn</span>}
              </div>
            ) : (
              <div>
                {!showCustomerSearch ? (
                  <button
                    type="button"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 12,
                      border: '1px dashed #cbd5e1',
                      background: '#ffffff',
                      color: '#475569',
                      fontSize: 13,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      cursor: 'pointer'
                    }}
                    onClick={() => setShowCustomerSearch(true)}
                  >
                    <i className="ph ph-user-plus" /> Chọn khách hàng
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div className="mobile-pos-search-wrapper">
                      <i className="ph ph-magnifying-glass search-icon" />
                      <input
                        type="text"
                        className="mobile-pos-search-input"
                        placeholder="Tìm tên hoặc SĐT khách hàng..."
                        aria-label="Tìm khách hàng theo tên hoặc số điện thoại"
                        value={customerQuery}
                        onChange={(e) => setCustomerQuery(e.target.value)}
                        autoFocus
                      />
                      <button type="button" className="mobile-pos-search-clear" onClick={() => setShowCustomerSearch(false)} aria-label="Đóng tìm khách hàng">
                        <i className="ph ph-x" />
                      </button>
                    </div>

                    {customerResults?.data && customerResults.data.length > 0 && (
                      <div style={{
                        maxHeight: 140,
                        overflowY: 'auto',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 12,
                        padding: 4
                      }}>
                        {customerResults.data.map((c) => (
                          <button
                            type="button"
                            key={c.id}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 8,
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: 13
                            }}
                            onClick={() => {
                              onSelectCustomer({ id: c.id, name: c.name, phone: c.phone });
                              setShowCustomerSearch(false);
                              setCustomerQuery('');
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>{c.name}</span>
                            <span style={{ color: '#64748b', fontSize: 12 }}>{c.phone}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cart Item List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-700)' }}>Dịch vụ, sản phẩm ({lines.length})</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {lines.map((line) => (
                <div key={`${line.itemType}-${line.itemId}`} className="mobile-cart-item-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="mobile-cart-item-title">{line.name}</div>
                    <div className="mobile-cart-item-unitprice">{formatMoney(line.salePrice)} / {line.unit || 'món'}</div>
                  </div>

                  <div className="mobile-cart-qty-ctrl">
                    <button
                      type="button"
                      className="mobile-cart-qty-btn"
                      aria-label={`Giảm số lượng ${line.name}`}
                      onClick={() => onUpdateQuantity(line.itemId, line.itemType, -1)}
                    >
                      <i className="ph ph-minus" />
                    </button>
                    <span className="mobile-cart-qty-val">{line.quantity}</span>
                    <button
                      type="button"
                      className="mobile-cart-qty-btn"
                      aria-label={`Tăng số lượng ${line.name}`}
                      onClick={() => onUpdateQuantity(line.itemId, line.itemType, 1)}
                    >
                      <i className="ph ph-plus" />
                    </button>
                  </div>

                  <div className="checkout-line-amounts">
                    {line.itemType === 'service' && line.staffId != null && (
                      <span className="checkout-commission" aria-label={`Hoa hồng ${line.name}: ${calculateExpectedCommission(line)}`} title="Hoa hồng nhân viên">
                        {calculateExpectedCommission(line)}
                      </span>
                    )}
                    <strong>{formatMoney(line.salePrice * line.quantity)}</strong>
                  </div>
                  {line.itemType === 'service' && <div className="checkout-line-staff">
                    <span>Nhân viên</span><Select<number | string> aria-label={`Nhân viên thực hiện ${line.name}`} value={line.staffId ?? ''}
                      onChange={value => onUpdateLineStaff(line.itemId, line.itemType, value === '' ? null : Number(value))}
                      size="sm" options={[{ value: '', label: 'Chọn nhân viên' }, ...staffList.map(staff => ({ value: staff.id, label: staff.name }))]} />
                  </div>}
                </div>
              ))}
            </div>
          </div>

          {/* Staff selection - removed, using per-line assignment above */}

          {/* Discount input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-700)' }}>Giảm giá (VNĐ)</span>
            <MoneyInput
              aria-label="Giảm giá"
              disabled={checkoutMutation.isPending}
              placeholder="0"
              value={discountValue}
              onChange={(val) => setDiscountValue(val)}
              suffix="đ"
              wrapperClassName="input-suffix mobile-money-input"
            />
          </div>

          {/* Summary */}
          <div className="mobile-checkout-summary">
            <div className="mobile-summary-row">
              <span style={{ color: '#64748b' }}>Tạm tính:</span>
              <span style={{ fontWeight: 600 }}>{formatMoney(subtotal)}</span>
            </div>
            {discountValue > 0 && (
              <div className="mobile-summary-row" style={{ color: '#dc2626' }}>
                <span>Giảm giá:</span>
                <span>-{formatMoney(discountValue)}</span>
              </div>
            )}
            {totalCommission > 0 && <div className="mobile-summary-row checkout-commission"><span>Hoa hồng dự kiến:</span><span>{formatMoney(totalCommission)}</span></div>}
            <div className="mobile-summary-row total-row">
              <span>Tổng hóa đơn:</span>
              <span style={{ color: 'var(--blue-700)' }}>{formatMoney(total)}</span>
            </div>
          </div>

          {/* Payment Method */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-700)' }}>Phương thức thanh toán</span>
            <div className="mobile-payment-methods">
              <button
                type="button"
                aria-pressed={paymentMethod === 'cash'}
                className={`mobile-pay-method-btn ${paymentMethod === 'cash' ? 'is-active' : ''}`}
                onClick={() => setPaymentMethod('cash')}
              >
                <i className="ph ph-money" />
                Tiền mặt
              </button>
              <button
                type="button"
                aria-pressed={paymentMethod === 'bank_transfer'}
                className={`mobile-pay-method-btn ${paymentMethod === 'bank_transfer' ? 'is-active' : ''}`}
                onClick={() => setPaymentMethod('bank_transfer')}
              >
                <i className="ph ph-qr-code" />
                VietQR / CK
              </button>
              <button
                type="button"
                aria-pressed={paymentMethod === 'card'}
                className={`mobile-pay-method-btn ${paymentMethod === 'card' ? 'is-active' : ''}`}
                onClick={() => setPaymentMethod('card')}
              >
                <i className="ph ph-credit-card" />
                Quẹt thẻ
              </button>
              <button
                type="button"
                aria-pressed={paymentMethod === 'wallet'}
                className={`mobile-pay-method-btn ${paymentMethod === 'wallet' ? 'is-active' : ''}`}
                onClick={() => setPaymentMethod('wallet')}
              >
                <i className="ph ph-wallet" />
                Thẻ TK
              </button>
            </div>
          </div>

          <PartialPaymentFields customerId={customer?.id} total={total} amount={amountPaid} onAmountChange={setAmountInput} allowDebt={allowDebt} onAllowDebtChange={setAllowDebt} method={paymentMethod} compact disabled={checkoutMutation.isPending} />
          {customer && <><button className="checkout-debt-toggle" type="button" onClick={()=>setShowDebt(!showDebt)}>{showDebt ? 'Ẩn công nợ' : 'Xem chi tiết công nợ / Thu nợ cũ'}</button>{showDebt && <CustomerDebtPanel key={customer.id} customerId={customer.id} />}</>}
        </div>
        <div className="mobile-checkout-footer">
          <div className="checkout-collect-total"><span>Thu hóa đơn lần này</span><strong>{formatMoney(Math.min(total, amountPaid))}</strong></div>
          {checkoutMutation.isError && <p role="alert">{checkoutMutation.error instanceof Error ? checkoutMutation.error.message : 'Không thể thanh toán. Vui lòng thử lại.'}</p>}
          {/* Submit Checkout */}
          <button
            type="button"
            className="mobile-checkout-submit-btn"
            disabled={checkoutMutation.isPending || lines.length === 0 || !customer || (amountPaid < total && !allowDebt) || (paymentMethod !== 'cash' && amountPaid > total)}
            onClick={handleCheckout}
          >
            {checkoutMutation.isPending ? (
              <span>Đang xử lý thanh toán...</span>
            ) : (
              <>
                <i className="ph ph-check-circle" style={{ fontSize: 20 }} />
                <span>Xác nhận thanh toán</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
    </MobileDialogPortal>
  );
}
