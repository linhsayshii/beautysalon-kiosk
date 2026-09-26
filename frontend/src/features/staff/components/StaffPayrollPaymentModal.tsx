import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EmptyState } from '@/components/data-display/DataState';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { Select } from '@/components/ui/Select/Select';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { formatMoney } from '@/lib/format';
import { payPayroll, type PayrollPeriodDetail } from '../staff.api';
import { Modal } from '@/components/ui/Modal/Modal';

interface StaffPayrollPaymentModalProps {
  periodDetail: PayrollPeriodDetail;
  onClose: () => void;
}

export function StaffPayrollPaymentModal({ periodDetail, onClose }: StaffPayrollPaymentModalProps) {
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const records = periodDetail.records.filter((r) => r.remainingAmount > 0);

  const [selectedStaffId, setSelectedStaffId] = useState<number>(records[0]?.staff.id || 0);
  const [paymentMethod, setPaymentMethod] = useState<'transfer' | 'cash'>('transfer');
  const [amount, setAmount] = useState<number>(records[0]?.remainingAmount || 0);
  const [note, setNote] = useState<string>(`Chi lương kỳ ${periodDetail.period.name}`);

  const selectedRecord = records.find((r) => r.staff.id === selectedStaffId);

  const payMutation = useMutation({
    mutationFn: () =>
      payPayroll(periodDetail.period.id, {
        staffId: selectedStaffId,
        amount,
        paymentMethod,
        note,
      }),
    onSuccess: (data) => {
      notify('Thanh toán thành công', data.message || 'Đã ghi nhận thanh toán lương');
      queryClient.invalidateQueries({ queryKey: ['staff-payroll'] });
      queryClient.invalidateQueries({ queryKey: ['staff-payroll-detail', periodDetail.period.id] });
      onClose();
    },
    onError: (error: any) => {
      notify('Lỗi thanh toán', error.message || 'Không thể thực hiện thanh toán lương');
    },
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Thanh toán lương nhân viên"
      subtitle={<>{periodDetail.period.name} ({periodDetail.period.code})</>}
      size="md"
      nested
    >

      <div className="modal-body">
        {!records.length ? (
          <EmptyState compact icon="ph ph-check-circle" title="Đã thanh toán đủ" message="Tất cả nhân viên trong kỳ này đã được thanh toán đầy đủ lương!" />
        ) : (
          <>
            <div className="field">
              <label className="field-label" htmlFor="payroll-pay-staff">
                Chọn nhân viên nhận lương <span className="field-required">*</span>
              </label>
              <Select<number>
                id="payroll-pay-staff"
                value={selectedStaffId}
                onChange={(sId) => {
                  setSelectedStaffId(sId);
                  const rec = records.find((r) => r.staff.id === sId);
                  if (rec) setAmount(rec.remainingAmount);
                }}
                fullWidth
                options={records.map((rec) => ({ value: rec.staff.id, label: `${rec.staff.name} (${rec.staff.code}) - Còn nợ: ${formatMoney(rec.remainingAmount)}` }))}
              />
            </div>

            {selectedRecord && (
              <dl className="value-strip">
                <div><dt>Lương thực nhận</dt><dd>{formatMoney(selectedRecord.netSalary)}</dd></div>
                <div><dt>Đã thanh toán</dt><dd className="is-success">{formatMoney(selectedRecord.paidAmount)}</dd></div>
                <div><dt>Còn cần trả</dt><dd className="is-danger">{formatMoney(selectedRecord.remainingAmount)}</dd></div>
              </dl>
            )}

            <div className="field">
              <label className="field-label" htmlFor="payroll-pay-amount">
                Số tiền thanh toán (VNĐ) <span className="field-required">*</span>
              </label>
              <MoneyInput id="payroll-pay-amount" className="input payroll-pay-amount" value={amount} onChange={setAmount} />
            </div>

            <fieldset className="field">
              <legend className="field-label">Phương thức thanh toán</legend>
              <div className="payroll-pay-methods">
                <label className="check">
                  <input type="radio" name="paymentMethod" value="transfer" checked={paymentMethod === 'transfer'} onChange={() => setPaymentMethod('transfer')} />
                  <span>Chuyển khoản</span>
                </label>
                <label className="check">
                  <input type="radio" name="paymentMethod" value="cash" checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} />
                  <span>Tiền mặt</span>
                </label>
              </div>
            </fieldset>

            <div className="field">
              <label className="field-label" htmlFor="payroll-pay-note">Ghi chú</label>
              <input id="payroll-pay-note" type="text" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú chi tiền..." />
            </div>
          </>
        )}
      </div>

      <div className="modal-footer">
        <button type="button" onClick={onClose} className="btn btn-secondary">
          Hủy bỏ
        </button>
        {records.length > 0 && (
          <button
            type="button"
            disabled={amount <= 0 || payMutation.isPending}
            onClick={() => payMutation.mutate()}
            className="btn btn-primary"
          >
            {payMutation.isPending ? 'Đang xử lý...' : 'Xác nhận thanh toán'}
          </button>
        )}
      </div>
    </Modal>
  );
}
