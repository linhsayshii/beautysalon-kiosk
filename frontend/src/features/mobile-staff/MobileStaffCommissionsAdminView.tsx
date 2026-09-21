import { DatePickerField } from '@/components/ui/DateTimePicker';
import { ErrorState, LoadingState } from '@/components/data-display/DataState';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  MobileSearchBar,
  MobileDetailSheet,
  MobileEmptyState,
} from '@/features/mobile-common';
import {
  getCommissions,
  type CommissionDetail,
  type CommissionStaffSummary,
} from '@/features/staff/staff.api';
import { monthStartIso, todayIso } from '@/lib/date';
import { formatMoney, formatPercent, initials } from '@/lib/format';
import './mobile-staff.css';

export function MobileStaffCommissionsAdminView() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'by_staff' | 'details'>('by_staff');
  const [dateFrom, setDateFrom] = useState(monthStartIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [search, setSearch] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  // Selected item for bottom sheet
  const [selectedStaffSummary, setSelectedStaffSummary] = useState<CommissionStaffSummary | null>(null);
  const [selectedTxRecord, setSelectedTxRecord] = useState<CommissionDetail | null>(null);

  const { data: commData, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-mobile-commissions', dateFrom, dateTo],
    queryFn: () => getCommissions(dateFrom, dateTo),
  });

  const payload = commData?.data;
  const rows: CommissionDetail[] = useMemo(() => {
    return payload?.rows ?? [];
  }, [payload]);

  const staffSummary: CommissionStaffSummary[] = useMemo(() => {
    return payload?.staffSummary ?? [];
  }, [payload]);

  // Filter staff list
  const filteredByStaff = useMemo(() => {
    if (!search.trim()) return staffSummary;
    const q = search.toLowerCase();
    return staffSummary.filter(
      (s) =>
        s.staff.name?.toLowerCase().includes(q) ||
        s.staff.code?.toLowerCase().includes(q) ||
        s.staff.role?.toLowerCase().includes(q)
    );
  }, [staffSummary, search]);

  // Filter transaction rows
  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.staff.name?.toLowerCase().includes(q) ||
        r.productName?.toLowerCase().includes(q) ||
        r.sourceName?.toLowerCase().includes(q) ||
        r.invoiceCode?.toLowerCase().includes(q)
    );
  }, [rows, search]);

  // Group staff by Role for Tab 1
  const groupedStaff = useMemo(() => {
    const map = new Map<string, CommissionStaffSummary[]>();
    filteredByStaff.forEach((s) => {
      const role = (s.staff.role || 'KỸ THUẬT VIÊN').toUpperCase();
      const list = map.get(role) || [];
      list.push(s);
      map.set(role, list);
    });
    return Array.from(map.entries());
  }, [filteredByStaff]);

  // Group transactions by date for Tab 2
  const groupedTransactions = useMemo(() => {
    const map = new Map<string, CommissionDetail[]>();
    filteredRows.forEach((r) => {
      const dateKey = r.occurredOn || 'GẦN ĐÂY';
      const list = map.get(dateKey) || [];
      list.push(r);
      map.set(dateKey, list);
    });
    return Array.from(map.entries());
  }, [filteredRows]);

  const totalCommissions = useMemo(() => {
    return filteredByStaff.reduce((sum, s) => sum + s.totalAmount, 0);
  }, [filteredByStaff]);

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
            <h1 className="mobile-staff-nav-title">Bảng hoa hồng</h1>
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
          </div>
        </div>

        {/* Inline Search Bar */}
        {isSearchVisible && (
          <div className="mobile-staff-search-bar-wrap">
            <MobileSearchBar
              value={search}
              onChange={setSearch}
              placeholder="Tìm theo nhân viên, dịch vụ, hóa đơn..."
            />
          </div>
        )}

        {/* Underline Tab Navigation */}
        <div className="mobile-staff-underline-tabs">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'by_staff'}
            className={`mobile-staff-underline-tab ${activeTab === 'by_staff' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('by_staff')}
          >
            Theo nhân viên
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'details'}
            className={`mobile-staff-underline-tab ${activeTab === 'details' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('details')}
          >
            Chi tiết giao dịch
          </button>
        </div>

        <div className="mobile-commission-date-range">
          <label><span>Từ ngày</span><DatePickerField aria-label="Hoa hồng từ ngày" value={dateFrom} max={dateTo} allowClear={false} onChange={(value) => { setDateFrom(value); setSelectedStaffSummary(null); setSelectedTxRecord(null); }} /></label>
          <label><span>Đến ngày</span><DatePickerField aria-label="Hoa hồng đến ngày" value={dateTo} min={dateFrom} allowClear={false} onChange={(value) => { setDateTo(value); setSelectedStaffSummary(null); setSelectedTxRecord(null); }} /></label>
        </div>
        {/* Summary Bar */}
        <div className="mobile-staff-summary-sort-bar">
          <span className="mobile-sort-select-chip">{dateFrom} – {dateTo}</span>
          <span className="mobile-summary-text">
            {activeTab === 'by_staff' ? `${filteredByStaff.length} nhân viên` : `${filteredRows.length} giao dịch`} · Tổng: <strong>{formatMoney(totalCommissions)}</strong>
          </span>
        </div>
      </div>

      {/* Tab 1: Grouped list by Role showing individual staff commission */}
      {activeTab === 'by_staff' && (
        <div className="mobile-grouped-list-container">
          {error ? <ErrorState error={error} onRetry={() => refetch()} /> : isLoading ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: '#64748b' }}>
              Đang tải dữ liệu hoa hồng...
            </div>
          ) : filteredByStaff.length === 0 ? (
            <MobileEmptyState
              icon="ph ph-chart-line-up"
              title="Không có hoa hồng"
              description="Chưa có dữ liệu hoa hồng trong khoảng thời gian này."
            />
          ) : (
            groupedStaff.map(([roleGroup, staffItems]) => (
              <div key={roleGroup} className="mobile-grouped-section">
                <div className="mobile-section-header">
                  <span className="mobile-section-title">{roleGroup}</span>
                  <span className="mobile-section-count">{staffItems.length} người</span>
                </div>
                <div className="mobile-section-card">
                  {staffItems.map((staff) => (
                    <div
                      key={staff.staff.id}
                      className="mobile-grouped-row"
                      onClick={() => setSelectedStaffSummary(staff)}
                    >
                      <div className="mobile-staff-row-left">
                        <div className="mobile-staff-avatar rose">
                          {initials(staff.staff.name || 'NV')}
                        </div>
                        <div className="mobile-staff-row-info">
                          <span className="mobile-staff-row-name">{staff.staff.name}</span>
                          <span className="mobile-staff-row-sub">
                            <span>{staff.staff.code}</span>
                            <span>•</span>
                            <span>{staff.transactionCount} lượt làm</span>
                          </span>
                        </div>
                      </div>

                      <div className="mobile-staff-row-right">
                        <span className="mobile-staff-row-value emerald">
                          {formatMoney(staff.totalAmount)}
                        </span>
                        <span style={{ fontSize: 11.5, color: '#64748b' }}>
                          Doanh số: {formatMoney(staff.totalRevenue)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Grouped list by date showing transaction logs */}
      {activeTab === 'details' && (
        <div className="mobile-grouped-list-container">
          {error ? <ErrorState error={error} onRetry={() => refetch()} /> : isLoading ? <LoadingState /> : filteredRows.length === 0 ? (
            <MobileEmptyState
              icon="ph ph-receipt"
              title="Không có giao dịch"
              description="Không có lịch sử hoa hồng nào phù hợp."
            />
          ) : (
            groupedTransactions.map(([dateKey, txList]) => (
              <div key={dateKey} className="mobile-grouped-section">
                <div className="mobile-section-header">
                  <span className="mobile-section-title">{dateKey}</span>
                  <span className="mobile-section-count">{txList.length} giao dịch</span>
                </div>
                <div className="mobile-section-card">
                  {txList.map((tx) => (
                    <div
                      key={tx.id}
                      className="mobile-grouped-row"
                      onClick={() => setSelectedTxRecord(tx)}
                    >
                      <div className="mobile-staff-row-left">
                        <div className="mobile-staff-avatar emerald">
                          <i
                            className={
                              tx.commissionType === 'service'
                                ? 'ph ph-sparkle'
                                : 'ph ph-shopping-bag'
                            }
                          />
                        </div>
                        <div className="mobile-staff-row-info">
                          <span className="mobile-staff-row-name">{tx.productName || tx.sourceName}</span>
                          <span className="mobile-staff-row-sub">
                            <span>{tx.staff.name}</span>
                            <span>•</span>
                            <span>{tx.invoiceCode}</span>
                          </span>
                        </div>
                      </div>

                      <div className="mobile-staff-row-right">
                        <span className="mobile-staff-row-value emerald">
                          +{formatMoney(tx.amount)}
                        </span>
                        <span style={{ fontSize: 11.5, color: '#64748b' }}>
                          {formatPercent(tx.rate)} hoa hồng
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Inset Detail Sheet - Staff Summary */}
      <MobileDetailSheet
        isOpen={Boolean(selectedStaffSummary)}
        title="Tổng hợp hoa hồng nhân viên"
        subtitle={selectedStaffSummary ? `${selectedStaffSummary.staff.name} • ${selectedStaffSummary.staff.code}` : ''}
        onClose={() => setSelectedStaffSummary(null)}
      >
        {selectedStaffSummary && (
          <>
            <div className="mobile-detail-hero">
              <div className="mobile-detail-hero-header">
                <div>
                  <div style={{ fontSize: 13, color: '#64748b' }}>Tổng hoa hồng nhận được</div>
                  <div className="mobile-detail-hero-amount" style={{ color: '#16a34a' }}>
                    {formatMoney(selectedStaffSummary.totalAmount)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, color: '#64748b' }}>Doanh số phục vụ</div>
                  <div style={{ fontSize: 16, fontWeight: 750, color: '#0f172a' }}>
                    {formatMoney(selectedStaffSummary.totalRevenue)}
                  </div>
                </div>
              </div>
            </div>

            <div className="mobile-sheet-section">
              <span className="mobile-sheet-section-title">Chi tiết phân loại hoa hồng</span>
              <div className="mobile-detail-list">
                <div className="mobile-detail-item">
                  <div className="mobile-detail-item-left">
                    <span className="mobile-detail-item-title">Hoa hồng làm dịch vụ</span>
                    <span className="mobile-detail-item-sub">Gội đầu, làm móng, chăm sóc da...</span>
                  </div>
                  <span className="mobile-detail-item-value" style={{ color: '#16a34a' }}>
                    +{formatMoney(selectedStaffSummary.serviceAmount)}
                  </span>
                </div>

                <div className="mobile-detail-item">
                  <div className="mobile-detail-item-left">
                    <span className="mobile-detail-item-title">Hoa hồng tư vấn bán sản phẩm</span>
                    <span className="mobile-detail-item-sub">Bán mỹ phẩm, liệu trình spa...</span>
                  </div>
                  <span className="mobile-detail-item-value" style={{ color: '#16a34a' }}>
                    +{formatMoney(selectedStaffSummary.consultingAmount)}
                  </span>
                </div>

                <div className="mobile-detail-item">
                  <div className="mobile-detail-item-left">
                    <span className="mobile-detail-item-title">Tổng số lượt thực hiện</span>
                    <span className="mobile-detail-item-sub">Hóa đơn có ghi nhận thợ</span>
                  </div>
                  <span className="mobile-detail-item-value">
                    {selectedStaffSummary.transactionCount} lượt
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </MobileDetailSheet>

      {/* Inset Detail Sheet - Transaction Log */}
      <MobileDetailSheet
        isOpen={Boolean(selectedTxRecord)}
        title="Chi tiết giao dịch hoa hồng"
        subtitle={selectedTxRecord ? `${selectedTxRecord.invoiceCode} • ${selectedTxRecord.occurredOn}` : ''}
        onClose={() => setSelectedTxRecord(null)}
      >
        {selectedTxRecord && (
          <>
            <div className="mobile-detail-hero">
              <div className="mobile-detail-hero-header">
                <div>
                  <div style={{ fontSize: 13, color: '#64748b' }}>Hoa hồng nhận được</div>
                  <div className="mobile-detail-hero-amount" style={{ color: '#16a34a' }}>
                    +{formatMoney(selectedTxRecord.amount)}
                  </div>
                </div>
                <span className="mobile-shift-badge theme-green">
                  {selectedTxRecord.commissionType === 'service' ? 'Làm dịch vụ' : 'Tư vấn bán SP'}
                </span>
              </div>
            </div>

            <div className="mobile-detail-grid">
              <div className="mobile-detail-cell">
                <span className="mobile-detail-cell-label">Mặt hàng / Dịch vụ</span>
                <span className="mobile-detail-cell-value">{selectedTxRecord.productName || selectedTxRecord.sourceName}</span>
              </div>
              <div className="mobile-detail-cell">
                <span className="mobile-detail-cell-label">Nhân viên nhận</span>
                <span className="mobile-detail-cell-value">{selectedTxRecord.staff.name}</span>
              </div>
              <div className="mobile-detail-cell">
                <span className="mobile-detail-cell-label">Doanh thu hóa đơn</span>
                <span className="mobile-detail-cell-value">{formatMoney(selectedTxRecord.revenue)}</span>
              </div>
              <div className="mobile-detail-cell">
                <span className="mobile-detail-cell-label">Tỷ lệ hoa hồng</span>
                <span className="mobile-detail-cell-value">{formatPercent(selectedTxRecord.rate)}</span>
              </div>
            </div>
          </>
        )}
      </MobileDetailSheet>
    </div>
  );
}
