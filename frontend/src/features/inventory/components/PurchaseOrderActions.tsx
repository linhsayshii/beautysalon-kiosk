import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal/Modal';
import { ErrorState } from '@/components/data-display/DataState';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { formatMoney } from '@/lib/format';
import { completePurchaseOrder } from '../inventory.api';
import { invalidatePurchaseQueries } from '../invalidatePurchaseQueries';
import type { ApiRecord } from '@/types/api';

export function PurchaseOrderActions({ order }: { order: ApiRecord }) {
  const [confirming, setConfirming] = useState(false);
  const client = useQueryClient();
  const { notify } = useToast();
  const mutation = useMutation({
    mutationFn: () => completePurchaseOrder(Number(order.id)),
    onSuccess: async () => {
      await invalidatePurchaseQueries(client);
      setConfirming(false);
      notify('Đã nhập hàng', `${order.code} đã được ghi nhận vào tồn kho.`);
    },
  });
  if (order.status !== 'draft') return null;
  return <>
    <button type="button" className="btn btn-primary" onClick={() => { mutation.reset(); setConfirming(true); }}><i className="ph ph-check" aria-hidden="true" />Nhận hàng, hoàn tất phiếu</button>
    <Modal open={confirming} title={`Nhận hàng ${order.code}`} onClose={() => { if (!mutation.isPending) setConfirming(false); }} closeOnBackdrop={!mutation.isPending} nested size="sm">
      <div className="modal-body">
        <p>Hàng trong phiếu sẽ được cộng vào tồn kho và giá vốn sẽ được cập nhật theo giá nhập.</p>
        <p>Tiền trả nhà cung cấp: <strong>{formatMoney(order.amountPaid)}</strong>. {Number(order.amountPaid) > 0 ? 'Khoản này sẽ được ghi vào sổ quỹ khi hoàn tất.' : 'Phiếu này chưa ghi nhận chi tiền.'}</p>
        {mutation.error && <ErrorState compact error={mutation.error} onRetry={() => mutation.reset()} />}
      </div>
      <footer className="modal-footer">
        <button type="button" className="btn btn-secondary" disabled={mutation.isPending} onClick={() => setConfirming(false)}>Quay lại</button>
        <button type="button" className="btn btn-primary" disabled={mutation.isPending} onClick={() => { if (!mutation.isPending) mutation.mutate(); }}>{mutation.isPending ? 'Đang nhận hàng…' : 'Xác nhận nhận hàng'}</button>
      </footer>
    </Modal>
  </>;
}
