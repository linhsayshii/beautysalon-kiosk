import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { Select } from '@/components/ui/Select/Select';
import { formatMoney, formatNumber } from '@/lib/format';
import { useMetadata } from '@/services/metadata';
import { checkoutPosInvoice, type PosCheckoutPayload, type PosReceiptData } from '../pos.api';

interface PosLine {
  itemId: number;
  itemType: 'product' | 'service' | 'package' | 'account_card';
  code: string;
  name: string;
  category: string;
  unit: string;
  salePrice: number;
  quantity: number;
  staffId: number | null;
}

interface PosCustomer {
  id: number;
  name: string;
  phone?: string;
}

interface PosCheckoutModalProps {
  customer: PosCustomer | null;
  lines: PosLine[];
  staffList: Array<{ id: number; name: string; role: string }>;
  onClose: () => void;
  onSuccess: (receipt: PosReceiptData, shouldPrint: boolean) => void;
}

type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'wallet';

export function PosCheckoutModal({
  customer,
  lines,
  staffList,
  onClose,
  onSuccess,
}: PosCheckoutModalProps) {
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [amountPaidInput, setAmountPaidInput] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [shouldPrintReceipt, setShouldPrintReceipt] = useState<boolean>(false);
  const { data: metadata } = useMetadata();
  const vietqrConfig = metadata?.data?.system?.vietqr || {
    bankBin: 'ICB',
    accountNumber: '108868686868',
    accountName: 'ANNA CHILL BEAUTY',
  };

  const subtotal = useMemo(() => {
    return lines.reduce((sum, line) => sum + line.salePrice * line.quantity, 0);
  }, [lines]);

  const calculatedDiscount = useMemo(() => {
    if (discountType === 'percent') {
      const pct = Math.min(100, Math.max(0, discountValue));
      return Math.round((subtotal * pct) / 100);
    }
    return Math.min(subtotal, Math.max(0, discountValue));
  }, [subtotal, discountType, discountValue]);

  const total = Math.max(0, subtotal - calculatedDiscount);

  const amountPaid = useMemo(() => {
    if (!amountPaidInput.trim()) return total;
    const parsed = Number(amountPaidInput.replace(/\D/g, ''));
    return Number.isNaN(parsed) ? total : parsed;
  }, [amountPaidInput, total]);

  const changeAmount = Math.max(0, amountPaid - total);

  // Suggested cash amounts
  const suggestedCashAmounts = useMemo(() => {
    const list: number[] = [total];
    if (total <= 0) return [0];

    const roundUps = [50000, 100000, 200000, 500000, 1000000, 2000000];
    roundUps.forEach((denom) => {
      if (denom > total && !list.includes(denom)) {
        list.push(denom);
      }
    });

    const nextHundred = Math.ceil(total / 100000) * 100000;
    if (nextHundred > total && !list.includes(nextHundred)) list.push(nextHundred);

    const nextFiveHundred = Math.ceil(total / 500000) * 500000;
    if (nextFiveHundred > total && !list.includes(nextFiveHundred)) list.push(nextFiveHundred);

    return Array.from(new Set(list)).sort((a, b) => a - b).slice(0, 5);
  }, [total]);

  // VietQR URL for dynamic bank transfer
  const vietQrUrl = useMemo(() => {
    if (paymentMethod !== 'bank_transfer' || total <= 0) return '';
    const bankCode = vietqrConfig.bankBin || 'ICB';
    const accNum = vietqrConfig.accountNumber || '108868686868';
    const accName = encodeURIComponent(vietqrConfig.accountName || 'ANNA CHILL BEAUTY');
    const memo = encodeURIComponent(`THANH TOAN ${customer?.name ? customer.name.slice(0, 15) : 'SPA'}`);
    return `https://img.vietqr.io/image/${bankCode}-${accNum}-qr_only.png?amount=${total}&addInfo=${memo}&accountName=${accName}`;
  }, [paymentMethod, total, customer, vietqrConfig]);

  const checkoutMutation = useMutation({
    mutationFn: (print: boolean) => {
      setShouldPrintReceipt(print);
      const payload: PosCheckoutPayload = {
        customerId: customer?.id ?? null,
        staffId: selectedStaffId ? Number(selectedStaffId) : null,
        discount: calculatedDiscount,
        paymentMethod,
        amountPaid: paymentMethod === 'cash' ? amountPaid : total,
        note: note.trim() || undefined,
        lines: lines.map((line) => ({
          itemType: line.itemType,
          itemId: line.itemId,
          quantity: line.quantity,
          staffId: line.staffId ?? undefined,
        })),
      };
      return checkoutPosInvoice(payload);
    },
    onSuccess: (response) => {
      onSuccess(response.data, shouldPrintReceipt);
    },
  });

  const handleSubmit = (event: FormEvent, print: boolean) => {
    event.preventDefault();
    if (checkoutMutation.isPending) return;
    checkoutMutation.mutate(print);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="pos-checkout-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pos-checkout-modal" role="dialog" aria-modal="true" aria-labelledby="checkout-modal-title">
        <header className="pos-checkout-header">
          <div className="pos-checkout-header-title">
            <span className="pos-checkout-badge">
              <i className="ph ph-receipt" />
            </span>
            <div>
              <h2 id="checkout-modal-title">Thanh toán đơn hàng</h2>
              <p>Khách hàng: <strong>{customer ? `${customer.name} ${customer.phone ? `(${customer.phone})` : ''}` : 'Khách lẻ'}</strong></p>
            </div>
          </div>
          <button type="button" className="pos-checkout-close" onClick={onClose} aria-label="Đóng">
            <i className="ph ph-x" />
          </button>
        </header>

        <form onSubmit={(e) => handleSubmit(e, false)} className="pos-checkout-body">
          <div className="pos-checkout-grid">
            {/* Cột trái: Chi tiết món & Giảm giá */}
            <section className="pos-checkout-cart-summary">
              <div className="checkout-section-header">
                <h3>Chi tiết đơn ({lines.reduce((s, l) => s + l.quantity, 0)} món)</h3>
              </div>

              <div className="pos-checkout-lines-list">
                {lines.map((line) => (
                  <div className="pos-checkout-line-item" key={`${line.itemType}-${line.itemId}`}>
                    <div className="line-item-main">
                      <span className="line-item-name">{line.name}</span>
                      <small className="line-item-code">{line.code} · {formatMoney(line.salePrice)}</small>
                    </div>
                    <div className="line-item-qty">x{line.quantity}</div>
                    <strong className="line-item-total">{formatMoney(line.salePrice * line.quantity)}</strong>
                  </div>
                ))}
              </div>

              <div className="pos-checkout-calculation">
                <div className="calc-row">
                  <span>Tổng tiền hàng</span>
                  <strong>{formatMoney(subtotal)}</strong>
                </div>

                <div className="calc-discount-box">
                  <div className="discount-label-row">
                    <span>Chiết khấu / Giảm giá</span>
                    <div className="discount-type-toggle">
                      <button
                        type="button"
                        className={discountType === 'amount' ? 'is-active' : ''}
                        onClick={() => { setDiscountType('amount'); setDiscountValue(0); }}
                      >
                        VNĐ
                      </button>
                      <button
                        type="button"
                        className={discountType === 'percent' ? 'is-active' : ''}
                        onClick={() => { setDiscountType('percent'); setDiscountValue(0); }}
                      >
                        %
                      </button>
                    </div>
                  </div>
                  <div className="discount-input-row">
                    {discountType === 'percent' ? (
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={discountValue || ''}
                        onChange={(e) => setDiscountValue(Number(e.target.value))}
                        placeholder="Nhập % giảm giá (VD: 10)"
                      />
                    ) : (
                      <MoneyInput
                        value={discountValue || ''}
                        onChange={setDiscountValue}
                        placeholder="Nhập số tiền giảm"
                      />
                    )}
                    {calculatedDiscount > 0 && (
                      <span className="calculated-discount-text">
                        -{formatMoney(calculatedDiscount)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="calc-total-row">
                  <span>Khách cần trả</span>
                  <strong className="total-highlight">{formatMoney(total)}</strong>
                </div>
              </div>

              <div className="pos-checkout-note-box">
                <label htmlFor="checkout-note">Ghi chú đơn hàng</label>
                <textarea
                  id="checkout-note"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ghi chú dịch vụ, sở thích của khách..."
                />
              </div>
            </section>

            {/* Cột phải: Phương thức thanh toán & Thu tiền */}
            <section className="pos-checkout-payment-section">
              <div className="checkout-section-header">
                <h3>Phương thức & Thu tiền</h3>
              </div>

              {/* Nhân viên phục vụ */}
              <div className="checkout-field-group">
                <label className="checkout-label">Nhân viên phục vụ / tư vấn</label>
                <Select
                  value={selectedStaffId}
                  onChange={setSelectedStaffId}
                  placeholder="Chọn nhân viên (để tính hoa hồng)"
                  fullWidth
                  options={[
                    { value: '', label: 'Không chỉ định nhân viên' },
                    ...staffList.map((st) => ({
                      value: String(st.id),
                      label: `${st.name} (${st.role})`,
                    })),
                  ]}
                />
              </div>

              {/* Chọn phương thức thanh toán */}
              <div className="checkout-field-group">
                <label className="checkout-label">Phương thức thanh toán</label>
                <div className="payment-methods-grid">
                  <button
                    type="button"
                    className={`payment-method-card ${paymentMethod === 'cash' ? 'is-selected' : ''}`}
                    onClick={() => setPaymentMethod('cash')}
                  >
                    <i className="ph ph-money" />
                    <span>Tiền mặt</span>
                  </button>
                  <button
                    type="button"
                    className={`payment-method-card ${paymentMethod === 'bank_transfer' ? 'is-selected' : ''}`}
                    onClick={() => setPaymentMethod('bank_transfer')}
                  >
                    <i className="ph ph-qr-code" />
                    <span>Chuyển khoản (VietQR)</span>
                  </button>
                  <button
                    type="button"
                    className={`payment-method-card ${paymentMethod === 'card' ? 'is-selected' : ''}`}
                    onClick={() => setPaymentMethod('card')}
                  >
                    <i className="ph ph-credit-card" />
                    <span>Quẹt thẻ POS</span>
                  </button>
                  <button
                    type="button"
                    className={`payment-method-card ${paymentMethod === 'wallet' ? 'is-selected' : ''}`}
                    onClick={() => setPaymentMethod('wallet')}
                  >
                    <i className="ph ph-wallet" />
                    <span>Thẻ thành viên</span>
                  </button>
                </div>
              </div>

              {/* Tab nội dung theo phương thức thanh toán */}
              {paymentMethod === 'cash' && (
                <div className="payment-cash-box">
                  <div className="cash-input-field">
                    <label htmlFor="amount-paid">Tiền khách đưa (VNĐ)</label>
                    <MoneyInput
                      id="amount-paid"
                      value={amountPaidInput}
                      placeholder={formatNumber(total)}
                      onChange={(val) => setAmountPaidInput(val ? String(val) : '')}
                    />
                  </div>

                  <div className="suggested-cash-buttons">
                    {suggestedCashAmounts.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        className={`suggested-cash-btn ${amountPaid === amt ? 'is-active' : ''}`}
                        onClick={() => setAmountPaidInput(String(amt))}
                      >
                        {amt === total ? 'Đủ tiền' : formatMoney(amt)}
                      </button>
                    ))}
                  </div>

                  <div className="cash-change-display">
                    <span className="cash-change-label">Tiền thừa thối lại</span>
                    <strong className={`cash-change-value ${changeAmount > 0 ? 'has-change' : ''}`}>
                      {formatMoney(changeAmount)}
                    </strong>
                  </div>
                </div>
              )}

              {paymentMethod === 'bank_transfer' && (
                <div className="payment-qr-box">
                  <div className="qr-container">
                    <img src={vietQrUrl} alt="VietQR Thanh toán" className="vietqr-image" />
                  </div>
                  <div className="qr-info">
                    <p>Quét mã VietQR thanh toán <strong>{formatMoney(total)}</strong></p>
                    <small>Số tài khoản: <strong>{vietqrConfig.accountNumber} ({vietqrConfig.bankBin})</strong></small>
                    <small>Chủ tài khoản: <strong>{vietqrConfig.accountName}</strong></small>
                  </div>
                </div>
              )}

              {paymentMethod === 'card' && (
                <div className="payment-info-box">
                  <i className="ph ph-credit-card info-icon" />
                  <div>
                    <strong>Quẹt thẻ qua máy POS ngân hàng</strong>
                    <p>Yêu cầu khách quẹt/chạm thẻ tại máy POS quầy thu ngân với số tiền <strong>{formatMoney(total)}</strong>.</p>
                  </div>
                </div>
              )}

              {paymentMethod === 'wallet' && (
                <div className="payment-info-box">
                  <i className="ph ph-wallet info-icon" />
                  <div>
                    <strong>Thanh toán bằng Thẻ tài khoản</strong>
                    <p>Khấu trừ số dư thẻ thành viên của khách <strong>{customer?.name || 'Khách lẻ'}</strong> với số tiền <strong>{formatMoney(total)}</strong>.</p>
                  </div>
                </div>
              )}

              {checkoutMutation.error && (
                <div className="pos-checkout-error">
                  <i className="ph ph-warning-circle" />
                  <span>
                    {checkoutMutation.error instanceof Error
                      ? checkoutMutation.error.message
                      : 'Đã xảy ra lỗi khi thanh toán hóa đơn'}
                  </span>
                </div>
              )}
            </section>
          </div>

          <footer className="pos-checkout-footer">
            <button
              type="button"
              className="pos-btn-cancel"
              onClick={onClose}
              disabled={checkoutMutation.isPending}
            >
              Hủy bỏ (Esc)
            </button>

            <div className="pos-checkout-submit-group">
              <button
                type="button"
                className="pos-btn-pay-print"
                disabled={checkoutMutation.isPending || lines.length === 0}
                onClick={(e) => handleSubmit(e, true)}
              >
                <i className="ph ph-printer" />
                {checkoutMutation.isPending && shouldPrintReceipt ? 'Đang xử lý...' : 'Thanh toán & In (F9)'}
              </button>

              <button
                type="submit"
                className="pos-btn-pay-direct"
                disabled={checkoutMutation.isPending || lines.length === 0}
                onClick={(e) => handleSubmit(e, false)}
              >
                <i className="ph ph-check-circle" />
                {checkoutMutation.isPending && !shouldPrintReceipt ? 'Đang xử lý...' : `Thanh toán (${formatMoney(total)})`}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
