import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { formatMoney } from '@/lib/format';
import { payPayroll, type PayrollPeriodDetail } from '../staff.api';

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
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Thanh toán lương nhân viên</h3>
            <p className="modal-subtitle">{periodDetail.period.name} ({periodDetail.period.code})</p>
          </div>
          <button type="button" onClick={onClose} className="modal-close-btn">
            <i className="ph ph-x" />
          </button>
        </div>

        <div className="work-settings-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!records.length ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#64748b' }}>
              Tất cả nhân viên trong kỳ này đã được thanh toán đầy đủ lương!
            </div>
          ) : (
            <>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Chọn nhân viên nhận lương <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => {
                    const sId = Number(e.target.value);
                    setSelectedStaffId(sId);
                    const rec = records.find((r) => r.staff.id === sId);
                    if (rec) setAmount(rec.remainingAmount);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 14,
                    background: '#fff',
                  }}
                >
                  {records.map((rec) => (
                    <option key={rec.staff.id} value={rec.staff.id}>
                      {rec.staff.name} ({rec.staff.code}) - Còn nợ: {formatMoney(rec.remainingAmount)}
                    </option>
                  ))}
                </select>
              </div>

              {selectedRecord && (
                <div
                  style={{
                    background: '#f8fafc',
                    padding: 12,
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    fontSize: 13,
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                  }}
                >
                  <div>
                    <span style={{ color: '#64748b' }}>Lương thực nhận:</span>{' '}
                    <strong>{formatMoney(selectedRecord.netSalary)}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Đã thanh toán:</span>{' '}
                    <strong style={{ color: '#059669' }}>{formatMoney(selectedRecord.paidAmount)}</strong>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: '#64748b' }}>Còn cần trả:</span>{' '}
                    <strong style={{ color: '#e11d48' }}>{formatMoney(selectedRecord.remainingAmount)}</strong>
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Số tiền thanh toán (VNĐ) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <MoneyInput
                  value={amount}
                  onChange={setAmount}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 15,
                    fontWeight: 600,
                    color: '#0052cc',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Phương thức thanh toán
                </label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="transfer"
                      checked={paymentMethod === 'transfer'}
                      onChange={() => setPaymentMethod('transfer')}
                    />
                    <span>Chuyển khoản</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="cash"
                      checked={paymentMethod === 'cash'}
                      onChange={() => setPaymentMethod('cash')}
                    />
                    <span>Tiền mặt</span>
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Ghi chú
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ghi chú chi tiền..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 14,
                  }}
                />
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn-secondary">
            Hủy bỏ
          </button>
          {records.length > 0 && (
            <button
              type="button"
              disabled={amount <= 0 || payMutation.isPending}
              onClick={() => payMutation.mutate()}
              className="btn-primary"
              style={{ background: '#0052cc', borderColor: '#0052cc' }}
            >
              {payMutation.isPending ? 'Đang xử lý...' : 'Xác nhận thanh toán'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
