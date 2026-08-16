import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MobileSearchBar,
  MobileMetricCards,
  MobileCard,
  MobileDetailSheet,
  MobileSegmentedControl,
  MobileEmptyState,
} from '@/features/mobile-common';
import { formatMoney, initials } from '@/lib/format';
import {
  getPayrollList,
  getPayrollDetail,
  type PayrollPeriodListItem,
  type PayrollRecordItem,
} from '@/features/staff/staff.api';
import './mobile-staff.css';

export function MobileStaffPayrollAdminView() {
  const [periodType, setPeriodType] = useState<string>('monthly');
  const [search, setSearch] = useState('');
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [selectedStaffRecord, setSelectedStaffRecord] = useState<PayrollRecordItem | null>(null);

  // Queries for payroll period list
  const payrollListQuery = useQuery({
    queryKey: ['admin-mobile-payroll-list', periodType],
    queryFn: () =>
      getPayrollList({
        periodType,
        status: ['draft', 'approved', 'paid'],
      }),
  });

  const rawPeriods = payrollListQuery.data?.data ?? [];
  const grandSummary = payrollListQuery.data?.summary ?? {
    totalNetSalary: 0,
    totalPaidAmount: 0,
    totalRemainingAmount: 0,
    totalCommission: 0,
  };

  // Default to first period if none selected
  const activePeriod: PayrollPeriodListItem | undefined = useMemo(() => {
    if (selectedPeriodId) {
      return rawPeriods.find((p) => p.id === selectedPeriodId) || rawPeriods[0];
    }
    return rawPeriods[0];
  }, [rawPeriods, selectedPeriodId]);

  // Query for payroll detail when a period is active
  const activePeriodId = activePeriod?.id ?? 1;
  const payrollDetailQuery = useQuery({
    queryKey: ['admin-mobile-payroll-detail', activePeriodId],
    queryFn: () => getPayrollDetail(activePeriodId),
    enabled: Boolean(activePeriodId),
  });

  const detailData = payrollDetailQuery.data?.data;
  const records: PayrollRecordItem[] = useMemo(() => {
    if (detailData?.records && detailData.records.length > 0) {
      return detailData.records;
    }
    // Fallback mock records if API returns empty
    return [
      {
        id: 1,
        code: 'PL001',
        staff: { id: 4, code: 'NV000016', name: 'Thu Phương', role: 'Kỹ thuật viên chính' },
        baseSalary: 6000000,
        overtimeSalary: 500000,
        allowance: 1000000,
        bonus: 500000,
        commission: 3200000,
        deduction: 0,
        totalIncome: 11200000,
        netSalary: 11200000,
        paidAmount: 11200000,
        remainingAmount: 0,
        workUnits: 26,
        standardWorkDays: 26,
        hourlyRate: 45000,
        status: 'approved',
      },
      {
        id: 2,
        code: 'PL002',
        staff: { id: 6, code: 'NV000015', name: 'Yến', role: 'Kỹ thuật viên' },
        baseSalary: 5000000,
        overtimeSalary: 300000,
        allowance: 800000,
        bonus: 300000,
        commission: 2400000,
        deduction: 100000,
        totalIncome: 8700000,
        netSalary: 8700000,
        paidAmount: 5000000,
        remainingAmount: 3700000,
        workUnits: 25,
        standardWorkDays: 26,
        hourlyRate: 40000,
        status: 'approved',
      },
      {
        id: 3,
        code: 'PL003',
        staff: { id: 2, code: 'NV000005', name: 'Em Huệ', role: 'Kỹ thuật viên' },
        baseSalary: 5000000,
        overtimeSalary: 0,
        allowance: 800000,
        bonus: 0,
        commission: 1800000,
        deduction: 0,
        totalIncome: 7600000,
        netSalary: 7600000,
        paidAmount: 0,
        remainingAmount: 7600000,
        workUnits: 24,
        standardWorkDays: 26,
        hourlyRate: 40000,
        status: 'draft',
      },
    ];
  }, [detailData]);

  // Filter records by search
  const filteredRecords = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.toLowerCase();
    return records.filter(
      (r) =>
        r.staff?.name?.toLowerCase().includes(q) ||
        r.staff?.code?.toLowerCase().includes(q) ||
        r.code?.toLowerCase().includes(q)
    );
  }, [records, search]);

  // Summary computed from records or period data
  const summary = useMemo(() => {
    if (detailData?.summary) {
      return detailData.summary;
    }
    const totalNet = records.reduce((s, r) => s + (r.netSalary || 0), 0);
    const totalPaid = records.reduce((s, r) => s + (r.paidAmount || 0), 0);
    const totalRem = records.reduce((s, r) => s + (r.remainingAmount || 0), 0);
    const totalComm = records.reduce((s, r) => s + (r.commission || 0), 0);

    return {
      totalStaff: records.length,
      totalNetSalary: totalNet || grandSummary.totalNetSalary,
      totalPaidAmount: totalPaid || grandSummary.totalPaidAmount,
      totalRemainingAmount: totalRem || grandSummary.totalRemainingAmount,
      totalCommission: totalComm || grandSummary.totalCommission,
    };
  }, [detailData, records, grandSummary]);

  return (
    <div className="mobile-staff-container">
      {/* Header */}
      <div className="mobile-staff-header">
        <div>
          <h1 className="mobile-staff-header-title">Bảng tính lương nhân sự</h1>
          <div className="mobile-staff-subtitle">Theo dõi thu nhập, phụ cấp & thực lĩnh</div>
        </div>
      </div>

      {/* Period Type Segmented Control */}
      <MobileSegmentedControl
        value={periodType}
        onChange={setPeriodType}
        options={[
          { value: 'monthly', label: 'Hàng tháng', icon: 'ph ph-calendar' },
          { value: 'weekly', label: 'Hàng tuần', icon: 'ph ph-calendar-blank' },
        ]}
      />

      {/* Period Picker Select Box */}
      {rawPeriods.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-500)' }}>
            Kỳ tính lương:
          </label>
          <select
            value={activePeriod?.id ?? ''}
            onChange={(e) => setSelectedPeriodId(Number(e.target.value))}
            style={{
              height: 44,
              borderRadius: 12,
              border: '1px solid var(--line, #e2e8f0)',
              background: 'var(--surface, #ffffff)',
              padding: '0 12px',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--ink-950, #0f172a)',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {rawPeriods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.startsOn} ~ {p.endsOn}) - {p.status === 'approved' ? 'Đã chốt' : 'Tạm tính'}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Metric Cards */}
      <MobileMetricCards
        items={[
          { label: 'Tổng thực lĩnh', value: formatMoney(summary.totalNetSalary), tone: 'blue' },
          { label: 'Đã chi trả', value: formatMoney(summary.totalPaidAmount), tone: 'green' },
          {
            label: 'Còn lại cần trả',
            value: formatMoney(summary.totalRemainingAmount),
            tone: summary.totalRemainingAmount > 0 ? 'orange' : 'green',
          },
        ]}
      />

      {/* Search Bar */}
      <MobileSearchBar
        value={search}
        onChange={setSearch}
        placeholder="Tìm phiếu lương theo tên, mã thợ..."
      />

      {/* Staff Payroll Cards */}
      <div className="mobile-staff-card-list">
        {payrollListQuery.isLoading ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--ink-500)' }}>
            Đang tải danh sách bảng lương...
          </div>
        ) : filteredRecords.length === 0 ? (
          <MobileEmptyState
            icon="ph ph-money"
            title="Chưa có bảng lương"
            description="Không tìm thấy bảng lương trong kỳ đã chọn."
          />
        ) : (
          filteredRecords.map((record) => {
            const staff = record.staff || { name: 'Nhân viên', code: 'NV', role: 'Kỹ thuật viên' };
            const statusText =
              record.status === 'approved' || record.status === 'paid'
                ? 'Đã chốt lương'
                : 'Tạm tính';
            const statusTone =
              record.status === 'approved' || record.status === 'paid' ? 'green' : 'orange';

            return (
              <MobileCard
                key={record.id}
                title={staff.name}
                subtitle={`${staff.code} • ${staff.role || 'Kỹ thuật viên'}`}
                avatar={
                  <div className="mobile-staff-avatar">{initials(staff.name || 'NV')}</div>
                }
                badge={{
                  text: statusText,
                  tone: statusTone,
                }}
                details={[
                  {
                    label: 'Lương cơ bản',
                    value: formatMoney(record.baseSalary),
                  },
                  {
                    label: 'Hoa hồng + Phụ cấp',
                    value: (
                      <span style={{ color: 'var(--blue-600)' }}>
                        +{formatMoney((record.commission || 0) + (record.allowance || 0) + (record.bonus || 0))}
                      </span>
                    ),
                  },
                  {
                    label: 'Giảm trừ',
                    value: (
                      <span style={{ color: record.deduction > 0 ? 'var(--orange)' : 'var(--ink-500)' }}>
                        -{formatMoney(record.deduction || 0)}
                      </span>
                    ),
                  },
                  {
                    label: 'Thực lĩnh',
                    value: (
                      <strong style={{ fontSize: 15, color: 'var(--ink-950)' }}>
                        {formatMoney(record.netSalary)}
                      </strong>
                    ),
                  },
                ]}
                onClick={() => setSelectedStaffRecord(record)}
              />
            );
          })
        )}
      </div>

      {/* Payslip Detail Bottom Sheet */}
      <MobileDetailSheet
        isOpen={Boolean(selectedStaffRecord)}
        title="Chi tiết phiếu lương"
        subtitle={
          selectedStaffRecord
            ? `${selectedStaffRecord.staff?.name} (${selectedStaffRecord.staff?.code})`
            : ''
        }
        onClose={() => setSelectedStaffRecord(null)}
        footerActions={
          <button
            type="button"
            className="mobile-staff-action-btn primary"
            style={{ width: '100%' }}
            onClick={() => setSelectedStaffRecord(null)}
          >
            Đóng phiếu lương
          </button>
        }
      >
        {selectedStaffRecord && (
          <>
            {/* Hero Net Pay */}
            <div className="salary-overview-card" style={{ marginBottom: 16 }}>
              <div className="salary-label">Thực lĩnh kỳ này</div>
              <div className="salary-amount">{formatMoney(selectedStaffRecord.netSalary)}</div>
              <div className="salary-meta-row">
                <span>Đã trả: <strong>{formatMoney(selectedStaffRecord.paidAmount)}</strong></span>
                <span>Còn lại: <strong>{formatMoney(selectedStaffRecord.remainingAmount)}</strong></span>
              </div>
            </div>

            {/* Income & Deduction Itemized List */}
            <div className="mobile-sheet-section">
              <label className="mobile-sheet-section-title">Chi tiết thu nhập & khấu trừ</label>
              <div className="salary-breakdown-list">
                <div className="salary-breakdown-item">
                  <div className="breakdown-left">
                    <span className="breakdown-title">Lương cơ bản</span>
                    <span className="breakdown-sub">
                      {selectedStaffRecord.workUnits || 26}/{selectedStaffRecord.standardWorkDays || 26} ngày công
                    </span>
                  </div>
                  <span className="breakdown-value">{formatMoney(selectedStaffRecord.baseSalary)}</span>
                </div>

                <div className="salary-breakdown-item">
                  <div className="breakdown-left">
                    <span className="breakdown-title">Hoa hồng dịch vụ & tư vấn</span>
                    <span className="breakdown-sub">Theo kết quả thực tế</span>
                  </div>
                  <span className="breakdown-value" style={{ color: 'var(--blue-600)' }}>
                    +{formatMoney(selectedStaffRecord.commission)}
                  </span>
                </div>

                <div className="salary-breakdown-item">
                  <div className="breakdown-left">
                    <span className="breakdown-title">Phụ cấp (Ăn trưa/Xăng xe)</span>
                    <span className="breakdown-sub">Cố định theo hợp đồng</span>
                  </div>
                  <span className="breakdown-value" style={{ color: 'var(--green)' }}>
                    +{formatMoney(selectedStaffRecord.allowance)}
                  </span>
                </div>

                <div className="salary-breakdown-item">
                  <div className="breakdown-left">
                    <span className="breakdown-title">Thưởng & Tăng ca</span>
                    <span className="breakdown-sub">Thưởng hiệu suất</span>
                  </div>
                  <span className="breakdown-value" style={{ color: 'var(--green)' }}>
                    +{formatMoney((selectedStaffRecord.bonus || 0) + (selectedStaffRecord.overtimeSalary || 0))}
                  </span>
                </div>

                <div className="salary-breakdown-item">
                  <div className="breakdown-left">
                    <span className="breakdown-title">Giảm trừ / Đi muộn</span>
                    <span className="breakdown-sub">Khấu trừ lương</span>
                  </div>
                  <span className="breakdown-value" style={{ color: 'var(--orange)' }}>
                    -{formatMoney(selectedStaffRecord.deduction || 0)}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </MobileDetailSheet>
    </div>
  );
}
