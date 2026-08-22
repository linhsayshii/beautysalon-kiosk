import { useState, useMemo } from 'react';
import type { RefObject } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { formatMoney } from '@/lib/format';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { searchPosCustomers, checkoutPosInvoice, getPosStaff, type PosReceiptData } from '@/features/pos/pos.api';
import { useMobileDialog } from '@/features/mobile-common/useMobileDialog';

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
  incompleteServiceCount = 0,
  onSelectCustomer,
  onUpdateQuantity,
  onUpdateLineStaff,
  onClose,
  onSuccess,
}: MobileCartBottomSheetProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [customerQuery, setCustomerQuery] = useState('');
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const { dialogRef, titleId } = useMobileDialog({ isOpen: true, onClose });

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
      amount = revenue * line.commissionRate;
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
        amount = revenue * line.commissionRate;
      } else {
        amount = line.quantity * line.commissionRate;
      }

      return sum + amount;
    }, 0);
  }, [lines]);

  const checkoutMutation = useMutation({
    mutationFn: checkoutPosInvoice,
    onSuccess: (res) => {
      onSuccess(res.data);
    },
  });

  const handleCheckout = () => {
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
      amountPaid: total,
      appointmentId,
      invoiceId,
      lines: lines.map((l) => ({
        itemId: l.itemId,
        itemType: l.itemType,
        quantity: l.quantity,
        staffId: l.staffId || null,
      })),
    } as any);
  };

  return (
    <div className="mobile-bottom-sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef as RefObject<HTMLDivElement>} className="mobile-bottom-sheet" style={{ maxHeight: '90dvh' }} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="mobile-sheet-drag-handle" />

        <div className="mobile-cart-sheet-header">
          <h2 id={titleId} className="mobile-cart-sheet-title">Chi tiết giỏ hàng & Thanh toán</h2>
          <button type="button" className="mobile-pos-search-clear" onClick={onClose} aria-label="Đóng">
            <i className="ph ph-x" />
          </button>
        </div>

        <div className="mobile-cart-sheet-content">
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
                <button
                  type="button"
                  aria-label={`Bỏ chọn khách hàng ${customer.name}`}
                  style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                  onClick={() => onSelectCustomer(null)}
                >
                  Bỏ chọn
                </button>
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
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-700)' }}>Món đã chọn ({lines.length})</span>
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

                  <div style={{ minWidth: 70, textAlign: 'right', fontWeight: 700, fontSize: 13 }}>
                    {formatMoney(line.salePrice * line.quantity)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Staff assignment per line item */}
          {staffList.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-700)' }}>Nhân viên thực hiện</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {lines.map((line) => (
                  <div key={`staff-${line.itemType}-${line.itemId}`} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '8px 0',
                    borderBottom: '1px dashed var(--line, #e2e8f0)'
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-800)' }}>{line.name}</span>
                      {line.quantity > 1 && <span style={{ fontSize: 11.5, color: 'var(--ink-500)', marginLeft: 6 }}>x{line.quantity}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <select
                        aria-label={`Nhân viên thực hiện ${line.name}`}
                        value={line.staffId ?? ''}
                        onChange={(e) => onUpdateLineStaff(line.itemId, line.itemType, e.target.value ? Number(e.target.value) : null)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 8,
                          border: '1px solid var(--line, #e2e8f0)',
                          background: 'var(--surface, #ffffff)',
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: 'var(--ink-800)',
                          minWidth: 100,
                          maxWidth: 140
                        }}
                      >
                        <option value="">-- Chọn NV --</option>
                        {staffList.map((st) => (
                          <option key={st.id} value={st.id}>{st.name}</option>
                        ))}
                      </select>
                      {line.staffId && (
                        <span style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: '#059669',
                          background: '#ecfdf5',
                          padding: '2px 8px',
                          borderRadius: 10,
                          whiteSpace: 'nowrap'
                        }}>
                          HH: {calculateExpectedCommission(line)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Staff selection - removed, using per-line assignment above */}

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

          {/* Discount input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-700)' }}>Giảm giá (VNĐ)</span>
            <MoneyInput
              aria-label="Giảm giá"
              placeholder="0"
              value={discountValue}
              onChange={(val) => setDiscountValue(val)}
              suffix="đ"
              style={{
                width: '100%',
                minHeight: 44,
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                padding: '0 10px',
                background: '#ffffff',
                fontSize: 13.5,
                fontWeight: 600,
                color: 'var(--ink-950)',
                boxSizing: 'border-box'
              }}
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
            {totalCommission > 0 && (
              <div className="mobile-summary-row" style={{ color: '#059669' }}>
                <span>HH dự kiến:</span>
                <span style={{ fontWeight: 700 }}>{formatMoney(totalCommission)}</span>
              </div>
            )}
            <div className="mobile-summary-row total-row">
              <span>Tổng thanh toán:</span>
              <span style={{ color: 'var(--blue-700)' }}>{formatMoney(total)}</span>
            </div>
          </div>

          {/* Submit Checkout */}
          <button
            type="button"
            className="mobile-checkout-submit-btn"
            disabled={checkoutMutation.isPending || lines.length === 0 || !customer}
            onClick={handleCheckout}
          >
            {checkoutMutation.isPending ? (
              <span>Đang xử lý thanh toán...</span>
            ) : (
              <>
                <i className="ph ph-check-circle" style={{ fontSize: 20 }} />
                <span>Thanh toán ngay ({formatMoney(total)})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
