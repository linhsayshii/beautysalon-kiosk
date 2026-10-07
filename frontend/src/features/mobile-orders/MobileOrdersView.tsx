import { Pagination } from '@/components/data-display/Pagination';
import { useFilterPagination } from '@/hooks/useFilterPagination';
import { useSearchParams } from 'react-router-dom';
import { InvoiceStatusBadge } from '@/components/data-display/Badges';
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { toIsoDate, monthStartIso, COMMON_DATE_PRESETS } from '@/lib/date';
import { Select } from '@/components/ui/Select/Select';
import { LoadingState, ErrorState } from '@/components/data-display/DataState';
import { statusLabels, type ApiRecord } from '@/types/api';
import { getOrders, getOrder } from '@/features/operations/operations.api';
import {
  MobileSearchBar,
  MobileFilterSheet,
  MobileDetailSheet,
  MobileEmptyState,
  MobileSortDropdown,
} from '@/features/mobile-common';
import { MobilePageHeader } from '@/components/ui/MobilePageHeader/MobilePageHeader';
import { APPOINTMENT_STATUS_LABELS } from '@/lib/appointment-status';
import { PAYMENT_METHOD_LABELS } from '@/lib/payment-methods';

const salesChannelLabels: Record<string, string> = {
  salon: 'Tại salon',
  online: 'Bán online',
  phone: 'Qua điện thoại',
};

const workStatusLabels = APPOINTMENT_STATUS_LABELS;

const datePresets = COMMON_DATE_PRESETS;

