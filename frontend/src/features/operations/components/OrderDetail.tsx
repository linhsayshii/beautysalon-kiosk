import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { StatusBadge } from '@/components/data-display/Badges';
import { ErrorState, LoadingState } from '@/components/data-display/DataState';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { statusLabels } from '@/types/api';
import { getOrder } from '../operations.api';

const salesChannelLabels: Record<string, string> = {
  salon: 'Tại salon',
  online: 'Bán online',
  phone: 'Qua điện thoại',
};

type OrderTab = 'items' | 'info' | 'payment';

export function OrderDetail({ id }: { id: number }) {
  const [tab, setTab] = useState<OrderTab>('items');
  const query = useQuery({ queryKey: ['order', id], queryFn: () => getOrder(id) });

  if (query.isPending) return <LoadingState />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const order = query.data.data;

  const tabs: { value: OrderTab; label: string }[] = [
    { value: 'items', label: `Hàng hóa & Dịch vụ (${order.items.length})` },
    { value: 'info', label: 'Thông tin hóa đơn' },
    { value: 'payment', label: 'Thanh toán' },
  ];

  return (
    <div className="order-detail" style={{ background: '#ffffff', borderTop: '2px solid #0052cc', borderBottom: '1px solid #cbd5e1' }}>
      <div className="inline-detail-tabs" role="tablist" aria-label={`Chi tiết đơn hàng ${order.code}`}>
        {tabs.map((item) => (
          <button
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            className={tab === item.value ? 'is-active' : ''}
            key={item.value}
            onClick={() => setTab(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'items' && (
        <div style={{ padding: '16px 20px' }}>
          <div className="table-scroll" style={{ marginBottom: 16 }}>
            <table className="kiotviet-payroll-table">
              <thead>
                <tr>
                  <th>Mã hàng</th>
                  <th>Tên hàng / Dịch vụ</th>
                  <th>Loại</th>
                  <th style={{ textAlign: 'right' }}>Số lượng</th>
                  <th style={{ textAlign: 'right' }}>Đơn giá</th>
                  <th style={{ textAlign: 'right' }}>Giảm giá</th>
                  <th style={{ textAlign: 'right' }}>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item: Record<string, any>) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600, color: '#0052cc' }}>{item.code}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.name}</div>
                      {item.description && item.description !== item.name && (
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>{item.description}</div>
                      )}
                    </td>
                    <td>{statusLabels[item.itemType] ?? item.itemType}</td>
                    <td style={{ textAlign: 'right' }}>{formatNumber(item.quantity)} {item.unit}</td>
                    <td style={{ textAlign: 'right' }}>{formatMoney(item.unitPrice)}</td>
                    <td style={{ textAlign: 'right', color: '#e11d48' }}>{formatMoney(item.discount)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{formatMoney(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 24,
              paddingTop: 12,
              borderTop: '1px solid #e2e8f0',
              fontSize: 14.5,
            }}
          >
            <span>Tổng tiền hàng: <strong>{formatMoney(order.subtotal)}</strong></span>
            <span>Giảm giá: <strong style={{ color: '#e11d48' }}>{formatMoney(order.discount)}</strong></span>
            <span>Tổng thanh toán: <strong style={{ color: '#0052cc', fontSize: 16 }}>{formatMoney(order.total)}</strong></span>
          </div>
        </div>
      )}

      {tab === 'info' && (
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px 24px', fontSize: 14.5 }}>
            <div>
              <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Mã hóa đơn:</span>
              <strong style={{ color: '#0052cc' }}>{order.code}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Khách hàng:</span>
              <strong>{order.customer.name} {order.customer.phone ? `(${order.customer.phone})` : ''}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Nhân viên thực hiện:</span>
              <strong>{order.staff.name ?? 'Chưa xác định'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Chi nhánh:</span>
              <strong>{order.branchName}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Thời gian tạo:</span>
              <div>{formatDateTime(order.issuedAt ?? order.createdAt)}</div>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Kênh bán hàng:</span>
              <div>{salesChannelLabels[order.salesChannel] ?? order.salesChannel}</div>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Trạng thái:</span>
              <div><StatusBadge status={order.status} /></div>
            </div>
          </div>
        </div>
      )}

      {tab === 'payment' && (
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px 24px', fontSize: 14.5 }}>
            <div>
              <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Hình thức thanh toán:</span>
              <strong style={{ color: '#0052cc' }}>{statusLabels[order.paymentMethod] ?? order.paymentMethod}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Số tiền đã thanh toán:</span>
              <strong style={{ color: '#059669', fontSize: 16 }}>{formatMoney(order.total)}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Công nợ ghi nhận:</span>
              <strong>0đ</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
