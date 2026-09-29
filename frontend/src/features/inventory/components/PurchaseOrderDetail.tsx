import { useQuery } from '@tanstack/react-query';
import { StatusBadge } from '@/components/data-display/Badges';
import { ErrorState, LoadingState } from '@/components/data-display/DataState';
import { DetailFacts, DetailHead, InlineDetail } from '@/components/data-display/InlineDetail';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { owedTone } from '@/lib/tone';
import { statusLabels } from '@/types/api';
import { getPurchaseOrder } from '../inventory.api';

export function PurchaseOrderDetail({ id }: { id: number }) {
  const query = useQuery({ queryKey: ['purchase-order', id], queryFn: () => getPurchaseOrder(id) });
  if (query.isPending) return <LoadingState />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const order = query.data.data;
  return (
    <InlineDetail className="purchase-detail" label={`Chi tiết phiếu nhập ${order.code}`}>
      <DetailHead
        icon="ph-truck"
        title={order.code}
        tags={<StatusBadge status={order.status} purchase />}
        meta={<>{order.supplier.name}{order.createdBy ? ` · Người tạo: ${order.createdBy}` : ''}</>}
      />
      <DetailFacts
        items={[
          { label: 'Nhà cung cấp', value: order.supplier.name },
          { label: 'Ngày nhập', value: formatDateTime(order.receivedAt) },
          { label: 'Thanh toán', value: statusLabels[order.paymentMethod] ?? order.paymentMethod },
          { label: 'Ghi chú', value: order.note || 'Chưa có', variant: order.note ? undefined : 'placeholder' },
        ]}
      />
      <div className="table-scroll">
        <table className="detail-table">
          <thead>
            <tr>
              <th>Mã hàng</th>
              <th>Tên hàng</th>
              <th className="is-num">Số lượng</th>
              <th className="is-num">Đơn giá</th>
              <th className="is-num">Giảm giá</th>
              <th className="is-num">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item: Record<string, any>) => (
              <tr key={item.id ?? item.sku}>
                <td className="is-code">{item.sku}</td>
                <td className="text-strong">{item.name}</td>
                <td className="is-num">{formatNumber(item.quantity)} {item.unit}</td>
                <td className="is-num">{formatMoney(item.unitCost)}</td>
                <td className={`is-num ${owedTone(item.discount)}`}>{formatMoney(item.discount)}</td>
                <td className="is-num text-strong">{formatMoney(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="detail-totals">
        <span>Tổng số mặt hàng: <strong>{order.items.length}</strong></span>
        <span>Tổng tiền hàng: <strong>{formatMoney(order.subtotal)}</strong></span>
        <span>Cần trả NCC: <strong className="is-grand">{formatMoney(order.amountDue)}</strong></span>
        <span>Đã trả NCC: <strong className="text-success">{formatMoney(order.amountPaid)}</strong></span>
      </div>
    </InlineDetail>
  );
}
