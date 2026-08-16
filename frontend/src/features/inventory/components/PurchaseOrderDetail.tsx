import { useQuery } from '@tanstack/react-query';
import { StatusBadge } from '@/components/data-display/Badges';
import { ErrorState, LoadingState } from '@/components/data-display/DataState';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { statusLabels } from '@/types/api';
import { getPurchaseOrder } from '../inventory.api';

export function PurchaseOrderDetail({ id }: { id: number }) {
  const query = useQuery({ queryKey: ['purchase-order', id], queryFn: () => getPurchaseOrder(id) });
  if (query.isPending) return <LoadingState />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const order = query.data.data;
  return <div className="purchase-detail"><div className="purchase-detail-head"><div><strong>{order.code}</strong><StatusBadge status={order.status} purchase /></div><span>{order.supplier.name} · {order.createdBy ?? '-'}</span></div><div className="purchase-detail-facts"><div><span>Nhà cung cấp</span><strong>{order.supplier.name}</strong></div><div><span>Ngày nhập</span><strong>{formatDateTime(order.receivedAt)}</strong></div><div><span>Thanh toán</span><strong>{statusLabels[order.paymentMethod] ?? order.paymentMethod}</strong></div><div><span>Ghi chú</span><strong>{order.note || 'Chưa có'}</strong></div></div><div className="table-scroll"><table className="data-table compact-detail-table"><thead><tr><th>Mã hàng</th><th>Tên hàng</th><th>Số lượng</th><th>Đơn giá</th><th>Giảm giá</th><th>Thành tiền</th></tr></thead><tbody>{order.items.map((item: Record<string, any>) => <tr key={item.id ?? item.sku}><td>{item.sku}</td><td>{item.name}</td><td className="numeric-cell">{formatNumber(item.quantity)} {item.unit}</td><td className="money-cell">{formatMoney(item.unitCost)}</td><td className="money-cell">{formatMoney(item.discount)}</td><td className="money-cell">{formatMoney(item.lineTotal)}</td></tr>)}</tbody></table></div><div className="purchase-detail-total"><span>Tổng số mặt hàng<strong>{order.items.length}</strong></span><span>Tổng tiền hàng<strong>{formatMoney(order.subtotal)}</strong></span><span>Cần trả NCC<strong>{formatMoney(order.amountDue)}</strong></span><span>Đã trả NCC<strong>{formatMoney(order.amountPaid)}</strong></span></div></div>;
}
