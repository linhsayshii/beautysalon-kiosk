import { ErrorState, LoadingState } from '@/components/data-display/DataState';
import { Pagination } from '@/components/data-display/Pagination';
import { useFilterPagination } from '@/hooks/useFilterPagination';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { StatusBadge } from '@/components/data-display/Badges';
import { Select } from '@/components/ui/Select/Select';
import { monthStartIso, todayIso, toIsoDate, COMMON_DATE_PRESETS } from '@/lib/date';
import { formatDateTime, formatDate, formatMoney, formatNumber } from '@/lib/format';
import { statusLabels, type ApiRecord } from '@/types/api';
import { getPurchaseOrders, getPurchaseOrder } from '@/features/inventory/inventory.api';
import {
  MobileSearchBar,
  MobileFilterSheet,
  MobileDetailSheet,
  MobileEmptyState,
  MobileSortDropdown,
} from '@/features/mobile-common';
import { MobilePageHeader } from '@/components/ui/MobilePageHeader/MobilePageHeader';

const datePresets = COMMON_DATE_PRESETS;

function formatMonthHeader(dateStr: string): string {
  try {
    const d = new Date(`${dateStr.length === 7 ? dateStr + '-01' : dateStr}T00:00:00`);
    if (isNaN(d.getTime())) return dateStr;
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `THÁNG ${month}/${year}`;
  } catch {
    return dateStr;
  }
}

