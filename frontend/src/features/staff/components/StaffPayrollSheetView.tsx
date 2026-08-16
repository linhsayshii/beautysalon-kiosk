import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { formatMoney } from '@/lib/format';
import { LoadingState } from '@/components/data-display/DataState';
import {
  getPayrollDetail,
  updatePayroll,
  approvePayroll,
  type PayrollRecordItem,
} from '../staff.api';
import { StaffPayrollPaymentModal } from './StaffPayrollPaymentModal';

interface StaffPayrollSheetViewProps {
  periodId: number;
  onBack: () => void;
}

export function StaffPayrollSheetView({ periodId, onBack }: StaffPayrollSheetViewProps) {
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Local editing state for records
  const [editedRecords, setEditedRecords] = useState<Record<number, Partial<PayrollRecordItem>>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ['staff-payroll-detail', periodId],
    queryFn: () => getPayrollDetail(periodId),
  });

  const detail = data?.data;

  const updateMutation = useMutation({
    mutationFn: () => {
      const recordsToUpdate = Object.entries(editedRecords).map(([idStr, changes]) => ({
        id: Number(idStr),
        ...changes,
      }));
      return updatePayroll(periodId, { records: recordsToUpdate });
    },
    onSuccess: (res) => {
      notify('Thành công', res.message || 'Đã lưu tạm bảng lương');
      setEditedRecords({});
      queryClient.invalidateQueries({ queryKey: ['staff-payroll-detail', periodId] });
      queryClient.invalidateQueries({ queryKey: ['staff-payroll'] });
    },
    onError: (err: any) => {
      notify('Lỗi', err.message || 'Không thể lưu bảng lương');
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => approvePayroll(periodId),
    onSuccess: (res) => {
      notify('Thành công', res.message || 'Đã chốt bảng lương thành công');
      queryClient.invalidateQueries({ queryKey: ['staff-payroll-detail', periodId] });
      queryClient.invalidateQueries({ queryKey: ['staff-payroll'] });
    },
    onError: (err: any) => {
      notify('Lỗi', err.message || 'Không thể chốt bảng lương');
    },
  });

  const handleRecordChange = (recordId: number, field: keyof PayrollRecordItem, value: any) => {
    setEditedRecords((prev) => {
      const existing = prev[recordId] || {};
      return {
        ...prev,
        [recordId]: {
          ...existing,
          [field]: value,
        },
      };
    });
  };

  const records = useMemo(() => {
    if (!detail) return [];
    return detail.records
      .map((r) => {
        const edits = editedRecords[r.id];
        if (!edits) return r;

        const baseSalary = edits.baseSalary !== undefined ? Number(edits.baseSalary) : r.baseSalary;
        const overtimeSalary = edits.overtimeSalary !== undefined ? Number(edits.overtimeSalary) : r.overtimeSalary;
        const allowance = edits.allowance !== undefined ? Number(edits.allowance) : r.allowance;
        const bonus = edits.bonus !== undefined ? Number(edits.bonus) : r.bonus;
        const commission = edits.commission !== undefined ? Number(edits.commission) : r.commission;
        const deduction = edits.deduction !== undefined ? Number(edits.deduction) : r.deduction;

        const totalIncome = baseSalary + overtimeSalary + allowance + bonus + commission;
        const netSalary = Math.max(0, totalIncome - deduction);
        const remainingAmount = Math.max(0, netSalary - r.paidAmount);

        return {
          ...r,
          ...edits,
          baseSalary,
          overtimeSalary,
          allowance,
          bonus,
          commission,
          deduction,
          totalIncome,
          netSalary,
          remainingAmount,
        };
      })
      .filter((r) => {
        if (!searchTerm) return true;
        const s = searchTerm.toLowerCase();
        return r.staff.name.toLowerCase().includes(s) || r.staff.code.toLowerCase().includes(s);
      });
  }, [detail, editedRecords, searchTerm]);

  // Grand total calculations
  const totals = useMemo(() => {
    return records.reduce(
      (acc, r) => ({
        baseSalary: acc.baseSalary + r.baseSalary,
        overtimeSalary: acc.overtimeSalary + r.overtimeSalary,
        commission: acc.commission + r.commission,
        allowance: acc.allowance + r.allowance,
        bonus: acc.bonus + r.bonus,
        totalIncome: acc.totalIncome + r.totalIncome,
        deduction: acc.deduction + r.deduction,
        netSalary: acc.netSalary + r.netSalary,
        paidAmount: acc.paidAmount + r.paidAmount,
        remainingAmount: acc.remainingAmount + r.remainingAmount,
      }),
      {
        baseSalary: 0,
        overtimeSalary: 0,
        commission: 0,
        allowance: 0,
        bonus: 0,
        totalIncome: 0,
        deduction: 0,
        netSalary: 0,
        paidAmount: 0,
        remainingAmount: 0,
      },
    );
  }, [records]);

  if (isLoading) {
    return (
      <div className="attendance-page">
        <div className="attendance-container">
          <LoadingState />
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="attendance-page">
        <div className="attendance-container">
          <div style={{ color: '#ef4444' }}>Không thể tải chi tiết bảng tính lương.</div>
          <button type="button" onClick={onBack} className="btn-secondary" style={{ marginTop: 12 }}>
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  const isApproved = detail.period.status === 'approved';

  return (
    <div className="attendance-page">
      <div className="attendance-container">
        {/* Top Header Navigation Bar (Chuẩn KiotViet) */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              onClick={onBack}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 18,
                color: '#334155',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <i className="ph ph-arrow-left" />
            </button>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#0f172a' }}>
              Cập nhật bảng tính lương
            </h2>
            <span style={{ fontSize: 13, color: '#64748b' }}>
              ({detail.period.name} - {detail.period.code})
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'flex-end' }}>
            <div style={{ position: 'relative', minWidth: 260 }}>
              <i
                className="ph ph-magnifying-glass"
                style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }}
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm nhân viên theo mã hoặc tên"
                style={{
                  width: '100%',
                  padding: '7px 12px 7px 32px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                }}
              />
            </div>

            {!isApproved && (
              <button
                type="button"
                disabled={updateMutation.isPending}
                onClick={() => updateMutation.mutate()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#334155',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <i className="ph ph-floppy-disk" />
                <span>{updateMutation.isPending ? 'Đang lưu...' : 'Lưu tạm'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 8,
                border: '1px solid #0284c7',
                background: '#fff',
                color: '#0284c7',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <i className="ph ph-credit-card" />
              <span>Thanh toán</span>
            </button>

            {!isApproved && (
              <button
                type="button"
                disabled={approveMutation.isPending}
                onClick={() => {
                  if (window.confirm('Bạn có chắc chắn muốn chốt bảng lương này? Sau khi chốt sẽ không thể sửa lại.')) {
                    approveMutation.mutate();
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#0284c7',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <i className="ph ph-check" />
                <span>{approveMutation.isPending ? 'Đang xử lý...' : 'Chốt lương'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Matrix Salary Table Card (Chuẩn KiotViet) */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table className="kiotviet-payroll-table">
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ width: 40, padding: '10px 8px', textAlign: 'center' }}>
                    <i className="ph ph-trash" style={{ color: '#94a3b8' }} />
                  </th>
                  <th style={{ width: 45, padding: '10px 8px', textAlign: 'center' }}>STT</th>
                  <th style={{ minWidth: 160, padding: '10px 12px', textAlign: 'left' }}>Tên nhân viên</th>
                  <th style={{ minWidth: 110, padding: '10px 8px', textAlign: 'right' }}>Lương chính</th>
                  <th style={{ minWidth: 90, padding: '10px 8px', textAlign: 'right' }}>Làm thêm</th>
                  <th style={{ minWidth: 110, padding: '10px 8px', textAlign: 'right' }}>Hoa hồng</th>
                  <th style={{ minWidth: 90, padding: '10px 8px', textAlign: 'right' }}>Phụ cấp</th>
                  <th style={{ minWidth: 90, padding: '10px 8px', textAlign: 'right' }}>Thưởng</th>
                  <th style={{ minWidth: 110, padding: '10px 8px', textAlign: 'right' }}>Tổng thu nhập</th>
                  <th style={{ minWidth: 90, padding: '10px 8px', textAlign: 'right' }}>Giảm trừ</th>
                  <th style={{ minWidth: 120, padding: '10px 8px', textAlign: 'right' }}>
                    Lương thực nhận <i className="ph ph-info" />
                  </th>
                  <th style={{ minWidth: 90, padding: '10px 8px', textAlign: 'right' }}>Đã trả</th>
                  <th style={{ minWidth: 100, padding: '10px 8px', textAlign: 'right' }}>Còn cần trả</th>
                </tr>
                {/* Header Summary Row */}
                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1', fontWeight: 700 }}>
                  <td colSpan={3} style={{ padding: '8px 12px' }} />
                  <td style={{ padding: '8px 8px', textAlign: 'right' }}>{formatMoney(totals.baseSalary)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right' }}>{formatMoney(totals.overtimeSalary)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right' }}>{formatMoney(totals.commission)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right' }}>{formatMoney(totals.allowance)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right' }}>{formatMoney(totals.bonus)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right' }}>{formatMoney(totals.totalIncome)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right' }}>{formatMoney(totals.deduction)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: '#0f172a' }}>
                    {formatMoney(totals.netSalary)}
                  </td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: '#059669' }}>
                    {formatMoney(totals.paidAmount)}
                  </td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: '#e11d48' }}>
                    {formatMoney(totals.remainingAmount)}
                  </td>
                </tr>
              </thead>
              <tbody>
                {records.map((r, idx) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ textAlign: 'center', padding: '8px' }}>
                      <button
                        type="button"
                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                      >
                        <i className="ph ph-trash" />
                      </button>
                    </td>
                    <td style={{ textAlign: 'center', padding: '8px', color: '#64748b' }}>{idx + 1}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ fontWeight: 600, color: '#0284c7' }}>{r.staff.name}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.staff.code}</div>
                    </td>

                    {/* Lương chính */}
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                      <input
                        type="number"
                        disabled={isApproved}
                        value={r.baseSalary}
                        onChange={(e) => handleRecordChange(r.id, 'baseSalary', Number(e.target.value))}
                        style={{
                          width: '100%',
                          textAlign: 'right',
                          padding: '4px 6px',
                          borderRadius: 4,
                          border: '1px solid #e2e8f0',
                          fontSize: 13,
                        }}
                      />
                    </td>

                    {/* Làm thêm */}
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                      <input
                        type="number"
                        disabled={isApproved}
                        value={r.overtimeSalary}
                        onChange={(e) => handleRecordChange(r.id, 'overtimeSalary', Number(e.target.value))}
                        style={{
                          width: '100%',
                          textAlign: 'right',
                          padding: '4px 6px',
                          borderRadius: 4,
                          border: '1px solid #e2e8f0',
                          fontSize: 13,
                        }}
                      />
                    </td>

                    {/* Hoa hồng */}
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                      <input
                        type="number"
                        disabled={isApproved}
                        value={r.commission}
                        onChange={(e) => handleRecordChange(r.id, 'commission', Number(e.target.value))}
                        style={{
                          width: '100%',
                          textAlign: 'right',
                          padding: '4px 6px',
                          borderRadius: 4,
                          border: '1px solid #e2e8f0',
                          fontSize: 13,
                        }}
                      />
                    </td>

                    {/* Phụ cấp */}
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                      <input
                        type="number"
                        disabled={isApproved}
                        value={r.allowance}
                        onChange={(e) => handleRecordChange(r.id, 'allowance', Number(e.target.value))}
                        style={{
                          width: '100%',
                          textAlign: 'right',
                          padding: '4px 6px',
                          borderRadius: 4,
                          border: '1px solid #e2e8f0',
                          fontSize: 13,
                        }}
                      />
                    </td>

                    {/* Thưởng */}
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                      <input
                        type="number"
                        disabled={isApproved}
                        value={r.bonus}
                        onChange={(e) => handleRecordChange(r.id, 'bonus', Number(e.target.value))}
                        style={{
                          width: '100%',
                          textAlign: 'right',
                          padding: '4px 6px',
                          borderRadius: 4,
                          border: '1px solid #e2e8f0',
                          fontSize: 13,
                        }}
                      />
                    </td>

                    {/* Tổng thu nhập */}
                    <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 600 }}>
                      {formatMoney(r.totalIncome)}
                    </td>

                    {/* Giảm trừ */}
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                      <input
                        type="number"
                        disabled={isApproved}
                        value={r.deduction}
                        onChange={(e) => handleRecordChange(r.id, 'deduction', Number(e.target.value))}
                        style={{
                          width: '100%',
                          textAlign: 'right',
                          padding: '4px 6px',
                          borderRadius: 4,
                          border: '1px solid #e2e8f0',
                          fontSize: 13,
                          color: '#e11d48',
                        }}
                      />
                    </td>

                    {/* Lương thực nhận */}
                    <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                      {formatMoney(r.netSalary)}
                    </td>

                    {/* Đã trả */}
                    <td style={{ padding: '8px 8px', textAlign: 'right', color: '#059669' }}>
                      {formatMoney(r.paidAmount)}
                    </td>

                    {/* Còn cần trả */}
                    <td style={{ padding: '8px 8px', textAlign: 'right', color: '#e11d48', fontWeight: 600 }}>
                      {formatMoney(r.remainingAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <StaffPayrollPaymentModal periodDetail={detail} onClose={() => setIsPaymentModalOpen(false)} />
      )}
    </div>
  );
}
