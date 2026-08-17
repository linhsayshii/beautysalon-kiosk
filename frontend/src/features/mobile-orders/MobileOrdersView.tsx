import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { toIsoDate, todayIso, monthStartIso, COMMON_DATE_PRESETS, formatDayHeader } from '@/lib/date';
import { StatusBadge } from '@/components/data-display/Badges';
import { statusLabels, type ApiRecord } from '@/types/api';
import { getOrders, getOrder } from '@/features/operations/operations.api';
import {
  MobileSearchBar,
  MobileFilterSheet,
  MobileDetailSheet,
  MobileEmptyState,
  MobileSortDropdown,
} from '@/features/mobile-common';
import './mobile-orders.css';

const salesChannelLabels: Record<string, string> = {
  salon: 'Tại salon',
  online: 'Bán online',
  phone: 'Qua điện thoại',
};

const datePresets = COMMON_DATE_PRESETS;

export function MobileOrdersView() {
  const navigate = useNavigate();

  // Search & Navigation
  const [search, setSearch] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  // Filters
  const [datePreset, setDatePreset] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [channelFilter, setChannelFilter] = useState<string>('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('');

  // Draft filters for bottom sheet
  const [draftDatePreset, setDraftDatePreset] = useState<string>('all');
  const [draftStatus, setDraftStatus] = useState<string>('');
  const [draftChannel, setDraftChannel] = useState<string>('');
  const [draftPaymentMethod, setDraftPaymentMethod] = useState<string>('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Sorting
  const [sortValue, setSortValue] = useState<string>('date_desc');

  const sortOptions = [
    { value: 'date_desc', label: 'Thời gian: Mới nhất' },
    { value: 'date_asc', label: 'Thời gian: Cũ nhất' },
    { value: 'total_desc', label: 'Giá trị: Cao → thấp' },
    { value: 'total_asc', label: 'Giá trị: Thấp → cao' },
    { value: 'code_asc', label: 'Mã đơn: A → Z' },
    { value: 'code_desc', label: 'Mã đơn: Z → A' },
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
      d7.setDate(d7.getDate() - 7);
      return { dateFrom: toIsoDate(d7), dateTo: todayString };
    }
    if (datePreset === 'this_month') {
      return { dateFrom: monthStartIso(), dateTo: todayString };
    }
    return { dateFrom: undefined, dateTo: undefined };
  }, [datePreset]);

  // Fetch Orders
  const { data: ordersData, isLoading } = useQuery({
    queryKey: [
      'mobile-orders',
      search,
      statusFilter,
      channelFilter,
      paymentMethodFilter,
      dateParams.dateFrom,
      dateParams.dateTo,
    ],
    queryFn: () =>
      getOrders({
        search,
        status: statusFilter,
        salesChannel: channelFilter,
        paymentMethod: paymentMethodFilter,
        dateFrom: dateParams.dateFrom,
        dateTo: dateParams.dateTo,
        pageSize: 100,
      }),
  });

  const rawRows = (ordersData?.data ?? []) as ApiRecord[];

  // Client-side search filter for instant responsiveness
  const filteredRows = useMemo(() => {
    if (!search.trim()) return rawRows;
    const q = search.toLowerCase().trim();
    return rawRows.filter((r) => {
      const code = String(r.code || '').toLowerCase();
      const custName = String(r.customer?.name || r.customerName || '').toLowerCase();
      const custPhone = String(r.customer?.phone || r.customerPhone || '').toLowerCase();
      const staffName = String(r.staff?.name || r.staffName || '').toLowerCase();
      return (
        code.includes(q) ||
        custName.includes(q) ||
        custPhone.includes(q) ||
        staffName.includes(q)
      );
    });
  }, [rawRows, search]);

  // Fetch Order Detail
  const { data: detailData, isLoading: isDetailLoading } = useQuery({
    queryKey: ['mobile-order-detail', selectedOrderId],
    queryFn: () => (selectedOrderId ? getOrder(selectedOrderId) : null),
    enabled: selectedOrderId !== null,
  });

  const activeOrder = detailData?.data as ApiRecord | undefined;

  // Filter and Sort Rows
  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      if (sortValue === 'date_desc') {
        const tA = a.issuedAt || a.createdAt ? new Date(a.issuedAt || a.createdAt).getTime() : 0;
        const tB = b.issuedAt || b.createdAt ? new Date(b.issuedAt || b.createdAt).getTime() : 0;
        return tB - tA;
      }
      if (sortValue === 'date_asc') {
        const tA = a.issuedAt || a.createdAt ? new Date(a.issuedAt || a.createdAt).getTime() : 0;
        const tB = b.issuedAt || b.createdAt ? new Date(b.issuedAt || b.createdAt).getTime() : 0;
        return tA - tB;
      }
      if (sortValue === 'total_desc') {
        return Number(b.total || 0) - Number(a.total || 0);
      }
      if (sortValue === 'total_asc') {
        return Number(a.total || 0) - Number(b.total || 0);
      }
      if (sortValue === 'code_asc') {
        return String(a.code || '').localeCompare(String(b.code || ''));
      }
      if (sortValue === 'code_desc') {
        return String(b.code || '').localeCompare(String(a.code || ''));
      }
      return 0;
    });
  }, [filteredRows, sortValue]);

  // Group orders by date (e.g. YYYY-MM-DD)
  const groupedSections = useMemo(() => {
    const map = new Map<string, ApiRecord[]>();

    sortedRows.forEach((row) => {
      const rawDate = row.issuedAt || row.createdAt || todayIso();
      const dateKey = toIsoDate(new Date(rawDate));
      const list = map.get(dateKey) || [];
      list.push(row);
      map.set(dateKey, list);
    });

    return Array.from(map.entries());
  }, [sortedRows]);

  // Total Revenue calculation
  const totalRevenueSum = useMemo(() => {
    return filteredRows.reduce((sum, r) => {
      if (r.status === 'cancelled') return sum;
      return sum + Number(r.total || 0);
    }, 0);
  }, [filteredRows]);

  const openFilterSheet = () => {
    setDraftDatePreset(datePreset);
    setDraftStatus(statusFilter);
    setDraftChannel(channelFilter);
    setDraftPaymentMethod(paymentMethodFilter);
    setIsFilterOpen(true);
  };

  const handleApplyFilter = () => {
    setDatePreset(draftDatePreset);
    setStatusFilter(draftStatus);
    setChannelFilter(draftChannel);
    setPaymentMethodFilter(draftPaymentMethod);
    setIsFilterOpen(false);
  };

  const handleResetFilter = () => {
    setDraftDatePreset('all');
    setDraftStatus('');
    setDraftChannel('');
    setDraftPaymentMethod('');
    setDatePreset('all');
    setStatusFilter('');
    setChannelFilter('');
    setPaymentMethodFilter('');
    setIsFilterOpen(false);
  };

  const getDatePresetLabel = (val: string) => {
    const found = datePresets.find((p) => p.value === val);
    return found ? found.label : 'Tất cả ngày';
  };

  return (
    <div className="mobile-orders-view">
      {/* Sticky Top Cluster */}
      <div className="mobile-orders-sticky-header-cluster">
        {/* 1. Header Toolbar */}
        <div className="mobile-orders-top-nav">
          <div className="mobile-orders-nav-left">
            <button
              type="button"
              className="mobile-orders-back-icon"
              onClick={() => navigate('/m/more')}
              aria-label="Quay lại"
            >
              <i className="ph ph-caret-left" />
            </button>
            <h1 className="mobile-orders-nav-title">Đơn hàng</h1>
          </div>

          <div className="mobile-orders-nav-actions">
            <button
              type="button"
              className={`mobile-orders-nav-btn ${isSearchVisible ? 'is-active' : ''}`}
              onClick={() => setIsSearchVisible((prev) => !prev)}
              aria-label="Tìm kiếm"
            >
              <i className="ph ph-magnifying-glass" />
            </button>
          </div>
        </div>

        {/* Inline Search Bar */}
        {isSearchVisible && (
          <div className="mobile-orders-search-bar-wrap">
            <MobileSearchBar
              value={search}
              placeholder="Tìm theo mã đơn, khách hàng, số điện thoại..."
              onChange={setSearch}
            />
          </div>
        )}

        {/* 2. Filter Strip */}
        <div className="mobile-orders-filter-strip">
          <button
            type="button"
            className="mobile-orders-filter-icon-btn"
            onClick={openFilterSheet}
            aria-label="Mở bộ lọc"
          >
            <i className="ph ph-faders" />
          </button>

          {/* Date Preset Chip */}
          <button
            type="button"
            className={`mobile-orders-filter-chip ${datePreset !== 'all' ? 'is-active' : ''}`}
            onClick={openFilterSheet}
          >
            <span>Khoảng ngày: {getDatePresetLabel(datePreset)}</span>
            <i className="ph ph-caret-down" />
          </button>

          {/* Status Filter Chip */}
          <button
            type="button"
            className={`mobile-orders-filter-chip ${statusFilter ? 'is-active' : ''}`}
            onClick={openFilterSheet}
          >
            <span>Trạng thái: {statusLabels[statusFilter] || 'Tất cả'}</span>
            <i className="ph ph-caret-down" />
          </button>

          {/* Sales Channel Filter Chip */}
          <button
            type="button"
            className={`mobile-orders-filter-chip ${channelFilter ? 'is-active' : ''}`}
            onClick={openFilterSheet}
          >
            <span>Kênh bán: {salesChannelLabels[channelFilter] || 'Tất cả'}</span>
            <i className="ph ph-caret-down" />
          </button>
        </div>

        {/* 3. Summary & Sort Dropdown Bar */}
        <div className="mobile-orders-summary-bar">
          <MobileSortDropdown
            value={sortValue}
            options={sortOptions}
            onChange={setSortValue}
          />

          <div className="mobile-orders-count-summary">
            {rawRows.length} đơn hàng · Doanh thu: {formatMoney(totalRevenueSum)}
          </div>
        </div>
      </div>

      {/* 4. Grouped Section List */}
      <div className="mobile-orders-sections-wrapper">
        {isLoading ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b' }}>
            Đang tải danh sách đơn hàng...
          </div>
        ) : rawRows.length === 0 ? (
          <div style={{ padding: '24px 16px' }}>
            <MobileEmptyState
              title="Không tìm thấy đơn hàng nào"
              description="Thử tìm kiếm với từ khóa khác hoặc thay đổi bộ lọc."
            />
          </div>
        ) : (
          groupedSections.map(([dateKey, items]) => (
            <div key={dateKey} className="mobile-orders-section">
              <div className="mobile-orders-section-title">
                {formatDayHeader(dateKey)} ({items.length})
              </div>
              <div className="mobile-orders-section-card">
                {items.map((order) => {
                  const custName = order.customer?.name || order.customerName || 'Khách lẻ';
                  const custPhone = order.customer?.phone || order.customerPhone || '';
                  const rawTime = order.issuedAt || order.createdAt;
                  const orderTime = rawTime ? new Date(rawTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--';
                  const isPaid = order.status === 'paid';

                  return (
                    <div
                      key={order.id}
                      className="mobile-orders-row-item"
                      onClick={() => setSelectedOrderId(order.id)}
                      role="button"
                      tabIndex={0}
                    >
                      {/* Square Rounded Avatar */}
                      <div className={`mobile-orders-square-avatar ${isPaid ? 'is-paid' : ''}`}>
                        <i className="ph ph-receipt" />
                      </div>

                      {/* Order Core Info */}
                      <div className="mobile-orders-row-info">
                        <div className="mobile-orders-row-top-line">
                          <span className="mobile-orders-code-text">{order.code}</span>
                          <span className="mobile-orders-time-text">{orderTime}</span>
                        </div>

                        <div className="mobile-orders-cust-line">
                          <span className="mobile-orders-cust-name">{custName}</span>
                          {custPhone && (
                            <a
                              href={`tel:${custPhone}`}
                              className="mobile-orders-phone-link"
                              onClick={(e) => e.stopPropagation()}
                            >
                              • {custPhone}
                            </a>
                          )}
                        </div>

                        <div className="mobile-orders-meta-line">
                          <span>
                            <i className="ph ph-user" /> {order.staff?.name || order.staffName || 'Thu ngân'}
                          </span>
                          <span>• {salesChannelLabels[order.salesChannel] || 'Tại salon'}</span>
                        </div>
                      </div>

                      {/* Right: Total Amount & Status Badge */}
                      <div className="mobile-orders-row-right">
                        <div className="mobile-orders-total-amount">
                          {formatMoney(order.total || 0)}
                        </div>
                        <div className="mobile-orders-status-badge-wrap">
                          <StatusBadge status={order.status} />
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

      {/* 5. Floating Action Button (FAB) */}
      <Link
        to="/m/invoices/new"
        className="mobile-orders-fab-btn"
        aria-label="Tạo hóa đơn mới"
        title="Tạo hóa đơn"
      >
        <i className="ph ph-plus" />
      </Link>

      {/* Filter Bottom Sheet */}
      <MobileFilterSheet
        isOpen={isFilterOpen}
        title="Bộ lọc đơn hàng"
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
          <label className="mobile-filter-field-label">Trạng thái đơn hàng</label>
          <select
            className="mobile-filter-select"
            value={draftStatus}
            onChange={(e) => setDraftStatus(e.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="paid">Đã thanh toán</option>
            <option value="draft">Đơn nháp</option>
            <option value="refunded">Đã hoàn tiền</option>
            <option value="cancelled">Đã hủy</option>
          </select>
        </div>

        <div className="mobile-filter-field">
          <label className="mobile-filter-field-label">Kênh bán hàng</label>
          <select
            className="mobile-filter-select"
            value={draftChannel}
            onChange={(e) => setDraftChannel(e.target.value)}
          >
            <option value="">Tất cả kênh bán</option>
            <option value="salon">Tại salon</option>
            <option value="online">Bán online</option>
            <option value="phone">Qua điện thoại</option>
          </select>
        </div>

        <div className="mobile-filter-field">
          <label className="mobile-filter-field-label">Hình thức thanh toán</label>
          <select
            className="mobile-filter-select"
            value={draftPaymentMethod}
            onChange={(e) => setDraftPaymentMethod(e.target.value)}
          >
            <option value="">Tất cả phương thức</option>
            <option value="cash">Tiền mặt</option>
            <option value="bank_transfer">Chuyển khoản</option>
            <option value="card">Thẻ</option>
            <option value="wallet">Ví điện tử</option>
          </select>
        </div>
      </MobileFilterSheet>

      {/* 6. Inset Detail View Bottom Sheet */}
      <MobileDetailSheet
        isOpen={selectedOrderId !== null}
        title="Chi tiết đơn hàng"
        onClose={() => setSelectedOrderId(null)}
      >
        {isDetailLoading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
            Đang tải thông tin đơn hàng...
          </div>
        ) : activeOrder ? (
          <div className="mobile-orders-detail-wrapper">
            {/* Header Card */}
            <div className="mobile-orders-detail-card">
              <div className="mobile-orders-detail-header-row">
                <h2 className="mobile-orders-detail-code">{activeOrder.code}</h2>
                <div className="mobile-orders-detail-status-pill">
                  <StatusBadge status={activeOrder.status} />
                </div>
              </div>

              {/* Customer Avatar & Phone */}
              <div className="mobile-orders-detail-cust-row">
                <div className="mobile-orders-detail-avatar">
                  <i className="ph-fill ph-user" />
                </div>
                <div className="mobile-orders-detail-cust-info">
                  <span className="mobile-orders-detail-cust-name">
                    {activeOrder.customer?.name || activeOrder.customerName || 'Khách lẻ'}
                  </span>
                  <span className="mobile-orders-detail-cust-phone">
                    {activeOrder.customer?.phone || activeOrder.customerPhone ? (
                      <a
                        href={`tel:${activeOrder.customer?.phone || activeOrder.customerPhone}`}
                        style={{ color: '#0062eb', textDecoration: 'none' }}
                      >
                        <i className="ph ph-phone" /> {activeOrder.customer?.phone || activeOrder.customerPhone}
                      </a>
                    ) : (
                      'Chưa có số điện thoại'
                    )}
                  </span>
                </div>
              </div>

              {/* Lưới 2x2: Kênh bán, Chi nhánh, Thời gian tạo, Thu ngân/Thợ */}
              <div className="mobile-orders-grid-2col">
                <div className="mobile-orders-grid-cell">
                  <span className="mobile-orders-grid-lbl">Kênh bán</span>
                  <span className="mobile-orders-grid-val">
                    {salesChannelLabels[activeOrder.salesChannel] || 'Tại salon'}
                  </span>
                </div>

                <div className="mobile-orders-grid-cell">
                  <span className="mobile-orders-grid-lbl">Chi nhánh</span>
                  <span className="mobile-orders-grid-val">
                    {activeOrder.branchName || 'Chi nhánh trung tâm'}
                  </span>
                </div>

                <div className="mobile-orders-grid-cell">
                  <span className="mobile-orders-grid-lbl">Thời gian tạo</span>
                  <span className="mobile-orders-grid-val">
                    {formatDateTime(activeOrder.issuedAt || activeOrder.createdAt)}
                  </span>
                </div>

                <div className="mobile-orders-grid-cell">
                  <span className="mobile-orders-grid-lbl">Thu ngân / Thợ</span>
                  <span className="mobile-orders-grid-val">
                    {activeOrder.staff?.name || activeOrder.staffName || 'Thu ngân'}
                  </span>
                </div>
              </div>
            </div>

            {/* Danh sách dịch vụ & sản phẩm card */}
            <div className="mobile-orders-detail-card">
              <div className="mobile-orders-card-section-title">
                DANH SÁCH DỊCH VỤ & SẢN PHẨM ({(activeOrder.items || []).length})
              </div>

              {(!activeOrder.items || activeOrder.items.length === 0) ? (
                <div style={{ fontSize: '13.5px', color: '#64748b', padding: '8px 0' }}>
                  Không có sản phẩm hoặc dịch vụ nào trong đơn hàng.
                </div>
              ) : (
                <div className="mobile-orders-items-table">
                  {activeOrder.items.map((item: ApiRecord, idx: number) => {
                    const itemName = item.name || item.description || `Mặt hàng #${idx + 1}`;
                    const lineTotal = item.lineTotal || (Number(item.quantity || 1) * Number(item.unitPrice || 0) - Number(item.discount || 0));

                    return (
                      <div key={item.id || idx} className="mobile-orders-item-row">
                        <div className="mobile-orders-item-left">
                          <span className="mobile-orders-item-name">{itemName}</span>
                          <span className="mobile-orders-item-calc">
                            {formatNumber(item.quantity)} {item.unit || ''} x {formatMoney(item.unitPrice)}
                            {Number(item.discount) > 0 && (
                              <span style={{ color: '#e11d48', marginLeft: '4px' }}>
                                (Giảm {formatMoney(item.discount)})
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="mobile-orders-item-total">
                          {formatMoney(lineTotal)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Chi tiết thanh toán card */}
            <div className="mobile-orders-detail-card">
              <div className="mobile-orders-card-section-title">CHI TIẾT THANH TOÁN</div>

              <div className="mobile-orders-payment-breakdown">
                <div className="mobile-orders-summary-line">
                  <span>Tổng tiền hàng:</span>
                  <span>{formatMoney(activeOrder.subtotal || activeOrder.total)}</span>
                </div>

                {Number(activeOrder.discount) > 0 && (
                  <div className="mobile-orders-summary-line is-discount">
                    <span>Giảm giá:</span>
                    <span>-{formatMoney(activeOrder.discount)}</span>
                  </div>
                )}

                <div className="mobile-orders-summary-line is-grand-total">
                  <span>Tổng thanh toán:</span>
                  <strong>{formatMoney(activeOrder.total)}</strong>
                </div>

                <div className="mobile-orders-summary-line">
                  <span>Khách đã trả:</span>
                  <span style={{ color: '#10b981', fontWeight: 650 }}>
                    {formatMoney(activeOrder.paidAmount ?? activeOrder.total)}
                  </span>
                </div>

                <div className="mobile-orders-summary-line">
                  <span>Hình thức thanh toán:</span>
                  <span>{statusLabels[activeOrder.paymentMethod] || activeOrder.paymentMethod || 'Tiền mặt'}</span>
                </div>

                {Number(activeOrder.debtAmount) > 0 ? (
                  <div className="mobile-orders-summary-line" style={{ color: '#e11d48', fontWeight: 650 }}>
                    <span>Còn nợ:</span>
                    <span>{formatMoney(activeOrder.debtAmount)}</span>
                  </div>
                ) : Number(activeOrder.changeAmount) > 0 ? (
                  <div className="mobile-orders-summary-line">
                    <span>Tiền thừa trả khách:</span>
                    <span>{formatMoney(activeOrder.changeAmount)}</span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Actions Card: In hóa đơn & Xem chi tiết */}
            <div className="mobile-orders-detail-card">
              <div className="mobile-orders-actions-row">
                <button
                  type="button"
                  className="mobile-orders-action-print-btn"
                  onClick={() => alert(`Đang chuẩn bị in hóa đơn ${activeOrder.code}`)}
                >
                  <i className="ph ph-printer" /> In hóa đơn
                </button>
                <button
                  type="button"
                  className="mobile-orders-action-detail-btn"
                  onClick={() => alert(`Xem chi tiết đầy đủ đơn hàng ${activeOrder.code}`)}
                >
                  Xem chi tiết
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </MobileDetailSheet>
    </div>
  );
}
