import { DetailFacts, DetailHead, InlineDetail } from '@/components/data-display/InlineDetail';
import { formatDateTime, formatMoney } from '@/lib/format';
import { statusLabels } from '@/types/api';
import { fundLabels, voucherSourceLabels, voucherTypeLabels, type CashVoucher } from '../cashbook.api';

export function voucherCounterpartyLabel(voucher: CashVoucher) {
  if (voucher.counterpartyType === 'customer') return 'Khách hàng';
  if (voucher.counterpartyType === 'supplier') return 'Nhà cung cấp';
  if (voucher.counterpartyType === 'staff') return 'Nhân viên';
  return voucher.type === 'income' ? 'Người nộp' : 'Người nhận';
}

export function CashVoucherDetail({ voucher, canCancel, onCancel }: { voucher: CashVoucher; canCancel: boolean; onCancel: () => void }) {
  const isIncome = voucher.type === 'income';
  const cancelled = voucher.status === 'cancelled';
  return (
    <InlineDetail label={`Chi tiết phiếu ${voucher.code}`}>
      <DetailHead
        icon={isIncome ? 'ph-arrow-down-left' : 'ph-arrow-up-right'}
        tone={isIncome ? 'green' : 'orange'}
        title={`${voucherTypeLabels[voucher.type]} ${voucher.code}`}
        tags={<span className={`status-badge ${voucher.status}`}>{cancelled ? 'Đã hủy' : 'Đã ghi sổ'}</span>}
        meta={`${voucher.categoryLabel} · ${formatDateTime(voucher.occurredAt)}`}
        aside={<span className={`cashbook-detail-amount ${cancelled ? 'text-muted' : isIncome ? 'text-success' : 'text-danger'}`}>{isIncome ? '+' : '-'}{formatMoney(voucher.amount)}</span>}
      />
      <DetailFacts items={[
        { label: 'Quỹ', value: fundLabels[voucher.fund] },
        { label: 'Hình thức', value: voucher.paymentMethod ? statusLabels[voucher.paymentMethod] ?? voucher.paymentMethod : fundLabels[voucher.fund] },
        { label: voucherCounterpartyLabel(voucher), value: voucher.counterpartyName || 'Không ghi', variant: voucher.counterpartyName ? undefined : 'placeholder' },
        { label: 'Người lập', value: voucher.createdByName ?? 'Hệ thống', variant: voucher.createdByName ? undefined : 'placeholder' },
        { label: 'Nguồn phiếu', value: voucherSourceLabels[voucher.sourceType] ?? voucher.sourceType },
        voucher.sourceCode ? { label: 'Chứng từ gốc', value: voucher.sourceCode, tone: 'primary' } : false,
        { label: 'Ghi sổ lúc', value: formatDateTime(voucher.createdAt) },
        { label: 'Ghi chú', value: voucher.note || 'Không có ghi chú', variant: voucher.note ? 'note' : 'placeholder', span: 'full' },
        cancelled && { label: 'Hủy lúc', value: formatDateTime(voucher.cancelledAt), tone: 'danger' },
        cancelled && { label: 'Người hủy', value: voucher.cancelledByName ?? '-' },
        cancelled && { label: 'Lý do hủy', value: voucher.cancelReason || '-', variant: 'note', span: 'wide' },
      ]} />
      {(canCancel || !voucher.cancellable) && !cancelled && (
        <div className="detail-actions">
          {!voucher.cancellable && <span className="detail-actions-note detail-actions-start">Phiếu tạo tự động từ {voucherSourceLabels[voucher.sourceType]?.toLowerCase()}, điều chỉnh tại chứng từ gốc.</span>}
          {canCancel && voucher.cancellable && <button type="button" className="btn btn-danger-soft" onClick={onCancel}><i className="ph ph-prohibit" aria-hidden="true" />Hủy phiếu</button>}
        </div>
      )}
    </InlineDetail>
  );
}
