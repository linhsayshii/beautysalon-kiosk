import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ErrorState, LoadingState } from '@/components/data-display/DataState';
import { formatMoney } from '@/lib/format';
import { getMyPayrollHistory, type MyPayrollResponse } from '@/features/staff/staff.api';
import './mobile-staff.css';

const statusLabels: Record<string, string> = {
  draft: 'Tạm tính',
  approved: 'Đã chốt',
  paid: 'Đã thanh toán',
  cancelled: 'Đã hủy',
};

function monthLabel(startsOn: string) {
  const [year, month] = startsOn.split('-');
  return `Tháng ${month}/${year}`;
}

interface SalaryLineProps {
  title: string;
  subtitle: string;
  value: number;
  sign?: '+' | '-';
  tone?: 'positive' | 'negative' | 'accent';
}

function SalaryLine({ title, subtitle, value, sign, tone }: SalaryLineProps) {
  const prefix = sign && value > 0 ? sign : '';
  return (
    <div className="salary-breakdown-item">
      <div className="breakdown-left">
        <span className="breakdown-title">{title}</span>
        <span className="breakdown-sub">{subtitle}</span>
      </div>
      <span className={`breakdown-value ${tone ? `is-${tone}` : ''}`}>{prefix}{formatMoney(value)}</span>
    </div>
  );
}

export function MobileStaffSalaryView() {
  const navigate = useNavigate();
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
  const query = useQuery({
    queryKey: ['mobile-my-payroll-history'],
    queryFn: getMyPayrollHistory,
  });

  const { records, currentPeriodStartsOn } = (query.data?.data ?? { records: [], currentPeriodStartsOn: null }) as MyPayrollResponse;
  const activeRecord = useMemo(
    () => records.find((record) => record.id === selectedRecordId)
      ?? records.find((record) => record.period.startsOn === currentPeriodStartsOn)
      ?? records[0]
      ?? null,
    [records, selectedRecordId, currentPeriodStartsOn],
  );

  return (
    <div className="mobile-staff-view mobile-salary-view">
      <div className="mobile-staff-sticky-header-cluster mobile-salary-sticky-shell">
        <div className="mobile-staff-top-nav mobile-salary-top-nav">
          <div className="mobile-staff-nav-left">
            <button type="button" className="mobile-staff-back-icon" onClick={() => navigate(-1)} aria-label="Quay lại">
              <i className="ph ph-arrow-left" />
            </button>
            <h1 className="mobile-staff-nav-title">Lương của tôi</h1>
          </div>
        </div>
        {records.length > 0 && (
          <div className="mobile-staff-filter-strip mobile-salary-month-menu">
            <label className="mobile-filter-chip mobile-salary-month-control" htmlFor="my-payroll-month">
              <i className="ph ph-calendar" />
              <span className="mobile-salary-month-label">Kỳ lương</span>
              <select
                id="my-payroll-month"
                value={activeRecord?.id ?? ''}
                onChange={(event) => setSelectedRecordId(Number(event.target.value))}
                aria-label="Chọn tháng lương"
              >
                {records.map((record) => (
                  <option value={record.id} key={record.id}>{monthLabel(record.period.startsOn)}</option>
                ))}
              </select>
              <i className="ph ph-caret-down mobile-salary-month-caret" aria-hidden="true" />
            </label>
          </div>
        )}
      </div>

      <div className="mobile-salary-content">
        {query.isPending ? (
          <LoadingState />
        ) : query.error ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : !activeRecord ? (
          <div className="mobile-staff-empty-state">
            <i className="ph ph-wallet" />
            <strong>Chưa có bảng lương</strong>
            <span>Bảng lương sẽ xuất hiện ở đây khi quản lý tạo kỳ lương cho bạn.</span>
          </div>
        ) : (
          <>
          <div className="salary-overview-card">
            <div className="salary-label">Thực lĩnh {monthLabel(activeRecord.period.startsOn).toLowerCase()}</div>
            <div className="salary-amount">{formatMoney(activeRecord.netSalary)}</div>
            <div className="salary-meta-row">
              <span>{activeRecord.workUnits}/{activeRecord.standardWorkDays} ngày công</span>
              <span className={`mobile-payroll-status is-${activeRecord.status}`}>{statusLabels[activeRecord.status] || activeRecord.status}</span>
            </div>
          </div>

          <div className="salary-breakdown-list">
            <h2>Chi tiết thu nhập</h2>
            <SalaryLine title="Lương cơ bản" subtitle={`${activeRecord.workUnits}/${activeRecord.standardWorkDays} ngày công tiêu chuẩn`} value={activeRecord.baseSalary} />
            <SalaryLine title="Lương tăng ca" subtitle="Theo điều chỉnh của kỳ lương" value={activeRecord.overtimeSalary} sign="+" tone="positive" />
            <SalaryLine title="Hoa hồng" subtitle="Từ dịch vụ và sản phẩm" value={activeRecord.commission} sign="+" tone="accent" />
            <SalaryLine title="Phụ cấp" subtitle="Theo điều chỉnh của kỳ lương" value={activeRecord.allowance} sign="+" tone="positive" />
            <SalaryLine title="Thưởng" subtitle="Theo điều chỉnh của kỳ lương" value={activeRecord.bonus} sign="+" tone="positive" />
            <SalaryLine title="Khấu trừ" subtitle="Theo điều chỉnh của kỳ lương" value={activeRecord.deduction} sign="-" tone="negative" />
          </div>

          <div className="salary-breakdown-list">
            <h2>Chi trả</h2>
            <SalaryLine title="Tổng thu nhập" subtitle="Trước khấu trừ" value={activeRecord.totalIncome} />
            <SalaryLine title="Đã thanh toán" subtitle="Tổng tiền đã nhận" value={activeRecord.paidAmount} tone="positive" />
            <SalaryLine title="Còn lại" subtitle="Số tiền chưa được chi trả" value={activeRecord.remainingAmount} tone={activeRecord.remainingAmount > 0 ? 'negative' : 'positive'} />
          </div>
          </>
        )}
      </div>
    </div>
  );
}