export function MobilePurchaseOrdersView() {

  // Search & Navigation
  const [search, setSearch] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  // Filters
  const [datePreset, setDatePreset] = useState<string>('this_month');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Draft filters for bottom sheet
  const [draftDatePreset, setDraftDatePreset] = useState<string>('this_month');
  const [draftStatus, setDraftStatus] = useState<string>('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Sorting
  const [sortValue, setSortValue] = useState<string>('date_desc');

  const sortOptions = [
    { value: 'date_desc', label: 'Thời gian: Mới nhất' },
    { value: 'date_asc', label: 'Thời gian: Cũ nhất' },
    { value: 'total_desc', label: 'Giá trị: Cao → thấp' },
    { value: 'total_asc', label: 'Giá trị: Thấp → cao' },
    { value: 'code_asc', label: 'Mã phiếu: A → Z' },
    { value: 'code_desc', label: 'Mã phiếu: Z → A' },
  ];

  // Detail Sheet
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  // Date ranges based on datePreset
  const dateParams = useMemo(() => {
    const today = new Date();
    const todayString = toIsoDate(today);

    if (datePreset === 'today') {
      return { dateFrom: todayString, dateTo: todayString };
    }
    if (datePreset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yString = toIsoDate(y);
      return { dateFrom: yString, dateTo: yString };
    }
    if (datePreset === '7days') {
      const d7 = new Date();
      d7.setDate(d7.getDate() - 6);
      return { dateFrom: toIsoDate(d7), dateTo: todayString };
    }
    if (datePreset === 'this_month') {
      return { dateFrom: monthStartIso(), dateTo: todayString };
    }
    return { dateFrom: undefined, dateTo: undefined };
  }, [datePreset]);

  // Fetch Purchase Orders
  const [page, setPage] = useFilterPagination([search, statusFilter, dateParams.dateFrom, dateParams.dateTo, sortValue]);

  const { data: purchaseOrdersData, isLoading, error, refetch } = useQuery({
    queryKey: ['mobile-purchase-orders', search, statusFilter, dateParams.dateFrom, dateParams.dateTo, page, sortValue],
    queryFn: () =>
      getPurchaseOrders({
        search,
        status: statusFilter,
        dateFrom: dateParams.dateFrom,
        dateTo: dateParams.dateTo,
        pageSize: 100,
        page,
        sort: sortValue,
      }),
  });

  const rawRows = (purchaseOrdersData?.data ?? []) as ApiRecord[];

  // Fetch Purchase Order Detail
  const { data: orderDetailData, isLoading: isDetailLoading, error: detailError, refetch: refetchDetail } = useQuery({
    queryKey: ['mobile-purchase-order-detail', selectedOrderId],
    queryFn: () => (selectedOrderId ? getPurchaseOrder(selectedOrderId) : null),
    enabled: selectedOrderId !== null,
  });

  const activeOrder = orderDetailData?.data as ApiRecord | undefined;

  const sortedRows = rawRows;

  // Group purchase orders by month/date (e.g. YYYY-MM)
  const groupedSections = useMemo(() => {
    const map = new Map<string, ApiRecord[]>();

    sortedRows.forEach((row) => {
      const rawDate = row.receivedAt || row.createdAt || todayIso();
      const d = new Date(rawDate);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const list = map.get(monthKey) || [];
      list.push(row);
      map.set(monthKey, list);
    });

    return Array.from(map.entries());
  }, [sortedRows]);

  // Total Amount Due calculation
  const totalAmountDueSum = purchaseOrdersData?.meta?.summary?.totalDue;

  const openFilterSheet = () => {
    setDraftDatePreset(datePreset);
    setDraftStatus(statusFilter);
    setIsFilterOpen(true);
  };

  const handleApplyFilter = () => {
    setDatePreset(draftDatePreset);
    setStatusFilter(draftStatus);
    setIsFilterOpen(false);
  };

  const handleResetFilter = () => {
    setDraftDatePreset('this_month');
    setDraftStatus('');
    setDatePreset('this_month');
    setStatusFilter('');
    setIsFilterOpen(false);
  };

  const getDatePresetLabel = (val: string) => {
    const found = datePresets.find((p) => p.value === val);
    return found ? found.label : 'Tháng này';
  };

  return (
    <div className="mobile-inventory-view">
      <MobilePageHeader
        title="Nhập hàng" backTo="/m/more"
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
            placeholder="Tìm theo mã phiếu, nhà cung cấp..."
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

          {/* Date Preset Chip */}
          <button
            type="button"
            className={`chip ${datePreset !== 'this_month' ? 'is-active' : ''}`}
            onClick={openFilterSheet}
          >
            <span>Khoảng ngày: {getDatePresetLabel(datePreset)}</span>
            <i className="ph ph-caret-down" />
          </button>

          {/* Status Filter Chip */}
          <button
            type="button"
            className={`chip ${statusFilter ? 'is-active' : ''}`}
            onClick={openFilterSheet}
          >
            <span>Trạng thái: {statusFilter === 'completed' ? 'Đã nhập hàng' : statusFilter === 'draft' ? 'Phiếu tạm' : 'Tất cả'}</span>
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
            {purchaseOrdersData?.meta?.pagination?.total ?? rawRows.length} phiếu nhập · Cần trả: {totalAmountDueSum === undefined ? '—' : formatMoney(totalAmountDueSum) }
          </div>
        </div>
      </MobilePageHeader>

      {/* 4. Grouped Section List */}
      <div className="mobile-inventory-sections-wrapper">
        {error ? <ErrorState error={error} onRetry={() => refetch()} /> : isLoading ? (
          <LoadingState compact label="Đang tải danh sách phiếu nhập..." />
        ) : rawRows.length === 0 ? (
          <MobileEmptyState
              title="Không tìm thấy phiếu nhập nào"
              description="Thử tìm kiếm với từ khóa khác hoặc điều chỉnh bộ lọc."
            />
        ) : (
          groupedSections.map(([monthKey, items]) => (
            <div key={monthKey} className="mobile-inventory-section">
              <div className="mobile-inventory-section-title">
                {formatMonthHeader(monthKey)} ({items.length})
              </div>
              <div className="mobile-inventory-section-card">
                {items.map((row) => {
                  const supplierName = row.supplier?.name || 'Nhà cung cấp';
                  const supplierPhone = row.supplier?.phone || '';
                  const receivedDate = formatDate(row.receivedAt || row.createdAt);
                  const itemCount = Number(row.itemCount || (row.items ? row.items.length : 0));

                  return (
                    <div
                      key={row.id}
                      className="mobile-inventory-row-item"
                      onClick={() => setSelectedOrderId(row.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedOrderId(row.id); } }}
                    >
                      {/* Square Rounded Avatar */}
                      <div className="mobile-row-avatar is-product">
                        <i className="ph ph-truck" />
                      </div>

                      {/* PO Core Info */}
                      <div className="mobile-row-info">
                        <div className="mobile-po-row-top-line">
                          <span className="mobile-po-code-text">{row.code}</span>
                          <span className="mobile-po-date-text">{receivedDate}</span>
                        </div>

                        <div className="mobile-po-supplier-line">
                          <span className="mobile-po-supplier-name">{supplierName}</span>
                          {supplierPhone && (
                            <span className="mobile-po-supplier-phone">
                              • {supplierPhone}
                            </span>
                          )}
                        </div>

                        <div className="mobile-po-meta-line">
                          <span>{itemCount} mặt hàng</span>
                        </div>
                      </div>

                      {/* Right: Amount Due & Status Badge */}
                      <div className="mobile-po-row-right">
                        <div className="mobile-po-total-due">
                          {formatMoney(row.amountDue)}
                        </div>
                        <div className="mobile-po-status-badge-wrap">
                          <StatusBadge status={row.status} purchase />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {purchaseOrdersData?.meta?.pagination && <Pagination pagination={purchaseOrdersData.meta.pagination} onChange={setPage} />}

      {/* 5. Floating Action Button (FAB) for Creating Purchase Order */}
      <Link
        to="/m/purchase-orders/new"
        className="m-fab"
        aria-label="Tạo phiếu nhập mới"
        title="Tạo phiếu nhập"
      >
        <i className="ph ph-plus" />
      </Link>

      {/* Filter Bottom Sheet */}
      <MobileFilterSheet
        isOpen={isFilterOpen}
        title="Bộ lọc phiếu nhập"
        onClose={() => setIsFilterOpen(false)}
        onReset={handleResetFilter}
        onApply={handleApplyFilter}
      >
        <div className="mobile-filter-field">
          <label className="mobile-filter-field-label">Khoảng thời gian</label>
          <Select
            aria-label="Khoảng thời gian"
            triggerClassName="mobile-filter-select"
            variant="filter"
            fullWidth
            value={draftDatePreset}
            onChange={setDraftDatePreset}
            options={datePresets}
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
            options={[{ value: '', label: 'Tất cả trạng thái' }, { value: 'draft', label: 'Phiếu tạm' }, { value: 'completed', label: 'Đã nhập hàng' }]}
          />
        </div>
      </MobileFilterSheet>

      {/* 6. Inset Detail View Bottom Sheet */}
      <MobileDetailSheet
        isOpen={selectedOrderId !== null}
        title="Chi tiết phiếu nhập"
        onClose={() => setSelectedOrderId(null)}
      >
        {detailError ? <ErrorState error={detailError} onRetry={() => refetchDetail()} /> : isDetailLoading ? (
          <LoadingState compact label="Đang tải thông tin phiếu nhập..." />
        ) : activeOrder ? (
          <div className="mobile-po-detail-wrapper">
            {/* Header Card */}
            <div className="mobile-po-detail-card">
              <div className="mobile-po-detail-header-row">
                <h2 className="mobile-po-detail-code">{activeOrder.code}</h2>
                <div className="mobile-po-detail-status-pill">
                  <StatusBadge status={activeOrder.status} purchase />
                </div>
              </div>

              {/* Supplier Info */}
              <div className="mobile-po-detail-supplier-row">
                <div className="mobile-po-detail-avatar">
                  <i className="ph ph-buildings" />
                </div>
                <div className="mobile-po-detail-supplier-info">
                  <span className="mobile-po-detail-supplier-name">
                    {activeOrder.supplier?.name || 'Nhà cung cấp'}
                  </span>
                  <span className="mobile-po-detail-supplier-phone">
                    {activeOrder.supplier?.phone ? (
                      <a
                        href={`tel:${activeOrder.supplier.phone}`}
                        className="text-primary"
                      >
                        <i className="ph ph-phone" /> {activeOrder.supplier.phone}
                      </a>
                    ) : (
                      'Chưa có số điện thoại'
                    )}
                  </span>
                </div>
              </div>

              {/* Lưới 2x2: Ngày nhập, Người tạo, Tổng số mặt hàng, Trạng thái thanh toán */}
              <div className="mobile-po-grid-2col">
                <div className="mobile-po-grid-cell">
                  <span className="mobile-po-grid-lbl">Ngày nhập</span>
                  <span className="mobile-po-grid-val">
                    {formatDateTime(activeOrder.receivedAt || activeOrder.createdAt)}
                  </span>
                </div>

                <div className="mobile-po-grid-cell">
                  <span className="mobile-po-grid-lbl">Người tạo</span>
                  <span className="mobile-po-grid-val">
                    {activeOrder.createdBy || 'Quản lý'}
                  </span>
                </div>

                <div className="mobile-po-grid-cell">
                  <span className="mobile-po-grid-lbl">Tổng số mặt hàng</span>
                  <span className="mobile-po-grid-val">
                    {formatNumber(activeOrder.items?.length || activeOrder.itemCount || 0)} SP
                  </span>
                </div>

                <div className="mobile-po-grid-cell">
                  <span className="mobile-po-grid-lbl">Trạng thái thanh toán</span>
                  <span className={`mobile-po-grid-val ${Number(activeOrder.amountPaid || 0) >= Number(activeOrder.amountDue || 0) ? 'text-success' : 'text-warning'}`}>
                    {Number(activeOrder.amountPaid || 0) >= Number(activeOrder.amountDue || 0) ? 'Đã thanh toán đủ' : Number(activeOrder.amountPaid || 0) > 0 ? 'Thanh toán 1 phần' : 'Chưa thanh toán'}
                  </span>
                </div>
              </div>
            </div>

            {/* Danh sách mặt hàng nhập card */}
            <div className="mobile-po-detail-card">
              <div className="mobile-po-card-section-title">
                DANH SÁCH MẶT HÀNG NHẬP ({(activeOrder.items || []).length})
              </div>

              {(!activeOrder.items || activeOrder.items.length === 0) ? (
                <p className="m-note">
                  Không có mặt hàng nào trong phiếu nhập.
                </p>
              ) : (
                <div className="mobile-po-items-table">
                  {activeOrder.items.map((item: ApiRecord, idx: number) => {
                    const itemName = item.name || `Mặt hàng #${idx + 1}`;
                    const lineTotal = item.lineTotal || (Number(item.quantity || 1) * Number(item.unitCost || 0) - Number(item.discount || 0));

                    return (
                      <div key={item.id || item.sku || idx} className="mobile-po-item-row">
                        <div className="mobile-po-item-left">
                          <span className="mobile-po-item-name">{itemName}</span>
                          <span className="mobile-po-item-calc">
                            {item.sku ? `${item.sku} · ` : ''}{formatNumber(item.quantity)} {item.unit || 'SP'} × {formatMoney(item.unitCost)}
                            {Number(item.discount) > 0 && (
                              <span className="text-danger"> 
                                (Giảm {formatMoney(item.discount)})
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="mobile-po-item-total">
                          {formatMoney(lineTotal)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Chi tiết tài chính card */}
            <div className="mobile-po-detail-card">
              <div className="mobile-po-card-section-title">CHI TIẾT TÀI CHÍNH</div>

              <div className="mobile-po-payment-breakdown">
                <div className="mobile-po-summary-line">
                  <span>Tổng tiền hàng:</span>
                  <span>{formatMoney(activeOrder.subtotal || activeOrder.amountDue)}</span>
                </div>

                {Number(activeOrder.discount) > 0 && (
                  <div className="mobile-po-summary-line is-discount">
                    <span>Giảm giá:</span>
                    <span>-{formatMoney(activeOrder.discount)}</span>
                  </div>
                )}

                <div className="mobile-po-summary-line is-grand-total">
                  <span>Cần trả NCC:</span>
                  <strong>{formatMoney(activeOrder.amountDue)}</strong>
                </div>

                <div className="mobile-po-summary-line">
                  <span>Đã trả NCC:</span>
                  <span className="text-strong text-success">
                    {formatMoney(activeOrder.amountPaid || 0)}
                  </span>
                </div>

                <div className={`mobile-po-summary-line text-strong ${Number(activeOrder.amountDue || 0) - Number(activeOrder.amountPaid || 0) > 0 ? 'text-danger' : 'text-success'}`}>
                  <span>Còn nợ NCC:</span>
                  <span>
                    {formatMoney(
                      Math.max(
                        0,
                        Number(activeOrder.amountDue || 0) - Number(activeOrder.amountPaid || 0)
                      )
                    )}
                  </span>
                </div>

                {activeOrder.paymentMethod && (
                  <div className="mobile-po-summary-line">
                    <span>Hình thức TT:</span>
                    <span>{statusLabels[activeOrder.paymentMethod] || activeOrder.paymentMethod}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions Card: In phiếu nhập & Sửa phiếu */}
            <div className="mobile-po-detail-card">
              <div className="mobile-po-actions-row">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => window.print()}
                >
                  <i className="ph ph-printer" /> In phiếu nhập
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </MobileDetailSheet>
    </div>
  );
}
