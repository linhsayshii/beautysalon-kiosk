import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal/Modal';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { formatMoney } from '@/lib/format';
import { cancelCashVoucher, type CashVoucher } from '../cashbook.api';
import { cashbookQueryPrefixes } from '../useCashVoucherForm';

export function CashVoucherCancelModal({ voucher, onClose }: { voucher: CashVoucher; onClose: () => void }) {
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const mutation = useMutation({
    mutationFn: () => cancelCashVoucher(voucher.id, reason.trim()),
    onSuccess: () => {
      cashbookQueryPrefixes.forEach((queryKey) => { void queryClient.invalidateQueries({ queryKey }); });
      notify('Đã hủy phiếu', `${voucher.code} không còn được tính vào tồn quỹ.`);
      onClose();
    },
  });
  const pending = mutation.isPending;
  return (
    <Modal open onClose={onClose} size="sm" nested closeOnBackdrop={!pending} title={`Hủy phiếu ${voucher.code}`} subtitle={`${voucher.categoryLabel} · ${formatMoney(voucher.amount)}`}>
      <form onSubmit={(event) => { event.preventDefault(); if (reason.trim() && !pending) mutation.mutate(); }}>
        <div className="modal-body form-stack">
          {voucher.sourceType === 'transfer' && <div className="alert alert-warning">Phiếu chuyển quỹ đi kèm với một phiếu đối ứng. Cả hai phiếu sẽ bị hủy.</div>}
          <div className="field">
            <label className="field-label" htmlFor="cash-cancel-reason">Lý do hủy <span className="field-required">*</span></label>
            <textarea id="cash-cancel-reason" className="textarea" rows={3} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} />
            <p className="field-hint">Phiếu vẫn được lưu lại với trạng thái "Đã hủy" để đối chiếu.</p>
          </div>
          {mutation.error && <div className="alert alert-danger" role="alert">{mutation.error.message}</div>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>Bỏ qua</button>
          <button type="submit" className="btn btn-danger" disabled={!reason.trim() || pending}>{pending ? 'Đang hủy…' : 'Hủy phiếu'}</button>
        </div>
      </form>
    </Modal>
  );
}
