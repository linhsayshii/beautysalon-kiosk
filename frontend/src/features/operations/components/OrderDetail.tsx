import { InvoiceStatusBadge } from '@/components/data-display/Badges';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ErrorState, LoadingState } from '@/components/data-display/DataState';
import { DetailFacts, DetailHead, InlineDetail, ValueStrip } from '@/components/data-display/InlineDetail';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { appointmentStatusLabel } from '@/lib/appointment-status';
import { owedTone } from '@/lib/tone';
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

  // POS sales record the staff per line, not on the invoice itself.
  const lineStaffNames = [...new Set((order.items ?? []).map((item: { staffName?: string | null }) => item.staffName).filter(Boolean))];
  const staffName = order.staff?.name ?? (lineStaffNames.length ? lineStaffNames.join(', ') : null);

  const tabs: { value: OrderTab; label: string }[] = [
    { value: 'items', label: `Hàng hóa & Dịch vụ (${order.items?.length || 0})` },
    { value: 'info', label: 'Thông tin hóa đơn' },
    { value: 'payment', label: 'Thanh toán & Công nợ' },
  ];

  const paidLabel = order.status === 'paid'
    ? (order.paymentStatus === 'partial' ? 'Thanh toán một phần' : order.paymentStatus === 'unpaid' ? 'Chưa thanh toán' : 'Đã thanh toán đủ')
    : statusLabels[order.status] ?? order.status;

  return (
    <InlineDetail className="order-detail" label={`Chi tiết đơn hàng ${order.code}`} tabs={tabs} tab={tab} onTabChange={setTab}>
      <DetailHead
        icon="ph-receipt"
        title={order.code}
        tags={<span className="badge badge-info">{salesChannelLabels[order.salesChannel] ?? order.salesChannel}</span>}
        meta={<>Khách hàng: <strong>{order.customer?.name || 'Khách lẻ'}</strong>{order.customer?.phone && <span> ({order.customer.phone})</span>}</>}
        aside={<><div><strong>{order.branchName}</strong></div><div>{formatDateTime(order.issuedAt || order.createdAt)}</div></>}
      />

      {Number(order.serviceProgress?.total || 0) > 0 && (
        <p className="detail-section-title text-success">
          <i className="ph ph-check-circle" aria-hidden="true" />
          Tiến độ dịch vụ: {order.serviceProgress.completed}/{order.serviceProgress.total} đã xong
        </p>
      )}

      <ValueStrip
        items={[
          { label: 'Tổng tiền hàng', value: formatMoney(order.subtotal) },
          { label: 'Giảm giá', value: formatMoney(order.discount), tone: Number(order.discount) > 0 ? 'danger' : undefined },
          { label: 'Tổng thanh toán', value: formatMoney(order.total), tone: 'primary' },
          { label: 'Đã thanh toán', value: formatMoney(order.amountPaid ?? order.total), tone: 'success' },
        ]}
      />

      {tab === 'items' && (
        <>
          <div className="table-scroll">
            <table className="detail-table">
              <thead>
                <tr>
                  <th>Mã hàng</th>
                  <th>Tên hàng / Dịch vụ</th>
                  <th>Loại</th>
                  <th>Thực hiện</th>
                  <th className="is-num">Số lượng</th>
                  <th className="is-num">Đơn giá</th>
                  <th className="is-num">Giảm giá</th>
                  <th className="is-num">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {order.items?.map((item: Record<string, any>) => (
                  <tr key={item.id}>
                    <td className="is-code">{item.code}</td>
                    <td>
                      <span className="cell-main">{item.name}</span>
                      {item.description && item.description !== item.name && <span className="cell-sub">{item.description}</span>}
                    </td>
                    <td>{statusLabels[item.itemType] ?? item.itemType}</td>
                    <td>
                      {item.appointment ? (
                        <>
                          <span className="cell-main">{item.appointment.staff?.name || item.staffName || 'Chưa phân công'}</span>
                          <span className="cell-sub text-primary">{appointmentStatusLabel(item.appointment.status)}</span>
                        </>
                      ) : (item.staffName || '-')}
                    </td>
                    <td className="is-num">{formatNumber(item.quantity)} {item.unit}</td>
                    <td className="is-num">{formatMoney(item.unitPrice)}</td>
                    <td className={`is-num ${owedTone(item.discount)}`}>{formatMoney(item.discount)}</td>
                    <td className="is-num text-strong">{formatMoney(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="detail-totals">
            <span>Tổng tiền hàng: <strong>{formatMoney(order.subtotal)}</strong></span>
            <span>Giảm giá: <strong className={owedTone(order.discount) || undefined}>{formatMoney(order.discount)}</strong></span>
            <span>Tổng thanh toán: <strong className="is-grand">{formatMoney(order.total)}</strong></span>
          </div>
        </>
      )}

      {tab === 'info' && (
        <DetailFacts
          items={[
            { label: 'Mã hóa đơn', value: order.code, tone: 'primary' },
            { label: 'Khách hàng', value: `${order.customer?.name || 'Khách lẻ'}${order.customer?.phone ? ` (${order.customer.phone})` : ''}` },
            { label: 'Nhân viên thực hiện', value: staffName ?? 'Chưa xác định' },
            { label: 'Chi nhánh', value: order.branchName },
            { label: 'Thời gian tạo', value: formatDateTime(order.issuedAt ?? order.createdAt) },
            { label: 'Kênh bán hàng', value: salesChannelLabels[order.salesChannel] ?? order.salesChannel },
            { label: 'Trạng thái', value: <InvoiceStatusBadge status={order.status} paymentStatus={order.paymentStatus} /> },
            { label: 'Ghi chú', value: order.note || 'Chưa có', variant: order.note ? undefined : 'placeholder' },
          ]}
        />
      )}

      {tab === 'payment' && (
        <DetailFacts
          items={[
            { label: 'Hình thức thanh toán', value: statusLabels[order.paymentMethod] ?? order.paymentMethod, tone: 'primary' },
            { label: 'Số tiền đã thanh toán', value: formatMoney(order.amountPaid ?? order.total), tone: 'success' },
            { label: 'Công nợ ghi nhận', value: formatMoney(order.debtAmount ?? 0) },
            {
              label: 'Trạng thái thu tiền',
              value: <span className={order.status === 'paid' ? 'badge badge-success' : 'badge badge-warning'}>{paidLabel}</span>,
            },
          ]}
        />
      )}
    </InlineDetail>
  );
}
