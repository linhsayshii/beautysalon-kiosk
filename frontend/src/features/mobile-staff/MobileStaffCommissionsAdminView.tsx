import { DateRangePickerField } from '@/components/ui/DateTimePicker';
import { ErrorState, LoadingState } from '@/components/data-display/DataState';
import { useState, useMemo } from 'react';
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
import { MobilePageHeader } from '@/components/ui/MobilePageHeader/MobilePageHeader';
import { formatDateOnly } from '@/lib/date';

export function MobileStaffCommissionsAdminView() {
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
      const dateKey = r.occurredOn ? formatDateOnly(r.occurredOn) : 'Chưa ghi nhận ngày';
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
    <div className="m-page">
      <MobilePageHeader
        title="Bảng hoa hồng" backTo="/m/more"
        actions={(
          <>
            <button
              type="button"
              className="btn btn-ghost btn-icon m-header-action"
              onClick={() => { if (isSearchVisible) setSearch(''); setIsSearchVisible(!isSearchVisible); }}
              aria-label="Tìm kiếm"
            >
              <i className="ph ph-magnifying-glass" />
            </button>
          </>
        )}
      >
        {isSearchVisible && (
          <MobileSearchBar
            value={search}
            onChange={setSearch}
            autoFocus
            placeholder="Tìm theo nhân viên, dịch vụ, hóa đơn..."
          />
        )}

        <div className="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'by_staff'}
            className={`tab${activeTab === 'by_staff' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('by_staff')}
          >
            Theo nhân viên
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'details'}
            className={`tab${activeTab === 'details' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('details')}
          >
            Chi tiết giao dịch
          </button>
        </div>

        <div className="mobile-commission-date-range">
          <DateRangePickerField className="input" aria-label="Kỳ hoa hồng" from={dateFrom} to={dateTo} onChange={(from, to) => { setDateFrom(from); setDateTo(to); setSelectedStaffSummary(null); setSelectedTxRecord(null); }} />
        </div>
        {/* Summary Bar */}
        <div className="m-summary-bar">
          <span className="m-summary-count">
            {activeTab === 'by_staff' ? `${filteredByStaff.length} nhân viên` : `${filteredRows.length} giao dịch`} · Tổng: <strong>{formatMoney(totalCommissions)}</strong>
          </span>
        </div>
      </MobilePageHeader>

      {/* Tab 1: Grouped list by Role showing individual staff commission */}
      {activeTab === 'by_staff' && (
        <div className="mobile-grouped-list-container">
          {error ? <ErrorState error={error} onRetry={() => refetch()} /> : isLoading ? (
            <LoadingState compact label="Đang tải dữ liệu hoa hồng..." />
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
                        <div className="mobile-staff-avatar">
                          {initials(staff.staff.name || 'NV')}
                        </div>
                        <div className="mobile-staff-row-info">
                          <span className="mobile-staff-row-name">{staff.staff.name}</span>
                          <span className="mobile-staff-row-sub">
                            <span>{staff.staff.code}</span>
                            <span>·</span>
                            <span>{staff.transactionCount} lượt làm</span>
                          </span>
                        </div>
                      </div>

                      <div className="mobile-staff-row-right">
                        <span className="mobile-staff-row-value emerald">
                          {formatMoney(staff.totalAmount)}
                        </span>
                        <span className="text-muted">
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
                              tx.commissionType === 'consulting'
                                ? 'ph ph-handshake'
                                : 'ph ph-sparkle'
                            }
                          />
                        </div>
                        <div className="mobile-staff-row-info">
                          <span className="mobile-staff-row-name">{tx.productName || tx.sourceName}</span>
                          <span className="mobile-staff-row-sub">
                            <span>{tx.staff.name}</span>
                            <span>·</span>
                            <span>{tx.invoiceCode}</span>
                          </span>
                        </div>
                      </div>

                      <div className="mobile-staff-row-right">
                        <span className="mobile-staff-row-value emerald">
                          +{formatMoney(tx.amount)}
                        </span>
                        <span className="text-muted">
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
        subtitle={selectedStaffSummary ? `${selectedStaffSummary.staff.name} · ${selectedStaffSummary.staff.code}` : ''}
        onClose={() => setSelectedStaffSummary(null)}
      >
        {selectedStaffSummary && (
          <>
            <div className="mobile-detail-hero">
              <div className="mobile-detail-hero-header">
                <div>
                  <div className="text-muted">Tổng hoa hồng nhận được</div>
                  <div className="mobile-detail-hero-amount text-success">
                    {formatMoney(selectedStaffSummary.totalAmount)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-muted">Doanh số phục vụ</div>
                  <div className="text-strong">
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
                    <span className="mobile-detail-item-title">Hoa hồng tua</span>
                    <span className="mobile-detail-item-sub">Thực hiện dịch vụ</span>
                  </div>
                  <span className="mobile-detail-item-value text-success">
                    +{formatMoney(selectedStaffSummary.tourAmount)}
                  </span>
                </div>

                <div className="mobile-detail-item">
                  <div className="mobile-detail-item-left">
                    <span className="mobile-detail-item-title">Hoa hồng tư vấn bán</span>
                    <span className="mobile-detail-item-sub">Tư vấn dịch vụ, bán sản phẩm</span>
                  </div>
                  <span className="mobile-detail-item-value text-success">
                    +{formatMoney(selectedStaffSummary.consultingAmount)}
                  </span>
                </div>

                {selectedStaffSummary.serviceAmount > 0 && (
                  <div className="mobile-detail-item">
                    <div className="mobile-detail-item-left">
                      <span className="mobile-detail-item-title">Hoa hồng thực hiện (cũ)</span>
                      <span className="mobile-detail-item-sub">Ghi nhận trước khi có hoa hồng tua</span>
                    </div>
                    <span className="mobile-detail-item-value text-success">
                      +{formatMoney(selectedStaffSummary.serviceAmount)}
                    </span>
                  </div>
                )}

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
        subtitle={selectedTxRecord ? `${selectedTxRecord.invoiceCode} · ${formatDateOnly(selectedTxRecord.occurredOn)}` : ''}
        onClose={() => setSelectedTxRecord(null)}
      >
        {selectedTxRecord && (
          <>
            <div className="mobile-detail-hero">
              <div className="mobile-detail-hero-header">
                <div>
                  <div className="text-muted">Hoa hồng nhận được</div>
                  <div className="mobile-detail-hero-amount text-success">
                    +{formatMoney(selectedTxRecord.amount)}
                  </div>
                </div>
                <span className="mobile-shift-badge theme-green">
                  {selectedTxRecord.commissionType === 'tour' ? 'Tua dịch vụ' : selectedTxRecord.commissionType === 'consulting' ? 'Tư vấn bán' : 'Làm dịch vụ'}
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
