import { Modal } from '@/components/ui/Modal/Modal';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import type { CashVoucherType } from '../cashbook.api';
import { useCashVoucherForm } from '../useCashVoucherForm';
import { CashVoucherFields } from './CashVoucherFields';

export function CashVoucherModal({ initialType, onClose }: { initialType: CashVoucherType; onClose: () => void }) {
  const { notify } = useToast();
  const form = useCashVoucherForm(initialType, (result) => {
    notify('Đã ghi sổ quỹ', result.message);
    onClose();
  });
  const pending = form.mutation.isPending;
  return (
    <Modal open onClose={onClose} title="Lập phiếu thu chi" subtitle="Ghi nhận tiền vào hoặc ra khỏi quỹ" size="md" closeOnBackdrop={!pending}>
      <form onSubmit={(event) => { event.preventDefault(); form.submit(); }}>
        <div className="modal-body">
          <CashVoucherFields form={form} idPrefix="cash-voucher" />
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>Bỏ qua</button>
          <button type="submit" className="btn btn-primary" disabled={Boolean(form.problem) || pending} title={form.problem ?? undefined}>
            {pending ? 'Đang lưu…' : form.type === 'income' ? 'Lưu phiếu thu' : 'Lưu phiếu chi'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
