import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { formatDateTime, formatDate, formatMoney, formatNumber } from '@/lib/format';
import { getCustomers, getCustomer, getCustomerActivity } from '@/features/operations/operations.api';
import { CustomerCreateDialog } from '@/features/operations/components/CustomerCreateDialog';
import { StatusBadge } from '@/components/data-display/Badges';
import { statusLabels } from '@/types/api';
import {
  MobileSearchBar,
  MobileFilterSheet,
  MobileDetailSheet,
  MobileSegmentedControl,
  MobileEmptyState,
} from '@/features/mobile-common';
import type { ApiRecord } from '@/types/api';
import './mobile-operations.css';

type CustomerTab = 'orders' | 'packages';

function getInitials(name: string) {
  if (!name) return 'KH';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function CustomerActivityList({ customerId, kind }: { customerId: number; kind: 'orders' | 'packages' }) {
  const query = useQuery({
    queryKey: ['mobile-customer-activity', customerId, kind],
    queryFn: () => getCustomerActivity(customerId, kind),
  });

  if (query.isPending) {
    return <div style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>Đang tải dữ liệu...</div>;
  }
  if (query.error) {
    return <div style={{ padding: '16px', textAlign: 'center', color: '#ef4444' }}>Lỗi tải dữ liệu.</div>;
  }
  const rows = query.data?.data ?? [];
  if (!rows.length) {
    return <MobileEmptyState title={kind === 'orders' ? 'Chưa có hóa đơn nào' : 'Chưa có gói dịch vụ nào'} />;
  }

  if (kind === 'orders') {
    return (
      <div className="mobile-activity-list">
        {rows.map((row) => (
          <div key={row.id} className="mobile-activity-item">
            <div className="mobile-activity-item-top">
              <span className="mobile-activity-item-code">{row.code}</span>
              <span className="mobile-activity-item-date">{formatDateTime(row.occurredAt)}</span>
            </div>
            <div className="mobile-activity-item-bottom">
              <span>{statusLabels[row.paymentMethod] ?? row.paymentMethod}</span>
              <strong style={{ color: '#0062eb' }}>{formatMoney(row.amount)}</strong>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mobile-activity-list">
      {rows.map((row) => (
        <div key={row.id} className="mobile-activity-item">
          <div className="mobile-activity-item-top">
            <span className="mobile-activity-item-code">{row.code}</span>
            <StatusBadge status={row.status} />
          </div>
          <div style={{ fontWeight: 700, fontSize: '13.5px' }}>{row.name}</div>
          <div className="mobile-activity-item-bottom" style={{ color: '#475569' }}>
            <span>Đã dùng: {formatNumber(row.usedUnits)}</span>
            <span style={{ fontWeight: 700, color: '#0062eb' }}>
              Còn lại: {formatNumber(row.totalUnits - row.usedUnits)} lượt
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function MobileCustomersView() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [groupFilter, setGroupFilter] = useState('');
  const [debtFilter, setDebtFilter] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'debt' | 'lastVisit'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Draft filters for filter sheet
  const [draftGroup, setDraftGroup] = useState('');
  const [draftDebt, setDraftDebt] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [detailActivityTab, setDetailActivityTab] = useState<CustomerTab>('orders');
  const [isCreating, setIsCreating] = useState(false);

  const { data: customersData, isLoading, refetch } = useQuery({
    queryKey: ['mobile-customers', search, groupFilter, debtFilter],
    queryFn: () =>
      getCustomers({
        search,
        group: groupFilter,
        debtStatus: debtFilter,
        pageSize: 100,
      }),
  });

  const rawRows = (customersData?.data ?? []) as ApiRecord[];

  const { data: customerDetailData, isLoading: isDetailLoading } = useQuery({
    queryKey: ['mobile-customer-detail', selectedCustomerId],
    queryFn: () => (selectedCustomerId ? getCustomer(selectedCustomerId) : null),
    enabled: selectedCustomerId !== null,
  });

  const activeCustomer = customerDetailData?.data as ApiRecord | undefined;

  // Sort rows
  const sortedRows = useMemo(() => {
    return [...rawRows].sort((a, b) => {
      if (sortBy === 'name') {
        return sortOrder === 'desc'
          ? String(b.name || '').localeCompare(String(a.name || ''))
          : String(a.name || '').localeCompare(String(b.name || ''));
      }
      if (sortBy === 'debt') {
        const dA = Number(a.debtBalance || 0);
        const dB = Number(b.debtBalance || 0);
        return sortOrder === 'desc' ? dB - dA : dA - dB;
      }
      if (sortBy === 'lastVisit') {
        const tA = a.lastVisit ? new Date(a.lastVisit).getTime() : 0;
        const tB = b.lastVisit ? new Date(b.lastVisit).getTime() : 0;
        return sortOrder === 'desc' ? tB - tA : tA - tB;
      }
      return 0;
    });
  }, [rawRows, sortBy, sortOrder]);

  // Group by customer group (or Alphabetical letter if group is same)
  const groupedSections = useMemo(() => {
    const map = new Map<string, ApiRecord[]>();
    sortedRows.forEach((row) => {
      const g = (row.group || 'CÁ NHÂN').toUpperCase();
      const list = map.get(g) || [];
      list.push(row);
      map.set(g, list);
    });
    return Array.from(map.entries());
  }, [sortedRows]);

  const totalDebtSum = useMemo(() => {
    return rawRows.reduce((sum, r) => sum + Number(r.debtBalance || 0), 0);
  }, [rawRows]);

  const handleApplyFilter = () => {
    setGroupFilter(draftGroup);
    setDebtFilter(draftDebt);
    setIsFilterOpen(false);
  };

  const handleResetFilter = () => {
    setDraftGroup('');
    setDraftDebt('');
    setGroupFilter('');
    setDebtFilter('');
    setIsFilterOpen(false);
  };

  const openFilterSheet = () => {
    setDraftGroup(groupFilter);
    setDraftDebt(debtFilter);
    setIsFilterOpen(true);
  };

  const toggleSort = () => {
    if (sortBy === 'name') {
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else {
        setSortBy('debt');
        setSortOrder('desc');
      }
    } else if (sortBy === 'debt') {
      if (sortOrder === 'desc') {
        setSortOrder('asc');
      } else {
        setSortBy('lastVisit');
        setSortOrder('desc');
      }
    } else {
      setSortBy('name');
      setSortOrder('asc');
    }
  };

  return (
    <div className="mobile-operations-view">
      {/* 1. Header Top Navigation */}
      <div className="mobile-operations-top-nav">
        <div className="mobile-operations-nav-left">
          <button
            type="button"
            className="mobile-operations-back-icon"
            onClick={() => navigate('/m/more')}
            aria-label="Quay lại"
          >
            <i className="ph ph-caret-left" />
          </button>
          <h1 className="mobile-operations-nav-title">Khách hàng</h1>
        </div>

        <div className="mobile-operations-nav-actions">
          <button
            type="button"
            className="mobile-operations-nav-btn"
            onClick={() => setIsSearchVisible((prev) => !prev)}
            aria-label="Tìm kiếm"
          >
            <i className="ph ph-magnifying-glass" />
          </button>
          <button
            type="button"
            className="mobile-operations-nav-btn"
            onClick={toggleSort}
            aria-label="Sắp xếp"
            title={`Sắp xếp theo: ${
              sortBy === 'name' ? 'Tên khách hàng' : sortBy === 'debt' ? 'Công nợ' : 'Lần cuối đến'
            }`}
          >
            <i className="ph ph-arrows-down-up" />
          </button>
        </div>
      </div>

      {/* Inline Search Bar */}
      {isSearchVisible && (
        <div className="mobile-operations-search-bar-wrap">
          <MobileSearchBar
            value={search}
            placeholder="Tìm mã, tên, số điện thoại..."
            onChange={setSearch}
          />
        </div>
      )}

      {/* 2. Horizontal Filter Chips Strip */}
      <div className="mobile-operations-filter-strip">
        <button
          type="button"
          className="mobile-filter-icon-btn"
          onClick={openFilterSheet}
          aria-label="Mở bộ lọc"
        >
          <i className="ph ph-faders" />
        </button>

        <button
          type="button"
          className={`mobile-filter-chip ${groupFilter ? 'is-active' : ''}`}
          onClick={openFilterSheet}
        >
          <span>{groupFilter ? groupFilter : 'Tất cả nhóm'}</span>
          <i className="ph ph-caret-down" />
        </button>

        <button
          type="button"
          className={`mobile-filter-chip ${debtFilter ? 'is-active' : ''}`}
          onClick={openFilterSheet}
        >
          <span>
            {debtFilter === 'with_debt'
              ? 'Đang có nợ'
              : debtFilter === 'no_debt'
              ? 'Không có nợ'
              : 'Tất cả công nợ'}
          </span>
          <i className="ph ph-caret-down" />
        </button>
      </div>

      {/* 3. Summary & Sort Indicator Bar */}
      <div className="mobile-operations-summary-bar">
        <button type="button" className="mobile-operations-sort-selector" onClick={toggleSort}>
          <span>
            {sortBy === 'name'
              ? `Tên ${sortOrder === 'asc' ? 'A → Z' : 'Z → A'}`
              : sortBy === 'debt'
              ? `Công nợ ${sortOrder === 'desc' ? 'cao → thấp' : 'thấp → cao'}`
              : `Lần đến ${sortOrder === 'desc' ? 'mới nhất' : 'cũ nhất'}`}
          </span>
          <i className="ph ph-caret-down" />
        </button>

        <div className="mobile-operations-count-summary">
          {rawRows.length} khách hàng · Nợ: {formatMoney(totalDebtSum)}
        </div>
      </div>

      {/* 4. Grouped Section List */}
      <div className="mobile-operations-sections-wrapper">
        {isLoading ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b' }}>
            Đang tải dữ liệu khách hàng...
          </div>
        ) : rawRows.length === 0 ? (
          <div style={{ padding: '24px 16px' }}>
            <MobileEmptyState
              title="Không tìm thấy khách hàng nào"
              description="Thử tìm kiếm với từ khóa khác hoặc thay đổi bộ lọc."
            />
          </div>
        ) : (
          groupedSections.map(([groupTitle, items]) => (
            <div key={groupTitle} className="mobile-operations-section">
              <div className="mobile-operations-section-title">{groupTitle}</div>
              <div className="mobile-operations-section-card">
                {items.map((row) => {
                  const hasDebt = Number(row.debtBalance || 0) > 0;
                  const isCompany = row.group === 'Công ty';

                  return (
                    <div
                      key={row.id}
                      className="mobile-operations-row-item"
                      onClick={() => setSelectedCustomerId(row.id)}
                      role="button"
                      tabIndex={0}
                    >
                      {/* Round Avatar */}
                      <div className={`mobile-customer-round-avatar ${isCompany ? 'is-company' : ''}`}>
                        {getInitials(row.name)}
                      </div>

                      {/* Info */}
                      <div className="mobile-row-info">
                        <div className="mobile-row-name">{row.name}</div>
                        <div className="mobile-row-sub">
                          {row.phone ? (
                            <a
                              href={`tel:${row.phone}`}
                              className="mobile-customer-phone-link"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <i className="ph ph-phone" />
                              {row.phone}
                            </a>
                          ) : (
                            <span>{row.code}</span>
                          )}
                          {row.activePackages > 0 ? (
                            <span>• {row.activePackages} gói</span>
                          ) : row.lastVisit ? (
                            <span>• {formatDate(row.lastVisit)}</span>
                          ) : null}
                        </div>
                      </div>

                      {/* Right: Debt amount */}
                      <div className="mobile-row-right">
                        <span className={`mobile-row-debt-val ${hasDebt ? 'has-debt' : 'no-debt'}`}>
                          {formatMoney(row.debtBalance || 0)}
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

      {/* 5. Floating Action Button (FAB) for Creating Customer */}
      <button
        type="button"
        className="mobile-operations-fab-btn"
        onClick={() => setIsCreating(true)}
        aria-label="Thêm khách hàng"
        title="Thêm khách hàng mới"
      >
        <i className="ph ph-plus" />
      </button>

      {/* Filter Bottom Sheet */}
      <MobileFilterSheet
        isOpen={isFilterOpen}
        title="Bộ lọc khách hàng"
        onClose={() => setIsFilterOpen(false)}
        onReset={handleResetFilter}
        onApply={handleApplyFilter}
      >
        <div className="mobile-filter-field">
          <label className="mobile-filter-field-label">Nhóm khách hàng</label>
          <select
            className="mobile-filter-select"
            value={draftGroup}
            onChange={(e) => setDraftGroup(e.target.value)}
          >
            <option value="">Tất cả nhóm</option>
            <option value="Cá nhân">Cá nhân</option>
            <option value="Công ty">Công ty</option>
          </select>
        </div>

        <div className="mobile-filter-field">
          <label className="mobile-filter-field-label">Tình trạng công nợ</label>
          <select
            className="mobile-filter-select"
            value={draftDebt}
            onChange={(e) => setDraftDebt(e.target.value)}
          >
            <option value="">Tất cả</option>
            <option value="with_debt">Đang có nợ</option>
            <option value="no_debt">Không có nợ</option>
          </select>
        </div>
      </MobileFilterSheet>

      {/* 6. Inset Detail Sheet */}
      <MobileDetailSheet
        isOpen={selectedCustomerId !== null}
        title="Thông tin chi tiết"
        onClose={() => setSelectedCustomerId(null)}
      >
        {isDetailLoading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
            Đang tải thông tin...
          </div>
        ) : activeCustomer ? (
          <div className="mobile-detail-page-container" style={{ padding: '4px 0 24px' }}>
            {/* Header Card */}
            <div className="mobile-detail-section-card">
              <div className="mobile-detail-card-header">
                <span className="mobile-detail-card-title">Hồ sơ khách hàng</span>
                <button
                  type="button"
                  className="mobile-detail-edit-link"
                  onClick={() => alert('Chức năng sửa khách hàng')}
                >
                  Sửa
                </button>
              </div>

              <h2 className="mobile-detail-main-name">{activeCustomer.name}</h2>

              <div className="mobile-detail-status-pills">
                <span className="mobile-detail-pill is-code">
                  <i className="ph ph-identification-card" /> {activeCustomer.code}
                </span>
                <span className="mobile-detail-pill is-gray">
                  {activeCustomer.group || 'Cá nhân'}
                </span>
                {activeCustomer.debtBalance > 0 ? (
                  <span className="mobile-detail-pill is-red">Đang nợ</span>
                ) : (
                  <span className="mobile-detail-pill is-green">Không nợ</span>
                )}
              </div>

              {/* 2x2 Grid */}
              <div className="mobile-detail-grid-2col">
                <div className="mobile-detail-grid-item">
                  <span className="mobile-detail-grid-label">Số điện thoại</span>
                  <span className="mobile-detail-grid-value">
                    {activeCustomer.phone ? (
                      <a href={`tel:${activeCustomer.phone}`} style={{ color: '#0062eb' }}>
                        {activeCustomer.phone}
                      </a>
                    ) : (
                      'Chưa có'
                    )}
                  </span>
                </div>

                <div className="mobile-detail-grid-item">
                  <span className="mobile-detail-grid-label">Nhóm khách</span>
                  <span className="mobile-detail-grid-value">{activeCustomer.group || 'Cá nhân'}</span>
                </div>

                <div className="mobile-detail-grid-item">
                  <span className="mobile-detail-grid-label">Lần cuối đến</span>
                  <span className="mobile-detail-grid-value">
                    {activeCustomer.lastVisit ? formatDateTime(activeCustomer.lastVisit) : 'Chưa có'}
                  </span>
                </div>

                <div className="mobile-detail-grid-item">
                  <span className="mobile-detail-grid-label">Gói đang dùng</span>
                  <span className="mobile-detail-grid-value">
                    {formatNumber(activeCustomer.activePackages || 0)} gói
                  </span>
                </div>

                <div className="mobile-detail-grid-item">
                  <span className="mobile-detail-grid-label">Tổng chi tiêu</span>
                  <span className="mobile-detail-grid-value" style={{ color: '#0062eb' }}>
                    {formatMoney(activeCustomer.totalSpent || 0)}
                  </span>
                </div>

                <div className="mobile-detail-grid-item">
                  <span className="mobile-detail-grid-label">Email</span>
                  <span className="mobile-detail-grid-value">{activeCustomer.email || 'Chưa có'}</span>
                </div>
              </div>
            </div>

            {/* Sổ công nợ card */}
            <div className="mobile-detail-section-card">
              <div className="mobile-detail-card-header">
                <span className="mobile-detail-card-title">Sổ công nợ</span>
              </div>

              <div className="mobile-detail-nav-row">
                <span style={{ fontSize: '14px', color: '#64748b' }}>Dư nợ hiện tại:</span>
                <strong
                  style={{
                    fontSize: '16px',
                    color: activeCustomer.debtBalance > 0 ? '#e11d48' : '#10b981',
                  }}
                >
                  {formatMoney(activeCustomer.debtBalance || 0)}
                </strong>
              </div>

              {activeCustomer.cardBalance > 0 && (
                <div className="mobile-detail-nav-row">
                  <span style={{ fontSize: '14px', color: '#64748b' }}>Số dư thẻ tài khoản:</span>
                  <strong style={{ fontSize: '15px', color: '#10b981' }}>
                    {formatMoney(activeCustomer.cardBalance)}
                  </strong>
                </div>
              )}
            </div>

            {/* Lịch sử mua hàng / Gói thẻ card */}
            <div className="mobile-detail-section-card">
              <div className="mobile-detail-card-header">
                <span className="mobile-detail-card-title">Lịch sử & Gói dịch vụ</span>
              </div>

              <MobileSegmentedControl<CustomerTab>
                value={detailActivityTab}
                onChange={setDetailActivityTab}
                options={[
                  { value: 'orders', label: 'Hóa đơn mua' },
                  { value: 'packages', label: 'Gói dịch vụ' },
                ]}
              />

              <div style={{ marginTop: '8px' }}>
                <CustomerActivityList
                  customerId={selectedCustomerId}
                  kind={detailActivityTab}
                />
              </div>
            </div>
          </div>
        ) : null}
      </MobileDetailSheet>

      {/* Customer Create Modal */}
      {isCreating && (
        <CustomerCreateDialog
          onClose={() => {
            setIsCreating(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}
