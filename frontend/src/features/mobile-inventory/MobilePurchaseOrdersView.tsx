import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { StatusBadge } from '@/components/data-display/Badges';
import { monthStartIso, todayIso } from '@/lib/date';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { statusLabels, type ApiRecord } from '@/types/api';
import { getPurchaseOrders, getPurchaseOrder } from '@/features/inventory/inventory.api';
import {
  MobileSearchBar,
  MobileFilterSheet,
  MobileMetricCards,
  MobileCard,
  MobileDetailSheet,
  MobileEmptyState,
} from '@/features/mobile-common';
import './mobile-inventory.css';

export function MobilePurchaseOrdersView() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState(monthStartIso());
  const [dateTo, setDateTo] = useState(todayIso());

  // Draft filters for filter sheet
  const [draftStatus, setDraftStatus] = useState('');
  const [draftDateFrom, setDraftDateFrom] = useState(monthStartIso());
  const [draftDateTo, setDraftDateTo] = useState(todayIso());
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  const activeFilterCount =
    (statusFilter ? 1 : 0) +
    (dateFrom !== monthStartIso() || dateTo !== todayIso() ? 1 : 0);

  const { data: purchaseOrdersData, isLoading } = useQuery({
    queryKey: ['mobile-purchase-orders', search, statusFilter, dateFrom, dateTo],
    queryFn: () =>
      getPurchaseOrders({
        search,
        status: statusFilter,
        dateFrom,
        dateTo,
        pageSize: 50,
      }),
  });

  const { data: orderDetailData, isLoading: isDetailLoading } = useQuery({
    queryKey: ['mobile-purchase-order-detail', selectedOrderId],
    queryFn: () => (selectedOrderId ? getPurchaseOrder(selectedOrderId) : null),
    enabled: selectedOrderId !== null,
  });

  const rows = (purchaseOrdersData?.data ?? []) as ApiRecord[];
  const summary = purchaseOrdersData?.meta?.summary;
  const activeOrder = orderDetailData?.data as ApiRecord | undefined;

  const handleApplyFilter = () => {
    setStatusFilter(draftStatus);
    setDateFrom(draftDateFrom);
    setDateTo(draftDateTo);
    setIsFilterOpen(false);
  };

  const handleResetFilter = () => {
    setDraftStatus('');
    setDraftDateFrom(monthStartIso());
    setDraftDateTo(todayIso());
    setStatusFilter('');
    setDateFrom(monthStartIso());
    setDateTo(todayIso());
    setIsFilterOpen(false);
  };

  const openFilterSheet = () => {
    setDraftStatus(statusFilter);
    setDraftDateFrom(dateFrom);
    setDraftDateTo(dateTo);
    setIsFilterOpen(true);
  };

  return (
    <div className="mobile-inventory-view">
      {/* Header & Link to Create PO */}
      <div className="mobile-inventory-header">
        <div className="mobile-inventory-header-top">
          <h2 className="mobile-inventory-title">Nhập hàng</h2>
          <Link to="/m/purchase-orders/new" className="mobile-inventory-add-btn">
            <i className="ph ph-plus" /> Nhập hàng
          </Link>
        </div>

        {/* Metric Cards */}
        <MobileMetricCards
          items={[
            {
              label: 'Tổng phiếu',
              value: formatNumber(summary?.totalOrders ?? rows.length),
              note: 'Theo bộ lọc',
              tone: 'blue',
            },
            {
              label: 'Giá trị nhập',
              value: formatMoney(summary?.totalDue ?? rows.reduce((s, r) => s + Number(r.amountDue || 0), 0)),
              note: 'Cần trả NCC',
              tone: 'green',
            },
            {
              label: 'Còn nợ NCC',
              value: formatMoney(summary?.totalDebt ?? 0),
              note: 'Chưa thanh toán',
              tone: 'orange',
            },
            {
              label: 'Phiếu tạm',
              value: formatNumber(summary?.drafts ?? rows.filter((r) => r.status === 'draft').length),
              note: 'Cần hoàn thành',
              tone: 'violet',
            },
          ]}
        />

        {/* Search Bar with Filter Sheet */}
        <MobileSearchBar
          value={search}
          placeholder="Tìm mã phiếu hoặc nhà cung cấp..."
          onChange={setSearch}
          onFilterClick={openFilterSheet}
          activeFilterCount={activeFilterCount}
        />
      </div>

      {/* Purchase Orders List */}
      <div className="mobile-inventory-list">
        {isLoading ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-500)' }}>
            Đang tải danh sách phiếu nhập...
          </div>
        ) : rows.length === 0 ? (
          <MobileEmptyState
            title="Chưa có phiếu nhập hàng nào"
            description="Thử tìm kiếm với từ khóa khác hoặc bấm Nhập hàng để tạo phiếu mới."
          />
        ) : (
          rows.map((row) => (
            <MobileCard
              key={row.id}
              title={row.code}
              subtitle={row.supplier?.name || 'Nhà cung cấp'}
              badge={{
                text: row.status === 'completed' ? 'Đã nhập hàng' : row.status === 'draft' ? 'Phiếu tạm' : row.status,
                tone: row.status === 'completed' ? 'green' : 'orange',
              }}
              avatar={
                <div className="mobile-goods-avatar is-product">
                  <i className="ph ph-truck" />
                </div>
              }
              details={[
                {
                  label: 'Ngày nhập',
                  value: formatDateTime(row.receivedAt || row.createdAt),
                },
                {
                  label: 'Số mặt hàng',
                  value: `${formatNumber(row.itemCount || 0)} SP`,
                },
                {
                  label: 'Cần trả NCC',
                  value: (
                    <span style={{ color: 'var(--blue-600)', fontWeight: 750 }}>
                      {formatMoney(row.amountDue)}
                    </span>
                  ),
                },
                {
                  label: 'Trạng thái',
                  value: <StatusBadge status={row.status} purchase />,
                },
              ]}
              onClick={() => setSelectedOrderId(row.id)}
            />
          ))
        )}
      </div>

      {/* Filter Sheet */}
      <MobileFilterSheet
        isOpen={isFilterOpen}
        title="Bộ lọc phiếu nhập"
        onClose={() => setIsFilterOpen(false)}
        onReset={handleResetFilter}
        onApply={handleApplyFilter}
      >
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

        <div className="mobile-filter-field">
          <label className="mobile-filter-field-label">Từ ngày</label>
          <input
            type="date"
            className="mobile-filter-input"
            value={draftDateFrom}
            onChange={(e) => setDraftDateFrom(e.target.value)}
          />
        </div>

        <div className="mobile-filter-field">
          <label className="mobile-filter-field-label">Đến ngày</label>
          <input
            type="date"
            className="mobile-filter-input"
            value={draftDateTo}
            onChange={(e) => setDraftDateTo(e.target.value)}
          />
        </div>
      </MobileFilterSheet>

      {/* Detail Bottom Sheet */}
      <MobileDetailSheet
        isOpen={selectedOrderId !== null}
        title={activeOrder?.code || 'Chi tiết phiếu nhập'}
        subtitle={activeOrder?.supplier?.name}
        onClose={() => setSelectedOrderId(null)}
      >
        {isDetailLoading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-500)' }}>
            Đang tải thông tin phiếu nhập...
          </div>
        ) : activeOrder ? (
          <div className="mobile-inventory-detail-content">
            {/* Header info */}
            <div className="mobile-inventory-detail-header-card">
              <div className="mobile-goods-avatar is-product">
                <i className="ph ph-receipt" />
              </div>
              <div className="mobile-inventory-detail-main-info">
                <span className="mobile-inventory-detail-name">{activeOrder.code}</span>
                <div className="mobile-inventory-detail-tags">
                  <span className="mobile-inventory-tag is-code">
                    <i className="ph ph-buildings" /> {activeOrder.supplier?.name}
                  </span>
                  <StatusBadge status={activeOrder.status} purchase />
                </div>
              </div>
            </div>

            {/* Facts strip */}
            <div className="mobile-inventory-detail-facts-grid">
              <div className="mobile-inventory-fact-box">
                <span className="mobile-inventory-fact-label">Tổng tiền hàng</span>
                <span className="mobile-inventory-fact-val">
                  {formatMoney(activeOrder.subtotal || activeOrder.amountDue)}
                </span>
              </div>
              <div className="mobile-inventory-fact-box">
                <span className="mobile-inventory-fact-label">Cần trả NCC</span>
                <span className="mobile-inventory-fact-val" style={{ color: 'var(--blue-600)' }}>
                  {formatMoney(activeOrder.amountDue)}
                </span>
              </div>
              <div className="mobile-inventory-fact-box">
                <span className="mobile-inventory-fact-label">Đã trả NCC</span>
                <span className="mobile-inventory-fact-val" style={{ color: 'var(--green)' }}>
                  {formatMoney(activeOrder.amountPaid || 0)}
                </span>
              </div>
              <div className="mobile-inventory-fact-box">
                <span className="mobile-inventory-fact-label">Còn nợ NCC</span>
                <span
                  className="mobile-inventory-fact-val"
                  style={{
                    color:
                      Number(activeOrder.amountDue || 0) - Number(activeOrder.amountPaid || 0) > 0
                        ? 'var(--red)'
                        : 'var(--green)',
                  }}
                >
                  {formatMoney(
                    Math.max(
                      0,
                      Number(activeOrder.amountDue || 0) - Number(activeOrder.amountPaid || 0)
                    )
                  )}
                </span>
              </div>
            </div>

            {/* General Meta */}
            <div className="mobile-inventory-detail-card">
              <h4>Thông tin giao dịch</h4>
              <div className="mobile-inventory-info-row">
                <span className="mobile-inventory-info-label">Nhà cung cấp:</span>
                <span className="mobile-inventory-info-val">{activeOrder.supplier?.name}</span>
              </div>
              {activeOrder.supplier?.phone && (
                <div className="mobile-inventory-info-row">
                  <span className="mobile-inventory-info-label">Số điện thoại:</span>
                  <a
                    href={`tel:${activeOrder.supplier.phone}`}
                    style={{ color: 'var(--blue-600)', fontWeight: 650 }}
                  >
                    {activeOrder.supplier.phone}
                  </a>
                </div>
              )}
              <div className="mobile-inventory-info-row">
                <span className="mobile-inventory-info-label">Ngày nhập:</span>
                <span className="mobile-inventory-info-val">
                  {formatDateTime(activeOrder.receivedAt)}
                </span>
              </div>
              <div className="mobile-inventory-info-row">
                <span className="mobile-inventory-info-label">Hình thức TT:</span>
                <span className="mobile-inventory-info-val">
                  {statusLabels[activeOrder.paymentMethod] ?? activeOrder.paymentMethod}
                </span>
              </div>
              <div className="mobile-inventory-info-row">
                <span className="mobile-inventory-info-label">Người tạo:</span>
                <span className="mobile-inventory-info-val">{activeOrder.createdBy || '-'}</span>
              </div>
              {activeOrder.note && (
                <div
                  className="mobile-inventory-info-row"
                  style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}
                >
                  <span className="mobile-inventory-info-label">Ghi chú:</span>
                  <span className="mobile-inventory-info-val" style={{ textAlign: 'left' }}>
                    {activeOrder.note}
                  </span>
                </div>
              )}
            </div>

            {/* Items Breakdown */}
            <div className="mobile-inventory-detail-card">
              <h4>Danh sách mặt hàng nhập ({activeOrder.items?.length || 0})</h4>
              <div className="mobile-po-items-list">
                {(activeOrder.items || []).map((item: any, idx: number) => (
                  <div key={item.id ?? item.sku ?? idx} className="mobile-po-item">
                    <div className="mobile-po-item-top">
                      <span className="mobile-po-item-name">{item.name}</span>
                      <span className="mobile-po-item-sku">{item.sku}</span>
                    </div>
                    <div className="mobile-po-item-bottom">
                      <span className="mobile-po-item-calc">
                        {formatNumber(item.quantity)} {item.unit || 'SP'} × {formatMoney(item.unitCost)}
                      </span>
                      <strong className="mobile-po-item-total">{formatMoney(item.lineTotal)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </MobileDetailSheet>
    </div>
  );
}
