import { useState, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { formatMoney } from '@/lib/format';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { searchPosCustomers, checkoutPosInvoice, getPosStaff, type PosReceiptData } from '@/features/pos/pos.api';

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
}

interface PosCustomer {
  id: number;
  name: string;
  phone?: string;
}

interface MobileCartBottomSheetProps {
  lines: PosLine[];
  customer: PosCustomer | null;
  onSelectCustomer: (cust: PosCustomer | null) => void;
  onUpdateQuantity: (itemId: number, itemType: string, delta: number) => void;
  onClose: () => void;
  onSuccess: (receipt: PosReceiptData) => void;
}

type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'wallet';

export function MobileCartBottomSheet({
  lines,
  customer,
  onSelectCustomer,
  onUpdateQuantity,
  onClose,
  onSuccess,
}: MobileCartBottomSheetProps) {
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [customerQuery, setCustomerQuery] = useState('');
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);

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

  const checkoutMutation = useMutation({
    mutationFn: checkoutPosInvoice,
    onSuccess: (res) => {
      onSuccess(res.data);
    },
  });

  const handleCheckout = () => {
    if (lines.length === 0) return;
    checkoutMutation.mutate({
      customerId: customer?.id ?? null,
      staffId: selectedStaffId ? Number(selectedStaffId) : null,
      discount: discountValue,
      paymentMethod,
      amountPaid: total,
      lines: lines.map((l) => ({
        itemId: l.itemId,
        itemType: l.itemType,
        quantity: l.quantity,
        staffId: l.staffId || (selectedStaffId ? Number(selectedStaffId) : null),
      })),
    });
  };

  return (
    <div className="mobile-bottom-sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mobile-bottom-sheet" style={{ maxHeight: '90dvh' }}>
        <div className="mobile-sheet-drag-handle" />

        <div className="mobile-cart-sheet-header">
          <h2 className="mobile-cart-sheet-title">Chi tiết giỏ hàng & Thanh toán</h2>
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
                    <i className="ph ph-user-plus" /> Thêm khách hàng (Tùy chọn)
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div className="mobile-pos-search-wrapper">
                      <i className="ph ph-magnifying-glass search-icon" />
                      <input
                        type="text"
                        className="mobile-pos-search-input"
                        placeholder="Tìm tên hoặc SĐT khách hàng..."
                        value={customerQuery}
                        onChange={(e) => setCustomerQuery(e.target.value)}
                        autoFocus
                      />
                      <button type="button" className="mobile-pos-search-clear" onClick={() => setShowCustomerSearch(false)}>
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
                          <div
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
                          </div>
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
                      onClick={() => onUpdateQuantity(line.itemId, line.itemType, -1)}
                    >
                      <i className="ph ph-minus" />
                    </button>
                    <span className="mobile-cart-qty-val">{line.quantity}</span>
                    <button
                      type="button"
                      className="mobile-cart-qty-btn"
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

          {/* Staff selection */}
          {staffList.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-700)' }}>Kỹ thuật viên / Nhân viên phục vụ</span>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                style={{
                  width: '100%',
                  height: 40,
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  padding: '0 10px',
                  background: '#ffffff',
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: 'var(--ink-950)'
                }}
              >
                <option value="">-- Chọn nhân viên thực hiện (Tùy chọn) --</option>
                {staffList.map((st) => (
                  <option key={st.id} value={st.id}>{st.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Payment Method */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-700)' }}>Phương thức thanh toán</span>
            <div className="mobile-payment-methods">
              <button
                type="button"
                className={`mobile-pay-method-btn ${paymentMethod === 'cash' ? 'is-active' : ''}`}
                onClick={() => setPaymentMethod('cash')}
              >
                <i className="ph ph-money" />
                Tiền mặt
              </button>
              <button
                type="button"
                className={`mobile-pay-method-btn ${paymentMethod === 'bank_transfer' ? 'is-active' : ''}`}
                onClick={() => setPaymentMethod('bank_transfer')}
              >
                <i className="ph ph-qr-code" />
                VietQR / CK
              </button>
              <button
                type="button"
                className={`mobile-pay-method-btn ${paymentMethod === 'card' ? 'is-active' : ''}`}
                onClick={() => setPaymentMethod('card')}
              >
                <i className="ph ph-credit-card" />
                Quẹt thẻ
              </button>
              <button
                type="button"
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
              placeholder="0"
              value={discountValue}
              onChange={(val) => setDiscountValue(val)}
              suffix="đ"
              style={{
                width: '100%',
                height: 40,
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
            <div className="mobile-summary-row total-row">
              <span>Tổng thanh toán:</span>
              <span style={{ color: 'var(--blue-700)' }}>{formatMoney(total)}</span>
            </div>
          </div>

          {/* Submit Checkout */}
          <button
            type="button"
            className="mobile-checkout-submit-btn"
            disabled={checkoutMutation.isPending || lines.length === 0}
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