export function MobileOrdersView() {

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
    { value: 'date_desc', label: 'Mới nhất' },
    { value: 'date_asc', label: 'Cũ nhất' },
    { value: 'total_desc', label: 'Giá trị cao' },
    { value: 'total_asc', label: 'Giá trị thấp' },
    { value: 'code_asc', label: 'Mã A → Z' },
    { value: 'code_desc', label: 'Mã Z → A' },
  ];

  // Detail Sheet
  const [orderParams] = useSearchParams();
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(() => Number(orderParams.get('invoice')) || null);

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

  // Fetch Orders
  const [page, setPage] = useFilterPagination([search, statusFilter, channelFilter, paymentMethodFilter, dateParams.dateFrom, dateParams.dateTo, sortValue]);

  const ordersQuery = useQuery({
    queryKey: [
      'mobile-orders',
      search,
      statusFilter,
      channelFilter,
      paymentMethodFilter,
      dateParams.dateFrom,
      dateParams.dateTo,
      page, sortValue],
    queryFn: () =>
      getOrders({
        search,
        status: statusFilter,
        salesChannel: channelFilter,
        paymentMethod: paymentMethodFilter,
        dateFrom: dateParams.dateFrom,
        dateTo: dateParams.dateTo,
        pageSize: 100,
        page,
        sort: sortValue,
      }),
  });

  const rawRows = (ordersQuery.data?.data ?? []) as ApiRecord[];

  // Fetch Order Detail
  const { data: detailData, isLoading: isDetailLoading, error: detailError, refetch: refetchDetail } = useQuery({
    queryKey: ['mobile-order-detail', selectedOrderId],
    queryFn: () => (selectedOrderId ? getOrder(selectedOrderId) : null),
    enabled: selectedOrderId !== null,
  });

  const activeOrder = detailData?.data as ApiRecord | undefined;


  // Total Revenue calculation
  const totalRevenueSum = ordersQuery.data?.meta?.summary?.paidRevenue;

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
    <div className="m-page">
      <MobilePageHeader
        title="Đơn hàng" backTo="/m/more"
        actions={(
          <>
            <button
              type="button"
              className={`btn btn-ghost btn-icon m-header-action${isSearchVisible ? ' is-active' : ''}`}
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
            placeholder="Tìm theo mã đơn, khách hàng, số điện thoại..."
            onChange={setSearch}
            autoFocus
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
            className={`chip ${datePreset !== 'all' ? 'is-active' : ''}`}
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
            <span>Trạng thái: {statusLabels[statusFilter] || 'Tất cả'}</span>
            <i className="ph ph-caret-down" />
          </button>

          {/* Sales Channel Filter Chip */}
          <button
            type="button"
            className={`chip ${channelFilter ? 'is-active' : ''}`}
            onClick={openFilterSheet}
          >
            <span>Kênh bán: {salesChannelLabels[channelFilter] || 'Tất cả'}</span>
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
            {ordersQuery.data?.meta?.pagination?.total ?? rawRows.length} đơn · Doanh thu <strong>{totalRevenueSum === undefined ? '—' : formatMoney(totalRevenueSum)}</strong>
          </div>
        </div>
      </MobilePageHeader>

      {/* Server order is retained across the complete list. */}
      <div className="m-body">
        {ordersQuery.isPending ? (
          <LoadingState compact />
        ) : ordersQuery.error ? (
          <ErrorState compact error={ordersQuery.error} onRetry={() => ordersQuery.refetch()} />
        ) : rawRows.length === 0 ? (
          <MobileEmptyState
              title="Không tìm thấy đơn hàng nào"
              description={search ? 'Thử từ khóa khác hoặc đổi bộ lọc.' : undefined}
            />
        ) : (
          <div className="m-list">
                {rawRows.map((order) => {
                  const custName = order.customer?.name || order.customerName || 'Khách lẻ';
                  const rawTime = order.issuedAt || order.createdAt;
                  const orderTime = rawTime ? formatDateTime(rawTime) : 'Chưa ghi nhận thời gian';
                  const isPaid = order.status === 'paid' && (!order.paymentStatus || order.paymentStatus === 'paid');

                  return (
                    <button key={order.id} type="button" className="m-list-row" onClick={() => setSelectedOrderId(order.id)}>
                      <span className={`m-list-avatar ${isPaid ? 'is-paid' : ''}`}><i className="ph ph-receipt" /></span>
                      <span className="m-list-copy">
                        <strong>{custName}</strong>
                        <small>{order.code} · {orderTime}</small>
                        <small>{order.staff?.name || order.staffName || 'Thu ngân'} · {salesChannelLabels[order.salesChannel] || 'Tại salon'}</small>
                      </span>
                      <span className="m-list-value">
                        {formatMoney(order.total || 0)}
                        <InvoiceStatusBadge status={order.status} paymentStatus={order.paymentStatus} />
                      </span>
                    </button>
                  );
                })}
          </div>
        )}
      </div>

      {(ordersQuery.data?.meta?.pagination?.totalPages ?? 1) > 1 && <Pagination pagination={ordersQuery.data?.meta?.pagination} onChange={setPage} />}

      {/* 5. Floating Action Button (FAB) */}
      <Link
        to="/m/invoices/new"
        className="m-fab"
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
          <label htmlFor="mobile-orders-date-filter" className="mobile-filter-field-label">Khoảng thời gian</label>
          <Select
            id="mobile-orders-date-filter"
            triggerClassName="mobile-filter-select"
            variant="filter"
            fullWidth
            value={draftDatePreset}
            onChange={setDraftDatePreset}
            options={datePresets}
          />
        </div>

        <div className="mobile-filter-field">
          <label htmlFor="mobile-orders-status-filter" className="mobile-filter-field-label">Trạng thái đơn hàng</label>
          <Select
            id="mobile-orders-status-filter"
            triggerClassName="mobile-filter-select"
            variant="filter"
            fullWidth
            value={draftStatus}
            onChange={setDraftStatus}
            options={[
              { value: '', label: 'Tất cả trạng thái' },
              { value: 'paid', label: 'Đã chốt hóa đơn' },
              { value: 'draft', label: 'Đơn nháp' },
              { value: 'refunded', label: 'Đã hoàn tiền' },
              { value: 'cancelled', label: 'Đã hủy' },
            ]}
          />
        </div>

        <div className="mobile-filter-field">
          <label htmlFor="mobile-orders-channel-filter" className="mobile-filter-field-label">Kênh bán hàng</label>
          <Select
            id="mobile-orders-channel-filter"
            triggerClassName="mobile-filter-select"
            variant="filter"
            fullWidth
            value={draftChannel}
            onChange={setDraftChannel}
            options={[
              { value: '', label: 'Tất cả kênh bán' },
              { value: 'salon', label: 'Tại salon' },
              { value: 'online', label: 'Bán online' },
              { value: 'phone', label: 'Qua điện thoại' },
            ]}
          />
        </div>

        <div className="mobile-filter-field">
          <label htmlFor="mobile-orders-payment-filter" className="mobile-filter-field-label">Hình thức thanh toán</label>
          <Select
            id="mobile-orders-payment-filter"
            triggerClassName="mobile-filter-select"
            variant="filter"
            fullWidth
            value={draftPaymentMethod}
            onChange={setDraftPaymentMethod}
            options={[
              { value: '', label: 'Tất cả phương thức' },
              ...(['cash', 'bank_transfer', 'card', 'wallet'] as const).map((value) => ({ value, label: PAYMENT_METHOD_LABELS[value] })),
            ]}
          />
        </div>
      </MobileFilterSheet>

      {/* 6. Inset Detail View Bottom Sheet */}
      <MobileDetailSheet
        isOpen={selectedOrderId !== null}
        title="Chi tiết đơn hàng"
        onClose={() => setSelectedOrderId(null)}
      >
        {detailError ? <ErrorState error={detailError} onRetry={() => refetchDetail()} /> : isDetailLoading ? (
          <LoadingState compact label="Đang tải thông tin đơn hàng..." />
        ) : activeOrder ? (
          <div className="mobile-orders-detail-wrapper">
            {/* Header Card */}
            <div className="mobile-orders-detail-card">
              <div className="mobile-orders-detail-header-row">
                <h2 className="mobile-orders-detail-code">{activeOrder.code}</h2>
                <div className="mobile-orders-detail-status-pill">
                  <InvoiceStatusBadge status={activeOrder.status} paymentStatus={activeOrder.paymentStatus} />
                </div>
              </div>
              {Number(activeOrder.serviceProgress?.total || 0) > 0 && (
                <div className="mobile-orders-service-progress">
                  {activeOrder.serviceProgress.completed}/{activeOrder.serviceProgress.total} dịch vụ đã xong
                </div>
              )}

              {/* Customer Avatar & Phone */}
              <div className="mobile-orders-detail-cust-row">
                <div className="mobile-orders-detail-avatar">
                  <i className="ph ph-user" />
                </div>
                <div className="mobile-orders-detail-cust-info">
                  <span className="mobile-orders-detail-cust-name">
                    {activeOrder.customer?.name || activeOrder.customerName || 'Khách lẻ'}
                  </span>
                  <span className="mobile-orders-detail-cust-phone">
                    {activeOrder.customer?.phone || activeOrder.customerPhone ? (
                      <a
                        href={`tel:${activeOrder.customer?.phone || activeOrder.customerPhone}`}
                        className="text-primary"
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
                <p className="m-note">
                  Không có sản phẩm hoặc dịch vụ nào trong đơn hàng.
                </p>
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
                              <span className="text-danger">
                                (Giảm {formatMoney(item.discount)})
                              </span>
                            )}
                          </span>
                          {item.appointment && (
                            <span className="mobile-orders-item-work-state">
                              <i className="ph ph-user" /> {item.appointment.staff?.name || item.staffName || 'Chưa phân công'}
                              <span>{workStatusLabels[item.appointment.status] || item.appointment.status}</span>
                            </span>
                          )}
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
                  <span className="text-strong text-success">
                    {formatMoney(activeOrder.paidAmount ?? activeOrder.total)}
                  </span>
                </div>

                <div className="mobile-orders-summary-line">
                  <span>Hình thức thanh toán:</span>
                  <span>{statusLabels[activeOrder.paymentMethod] || activeOrder.paymentMethod || 'Tiền mặt'}</span>
                </div>

                {Number(activeOrder.debtAmount) > 0 ? (
                  <div className="mobile-orders-summary-line text-strong text-danger">
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
                  className="btn btn-secondary"
                  onClick={() => window.print()}
                >
                  <i className="ph ph-printer" /> In hóa đơn
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </MobileDetailSheet>
    </div>
  );
}
