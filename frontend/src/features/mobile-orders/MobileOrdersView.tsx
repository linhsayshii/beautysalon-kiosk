import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatMoney, formatDateTime } from '@/lib/format';
import { StatusBadge } from '@/components/data-display/Badges';
import { getOrders, getOrder } from '@/features/operations/operations.api';
import type { ApiRecord } from '@/types/api';
import './mobile-orders.css';

const statusTabs = [
  { value: '', label: 'Tất cả' },
  { value: 'paid', label: 'Đã thanh toán' },
  { value: 'draft', label: 'Đơn nháp' },
  { value: 'refunded', label: 'Đã hoàn tiền' },
];

export function MobileOrdersView() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['mobile-orders', search, statusFilter],
    queryFn: () => getOrders({
      search,
      status: statusFilter,
      pageSize: 50,
    }),
  });

  const orders = (ordersData?.data ?? []) as ApiRecord[];

  const { data: detailData, isLoading: isDetailLoading } = useQuery({
    queryKey: ['mobile-order-detail', selectedOrderId],
    queryFn: () => (selectedOrderId ? getOrder(selectedOrderId) : null),
    enabled: selectedOrderId !== null,
  });

  const activeOrder = detailData?.data as ApiRecord | undefined;

  return (
    <div className="mobile-orders-container">
      {/* Search and Status Filters */}
      <div className="mobile-orders-header">
        <div className="mobile-orders-search">
          <i className="ph ph-magnifying-glass" />
          <input
            type="text"
            placeholder="Tìm theo mã đơn, khách hàng..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="mobile-status-tabs" role="tablist">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={`mobile-status-tab ${statusFilter === tab.value ? 'active' : ''}`}
              onClick={() => setStatusFilter(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      <div className="mobile-orders-list">
        {isLoading ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: '#64748b' }}>Đang tải danh sách đơn hàng...</div>
        ) : orders.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8' }}>Không tìm thấy đơn hàng nào.</div>
        ) : (
          orders.map((order) => (
            <div
              key={order.id}
              className="mobile-order-card"
              onClick={() => setSelectedOrderId(order.id)}
            >
              <div className="order-card-top">
                <div className="order-code-group">
                  <span className="order-code">{order.code}</span>
                  <span className="order-time">{formatDateTime(order.issuedAt)}</span>
                </div>
                <StatusBadge status={order.status} />
              </div>

              <div className="order-card-middle">
                <div className="order-customer-info">
                  <strong className="order-customer-name">{order.customer?.name || order.customerName || 'Khách lẻ'}</strong>
                  <span className="order-customer-phone">{order.customer?.phone || order.customerPhone || 'Không có số điện thoại'}</span>
                </div>
                <div className="order-card-amount">
                  <div className="order-amount-value">{formatMoney(order.total)}</div>
                  <span className="order-items-count">{(order.items?.length || 1)} mặt hàng</span>
                </div>
              </div>

              <div className="order-card-footer">
                <span className="order-staff-name">
                  <i className="ph ph-user" /> {order.staff?.name || order.staffName || 'Thu ngân'}
                </span>
                <span>{order.paymentMethod === 'bank_transfer' ? 'Chuyển khoản' : order.paymentMethod === 'card' ? 'Thẻ' : 'Tiền mặt'}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bottom Sheet for Order Detail */}
      {selectedOrderId !== null && (
        <div className="order-sheet-overlay" onClick={() => setSelectedOrderId(null)}>
          <div className="order-sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="order-sheet-handle" />
            <div className="order-sheet-header">
              <h2>Chi tiết đơn hàng {activeOrder?.code || `#${selectedOrderId}`}</h2>
              <button
                type="button"
                className="modal-close-button"
                onClick={() => setSelectedOrderId(null)}
                style={{ border: 'none', background: 'transparent', fontSize: '20px', cursor: 'pointer' }}
              >
                <i className="ph ph-x" />
              </button>
            </div>

            <div className="order-sheet-body">
              {isDetailLoading ? (
                <div style={{ padding: '20px', textAlign: 'center' }}>Đang tải thông tin...</div>
              ) : activeOrder ? (
                <>
                  <div className="order-sheet-section">
                    <h3>Khách hàng</h3>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{activeOrder.customer?.name || 'Khách lẻ'}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>{activeOrder.customer?.phone || 'Chưa lưu số điện thoại'}</div>
                  </div>

                  <div className="order-sheet-section">
                    <h3>Danh sách dịch vụ / sản phẩm</h3>
                    {(activeOrder.items || []).map((item: ApiRecord, idx: number) => (
                      <div key={idx} className="order-item-row">
                        <div>
                          <div><strong>{item.name || item.description}</strong></div>
                          <small style={{ color: '#64748b' }}>{item.quantity} x {formatMoney(item.unitPrice)}</small>
                        </div>
                        <div><strong>{formatMoney(item.lineTotal || (item.quantity * item.unitPrice))}</strong></div>
                      </div>
                    ))}
                  </div>

                  <div className="order-sheet-section">
                    <div className="order-summary-row">
                      <span>Tạm tính:</span>
                      <span>{formatMoney(activeOrder.subtotal || activeOrder.total)}</span>
                    </div>
                    {Number(activeOrder.discount) > 0 && (
                      <div className="order-summary-row" style={{ color: '#16a34a' }}>
                        <span>Giảm giá:</span>
                        <span>-{formatMoney(activeOrder.discount)}</span>
                      </div>
                    )}
                    <div className="order-summary-row total">
                      <span>Tổng cộng:</span>
                      <span>{formatMoney(activeOrder.total)}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div>Không thể tải thông tin đơn hàng</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
