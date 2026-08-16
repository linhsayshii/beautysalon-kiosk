import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { getCustomerCards, getCustomerCard } from '@/features/operations/operations.api';
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

type CardDetailTab = 'info' | 'history';

export function MobileCustomerCardsView() {
  const [search, setSearch] = useState('');
  const [itemTypeFilter, setItemTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Draft filters for filter sheet
  const [draftItemType, setDraftItemType] = useState('');
  const [draftStatus, setDraftStatus] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [selectedCardType, setSelectedCardType] = useState<string>('package');
  const [detailTab, setDetailTab] = useState<CardDetailTab>('info');

  const activeFilterCount = (itemTypeFilter ? 1 : 0) + (statusFilter ? 1 : 0);

  const { data: cardsData, isLoading } = useQuery({
    queryKey: ['mobile-customer-cards', search, itemTypeFilter, statusFilter],
    queryFn: () => getCustomerCards({
      search,
      itemType: itemTypeFilter,
      status: statusFilter,
      pageSize: 50,
    }),
  });

  const rows = (cardsData?.data ?? []) as ApiRecord[];
  const summary = cardsData?.meta?.summary;
  const totalCards = cardsData?.meta?.pagination?.total ?? rows.length;
  const activeCount = rows.filter((r) => r.status === 'active').length;
  const totalUsed = summary?.totalUsed ?? rows.reduce((sum, r) => sum + Number(r.usedUnits || 0), 0);
  const totalBalance = summary?.totalBalance ?? rows.reduce((sum, r) => sum + Number(r.currentBalance || 0), 0);

  const { data: cardDetailData, isLoading: isDetailLoading } = useQuery({
    queryKey: ['mobile-customer-card-detail', selectedCardType, selectedCardId],
    queryFn: () => (selectedCardId ? getCustomerCard(selectedCardType, selectedCardId) : null),
    enabled: selectedCardId !== null,
  });

  const activeCard = cardDetailData?.data as ApiRecord | undefined;

  const handleApplyFilter = () => {
    setItemTypeFilter(draftItemType);
    setStatusFilter(draftStatus);
    setIsFilterOpen(false);
  };

  const handleResetFilter = () => {
    setDraftItemType('');
    setDraftStatus('');
    setItemTypeFilter('');
    setStatusFilter('');
    setIsFilterOpen(false);
  };

  const openFilterSheet = () => {
    setDraftItemType(itemTypeFilter);
    setDraftStatus(statusFilter);
    setIsFilterOpen(true);
  };

  return (
    <div className="mobile-operations-view">
      {/* Header & Metrics */}
      <div className="mobile-operations-header">
        <div className="mobile-operations-header-top">
          <h2 className="mobile-operations-title">Gói, thẻ đã bán</h2>
        </div>

        {/* Metric Cards */}
        <MobileMetricCards
          items={[
            { label: 'Tổng gói/thẻ đã bán', value: formatNumber(totalCards), tone: 'blue' },
            { label: 'Đang sử dụng', value: formatNumber(activeCount), tone: 'green' },
            { label: 'Lượt đã dùng', value: formatNumber(totalUsed), tone: 'violet' },
            { label: 'Số dư thẻ', value: formatMoney(totalBalance), tone: 'orange' },
          ]}
        />

        {/* Search Bar with Filter Sheet trigger */}
        <MobileSearchBar
          value={search}
          placeholder="Tìm mã, tên gói/thẻ, khách hàng..."
          onChange={setSearch}
          onFilterClick={openFilterSheet}
          activeFilterCount={activeFilterCount}
        />
      </div>

      {/* Cards List */}
      <div className="mobile-operations-list">
        {isLoading ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-500)' }}>Đang tải danh sách gói thẻ...</div>
        ) : rows.length === 0 ? (
          <MobileEmptyState
            title="Chưa có gói dịch vụ hoặc thẻ tài khoản nào"
            description="Thử tìm kiếm với từ khóa khác hoặc thay đổi bộ lọc."
          />
        ) : (
          rows.map((row) => {
            const isPkg = row.itemType === 'package';
            const usedUnits = Number(row.usedUnits || 0);
            const totalUnits = Number(row.totalUnits || 1);
            const progressPercent = Math.min(100, Math.round((usedUnits / totalUnits) * 100));

            return (
              <MobileCard
                key={`${row.itemType}-${row.id}`}
                title={row.itemName}
                subtitle={`${row.code} • ${statusLabels[row.itemType] ?? row.itemType}`}
                badge={{
                  text: statusLabels[row.status] ?? row.status,
                  tone: row.status === 'active' ? 'green' : row.status === 'expired' ? 'red' : 'gray',
                }}
                details={[
                  {
                    label: 'Khách hàng',
                    value: (
                      <div>
                        <strong>{row.customer?.name}</strong>
                        {row.customer?.phone && (
                          <div style={{ fontSize: '11.5px', color: 'var(--ink-500)' }}>{row.customer.phone}</div>
                        )}
                      </div>
                    ),
                  },
                  {
                    label: 'Hạn sử dụng',
                    value: formatDate(row.expiresAt),
                  },
                  {
                    label: isPkg ? 'Tiến độ sử dụng' : 'Số dư ban đầu',
                    value: isPkg ? (
                      <div className="mobile-package-progress-wrap">
                        <div className="mobile-package-progress-bar">
                          <div
                            className="mobile-package-progress-fill"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <div className="mobile-package-progress-text">
                          <span>{usedUnits}/{totalUnits} lượt</span>
                          <span style={{ fontWeight: 700, color: 'var(--blue-600)' }}>
                            Còn {row.remainingUnits} lượt
                          </span>
                        </div>
                      </div>
                    ) : (
                      formatMoney(row.openingBalance || 0)
                    ),
                  },
                  {
                    label: isPkg ? 'Giá bán' : 'Số dư hiện tại',
                    value: isPkg ? (
                      formatMoney(row.salePrice || 0)
                    ) : (
                      <span style={{ color: 'var(--green)', fontWeight: 800 }}>
                        {formatMoney(row.currentBalance || 0)}
                      </span>
                    ),
                  },
                ]}
                onClick={() => {
                  setSelectedCardId(row.id);
                  setSelectedCardType(row.itemType);
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
        title="Bộ lọc gói thẻ"
        onClose={() => setIsFilterOpen(false)}
        onReset={handleResetFilter}
        onApply={handleApplyFilter}
      >
        <div className="mobile-filter-field">
          <label className="mobile-filter-field-label">Loại hàng</label>
          <select
            className="mobile-filter-select"
            value={draftItemType}
            onChange={(e) => setDraftItemType(e.target.value)}
          >
            <option value="">Tất cả loại</option>
            <option value="package">Gói dịch vụ</option>
            <option value="account_card">Thẻ tài khoản</option>
          </select>
        </div>

        <div className="mobile-filter-field">
          <label className="mobile-filter-field-label">Trạng thái</label>
          <select
            className="mobile-filter-select"
            value={draftStatus}
            onChange={(e) => setDraftStatus(e.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="active">Đang sử dụng</option>
            <option value="completed">Đã dùng hết</option>
            <option value="expired">Hết hạn</option>
          </select>
        </div>
      </MobileFilterSheet>

      {/* Detail Bottom Sheet */}
      <MobileDetailSheet
        isOpen={selectedCardId !== null}
        title={activeCard?.itemName || 'Chi tiết gói/thẻ'}
        subtitle={activeCard ? `${activeCard.code} • ${activeCard.customer?.name}` : undefined}
        onClose={() => setSelectedCardId(null)}
      >
        {isDetailLoading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-500)' }}>Đang tải thông tin...</div>
        ) : activeCard ? (
          <div className="mobile-customer-detail-content">
            {/* Quick 4-fact Strip */}
            <div className="mobile-customer-detail-facts-grid">
              <div className="mobile-customer-fact-box">
                <span className="mobile-customer-fact-label">Giá bán</span>
                <span className="mobile-customer-fact-val" style={{ color: 'var(--blue-600)' }}>
                  {formatMoney(activeCard.salePrice)}
                </span>
              </div>
              <div className="mobile-customer-fact-box">
                <span className="mobile-customer-fact-label">
                  {activeCard.itemType === 'package' ? 'Còn lại' : 'Số dư còn'}
                </span>
                <span className="mobile-customer-fact-val" style={{ color: 'var(--green)' }}>
                  {activeCard.itemType === 'package'
                    ? `${formatNumber(activeCard.remainingUnits)} lượt`
                    : formatMoney(activeCard.currentBalance)}
                </span>
              </div>
              <div className="mobile-customer-fact-box">
                <span className="mobile-customer-fact-label">Thời gian bán</span>
                <span className="mobile-customer-fact-val">
                  {formatDate(activeCard.soldAt)}
                </span>
              </div>
              <div className="mobile-customer-fact-box">
                <span className="mobile-customer-fact-label">Hạn sử dụng</span>
                <span className="mobile-customer-fact-val">
                  {formatDate(activeCard.expiresAt)}
                </span>
              </div>
            </div>

            {/* Segmented Control */}
            <MobileSegmentedControl<CardDetailTab>
              value={detailTab}
              onChange={setDetailTab}
              options={[
                { value: 'info', label: 'Thông tin' },
                { value: 'history', label: 'Lịch sử sử dụng' },
              ]}
            />

            {/* Tab 1: Thông tin */}
            {detailTab === 'info' && (
              <div className="mobile-detail-section-card">
                <h4>Khách hàng & Cấu hình</h4>
                <div className="mobile-detail-info-row">
                  <span className="mobile-detail-info-label">Khách hàng:</span>
                  <span className="mobile-detail-info-val">{activeCard.customer?.name}</span>
                </div>
                <div className="mobile-detail-info-row">
                  <span className="mobile-detail-info-label">Mã khách:</span>
                  <span className="mobile-detail-info-val">{activeCard.customer?.code}</span>
                </div>
                <div className="mobile-detail-info-row">
                  <span className="mobile-detail-info-label">Trạng thái:</span>
                  <StatusBadge status={activeCard.status} />
                </div>

                {activeCard.itemType === 'package' ? (
                  <div style={{ marginTop: '10px' }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>Dịch vụ trong gói</div>
                    {(activeCard.services || []).map((srv: ApiRecord) => (
                      <div key={srv.id} className="mobile-detail-info-row">
                        <span>{srv.name} ({srv.code})</span>
                        <span>Đã dùng: {activeCard.usedUnits}/{activeCard.totalUnits}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ marginTop: '10px' }}>
                    <div className="mobile-detail-info-row">
                      <span className="mobile-detail-info-label">Số dư ban đầu:</span>
                      <span className="mobile-detail-info-val">{formatMoney(activeCard.openingBalance)}</span>
                    </div>
                    <div className="mobile-detail-info-row">
                      <span className="mobile-detail-info-label">Đã sử dụng:</span>
                      <span className="mobile-detail-info-val">
                        {formatMoney(Number(activeCard.openingBalance || 0) - Number(activeCard.currentBalance || 0))}
                      </span>
                    </div>
                    <div className="mobile-detail-info-row">
                      <span className="mobile-detail-info-label">Còn lại:</span>
                      <span className="mobile-detail-info-val" style={{ color: 'var(--green)' }}>
                        {formatMoney(activeCard.currentBalance)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Lịch sử sử dụng */}
            {detailTab === 'history' && (
              <div className="mobile-activity-list">
                {(!activeCard.usages || activeCard.usages.length === 0) ? (
                  <MobileEmptyState title="Chưa có lịch sử sử dụng nào" />
                ) : (
                  activeCard.usages.map((u: ApiRecord) => (
                    <div key={u.id} className="mobile-activity-item">
                      <div className="mobile-activity-item-top">
                        <span className="mobile-activity-item-code">{u.serviceName ?? 'Sử dụng gói'}</span>
                        <span className="mobile-activity-item-date">{formatDateTime(u.occurredAt)}</span>
                      </div>
                      <div className="mobile-activity-item-bottom">
                        <span style={{ color: 'var(--ink-500)' }}>Hóa đơn: {u.invoiceCode || '-'}</span>
                        <strong style={{ color: 'var(--blue-600)' }}>-{formatNumber(u.unitsUsed)} lượt</strong>
                      </div>
                      {u.note && (
                        <small style={{ color: 'var(--ink-400)' }}>Ghi chú: {u.note}</small>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ) : null}
      </MobileDetailSheet>
    </div>
  );
}
