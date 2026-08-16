import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { StatusBadge } from '@/components/data-display/Badges';
import { monthStartIso, todayIso, toIsoDate, COMMON_DATE_PRESETS } from '@/lib/date';
import { formatDateTime, formatDate, formatMoney, formatNumber } from '@/lib/format';
import { statusLabels, type ApiRecord } from '@/types/api';
import { getPurchaseOrders, getPurchaseOrder } from '@/features/inventory/inventory.api';
import {
  MobileSearchBar,
  MobileFilterSheet,
  MobileDetailSheet,
  MobileEmptyState,
} from '@/features/mobile-common';
import './mobile-inventory.css';

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
  const navigate = useNavigate();

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
  const [sortBy, setSortBy] = useState<'date' | 'total' | 'code'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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
      d7.setDate(d7.getDate() - 7);
      return { dateFrom: toIsoDate(d7), dateTo: todayString };
    }
    if (datePreset === 'this_month') {
      return { dateFrom: monthStartIso(), dateTo: todayString };
    }
    return { dateFrom: undefined, dateTo: undefined };
  }, [datePreset]);

  // Fetch Purchase Orders
  const { data: purchaseOrdersData, isLoading } = useQuery({
    queryKey: ['mobile-purchase-orders', search, statusFilter, dateParams.dateFrom, dateParams.dateTo],
    queryFn: () =>
      getPurchaseOrders({
        search,
        status: statusFilter,
        dateFrom: dateParams.dateFrom,
        dateTo: dateParams.dateTo,
        pageSize: 100,
      }),
  });

  const rawRows = (purchaseOrdersData?.data ?? []) as ApiRecord[];

  // Fetch Purchase Order Detail
  const { data: orderDetailData, isLoading: isDetailLoading } = useQuery({
    queryKey: ['mobile-purchase-order-detail', selectedOrderId],
    queryFn: () => (selectedOrderId ? getPurchaseOrder(selectedOrderId) : null),
    enabled: selectedOrderId !== null,
  });

  const activeOrder = orderDetailData?.data as ApiRecord | undefined;

  // Filter and Sort Rows
  const sortedRows = useMemo(() => {
    return [...rawRows].sort((a, b) => {
      if (sortBy === 'date') {
        const tA = a.receivedAt || a.createdAt ? new Date(a.receivedAt || a.createdAt).getTime() : 0;
        const tB = b.receivedAt || b.createdAt ? new Date(b.receivedAt || b.createdAt).getTime() : 0;
        return sortOrder === 'desc' ? tB - tA : tA - tB;
      }
      if (sortBy === 'total') {
        const valA = Number(a.amountDue || 0);
        const valB = Number(b.amountDue || 0);
        return sortOrder === 'desc' ? valB - valA : valA - valB;
      }
      if (sortBy === 'code') {
        return sortOrder === 'desc'
          ? String(b.code || '').localeCompare(String(a.code || ''))
          : String(a.code || '').localeCompare(String(b.code || ''));
      }
      return 0;
    });
  }, [rawRows, sortBy, sortOrder]);

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
  const totalAmountDueSum = useMemo(() => {
    return rawRows.reduce((sum, r) => sum + Number(r.amountDue || 0), 0);
  }, [rawRows]);

  // Handle Sort Toggle
  const toggleSort = () => {
    if (sortBy === 'date') {
      if (sortOrder === 'desc') {
        setSortOrder('asc');
      } else {
        setSortBy('total');
        setSortOrder('desc');
      }
    } else if (sortBy === 'total') {
      if (sortOrder === 'desc') {
        setSortOrder('asc');
      } else {
        setSortBy('code');
        setSortOrder('asc');
      }
    } else {
      setSortBy('date');
      setSortOrder('desc');
    }
  };

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
      {/* 1. Header Top Navigation */}
      <div className="mobile-inventory-top-nav">
        <div className="mobile-inventory-nav-left">
          <button
            type="button"
            className="mobile-inventory-back-icon"
            onClick={() => navigate('/m/more')}
            aria-label="Quay lại"
          >
            <i className="ph ph-caret-left" />
          </button>
          <h1 className="mobile-inventory-nav-title">Nhập hàng</h1>
        </div>

        <div className="mobile-inventory-nav-actions">
          <button
            type="button"
            className="mobile-inventory-nav-btn"
            onClick={() => setIsSearchVisible((prev) => !prev)}
            aria-label="Tìm kiếm"
          >
            <i className="ph ph-magnifying-glass" />
          </button>
          <button
            type="button"
            className="mobile-inventory-nav-btn"
            onClick={toggleSort}
            aria-label="Sắp xếp"
            title={`Sắp xếp: ${
              sortBy === 'date'
                ? `Thời gian ${sortOrder === 'desc' ? 'mới nhất' : 'cũ nhất'}`
                : sortBy === 'total'
                ? `Cần trả ${sortOrder === 'desc' ? 'cao → thấp' : 'thấp → cao'}`
                : `Mã phiếu ${sortOrder === 'asc' ? 'A → Z' : 'Z → A'}`
            }`}
          >
            <i className="ph ph-arrows-down-up" />
          </button>
        </div>
      </div>

      {/* Inline Search Bar */}
      {isSearchVisible && (
        <div className="mobile-inventory-search-bar-wrap">
          <MobileSearchBar
            value={search}
            placeholder="Tìm theo mã phiếu, nhà cung cấp..."
            onChange={setSearch}
          />
        </div>
      )}

      {/* 2. Filter Strip */}
      <div className="mobile-inventory-filter-strip">
        <button
          type="button"
          className="mobile-filter-icon-btn"
          onClick={openFilterSheet}
          aria-label="Mở bộ lọc"
        >
          <i className="ph ph-faders" />
        </button>

        {/* Date Preset Chip */}
        <button
          type="button"
          className={`mobile-filter-chip ${datePreset !== 'this_month' ? 'is-active' : ''}`}
          onClick={openFilterSheet}
        >
          <span>Khoảng ngày: {getDatePresetLabel(datePreset)}</span>
          <i className="ph ph-caret-down" />
        </button>

        {/* Status Filter Chip */}
        <button
          type="button"
          className={`mobile-filter-chip ${statusFilter ? 'is-active' : ''}`}
          onClick={openFilterSheet}
        >
          <span>Trạng thái: {statusFilter === 'completed' ? 'Đã nhập hàng' : statusFilter === 'draft' ? 'Phiếu tạm' : 'Tất cả'}</span>
          <i className="ph ph-caret-down" />
        </button>
      </div>

      {/* 3. Summary & Sort Bar */}
      <div className="mobile-inventory-summary-bar">
        <button type="button" className="mobile-inventory-sort-selector" onClick={toggleSort}>
          <span>
            {sortBy === 'date'
              ? `${sortOrder === 'desc' ? 'Mới nhất' : 'Cũ nhất'}`
              : sortBy === 'total'
              ? `Cần trả: ${sortOrder === 'desc' ? 'Cao → thấp' : 'Thấp → cao'}`
              : `Mã phiếu: ${sortOrder === 'asc' ? 'A → Z' : 'Z → A'}`}
          </span>
          <i className="ph ph-caret-down" />
        </button>

        <div className="mobile-inventory-count-summary">
          {rawRows.length} phiếu nhập · Cần trả: {formatMoney(totalAmountDueSum)}
        </div>
      </div>

      {/* 4. Grouped Section List */}
      <div className="mobile-inventory-sections-wrapper">
        {isLoading ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b' }}>
            Đang tải danh sách phiếu nhập...
          </div>
        ) : rawRows.length === 0 ? (
          <div style={{ padding: '24px 16px' }}>
            <MobileEmptyState
              title="Không tìm thấy phiếu nhập nào"
              description="Thử tìm kiếm với từ khóa khác hoặc điều chỉnh bộ lọc."
            />
          </div>
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

      {/* 5. Floating Action Button (FAB) for Creating Purchase Order */}
      <Link
        to="/m/purchase-orders/new"
        className="mobile-inventory-fab-btn"
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
          <select
            className="mobile-filter-select"
            value={draftDatePreset}
            onChange={(e) => setDraftDatePreset(e.target.value)}
          >
            {datePresets.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
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
            <option value="draft">Phiếu tạm</option>
            <option value="completed">Đã nhập hàng</option>
          </select>
        </div>
      </MobileFilterSheet>

      {/* 6. Inset Detail View Bottom Sheet */}
      <MobileDetailSheet
        isOpen={selectedOrderId !== null}
        title="Chi tiết phiếu nhập"
        onClose={() => setSelectedOrderId(null)}
      >
        {isDetailLoading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
            Đang tải thông tin phiếu nhập...
          </div>
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
                        style={{ color: '#0062eb', textDecoration: 'none' }}
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
                  <span className="mobile-po-grid-val" style={{ color: Number(activeOrder.amountPaid || 0) >= Number(activeOrder.amountDue || 0) ? '#10b981' : '#f59e0b' }}>
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
                <div style={{ fontSize: '13.5px', color: '#64748b', padding: '8px 0' }}>
                  Không có mặt hàng nào trong phiếu nhập.
                </div>
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
                              <span style={{ color: '#e11d48', marginLeft: '4px' }}>
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
                  <span style={{ color: '#10b981', fontWeight: 650 }}>
                    {formatMoney(activeOrder.amountPaid || 0)}
                  </span>
                </div>

                <div className="mobile-po-summary-line" style={{ color: Number(activeOrder.amountDue || 0) - Number(activeOrder.amountPaid || 0) > 0 ? '#e11d48' : '#10b981', fontWeight: 650 }}>
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
                  className="mobile-po-action-print-btn"
                  onClick={() => alert(`Đang chuẩn bị in phiếu nhập ${activeOrder.code}`)}
                >
                  <i className="ph ph-printer" /> In phiếu nhập
                </button>
                <button
                  type="button"
                  className="mobile-po-action-edit-btn"
                  onClick={() => alert(`Chức năng chỉnh sửa phiếu nhập ${activeOrder.code}`)}
                >
                  Sửa phiếu
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </MobileDetailSheet>
    </div>
  );
}
