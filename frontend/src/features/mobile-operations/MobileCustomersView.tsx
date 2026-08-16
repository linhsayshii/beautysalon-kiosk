import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDateTime, formatDate, formatMoney, formatNumber } from '@/lib/format';
import { getCustomers, getCustomer, getCustomerActivity } from '@/features/operations/operations.api';
import { CustomerCreateDialog } from '@/features/operations/components/CustomerCreateDialog';
import { StatusBadge } from '@/components/data-display/Badges';
import { statusLabels } from '@/types/api';
import {
  MobileSearchBar,
  MobileFilterSheet,
  MobileMetricCards,
  MobileCard,
  MobileDetailSheet,
  MobileSegmentedControl,
  MobileEmptyState,
} from '@/features/mobile-common';
import type { ApiRecord } from '@/types/api';
import './mobile-operations.css';

type CustomerTab = 'info' | 'orders' | 'packages' | 'debt';

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
    return <div style={{ padding: '16px', textAlign: 'center', color: 'var(--ink-500)' }}>Đang tải dữ liệu...</div>;
  }
  if (query.error) {
    return <div style={{ padding: '16px', textAlign: 'center', color: 'var(--red)' }}>Lỗi tải dữ liệu.</div>;
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
              <strong style={{ color: 'var(--blue-600)' }}>{formatMoney(row.amount)}</strong>
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
          <div className="mobile-activity-item-bottom" style={{ color: 'var(--ink-600)' }}>
            <span>Đã dùng: {formatNumber(row.usedUnits)}</span>
            <span style={{ fontWeight: 700, color: 'var(--blue-600)' }}>
              Còn lại: {formatNumber(row.totalUnits - row.usedUnits)} lượt
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function MobileCustomersView() {
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [debtFilter, setDebtFilter] = useState('');

  // Draft filters for filter sheet
  const [draftGroup, setDraftGroup] = useState('');
  const [draftDebt, setDraftDebt] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<CustomerTab>('info');
  const [isCreating, setIsCreating] = useState(false);

  const activeFilterCount = (groupFilter ? 1 : 0) + (debtFilter ? 1 : 0);

  const { data: customersData, isLoading, refetch } = useQuery({
    queryKey: ['mobile-customers', search, groupFilter, debtFilter],
    queryFn: () => getCustomers({
      search,
      group: groupFilter,
      debtStatus: debtFilter,
      pageSize: 50,
    }),
  });

  const rows = (customersData?.data ?? []) as ApiRecord[];
  const summary = customersData?.meta?.summary;
  const totalInDebt = summary?.customersInDebt ?? rows.filter((r) => Number(r.debtBalance) > 0).length;
  const totalDebt = summary?.totalDebt ?? rows.reduce((sum, r) => sum + Number(r.debtBalance || 0), 0);
  const totalActivePackages = rows.filter((r) => Number(r.activePackages) > 0).length;

  const { data: customerDetailData, isLoading: isDetailLoading } = useQuery({
    queryKey: ['mobile-customer-detail', selectedCustomerId],
    queryFn: () => (selectedCustomerId ? getCustomer(selectedCustomerId) : null),
    enabled: selectedCustomerId !== null,
  });

  const activeCustomer = customerDetailData?.data as ApiRecord | undefined;

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

  return (
    <div className="mobile-operations-view">
      {/* Header & Create Button */}
      <div className="mobile-operations-header">
        <div className="mobile-operations-header-top">
          <h2 className="mobile-operations-title">Khách hàng</h2>
          <button
            type="button"
            className="mobile-operations-add-btn"
            onClick={() => setIsCreating(true)}
          >
            <i className="ph ph-plus" /> Thêm khách
          </button>
        </div>

        {/* Metric Cards */}
        <MobileMetricCards
          items={[
            { label: 'Tổng khách hàng', value: formatNumber(summary?.totalCustomers ?? rows.length), tone: 'blue' },
            { label: 'Khách đang nợ', value: formatNumber(totalInDebt), tone: 'orange' },
            { label: 'Tổng công nợ', value: formatMoney(totalDebt), tone: 'red' },
            { label: 'Gói đang dùng', value: formatNumber(totalActivePackages), tone: 'violet' },
          ]}
        />

        {/* Search Bar with Filter Sheet trigger */}
        <MobileSearchBar
          value={search}
          placeholder="Tìm mã, tên, số điện thoại..."
          onChange={setSearch}
          onFilterClick={openFilterSheet}
          activeFilterCount={activeFilterCount}
        />
      </div>

      {/* Customers List */}
      <div className="mobile-operations-list">
        {isLoading ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-500)' }}>Đang tải danh sách khách hàng...</div>
        ) : rows.length === 0 ? (
          <MobileEmptyState
            title="Không tìm thấy khách hàng nào"
            description="Thử tìm kiếm với từ khóa khác hoặc thay đổi bộ lọc."
          />
        ) : (
          rows.map((row) => {
            const hasDebt = Number(row.debtBalance) > 0;
            return (
              <MobileCard
                key={row.id}
                title={row.name}
                subtitle={row.code}
                badge={{
                  text: row.group || 'Cá nhân',
                  tone: row.group === 'Công ty' ? 'blue' : 'gray',
                }}
                avatar={
                  <div className="mobile-customer-avatar-initials">
                    {getInitials(row.name)}
                  </div>
                }
                details={[
                  {
                    label: 'Số điện thoại',
                    value: row.phone ? (
                      <a
                        href={`tel:${row.phone}`}
                        className="mobile-customer-phone-link"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <i className="ph ph-phone" /> {row.phone}
                      </a>
                    ) : 'Chưa có',
                  },
                  {
                    label: 'Gói đang dùng',
                    value: `${formatNumber(row.activePackages || 0)} gói`,
                  },
                  {
                    label: 'Tổng chi tiêu',
                    value: formatMoney(row.totalSpent || 0),
                  },
                  {
                    label: 'Công nợ',
                    value: (
                      <span style={{ color: hasDebt ? 'var(--red)' : 'var(--green)', fontWeight: 700 }}>
                        {formatMoney(row.debtBalance || 0)}
                      </span>
                    ),
                  },
                ]}
                action={
                  row.phone ? (
                    <a
                      href={`tel:${row.phone}`}
                      className="mobile-card-call-btn"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <i className="ph ph-phone-call" /> Gọi điện
                    </a>
                  ) : null
                }
                onClick={() => {
                  setSelectedCustomerId(row.id);
                  setDetailTab('info');
                }}
              />
            );
          })
        )}
      </div>

      {/* Filter Sheet */}
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

      {/* Detail Bottom Sheet */}
      <MobileDetailSheet
        isOpen={selectedCustomerId !== null}
        title={activeCustomer?.name || 'Chi tiết khách hàng'}
        subtitle={activeCustomer?.code}
        onClose={() => setSelectedCustomerId(null)}
      >
        {isDetailLoading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-500)' }}>Đang tải thông tin...</div>
        ) : activeCustomer ? (
          <div className="mobile-customer-detail-content">
            {/* Header card with avatar & quick tags */}
            <div className="mobile-customer-detail-header-card">
              <div className="mobile-customer-detail-avatar">
                <i className="ph ph-user" />
              </div>
              <div className="mobile-customer-detail-main-info">
                <span className="mobile-customer-detail-name">{activeCustomer.name}</span>
                <div className="mobile-customer-detail-tags">
                  <span className="mobile-customer-tag is-code">
                    <i className="ph ph-identification-card" /> {activeCustomer.code}
                  </span>
                  <span className="mobile-customer-tag">
                    <i className="ph ph-users" /> {activeCustomer.group}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick 4-Fact strip */}
            <div className="mobile-customer-detail-facts-grid">
              <div className="mobile-customer-fact-box">
                <span className="mobile-customer-fact-label">Tổng mua</span>
                <span className="mobile-customer-fact-val" style={{ color: 'var(--blue-600)' }}>
                  {formatMoney(activeCustomer.totalSpent)}
                </span>
              </div>
              <div className="mobile-customer-fact-box">
                <span className="mobile-customer-fact-label">Ghé thăm</span>
                <span className="mobile-customer-fact-val">
                  {formatNumber(activeCustomer.visitCount || 0)} lượt
                </span>
              </div>
              <div className="mobile-customer-fact-box">
                <span className="mobile-customer-fact-label">Số dư thẻ</span>
                <span className="mobile-customer-fact-val" style={{ color: 'var(--green)' }}>
                  {formatMoney(activeCustomer.cardBalance || 0)}
                </span>
              </div>
              <div className="mobile-customer-fact-box">
                <span className="mobile-customer-fact-label">Công nợ</span>
                <span
                  className="mobile-customer-fact-val"
                  style={{ color: activeCustomer.debtBalance > 0 ? 'var(--red)' : 'var(--green)' }}
                >
                  {formatMoney(activeCustomer.debtBalance || 0)}
                </span>
              </div>
            </div>

            {/* Segmented Control Tabs */}
            <MobileSegmentedControl<CustomerTab>
              value={detailTab}
              onChange={setDetailTab}
              options={[
                { value: 'info', label: 'Thông tin' },
                { value: 'orders', label: 'Lịch sử' },
                { value: 'packages', label: 'Gói thẻ' },
                { value: 'debt', label: 'Công nợ' },
              ]}
            />

            {/* Tab: Thông tin */}
            {detailTab === 'info' && (
              <div className="mobile-detail-section-card">
                <h4>Thông tin liên hệ & Hồ sơ</h4>
                <div className="mobile-detail-info-row">
                  <span className="mobile-detail-info-label">Số điện thoại:</span>
                  <span className="mobile-detail-info-val">
                    {activeCustomer.phone ? (
                      <a href={`tel:${activeCustomer.phone}`} style={{ color: 'var(--blue-600)' }}>
                        {activeCustomer.phone}
                      </a>
                    ) : 'Chưa có'}
                  </span>
                </div>
                <div className="mobile-detail-info-row">
                  <span className="mobile-detail-info-label">Email:</span>
                  <span className="mobile-detail-info-val">{activeCustomer.email || 'Chưa có'}</span>
                </div>
                <div className="mobile-detail-info-row">
                  <span className="mobile-detail-info-label">Lần cuối đến:</span>
                  <span className="mobile-detail-info-val">
                    {activeCustomer.lastVisit ? formatDateTime(activeCustomer.lastVisit) : 'Chưa có'}
                  </span>
                </div>
                <div className="mobile-detail-info-row">
                  <span className="mobile-detail-info-label">Địa chỉ:</span>
                  <span className="mobile-detail-info-val">{activeCustomer.address || 'Chưa có'}</span>
                </div>
                <div className="mobile-detail-info-row">
                  <span className="mobile-detail-info-label">Ngày tạo:</span>
                  <span className="mobile-detail-info-val">{formatDate(activeCustomer.createdAt)}</span>
                </div>
                {activeCustomer.notes && (
                  <div className="mobile-detail-info-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                    <span className="mobile-detail-info-label">Ghi chú:</span>
                    <span className="mobile-detail-info-val" style={{ textAlign: 'left' }}>{activeCustomer.notes}</span>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Lịch sử */}
            {detailTab === 'orders' && selectedCustomerId !== null && (
              <CustomerActivityList customerId={selectedCustomerId} kind="orders" />
            )}

            {/* Tab: Gói thẻ */}
            {detailTab === 'packages' && selectedCustomerId !== null && (
              <CustomerActivityList customerId={selectedCustomerId} kind="packages" />
            )}

            {/* Tab: Công nợ */}
            {detailTab === 'debt' && (
              <div className="mobile-detail-section-card">
                <h4>Tình trạng công nợ hiện tại</h4>
                <div className="mobile-detail-info-row">
                  <span className="mobile-detail-info-label">Công nợ hiện tại:</span>
                  <strong style={{ color: activeCustomer.debtBalance > 0 ? 'var(--red)' : 'var(--green)', fontSize: '16px' }}>
                    {formatMoney(activeCustomer.debtBalance)}
                  </strong>
                </div>
                <div className="mobile-detail-info-row">
                  <span className="mobile-detail-info-label">Số dư thẻ tài khoản:</span>
                  <strong style={{ color: 'var(--green)', fontSize: '15px' }}>
                    {formatMoney(activeCustomer.cardBalance)}
                  </strong>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'var(--ink-500)', lineHeight: 1.4 }}>
                  {activeCustomer.debtBalance > 0
                    ? 'Khách hàng đang có khoản cần thu theo các hóa đơn mua hàng / dịch vụ.'
                    : 'Khách hàng hiện tại không có khoản nợ nào.'}
                </p>
              </div>
            )}
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
