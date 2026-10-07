import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { owedTone } from '@/lib/tone';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/DataState';
import { DetailFacts, DetailHead, InlineDetail, ValueStrip } from '@/components/data-display/InlineDetail';
import { StatusBadge } from '@/components/data-display/Badges';
import { exportCsv } from '@/lib/export';
import { getPayrollDetail, recalculatePayroll, cancelPayroll } from '../staff.api';
import { payrollPeriodTypeLabel } from '../payroll-labels';
import { StaffPayrollPaymentModal } from './StaffPayrollPaymentModal';

interface StaffPayrollDetailAccordionProps {
  periodId: number;
  onOpenSheetView: (periodId: number) => void;
}

type PayrollTab = 'info' | 'records' | 'payments';

export function StaffPayrollDetailAccordion({ periodId, onOpenSheetView }: StaffPayrollDetailAccordionProps) {
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<PayrollTab>('info');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['staff-payroll-detail', periodId],
    queryFn: () => getPayrollDetail(periodId),
  });

  const detail = data?.data;

  const recalcMutation = useMutation({
    mutationFn: () => recalculatePayroll(periodId),
    onSuccess: (res) => {
      notify('Thành công', res.message || 'Đã tải lại và cập nhật dữ liệu bảng lương');
      queryClient.invalidateQueries({ queryKey: ['staff-payroll'] });
      queryClient.invalidateQueries({ queryKey: ['staff-payroll-detail', periodId] });
    },
    onError: (err: any) => {
      notify('Lỗi', err.message || 'Không thể tải lại dữ liệu bảng lương');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelPayroll(periodId),
    onSuccess: (res) => {
      notify('Đã hủy', res.message || 'Đã hủy bảng lương');
      queryClient.invalidateQueries({ queryKey: ['staff-payroll'] });
      queryClient.invalidateQueries({ queryKey: ['staff-payroll-detail', periodId] });
    },
    onError: (err: any) => {
      notify('Lỗi', err.message || 'Không thể hủy bảng lương');
    },
  });

  if (isLoading) {
    return (
      <div className="inline-detail">
        <LoadingState />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="inline-detail">
        <ErrorState error={error ?? new Error('Không thể tải chi tiết bảng lương.')} onRetry={() => refetch()} />
      </div>
    );
  }

  const period = detail.period;
  const records = detail.records || [];
  const payments = detail.payments || [];
  const summary = detail.summary || {
    totalStaff: 0,
    totalBaseSalary: 0,
    totalOvertimeSalary: 0,
    totalAllowance: 0,
    totalBonus: 0,
    totalCommission: 0,
    totalTourCommission: 0,
    totalDeduction: 0,
    totalIncome: 0,
    totalNetSalary: 0,
    totalPaidAmount: 0,
    totalRemainingAmount: 0,
  };

  const handleExport = () => {
    if (records.length === 0) {
      notify('Thông báo', 'Không có dữ liệu phiếu lương để xuất');
      return;
    }
    const exportRows = records.map((r) => ({
      code: r.code,
      staffCode: r.staff.code,
      staffName: r.staff.name,
      role: r.staff.role,
      baseSalary: r.baseSalary,
      overtimeSalary: r.overtimeSalary,
      allowance: r.allowance,
      bonus: r.bonus,
      commission: r.commission,
      tourCommission: r.tourCommission,
      deduction: r.deduction,
      totalIncome: r.totalIncome,
      netSalary: r.netSalary,
      paidAmount: r.paidAmount,
      remainingAmount: r.remainingAmount,
    }));
    exportCsv(exportRows, `bang-luong-${period.code}`);
    notify('Thành công', 'Đã xuất file bảng lương');
  };

  const tabs = [
    { value: 'info' as const, label: 'Thông tin' },
    { value: 'records' as const, label: `Phiếu lương (${records.length})` },
    { value: 'payments' as const, label: `Lịch sử thanh toán (${payments.length})` },
  ];

  return (
    <InlineDetail className="payroll-detail" label={`Chi tiết bảng lương ${period.code}`} tabs={tabs} tab={activeTab} onTabChange={setActiveTab}>
      <DetailHead
        icon="ph-money"
        title={period.name}
        tags={<StatusBadge status={period.status} payroll />}
        meta={<>Mã bảng lương: <strong className="text-primary">{period.code}</strong> • {payrollPeriodTypeLabel(period.periodType)}</>}
        aside={<><div>Người tạo: <strong>{period.creatorName || 'Hệ thống'}</strong></div><div>Kỳ làm việc: {formatDate(period.startsOn)} - {formatDate(period.endsOn)}</div></>}
      />

      <ValueStrip
        items={[
          { label: 'Tổng số nhân viên', value: formatNumber(summary.totalStaff) },
          { label: 'Tổng tiền lương', value: formatMoney(summary.totalNetSalary), tone: 'primary' },
          { label: 'Đã chi trả', value: formatMoney(summary.totalPaidAmount), tone: 'success' },
          { label: 'Còn cần trả', value: formatMoney(summary.totalRemainingAmount), tone: Number(summary.totalRemainingAmount) > 0 ? 'danger' : undefined },
        ]}
      />

      {activeTab === 'info' && (
        <>
          <DetailFacts
            items={[
              { label: 'Mã bảng lương', value: period.code, tone: 'primary' },
              { label: 'Tên bảng lương', value: period.name },
              { label: 'Kỳ hạn trả', value: payrollPeriodTypeLabel(period.periodType) },
              { label: 'Kỳ làm việc', value: `${formatDate(period.startsOn)} - ${formatDate(period.endsOn)}` },
              { label: 'Ngày tạo', value: formatDateTime(period.createdAt) },
              { label: 'Người tạo', value: period.creatorName || 'Auto' },
              { label: 'Người lập bảng', value: period.creatorName || 'Auto' },
              { label: 'Trạng thái', value: <StatusBadge status={period.status} payroll /> },
              { label: 'Phạm vi áp dụng', value: 'Tất cả nhân viên' },
              { label: 'Người chốt lương', value: period.approvedByName || '-' },
              { label: 'Ghi chú', value: period.note || 'Ghi chú...', span: 'wide', variant: period.note ? 'note' : 'placeholder' },
            ]}
          />

          <div className="detail-actions">
            {period.status === 'draft' && (
              <button
                type="button"
                className="btn btn-ghost btn-sm detail-actions-start text-danger"
                onClick={() => {
                  if (window.confirm('Bạn có chắc chắn muốn hủy bảng lương này không?')) {
                    cancelMutation.mutate();
                  }
                }}
              >
                <i className="ph ph-trash" />
                <span>Hủy bỏ</span>
              </button>
            )}
            <span className="detail-actions-note">
              Dữ liệu được cập nhật vào: {formatDateTime(period.updatedDataAt || period.createdAt)} <i className="ph ph-info" />
            </span>
            {period.status === 'draft' && (
              <button type="button" className="btn btn-secondary btn-sm" disabled={recalcMutation.isPending} onClick={() => { if (window.confirm('Tính lại lương cơ bản, hoa hồng và khấu trừ từ chấm công, kể cả dòng đã sửa tay? Phụ cấp, thưởng và tăng ca giữ nguyên.')) recalcMutation.mutate(); }}>
                <i className={`ph ph-arrow-clockwise ${recalcMutation.isPending ? 'ph-spin' : ''}`} />
                <span>{recalcMutation.isPending ? 'Đang tính lại...' : 'Tải lại dữ liệu'}</span>
              </button>
            )}
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onOpenSheetView(period.id)}>
              <i className="ph ph-check-square" />
              <span>Xem bảng lương</span>
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleExport}>
              <i className="ph ph-file-arrow-up" />
              <span>Xuất file</span>
            </button>
          </div>
        </>
      )}

      {activeTab === 'records' && (
        <>
          <div className="detail-table-scroll">
            <table className="detail-table">
              <thead>
                <tr>
                  <th>Mã phiếu</th>
                  <th>Tên nhân viên</th>
                  <th className="is-num">Lương chính</th>
                  <th className="is-num">Phụ cấp / Hoa hồng</th>
                  <th className="is-num">Tổng thu nhập</th>
                  <th className="is-num">Đã trả NV</th>
                  <th className="is-num">Còn cần trả</th>
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => {
                  const allowanceAndCommission = (rec.allowance || 0) + (rec.commission || 0) + (rec.tourCommission || 0) + (rec.bonus || 0);
                  return (
                    <tr key={rec.id}>
                      <td className="is-code">{rec.code}</td>
                      <td>
                        <span className="text-strong text-primary">{rec.staff.name}</span>
                        {rec.staff.role && <span className="text-muted"> ({rec.staff.role})</span>}
                      </td>
                      <td className="is-num">{formatMoney(rec.baseSalary)}</td>
                      <td className="is-num text-muted">{formatMoney(allowanceAndCommission)}</td>
                      <td className="is-num text-strong">{formatMoney(rec.netSalary)}</td>
                      <td className="is-num text-success">{formatMoney(rec.paidAmount)}</td>
                      <td className={`is-num text-strong ${owedTone(rec.remainingAmount)}`}>{formatMoney(rec.remainingAmount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="detail-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setIsPaymentModalOpen(true)}>
              <i className="ph ph-credit-card" />
              <span>Thanh toán</span>
            </button>
          </div>
        </>
      )}

      {activeTab === 'payments' && (
        !payments.length ? (
          <EmptyState message="Chưa có giao dịch thanh toán nào trong kỳ lương này." />
        ) : (
          <div className="table-scroll">
            <table className="detail-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Nhân viên nhận</th>
                  <th className="is-num">Số tiền</th>
                  <th>Hình thức</th>
                  <th>Người chi</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{formatDateTime(p.paidAt)}</td>
                    <td className="is-code">{p.staff.name}</td>
                    <td className="is-num text-strong text-success">{formatMoney(p.amount)}</td>
                    <td>{p.paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}</td>
                    <td>{p.actorName || 'Quản lý'}</td>
                    <td className="text-muted">{p.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {isPaymentModalOpen && (
        <StaffPayrollPaymentModal periodDetail={detail} onClose={() => setIsPaymentModalOpen(false)} />
      )}
    </InlineDetail>
  );
}
