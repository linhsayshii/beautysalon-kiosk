import { resynchronizeRealtimeQueries } from '@/context/RealtimeQuerySynchronizer';
import { PartialPaymentFields } from '@/features/debts/PartialPaymentFields';
import { CustomerDebtPanel } from '@/features/debts/CustomerDebtPanel';
import { usePaymentRequestKey } from '@/features/debts/debts.api';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { formatMoney } from '@/lib/format';
import { useMetadata } from '@/services/metadata';
import { checkoutPosInvoice, type PosCheckoutPayload, type PosReceiptData } from '../pos.api';
import { Modal } from '@/components/ui/Modal/Modal';
import { PAYMENT_METHOD_LABELS } from '@/lib/payment-methods';

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
  consultantStaffId?: number | null;
  usePackageId?: number | null;
  usePackageServiceId?: number | null;
}

interface PosCustomer {
  id: number;
  name: string;
  phone?: string;
}

interface PosCheckoutModalProps {
  customer: PosCustomer | null;
  lines: PosLine[];
  invoiceId?: number;
  onClose: () => void;
  onSuccess: (receipt: PosReceiptData, shouldPrint: boolean) => void;
}

type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'wallet';

export function PosCheckoutModal({
  customer,
  lines,
  invoiceId,
  onClose,
  onSuccess,
}: PosCheckoutModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [amountPaidInput, setAmountPaidInput] = useState<string>('');
  const [allowDebt, setAllowDebt] = useState(false);
  const [showDebt, setShowDebt] = useState(false);
  const requestKey = usePaymentRequestKey();
  const queryClient = useQueryClient();
  const [note, setNote] = useState<string>('');
  const [shouldPrintReceipt, setShouldPrintReceipt] = useState<boolean>(false);
  const { data: metadata } = useMetadata();
  const vietqrConfig = metadata?.data?.system?.vietqr || {
    bankBin: '',
    accountNumber: '',
    accountName: '',
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
    if (paymentMethod === 'wallet' || !amountPaidInput.trim()) return total;
    const parsed = Number(amountPaidInput.replace(/\D/g, ''));
    return Number.isNaN(parsed) ? total : parsed;
  }, [amountPaidInput, total, paymentMethod]);

  // VietQR URL for dynamic bank transfer
  const vietQrUrl = useMemo(() => {
    if (paymentMethod !== 'bank_transfer' || amountPaid <= 0) return '';
    const bankCode = vietqrConfig.bankBin;
    const accNum = vietqrConfig.accountNumber;
    if (!bankCode || !accNum) return '';
    const accName = encodeURIComponent(vietqrConfig.accountName);
    const memo = encodeURIComponent(`THANH TOAN ${customer?.name ? customer.name.slice(0, 15) : 'SPA'}`);
    return `https://img.vietqr.io/image/${bankCode}-${accNum}-qr_only.png?amount=${amountPaid}&addInfo=${memo}&accountName=${accName}`;
  }, [paymentMethod, amountPaid, customer, vietqrConfig]);

  const checkoutMutation = useMutation({
    mutationFn: (print: boolean) => {
      setShouldPrintReceipt(print);
      const payload: PosCheckoutPayload = {
        customerId: customer?.id ?? null,
        discount: calculatedDiscount,
        paymentMethod,
        amountPaid,
        allowDebt,
        note: note.trim() || undefined,
        invoiceId,
        lines: lines.map((line) => ({
          itemType: line.itemType,
          itemId: line.itemId,
          quantity: line.quantity,
          staffId: line.staffId ?? undefined,
          consultantStaffId: line.itemType === 'service' ? line.consultantStaffId ?? null : null,
          usePackageId: line.usePackageId ?? undefined,
          usePackageServiceId: line.usePackageServiceId ?? undefined,
        })),
      };
      return checkoutPosInvoice({...payload,requestKey:requestKey(payload)});
    },
    onSuccess: (response) => {
      resynchronizeRealtimeQueries(queryClient);
      onSuccess(response.data, shouldPrintReceipt);
    },
  });

  const handleSubmit = (event: FormEvent, print: boolean) => {
    event.preventDefault();
    if (checkoutMutation.isPending) return;
    if (!customer || (amountPaid < total && !allowDebt) || (paymentMethod !== 'cash' && amountPaid > total)) return;
    checkoutMutation.mutate(print);
  };

  const closeUnlessPaying = () => { if (!checkoutMutation.isPending) onClose(); };

  return (
    <Modal
      open
      onClose={closeUnlessPaying}
      title="Thanh toán đơn hàng"
      subtitle={<>Khách hàng: <strong>{customer ? `${customer.name} ${customer.phone ? `(${customer.phone})` : ''}` : 'Chưa chọn khách hàng'}</strong></>}
      size="xl"
      className="modal-fill pos-checkout-modal"
      closeOnBackdrop={!checkoutMutation.isPending}
    >
      <form onSubmit={(e) => handleSubmit(e, false)}>
        <div className="modal-body modal-body-block">
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
                  <span>{PAYMENT_METHOD_LABELS.cash}</span>
                </button>
                <button
                  type="button"
                  className={`payment-method-card ${paymentMethod === 'bank_transfer' ? 'is-selected' : ''}`}
                  onClick={() => setPaymentMethod('bank_transfer')}
                >
                  <i className="ph ph-qr-code" />
                  <span>{PAYMENT_METHOD_LABELS.bank_transfer}</span>
                </button>
                <button
                  type="button"
                  className={`payment-method-card ${paymentMethod === 'card' ? 'is-selected' : ''}`}
                  onClick={() => setPaymentMethod('card')}
                >
                  <i className="ph ph-credit-card" />
                  <span>{PAYMENT_METHOD_LABELS.card}</span>
                </button>
                <button
                  type="button"
                  className={`payment-method-card ${paymentMethod === 'wallet' ? 'is-selected' : ''}`}
                  onClick={() => setPaymentMethod('wallet')}
                >
                  <i className="ph ph-wallet" />
                  <span>{PAYMENT_METHOD_LABELS.wallet}</span>
                </button>
              </div>
            </div>

            {/* Tab nội dung theo phương thức thanh toán */}
            <PartialPaymentFields showTransferQr={false} customerId={customer?.id} total={total} amount={amountPaid} onAmountChange={v=>setAmountPaidInput(String(v))} allowDebt={allowDebt} onAllowDebtChange={setAllowDebt} method={paymentMethod} disabled={checkoutMutation.isPending} />
            {customer && <><button type="button" className="btn btn-link btn-sm" onClick={()=>setShowDebt(!showDebt)}>{showDebt ? 'Ẩn công nợ' : 'Xem công nợ / Thu nợ cũ'}</button>{showDebt && <CustomerDebtPanel key={customer.id} customerId={customer.id} />}</>}

            {paymentMethod === 'bank_transfer' && amountPaid > 0 && vietQrUrl && (
              <div className="payment-qr-box">
                <div className="qr-container">
                  <img src={vietQrUrl} alt="VietQR Thanh toán" className="vietqr-image" />
                </div>
                <div className="qr-info">
                  <p>Quét mã VietQR thanh toán <strong>{formatMoney(amountPaid)}</strong></p>
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
                  <p>Khấu trừ số dư thẻ thành viên của khách <strong>{customer?.name || 'Chưa chọn khách hàng'}</strong> với số tiền <strong>{formatMoney(total)}</strong>.</p>
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
        </div>

        <footer className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary modal-footer-start"
            onClick={onClose}
            disabled={checkoutMutation.isPending}
          >
            Hủy bỏ (Esc)
          </button>

            <button
              type="button"
              className="btn btn-secondary"
              disabled={checkoutMutation.isPending || lines.length === 0 || !customer || (amountPaid < total && !allowDebt) || (paymentMethod !== 'cash' && amountPaid > total)}
              onClick={(e) => handleSubmit(e, true)}
            >
              <i className="ph ph-printer" />
              {checkoutMutation.isPending && shouldPrintReceipt ? 'Đang xử lý...' : 'Thanh toán & In (F9)'}
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={checkoutMutation.isPending || lines.length === 0 || !customer || (amountPaid < total && !allowDebt) || (paymentMethod !== 'cash' && amountPaid > total)}
              onClick={(e) => handleSubmit(e, false)}
            >
              <i className="ph ph-check-circle" />
              {checkoutMutation.isPending && !shouldPrintReceipt ? 'Đang xử lý...' : `Chốt hóa đơn (${formatMoney(Math.min(amountPaid,total))})`}
            </button>
        </footer>
      </form>
    </Modal>
  );
}
