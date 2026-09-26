import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ErrorState, LoadingState } from '@/components/data-display/DataState';
import { PageHeader } from '@/components/ui/PageHeader/PageHeader';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { useComingSoon } from '@/components/ui/Toast/useComingSoon';
import { formatMoney } from '@/lib/format';
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
  const comingSoon = useComingSoon();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Local editing state for records
  const [editedRecords, setEditedRecords] = useState<Record<number, Partial<PayrollRecordItem>>>({});

  const { data, isLoading, error, refetch } = useQuery({
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
      <main className="page">
        <LoadingState />
      </main>
    );
  }

  if (error || !detail) {
    return (
      <main className="page">
        <div className="page-stack">
          <PageHeader title="Cập nhật bảng tính lương" onBack={onBack} />
          <ErrorState error={error ?? new Error('Không thể tải chi tiết bảng tính lương.')} onRetry={() => refetch()} />
        </div>
      </main>
    );
  }

  const isApproved = detail.period.status === 'approved';
  const moneyCell = (record: PayrollRecordItem, field: keyof PayrollRecordItem, extraClass = '') => (
    <td className="is-num">
      <MoneyInput
        className={`input input-sm cell-input ${extraClass}`}
        aria-label={`${record.staff.name} – ${String(field)}`}
        disabled={isApproved}
        value={record[field] as number}
        onChange={(val) => handleRecordChange(record.id, field, val)}
      />
    </td>
  );

  return (
    <main className="page">
      <div className="page-stack">
        <PageHeader
          title="Cập nhật bảng tính lương"
          subtitle={<>{detail.period.name} – <span className="text-primary">{detail.period.code}</span></>}
          onBack={onBack}
          extraActions={<>
            {!isApproved && (
              <button type="button" className="btn btn-secondary" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
                <i className="ph ph-floppy-disk" />
                <span>{updateMutation.isPending ? 'Đang lưu...' : 'Lưu tạm'}</span>
              </button>
            )}
            <button type="button" className="btn btn-soft" onClick={() => setIsPaymentModalOpen(true)}>
              <i className="ph ph-credit-card" />
              <span>Thanh toán</span>
            </button>
            {!isApproved && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={approveMutation.isPending}
                onClick={() => {
                  if (window.confirm('Bạn có chắc chắn muốn chốt bảng lương này? Sau khi chốt sẽ không thể sửa lại.')) {
                    approveMutation.mutate();
                  }
                }}
              >
                <i className="ph ph-check" />
                <span>{approveMutation.isPending ? 'Đang xử lý...' : 'Chốt lương'}</span>
              </button>
            )}
          </>}
        />

        <section className="data-panel">
          <div className="data-toolbar">
            <label className="search-control">
              <i className="ph ph-magnifying-glass" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm nhân viên theo mã hoặc tên"
                aria-label="Tìm nhân viên"
              />
            </label>
          </div>
          <div className="table-scroll">
            <table className="detail-table payroll-sheet-table">
              <thead>
                <tr>
                  <th className="is-center"><i className="ph ph-trash text-faint" aria-label="Xóa" /></th>
                  <th className="is-center">STT</th>
                  <th>Tên nhân viên</th>
                  <th className="is-num">Lương chính</th>
                  <th className="is-num">Làm thêm</th>
                  <th className="is-num">Hoa hồng</th>
                  <th className="is-num">Phụ cấp</th>
                  <th className="is-num">Thưởng</th>
                  <th className="is-num">Tổng thu nhập</th>
                  <th className="is-num">Giảm trừ</th>
                  <th className="is-num">Lương thực nhận <i className="ph ph-info" /></th>
                  <th className="is-num">Đã trả</th>
                  <th className="is-num">Còn cần trả</th>
                </tr>
                <tr className="table-summary-row">
                  <td colSpan={3} />
                  <td className="is-num">{formatMoney(totals.baseSalary)}</td>
                  <td className="is-num">{formatMoney(totals.overtimeSalary)}</td>
                  <td className="is-num">{formatMoney(totals.commission)}</td>
                  <td className="is-num">{formatMoney(totals.allowance)}</td>
                  <td className="is-num">{formatMoney(totals.bonus)}</td>
                  <td className="is-num">{formatMoney(totals.totalIncome)}</td>
                  <td className="is-num">{formatMoney(totals.deduction)}</td>
                  <td className="is-num">{formatMoney(totals.netSalary)}</td>
                  <td className="is-num text-success">{formatMoney(totals.paidAmount)}</td>
                  <td className="is-num text-danger">{formatMoney(totals.remainingAmount)}</td>
                </tr>
              </thead>
              <tbody>
                {records.map((r, idx) => (
                  <tr key={r.id}>
                    <td className="is-center">
                      <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Xóa dòng" onClick={comingSoon}>
                        <i className="ph ph-trash" />
                      </button>
                    </td>
                    <td className="is-center text-muted">{idx + 1}</td>
                    <td>
                      <span className="cell-main link">{r.staff.name}</span>
                      <span className="cell-sub">{r.staff.code}</span>
                    </td>
                    {moneyCell(r, 'baseSalary')}
                    {moneyCell(r, 'overtimeSalary')}
                    {moneyCell(r, 'commission')}
                    {moneyCell(r, 'allowance')}
                    {moneyCell(r, 'bonus')}
                    <td className="is-num text-strong">{formatMoney(r.totalIncome)}</td>
                    {moneyCell(r, 'deduction', 'text-danger')}
                    <td className="is-num text-strong">{formatMoney(r.netSalary)}</td>
                    <td className="is-num text-strong text-success">{formatMoney(r.paidAmount)}</td>
                    <td className="is-num text-strong text-danger">{formatMoney(r.remainingAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {isPaymentModalOpen && (
        <StaffPayrollPaymentModal periodDetail={detail} onClose={() => setIsPaymentModalOpen(false)} />
      )}
    </main>
  );
}
