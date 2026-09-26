import { ErrorState, LoadingState } from '@/components/data-display/DataState';
import { Pagination } from '@/components/data-display/Pagination';
import { useFilterPagination } from '@/hooks/useFilterPagination';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { getCustomerCards, getCustomerCard } from '@/features/operations/operations.api';
import { StatusBadge } from '@/components/data-display/Badges';
import { Select } from '@/components/ui/Select/Select';
import {
  MobileSearchBar,
  MobileFilterSheet,
  MobileDetailSheet,
  MobileEmptyState,
  MobileSortDropdown,
} from '@/features/mobile-common';
import type { ApiRecord } from '@/types/api';
import { MobilePageHeader } from '@/components/ui/MobilePageHeader/MobilePageHeader';

export function MobileCustomerCardsView() {
  const [search, setSearch] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [itemTypeFilter, setItemTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortValue, setSortValue] = useState<string>('soldAt_desc');

  const sortOptions = [
    { value: 'soldAt_desc', label: 'Bán: Mới nhất' },
    { value: 'soldAt_asc', label: 'Bán: Cũ nhất' },
    { value: 'name_asc', label: 'Tên gói/thẻ: A → Z' },
    { value: 'name_desc', label: 'Tên gói/thẻ: Z → A' },
    { value: 'price_desc', label: 'Giá bán: Cao → thấp' },
    { value: 'price_asc', label: 'Giá bán: Thấp → cao' },
  ];

  // Draft filters for filter sheet
  const [draftItemType, setDraftItemType] = useState('');
  const [draftStatus, setDraftStatus] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [selectedCardType, setSelectedCardType] = useState<string>('package');

  const [page, setPage] = useFilterPagination([search, itemTypeFilter, statusFilter, sortValue]);

  const { data: cardsData, isLoading, error, refetch } = useQuery({
    queryKey: ['mobile-customer-cards', search, itemTypeFilter, statusFilter, page, sortValue],
    queryFn: () =>
      getCustomerCards({
        search,
        itemType: itemTypeFilter,
        status: statusFilter,
        pageSize: 100,
        page,
        sort: sortValue,
      }),
  });

  const rawRows = (cardsData?.data ?? []) as ApiRecord[];

  const { data: cardDetailData, isLoading: isDetailLoading, error: detailError, refetch: refetchDetail } = useQuery({
    queryKey: ['mobile-customer-card-detail', selectedCardType, selectedCardId],
    queryFn: () => (selectedCardId ? getCustomerCard(selectedCardType, selectedCardId) : null),
    enabled: selectedCardId !== null,
  });

  const activeCard = cardDetailData?.data as ApiRecord | undefined;

  const sortedRows = rawRows;

  // Group by item type: GÓI DỊCH VỤ and THẺ TÀI KHOẢN
  const groupedSections = useMemo(() => {
    const map = new Map<string, ApiRecord[]>();
    sortedRows.forEach((row) => {
      const sectionName = row.itemType === 'package' ? 'GÓI DỊCH VỤ' : 'THẺ TÀI KHOẢN';
      const list = map.get(sectionName) || [];
      list.push(row);
      map.set(sectionName, list);
    });
    return Array.from(map.entries());
  }, [sortedRows]);

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
      <MobilePageHeader
        title="Gói & Thẻ đã bán" backTo="/m/more"
        actions={(
          <>
            <button
              type="button"
              className={`btn btn-ghost btn-icon m-header-action${isSearchVisible ? ' is-active' : ''}`}
              onClick={() => setIsSearchVisible((prev) => !prev)}
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
            placeholder="Tìm mã, tên gói/thẻ, khách hàng..."
            onChange={setSearch}
          />
        )}

        <div className="m-chip-strip">
          <button
            type="button"
            className="chip chip-icon"
            onClick={openFilterSheet}
            aria-label="Mở bộ lọc"
          >
            <i className="ph ph-faders" />
          </button>

          <button
            type="button"
            className={`chip ${itemTypeFilter ? 'is-active' : ''}`}
            onClick={openFilterSheet}
          >
            <span>
              {itemTypeFilter === 'package'
                ? 'Gói dịch vụ'
                : itemTypeFilter === 'account_card'
                ? 'Thẻ tài khoản'
                : 'Tất cả loại thẻ'}
            </span>
            <i className="ph ph-caret-down" />
          </button>

          <button
            type="button"
            className={`chip ${statusFilter ? 'is-active' : ''}`}
            onClick={openFilterSheet}
          >
            <span>
              {statusFilter === 'active'
                ? 'Đang sử dụng'
                : statusFilter === 'completed'
                ? 'Đã dùng hết'
                : statusFilter === 'expired'
                ? 'Hết hạn'
                : 'Trạng thái'}
            </span>
            <i className="ph ph-caret-down" />
          </button>
        </div>

        <div className="m-summary-bar">
          <MobileSortDropdown
            value={sortValue}
            options={sortOptions}
            onChange={setSortValue}
          />

          <div className="m-summary-count">
            {cardsData?.meta?.pagination?.total ?? rawRows.length} gói, thẻ đã bán
          </div>
        </div>
      </MobilePageHeader>

      {/* 4. Grouped Section List */}
      <div className="mobile-operations-sections-wrapper">
        {error ? <ErrorState error={error} onRetry={() => refetch()} /> : isLoading ? (
          <LoadingState compact label="Đang tải danh sách gói thẻ..." />
        ) : rawRows.length === 0 ? (
          <MobileEmptyState
              title="Chưa có gói dịch vụ hoặc thẻ tài khoản nào"
              description="Thử tìm kiếm với từ khóa khác hoặc thay đổi bộ lọc."
            />
        ) : (
          groupedSections.map(([sectionName, items]) => (
            <div key={sectionName} className="mobile-operations-section">
              <div className="mobile-operations-section-title">{sectionName}</div>
              <div className="mobile-operations-section-card">
                {items.map((row) => {
                  const isPkg = row.itemType === 'package';
                  const usedUnits = Number(row.usedUnits || 0);
                  const totalUnits = Number(row.totalUnits || 1);
                  const progressPercent = Math.min(100, Math.round((usedUnits / totalUnits) * 100));

                  return (
                    <div
                      key={`${row.itemType}-${row.id}`}
                      className="mobile-operations-row-item"
                      onClick={() => {
                        setSelectedCardId(row.id);
                        setSelectedCardType(row.itemType);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedCardId(row.id); setSelectedCardType(row.itemType); } }}
                    >
                      {/* Square rounded avatar */}
                      <div className={`mobile-card-square-avatar is-${row.itemType}`}>
                        <i className={isPkg ? 'ph ph-stack' : 'ph ph-credit-card'} />
                      </div>

                      {/* Info */}
                      <div className="mobile-row-info">
                        <div className="mobile-row-name">{row.itemName}</div>
                        <div className="mobile-row-sub">
                          <span>{row.customer?.name}</span>
                          {row.customer?.phone && (
                            <a
                              href={`tel:${row.customer.phone}`}
                              className="mobile-customer-phone-link"
                              onClick={(e) => e.stopPropagation()}
                            >
                              • {row.customer.phone}
                            </a>
                          )}
                        </div>

                        {/* Progress or Balance preview */}
                        {isPkg ? (
                          <div className="mobile-package-progress-wrap">
                            <div className="mobile-package-progress-bar">
                              <div
                                className="mobile-package-progress-fill"
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                            <div className="mobile-package-progress-text">
                              <span>
                                {usedUnits}/{totalUnits} lượt
                              </span>
                              <span className="text-strong text-primary">
                                Còn {row.remainingUnits} lượt
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-strong text-success">
                            Số dư: {formatMoney(row.currentBalance || 0)}
                          </div>
                        )}
                      </div>

                      {/* Right: Status badge & Price */}
                      <div className="mobile-row-right">
                        <StatusBadge status={row.status} />
                        <span className="text-strong">
                          {formatMoney(row.salePrice || 0)}
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

      {cardsData?.meta?.pagination && <Pagination pagination={cardsData.meta.pagination} onChange={setPage} />}

      {/* Filter Bottom Sheet */}
      <MobileFilterSheet
        isOpen={isFilterOpen}
        title="Bộ lọc gói thẻ"
        onClose={() => setIsFilterOpen(false)}
        onReset={handleResetFilter}
        onApply={handleApplyFilter}
      >
        <div className="mobile-filter-field">
          <label className="mobile-filter-field-label">Loại hàng</label>
          <Select
            aria-label="Loại hàng"
            triggerClassName="mobile-filter-select"
            variant="filter"
            fullWidth
            value={draftItemType}
            onChange={setDraftItemType}
            options={[{ value: '', label: 'Tất cả loại thẻ' }, { value: 'package', label: 'Gói dịch vụ' }, { value: 'account_card', label: 'Thẻ tài khoản' }]}
          />
        </div>

        <div className="mobile-filter-field">
          <label className="mobile-filter-field-label">Trạng thái</label>
          <Select
            aria-label="Trạng thái"
            triggerClassName="mobile-filter-select"
            variant="filter"
            fullWidth
            value={draftStatus}
            onChange={setDraftStatus}
            options={[{ value: '', label: 'Tất cả trạng thái' }, { value: 'active', label: 'Đang sử dụng' }, { value: 'completed', label: 'Đã dùng hết' }, { value: 'expired', label: 'Hết hạn' }]}
          />
        </div>
      </MobileFilterSheet>

      {/* 5. Inset Detail Sheet */}
      <MobileDetailSheet
        isOpen={selectedCardId !== null}
        title="Thông tin chi tiết gói/thẻ"
        onClose={() => setSelectedCardId(null)}
      >
        {detailError ? <ErrorState error={detailError} onRetry={() => refetchDetail()} /> : isDetailLoading ? (
          <LoadingState compact label="Đang tải thông tin..." />
        ) : activeCard ? (
          <div className="mobile-detail-page-container">
            {/* Header Card */}
            <div className="mobile-detail-section-card">
              <div className="mobile-detail-card-header">
                <span className="mobile-detail-card-title">
                  {activeCard.itemType === 'package' ? 'Gói dịch vụ' : 'Thẻ tài khoản'}
                </span>
              </div>

              <h2 className="mobile-detail-main-name">{activeCard.itemName}</h2>

              <div className="mobile-detail-status-pills">
                <span className="mobile-detail-pill is-code">
                  <i className="ph ph-identification-card" /> {activeCard.code}
                </span>
                <StatusBadge status={activeCard.status} />
              </div>

              {/* 2x2 grid */}
              <div className="mobile-detail-grid-2col">
                <div className="mobile-detail-grid-item">
                  <span className="mobile-detail-grid-label">Khách hàng</span>
                  <span className="mobile-detail-grid-value">{activeCard.customer?.name}</span>
                </div>

                <div className="mobile-detail-grid-item">
                  <span className="mobile-detail-grid-label">Số điện thoại</span>
                  <span className="mobile-detail-grid-value">
                    {activeCard.customer?.phone ? (
                      <a href={`tel:${activeCard.customer.phone}`} className="text-primary">
                        {activeCard.customer.phone}
                      </a>
                    ) : (
                      'Chưa có'
                    )}
                  </span>
                </div>

                <div className="mobile-detail-grid-item">
                  <span className="mobile-detail-grid-label">Giá bán</span>
                  <span className="mobile-detail-grid-value text-primary">
                    {formatMoney(activeCard.salePrice)}
                  </span>
                </div>

                <div className="mobile-detail-grid-item">
                  <span className="mobile-detail-grid-label">
                    {activeCard.itemType === 'package' ? 'Còn lại' : 'Số dư hiện tại'}
                  </span>
                  <span className="mobile-detail-grid-value text-success">
                    {activeCard.itemType === 'package'
                      ? `${formatNumber(activeCard.remainingUnits)} lượt`
                      : formatMoney(activeCard.currentBalance)}
                  </span>
                </div>

                <div className="mobile-detail-grid-item">
                  <span className="mobile-detail-grid-label">Ngày bán</span>
                  <span className="mobile-detail-grid-value">{formatDate(activeCard.soldAt)}</span>
                </div>

                <div className="mobile-detail-grid-item">
                  <span className="mobile-detail-grid-label">Hạn sử dụng</span>
                  <span className="mobile-detail-grid-value">{formatDate(activeCard.expiresAt)}</span>
                </div>
              </div>
            </div>

            {/* Dịch vụ trong gói / Cấu hình thẻ */}
            {activeCard.itemType === 'package' ? (
              <div className="mobile-detail-section-card">
                <div className="mobile-detail-card-header">
                  <span className="mobile-detail-card-title">Dịch vụ trong gói</span>
                </div>
                {(activeCard.services || []).map((srv: ApiRecord) => (
                  <div key={srv.id} className="mobile-detail-nav-row">
                    <span className="text-strong">
                      {srv.name} ({srv.code})
                    </span>
                    <span className="text-muted">
                      Đã dùng: {activeCard.usedUnits}/{activeCard.totalUnits}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mobile-detail-section-card">
                <div className="mobile-detail-card-header">
                  <span className="mobile-detail-card-title">Số dư thẻ</span>
                </div>
                <div className="mobile-detail-nav-row">
                  <span className="text-muted">Số dư ban đầu:</span>
                  <span className="text-strong">
                    {formatMoney(activeCard.openingBalance)}
                  </span>
                </div>
                <div className="mobile-detail-nav-row">
                  <span className="text-muted">Đã sử dụng:</span>
                  <span className="text-strong text-danger">
                    {formatMoney(
                      Number(activeCard.openingBalance || 0) - Number(activeCard.currentBalance || 0)
                    )}
                  </span>
                </div>
                <div className="mobile-detail-nav-row">
                  <span className="text-muted">Còn lại:</span>
                  <span className="text-strong text-success">
                    {formatMoney(activeCard.currentBalance)}
                  </span>
                </div>
              </div>
            )}

            {/* Lịch sử sử dụng card */}
            <div className="mobile-detail-section-card">
              <div className="mobile-detail-card-header">
                <span className="mobile-detail-card-title">Lịch sử sử dụng</span>
              </div>
              {!activeCard.usages || activeCard.usages.length === 0 ? (
                <MobileEmptyState title="Chưa có lịch sử sử dụng nào" />
              ) : (
                <div className="mobile-activity-list">
                  {activeCard.usages.map((u: ApiRecord) => (
                    <div key={u.id} className="mobile-activity-item">
                      <div className="mobile-activity-item-top">
                        <span className="mobile-activity-item-code">
                          {u.serviceName ?? 'Sử dụng dịch vụ'}
                        </span>
                        <span className="mobile-activity-item-date">
                          {formatDateTime(u.occurredAt)}
                        </span>
                      </div>
                      <div className="mobile-activity-item-bottom">
                        <span className="text-muted">
                          Hóa đơn: {u.invoiceCode || '-'}
                        </span>
                        <strong className="text-primary">
                          -{formatNumber(u.unitsUsed)} lượt
                        </strong>
                      </div>
                      {u.note && (
                        <small className="text-faint">Ghi chú: {u.note}</small>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </MobileDetailSheet>
    </div>
  );
}
