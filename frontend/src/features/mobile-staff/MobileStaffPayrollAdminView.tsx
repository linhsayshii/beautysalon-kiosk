import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MobileSearchBar,
  MobileDetailSheet,
  MobileEmptyState,
} from '@/features/mobile-common';
import { formatMoney, initials } from '@/lib/format';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { Select } from '@/components/ui/Select/Select';
import {
  getPayrollList,
  getPayrollDetail,
  type PayrollPeriodListItem,
  type PayrollRecordItem,
} from '@/features/staff/staff.api';
import { StatusBadge } from '@/components/data-display/Badges';
import { MobilePageHeader } from '@/components/ui/MobilePageHeader/MobilePageHeader';
import { LoadingState } from '@/components/data-display/DataState';

export function MobileStaffPayrollAdminView() {
  const { notify } = useToast();
  const [periodType, setPeriodType] = useState<string>('monthly');
  const [search, setSearch] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
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
    return detailData?.records ?? [];
  }, [detailData]);

  // Filter records by search term
  const filteredRecords = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.toLowerCase();
    return records.filter(
      (r) =>
        r.staff.name.toLowerCase().includes(q) ||
        r.staff.code.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q)
    );
  }, [records, search]);

  // Group by Role
  const groupedRecords = useMemo(() => {
    const map = new Map<string, PayrollRecordItem[]>();
    filteredRecords.forEach((rec) => {
      const role = (rec.staff.role || 'KỸ THUẬT VIÊN').toUpperCase();
      const list = map.get(role) || [];
      list.push(rec);
      map.set(role, list);
    });
    return Array.from(map.entries());
  }, [filteredRecords]);

  // Total summary calculation
  const totalNet = useMemo(() => {
    return filteredRecords.reduce((sum, r) => sum + Number(r.netSalary || 0), 0);
  }, [filteredRecords]);

  const handleExport = () => {
    notify('Xuất bảng lương', 'Đã tải xuống file bảng lương nhân viên (.xlsx).');
  };

  return (
    <div className="mobile-staff-view">
      <MobilePageHeader
        title="Bảng lương" backTo="/m/more"
        actions={(
          <>
            <button
              type="button"
              className="btn btn-ghost btn-icon m-header-action"
              onClick={() => setIsSearchVisible((prev) => !prev)}
              aria-label="Tìm kiếm"
            >
              <i className="ph ph-magnifying-glass" />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-icon m-header-action"
              onClick={handleExport}
              aria-label="Xuất file"
              title="Xuất file bảng lương"
            >
              <i className="ph ph-export" />
            </button>
          </>
        )}
      >
        {isSearchVisible && (
          <MobileSearchBar
            value={search}
            onChange={setSearch}
            placeholder="Tìm phiếu lương theo tên, mã thợ..."
          />
        )}

        {/* Filter Strip */}
        <div className="m-chip-strip">
          <button
            type="button"
            className={`chip ${periodType === 'monthly' ? 'is-active' : ''}`}
            onClick={() => setPeriodType('monthly')}
          >
            <span>Kỳ tháng</span>
          </button>

          <button
            type="button"
            className={`chip ${periodType === 'weekly' ? 'is-active' : ''}`}
            onClick={() => setPeriodType('weekly')}
          >
            <span>Kỳ tuần</span>
          </button>

          {rawPeriods.length > 0 && (
            <Select<number>
              aria-label="Kỳ lương"
              variant="pill"
              value={activePeriod?.id}
              onChange={setSelectedPeriodId}
              options={rawPeriods.map((period) => ({ value: period.id, label: period.name }))}
            />
          )}
        </div>

        {/* Summary Bar */}
        <div className="m-summary-bar">
          <span className="m-summary-count">
            {filteredRecords.length} nhân viên · Tổng: <strong>{formatMoney(totalNet)}</strong>
          </span>
        </div>
      </MobilePageHeader>

      {/* Grouped Section List */}
      <div className="mobile-grouped-list-container">
        {payrollDetailQuery.isLoading ? (
          <LoadingState compact label="Đang tải dữ liệu bảng lương..." />
        ) : filteredRecords.length === 0 ? (
          <MobileEmptyState
            icon="ph ph-money"
            title="Chưa có bảng lương"
            description="Không tìm thấy phiếu lương nào trong kỳ này."
          />
        ) : (
          groupedRecords.map(([roleGroup, groupRecords]) => (
            <div key={roleGroup} className="mobile-grouped-section">
              <div className="mobile-section-header">
                <span className="mobile-section-title">{roleGroup}</span>
                <span className="mobile-section-count">{groupRecords.length}</span>
              </div>
              <div className="mobile-section-card">
                {groupRecords.map((record) => {
                  return (
                    <div
                      key={record.id}
                      className="mobile-grouped-row"
                      onClick={() => setSelectedStaffRecord(record)}
                    >
                      <div className="mobile-staff-row-left">
                        <div className="mobile-staff-avatar purple">
                          {initials(record.staff.name || 'NV')}
                        </div>
                        <div className="mobile-staff-row-info">
                          <span className="mobile-staff-row-name">{record.staff.name}</span>
                          <span className="mobile-staff-row-sub">
                            <span>{record.staff.code}</span>
                            <span>•</span>
                            <span>{record.staff.role}</span>
                          </span>
                        </div>
                      </div>

                      <div className="mobile-staff-row-right">
                        <span className="mobile-staff-row-value blue">
                          {formatMoney(record.netSalary)}
                        </span>
                        <StatusBadge status={record.status} payroll />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Payslip Inset Detail Sheet */}
      <MobileDetailSheet
        isOpen={Boolean(selectedStaffRecord)}
        title="Chi tiết phiếu lương"
        subtitle={
          selectedStaffRecord
            ? `${selectedStaffRecord.staff.name} • ${selectedStaffRecord.code}`
            : ''
        }
        onClose={() => setSelectedStaffRecord(null)}
        footerActions={
          <button type="button" className="btn btn-primary" onClick={() => setSelectedStaffRecord(null)}>
            Đóng phiếu lương
          </button>
        }
      >
        {selectedStaffRecord && (
          <>
            <div className="mobile-detail-hero">
              <div className="mobile-detail-hero-header">
                <div>
                  <div className="text-muted">Thực lĩnh kỳ này</div>
                  <div className="mobile-detail-hero-amount">
                    {formatMoney(selectedStaffRecord.netSalary)}
                  </div>
                </div>
                <StatusBadge status={selectedStaffRecord.status} payroll />
              </div>
            </div>

            <div className="mobile-detail-grid">
              <div className="mobile-detail-cell">
                <span className="mobile-detail-cell-label">Mã phiếu lương</span>
                <span className="mobile-detail-cell-value">{selectedStaffRecord.code}</span>
              </div>
              <div className="mobile-detail-cell">
                <span className="mobile-detail-cell-label">Ngày công thực tế</span>
                <span className="mobile-detail-cell-value">
                  {selectedStaffRecord.workUnits}/{selectedStaffRecord.standardWorkDays} công
                </span>
              </div>
              <div className="mobile-detail-cell">
                <span className="mobile-detail-cell-label">Lương cơ bản</span>
                <span className="mobile-detail-cell-value">
                  {formatMoney(selectedStaffRecord.baseSalary)}
                </span>
              </div>
              <div className="mobile-detail-cell">
                <span className="mobile-detail-cell-label">Hoa hồng dịch vụ</span>
                <span className="mobile-detail-cell-value text-primary">
                  +{formatMoney(selectedStaffRecord.commission)}
                </span>
              </div>
            </div>

            <div className="mobile-sheet-section">
              <span className="mobile-sheet-section-title">Chi tiết thu nhập & khấu trừ</span>
              <div className="mobile-detail-list">
                <div className="mobile-detail-item">
                  <div className="mobile-detail-item-left">
                    <span className="mobile-detail-item-title">Lương làm thêm giờ (OT)</span>
                    <span className="mobile-detail-item-sub">Tính theo giờ phát sinh ngoài ca</span>
                  </div>
                  <span className="mobile-detail-item-value">
                    +{formatMoney(selectedStaffRecord.overtimeSalary)}
                  </span>
                </div>

                <div className="mobile-detail-item">
                  <div className="mobile-detail-item-left">
                    <span className="mobile-detail-item-title">Phụ cấp & Ăn trưa</span>
                    <span className="mobile-detail-item-sub">Định mức cố định tháng</span>
                  </div>
                  <span className="mobile-detail-item-value text-success">
                    +{formatMoney(selectedStaffRecord.allowance)}
                  </span>
                </div>

                <div className="mobile-detail-item">
                  <div className="mobile-detail-item-left">
                    <span className="mobile-detail-item-title">Thưởng đánh giá & KPI</span>
                    <span className="mobile-detail-item-sub">Đạt chỉ tiêu tháng</span>
                  </div>
                  <span className="mobile-detail-item-value text-success">
                    +{formatMoney(selectedStaffRecord.bonus)}
                  </span>
                </div>

                <div className="mobile-detail-item">
                  <div className="mobile-detail-item-left">
                    <span className="mobile-detail-item-title">Giảm trừ / Phạt vi phạm</span>
                    <span className="mobile-detail-item-sub">Đi muộn hoặc vi phạm quy chế</span>
                  </div>
                  <span className="mobile-detail-item-value text-warning">
                    -{formatMoney(selectedStaffRecord.deduction)}
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
