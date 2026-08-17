import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  MobileSearchBar,
  MobileDetailSheet,
  MobileEmptyState,
} from '@/features/mobile-common';
import { formatMoney, initials } from '@/lib/format';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import {
  getPayrollList,
  getPayrollDetail,
  type PayrollPeriodListItem,
  type PayrollRecordItem,
} from '@/features/staff/staff.api';
import './mobile-staff.css';

export function MobileStaffPayrollAdminView() {
  const navigate = useNavigate();
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
      {/* Sticky Top Header Cluster */}
      <div className="mobile-staff-sticky-header-cluster">
        {/* 1. Header Top Navigation */}
        <div className="mobile-staff-top-nav">
          <div className="mobile-staff-nav-left">
            <button
              type="button"
              className="mobile-staff-back-icon"
              onClick={() => navigate('/m/more')}
              aria-label="Quay lại"
            >
              <i className="ph ph-caret-left" />
            </button>
            <h1 className="mobile-staff-nav-title">Bảng lương</h1>
          </div>

          <div className="mobile-staff-nav-actions">
            <button
              type="button"
              className="mobile-staff-nav-btn"
              onClick={() => setIsSearchVisible((prev) => !prev)}
              aria-label="Tìm kiếm"
            >
              <i className="ph ph-magnifying-glass" />
            </button>
            <button
              type="button"
              className="mobile-staff-nav-btn"
              onClick={handleExport}
              aria-label="Xuất file"
              title="Xuất file bảng lương"
            >
              <i className="ph ph-export" />
            </button>
          </div>
        </div>

        {/* Inline Search Bar */}
        {isSearchVisible && (
          <div className="mobile-staff-search-bar-wrap">
            <MobileSearchBar
              value={search}
              onChange={setSearch}
              placeholder="Tìm phiếu lương theo tên, mã thợ..."
            />
          </div>
        )}

        {/* Filter Strip */}
        <div className="mobile-staff-filter-strip">
          <button
            type="button"
            className={`mobile-filter-chip ${periodType === 'monthly' ? 'is-active' : ''}`}
            onClick={() => setPeriodType('monthly')}
          >
            <span>Kỳ tháng</span>
          </button>

          <button
            type="button"
            className={`mobile-filter-chip ${periodType === 'weekly' ? 'is-active' : ''}`}
            onClick={() => setPeriodType('weekly')}
          >
            <span>Kỳ tuần</span>
          </button>

          {rawPeriods.length > 0 && (
            <select
              value={activePeriod?.id ?? ''}
              onChange={(e) => setSelectedPeriodId(Number(e.target.value))}
              style={{
                height: 36,
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                padding: '0 10px',
                fontSize: 13,
                fontWeight: 600,
                background: '#ffffff',
                color: '#334155',
              }}
            >
              {rawPeriods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Summary Bar */}
        <div className="mobile-staff-summary-sort-bar">
          <span className="mobile-sort-select-chip">
            <span>{activePeriod?.name || 'Kỳ lương hiện tại'}</span>
          </span>
          <span className="mobile-summary-text">
            {filteredRecords.length} nhân viên · Tổng: <strong>{formatMoney(totalNet)}</strong>
          </span>
        </div>
      </div>

      {/* Grouped Section List */}
      <div className="mobile-grouped-list-container">
        {payrollDetailQuery.isLoading ? (
          <div style={{ textAlign: 'center', padding: '36px 0', color: '#64748b' }}>
            Đang tải dữ liệu bảng lương...
          </div>
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
                  const isApproved = record.status === 'approved' || record.status === 'paid';
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
                        <span
                          className={`mobile-shift-badge ${isApproved ? 'theme-green' : 'theme-orange'}`}
                          style={{ fontSize: 11 }}
                        >
                          {isApproved ? 'Đã chốt lương' : 'Tạm tính'}
                        </span>
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
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            <button
              type="button"
              className="mobile-staff-action-btn primary"
              style={{ width: '100%' }}
              onClick={() => setSelectedStaffRecord(null)}
            >
              Đóng phiếu lương
            </button>
          </div>
        }
      >
        {selectedStaffRecord && (
          <>
            <div className="mobile-detail-hero">
              <div className="mobile-detail-hero-header">
                <div>
                  <div style={{ fontSize: 13, color: '#64748b' }}>Thực lĩnh kỳ này</div>
                  <div className="mobile-detail-hero-amount">
                    {formatMoney(selectedStaffRecord.netSalary)}
                  </div>
                </div>
                <span
                  className={`mobile-shift-badge ${
                    selectedStaffRecord.status === 'approved' ? 'theme-green' : 'theme-orange'
                  }`}
                >
                  {selectedStaffRecord.status === 'approved' ? 'Đã duyệt' : 'Chưa duyệt'}
                </span>
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
                <span className="mobile-detail-cell-value" style={{ color: '#0062eb' }}>
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
                  <span className="mobile-detail-item-value" style={{ color: '#16a34a' }}>
                    +{formatMoney(selectedStaffRecord.allowance)}
                  </span>
                </div>

                <div className="mobile-detail-item">
                  <div className="mobile-detail-item-left">
                    <span className="mobile-detail-item-title">Thưởng đánh giá & KPI</span>
                    <span className="mobile-detail-item-sub">Đạt chỉ tiêu tháng</span>
                  </div>
                  <span className="mobile-detail-item-value" style={{ color: '#16a34a' }}>
                    +{formatMoney(selectedStaffRecord.bonus)}
                  </span>
                </div>

                <div className="mobile-detail-item">
                  <div className="mobile-detail-item-left">
                    <span className="mobile-detail-item-title">Giảm trừ / Phạt vi phạm</span>
                    <span className="mobile-detail-item-sub">Đi muộn hoặc vi phạm quy chế</span>
                  </div>
                  <span className="mobile-detail-item-value" style={{ color: '#ea580c' }}>
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
