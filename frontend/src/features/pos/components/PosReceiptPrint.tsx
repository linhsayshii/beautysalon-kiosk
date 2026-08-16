import { useRef } from 'react';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { useMetadata } from '@/services/metadata';
import type { PosReceiptData } from '../pos.api';

interface PosReceiptPrintProps {
  receipt: PosReceiptData;
  onClose: () => void;
}

export function PosReceiptPrint({ receipt, onClose }: PosReceiptPrintProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const { data: metadata } = useMetadata();
  const storeName = metadata?.data?.system?.storeName || 'ANNA CHILL BEAUTY';

  const handlePrint = () => {
    window.print();
  };

  const paymentMethodLabel: Record<string, string> = {
    cash: 'Tiền mặt',
    bank_transfer: 'Chuyển khoản',
    card: 'Quẹt thẻ',
    wallet: 'Thẻ thành viên',
    mixed: 'Hỗn hợp',
  };

  return (
    <div className="receipt-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="receipt-modal" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
        <div className="receipt-actions no-print">
          <button type="button" className="receipt-btn-close" onClick={onClose}>
            <i className="ph ph-x" /> Đóng
          </button>
          <button type="button" className="receipt-btn-print" onClick={handlePrint}>
            <i className="ph ph-printer" /> In hóa đơn
          </button>
        </div>

        <div className="receipt-paper" ref={printRef}>
          <header className="receipt-header">
            <h1 className="receipt-brand">{storeName}</h1>
            <p className="receipt-branch-meta">{receipt.branch.name} - {receipt.branch.address}</p>
            {receipt.branch.phone && <p className="receipt-branch-meta">Hotline: {receipt.branch.phone}</p>}
            <div className="receipt-divider" />
            <h2 id="receipt-title" className="receipt-title">HÓA ĐƠN THANH TOÁN</h2>
            <p className="receipt-code">Số HĐ: <strong>{receipt.code}</strong></p>
            <p className="receipt-meta">Ngày: {formatDateTime(receipt.issuedAt)}</p>
          </header>

          <div className="receipt-customer-info">
            <div className="receipt-row">
              <span>Khách hàng:</span>
              <strong>{receipt.customer.name}</strong>
            </div>
            {receipt.customer.phone && (
              <div className="receipt-row">
                <span>Điện thoại:</span>
                <span>{receipt.customer.phone}</span>
              </div>
            )}
            {receipt.staff && (
              <div className="receipt-row">
                <span>Nhân viên:</span>
                <span>{receipt.staff.name}</span>
              </div>
            )}
          </div>

          <div className="receipt-divider" />

          <table className="receipt-table">
            <thead>
              <tr>
                <th className="th-name">Mặt hàng</th>
                <th className="th-qty">SL</th>
                <th className="th-price">Đơn giá</th>
                <th className="th-total">T.Tiền</th>
              </tr>
            </thead>
            <tbody>
              {receipt.items.map((item) => (
                <tr key={item.id}>
                  <td className="td-name">
                    <div>{item.name}</div>
                    <small>{item.code}</small>
                  </td>
                  <td className="td-qty">{formatNumber(item.quantity)}</td>
                  <td className="td-price">{formatMoney(item.unitPrice)}</td>
                  <td className="td-total">{formatMoney(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="receipt-divider" />

          <div className="receipt-summary">
            <div className="receipt-summary-row">
              <span>Tổng tiền hàng:</span>
              <span>{formatMoney(receipt.subtotal)}</span>
            </div>
            {receipt.discount > 0 && (
              <div className="receipt-summary-row receipt-discount">
                <span>Chiết khấu / Giảm giá:</span>
                <span>-{formatMoney(receipt.discount)}</span>
              </div>
            )}
            <div className="receipt-summary-row receipt-grand-total">
              <span>TỔNG THANH TOÁN:</span>
              <strong>{formatMoney(receipt.total)}</strong>
            </div>
            <div className="receipt-summary-row">
              <span>Phương thức TT:</span>
              <span>{paymentMethodLabel[receipt.paymentMethod] || receipt.paymentMethod}</span>
            </div>
            <div className="receipt-summary-row">
              <span>Tiền khách đưa:</span>
              <span>{formatMoney(receipt.amountPaid)}</span>
            </div>
            <div className="receipt-summary-row">
              <span>Tiền thừa trả khách:</span>
              <span>{formatMoney(receipt.changeAmount)}</span>
            </div>
          </div>

          {receipt.note && (
            <div className="receipt-note">
              <em>Ghi chú: {receipt.note}</em>
            </div>
          )}

          <footer className="receipt-footer">
            <p className="receipt-thanks">Cảm ơn Quý khách & Hẹn gặp lại!</p>
            <p className="receipt-sub">{receipt.branch.name} xin hân hạnh phục vụ!</p>
          </footer>
        </div>
      </div>
    </div>
  );
}
