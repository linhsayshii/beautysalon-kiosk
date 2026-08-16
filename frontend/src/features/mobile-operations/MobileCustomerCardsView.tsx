import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { getCustomerCards, getCustomerCard } from '@/features/operations/operations.api';
import { StatusBadge } from '@/components/data-display/Badges';
import { statusLabels } from '@/types/api';
import {
  MobileSearchBar,
  MobileFilterSheet,
  MobileDetailSheet,
  MobileEmptyState,
} from '@/features/mobile-common';
import type { ApiRecord } from '@/types/api';
import './mobile-operations.css';

export function MobileCustomerCardsView() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [itemTypeFilter, setItemTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState<'soldAt' | 'name' | 'price'>('soldAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Draft filters for filter sheet
  const [draftItemType, setDraftItemType] = useState('');
  const [draftStatus, setDraftStatus] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [selectedCardType, setSelectedCardType] = useState<string>('package');

  const { data: cardsData, isLoading } = useQuery({
    queryKey: ['mobile-customer-cards', search, itemTypeFilter, statusFilter],
    queryFn: () =>
      getCustomerCards({
        search,
        itemType: itemTypeFilter,
        status: statusFilter,
        pageSize: 100,
      }),
  });

  const rawRows = (cardsData?.data ?? []) as ApiRecord[];

  const { data: cardDetailData, isLoading: isDetailLoading } = useQuery({
    queryKey: ['mobile-customer-card-detail', selectedCardType, selectedCardId],
    queryFn: () => (selectedCardId ? getCustomerCard(selectedCardType, selectedCardId) : null),
    enabled: selectedCardId !== null,
  });

  const activeCard = cardDetailData?.data as ApiRecord | undefined;

  // Sort rows
  const sortedRows = useMemo(() => {
    return [...rawRows].sort((a, b) => {
      if (sortBy === 'soldAt') {
        const tA = a.soldAt ? new Date(a.soldAt).getTime() : 0;
        const tB = b.soldAt ? new Date(b.soldAt).getTime() : 0;
        return sortOrder === 'desc' ? tB - tA : tA - tB;
      }
      if (sortBy === 'name') {
        return sortOrder === 'desc'
          ? String(b.itemName || '').localeCompare(String(a.itemName || ''))
          : String(a.itemName || '').localeCompare(String(b.itemName || ''));
      }
      if (sortBy === 'price') {
        const pA = Number(a.salePrice || 0);
        const pB = Number(b.salePrice || 0);
        return sortOrder === 'desc' ? pB - pA : pA - pB;
      }
      return 0;
    });
  }, [rawRows, sortBy, sortOrder]);

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

  const toggleSort = () => {
    if (sortBy === 'soldAt') {
      if (sortOrder === 'desc') {
        setSortOrder('asc');
      } else {
        setSortBy('name');
        setSortOrder('asc');
      }
    } else if (sortBy === 'name') {
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else {
        setSortBy('price');
        setSortOrder('desc');
      }
    } else {
      setSortBy('soldAt');
      setSortOrder('desc');
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
          <h1 className="mobile-operations-nav-title">Gói & Thẻ đã bán</h1>
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
              sortBy === 'soldAt' ? 'Thời gian bán' : sortBy === 'name' ? 'Tên gói/thẻ' : 'Giá bán'
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
            placeholder="Tìm mã, tên gói/thẻ, khách hàng..."
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
          className={`mobile-filter-chip ${itemTypeFilter ? 'is-active' : ''}`}
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
          className={`mobile-filter-chip ${statusFilter ? 'is-active' : ''}`}
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

      {/* 3. Summary & Sort Indicator Bar */}
      <div className="mobile-operations-summary-bar">
        <button type="button" className="mobile-operations-sort-selector" onClick={toggleSort}>
          <span>
            {sortBy === 'soldAt'
              ? `Bán: ${sortOrder === 'desc' ? 'Mới nhất' : 'Cũ nhất'}`
              : sortBy === 'name'
              ? `Tên ${sortOrder === 'asc' ? 'A → Z' : 'Z → A'}`
              : `Giá bán ${sortOrder === 'desc' ? 'cao → thấp' : 'thấp → cao'}`}
          </span>
          <i className="ph ph-caret-down" />
        </button>

        <div className="mobile-operations-count-summary">
          {rawRows.length} gói, thẻ đã bán
        </div>
      </div>

      {/* 4. Grouped Section List */}
      <div className="mobile-operations-sections-wrapper">
        {isLoading ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b' }}>
            Đang tải danh sách gói thẻ...
          </div>
        ) : rawRows.length === 0 ? (
          <div style={{ padding: '24px 16px' }}>
            <MobileEmptyState
              title="Chưa có gói dịch vụ hoặc thẻ tài khoản nào"
              description="Thử tìm kiếm với từ khóa khác hoặc thay đổi bộ lọc."
            />
          </div>
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
                          <div className="mobile-package-progress-wrap" style={{ marginTop: '2px' }}>
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
                              <span style={{ fontWeight: 700, color: '#0062eb' }}>
                                Còn {row.remainingUnits} lượt
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize: '12px', color: '#10b981', fontWeight: 700 }}>
                            Số dư: {formatMoney(row.currentBalance || 0)}
                          </div>
                        )}
                      </div>

                      {/* Right: Status badge & Price */}
                      <div className="mobile-row-right">
                        <StatusBadge status={row.status} />
                        <span style={{ fontSize: '13px', fontWeight: 650, color: '#0f172a' }}>
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
          <select
            className="mobile-filter-select"
            value={draftItemType}
            onChange={(e) => setDraftItemType(e.target.value)}
          >
            <option value="">Tất cả loại thẻ</option>
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

      {/* 5. Inset Detail Sheet */}
      <MobileDetailSheet
        isOpen={selectedCardId !== null}
        title="Thông tin chi tiết gói/thẻ"
        onClose={() => setSelectedCardId(null)}
      >
        {isDetailLoading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
            Đang tải thông tin...
          </div>
        ) : activeCard ? (
          <div className="mobile-detail-page-container" style={{ padding: '4px 0 24px' }}>
            {/* Header Card */}
            <div className="mobile-detail-section-card">
              <div className="mobile-detail-card-header">
                <span className="mobile-detail-card-title">
                  {activeCard.itemType === 'package' ? 'Gói dịch vụ' : 'Thẻ tài khoản'}
                </span>
                <button
                  type="button"
                  className="mobile-detail-edit-link"
                  onClick={() => alert('Chức năng sửa thông tin gói/thẻ')}
                >
                  Sửa
                </button>
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
                      <a href={`tel:${activeCard.customer.phone}`} style={{ color: '#0062eb' }}>
                        {activeCard.customer.phone}
                      </a>
                    ) : (
                      'Chưa có'
                    )}
                  </span>
                </div>

                <div className="mobile-detail-grid-item">
                  <span className="mobile-detail-grid-label">Giá bán</span>
                  <span className="mobile-detail-grid-value" style={{ color: '#0062eb' }}>
                    {formatMoney(activeCard.salePrice)}
                  </span>
                </div>

                <div className="mobile-detail-grid-item">
                  <span className="mobile-detail-grid-label">
                    {activeCard.itemType === 'package' ? 'Còn lại' : 'Số dư hiện tại'}
                  </span>
                  <span className="mobile-detail-grid-value" style={{ color: '#10b981' }}>
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
                    <span style={{ fontSize: '13.5px', fontWeight: 600 }}>
                      {srv.name} ({srv.code})
                    </span>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>
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
                  <span style={{ fontSize: '13.5px', color: '#64748b' }}>Số dư ban đầu:</span>
                  <span style={{ fontSize: '14px', fontWeight: 700 }}>
                    {formatMoney(activeCard.openingBalance)}
                  </span>
                </div>
                <div className="mobile-detail-nav-row">
                  <span style={{ fontSize: '13.5px', color: '#64748b' }}>Đã sử dụng:</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#e11d48' }}>
                    {formatMoney(
                      Number(activeCard.openingBalance || 0) - Number(activeCard.currentBalance || 0)
                    )}
                  </span>
                </div>
                <div className="mobile-detail-nav-row">
                  <span style={{ fontSize: '13.5px', color: '#64748b' }}>Còn lại:</span>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#10b981' }}>
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
                        <span style={{ color: '#64748b' }}>
                          Hóa đơn: {u.invoiceCode || '-'}
                        </span>
                        <strong style={{ color: '#0062eb' }}>
                          -{formatNumber(u.unitsUsed)} lượt
                        </strong>
                      </div>
                      {u.note && (
                        <small style={{ color: '#94a3b8' }}>Ghi chú: {u.note}</small>
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
