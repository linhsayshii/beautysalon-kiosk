import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/DataState';
import { StatusBadge } from '@/components/data-display/Badges';
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { getCustomerCard } from '../operations.api';

export function CustomerCardDetail({ id, itemType }: { id: number; itemType: string }) {
  const [tab, setTab] = useState<'information' | 'history'>('information');
  const query = useQuery({ queryKey: ['customer-card', itemType, id], queryFn: () => getCustomerCard(itemType, id) });
  if (query.isPending) return <LoadingState />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const item = query.data.data;
  const isPackage = item.itemType === 'package';

  return <div className="sold-card-detail">
    <div className="inline-detail-tabs" role="tablist" aria-label="Chi tiết gói thẻ">
      <button type="button" role="tab" aria-selected={tab === 'information'} className={tab === 'information' ? 'is-active' : ''} onClick={() => setTab('information')}>Thông tin</button>
      <button type="button" role="tab" aria-selected={tab === 'history'} className={tab === 'history' ? 'is-active' : ''} onClick={() => setTab('history')}>Lịch sử sử dụng</button>
    </div>
    {tab === 'information' ? <div className="sold-card-information">
      <div className="sold-card-head"><div><strong>{item.itemName}</strong><StatusBadge status={item.status} /></div><span><i className="ph ph-cube" />{item.code}</span><span><i className="ph ph-user-circle" />{item.customer.name}</span><span><i className="ph ph-identification-card" />{item.customer.code}</span></div>
      <div className="sold-card-facts"><div><span>Giá bán</span><strong>{formatMoney(item.salePrice)}</strong></div><div><span>{isPackage ? 'Giá trị còn lại' : 'Số dư còn lại'}</span><strong>{isPackage ? `${formatNumber(item.remainingUnits)} lượt` : formatMoney(item.currentBalance)}</strong></div><div><span>Thời gian bán</span><strong>{formatDateTime(item.soldAt)}</strong></div><div><span>Hạn sử dụng</span><strong>{formatDate(item.expiresAt)}</strong></div></div>
      {isPackage ? <div className="sold-card-services"><strong>Dịch vụ trong gói</strong>{item.services.length ? <div className="table-scroll"><table className="data-table inline-detail-table"><thead><tr><th>Mã dịch vụ</th><th>Tên dịch vụ</th><th>Đơn giá trong gói</th><th>Tổng</th><th>Đã dùng</th><th>Còn lại</th></tr></thead><tbody>{item.services.map((service: Record<string, any>) => <tr key={service.id}><td data-label="Mã dịch vụ">{service.code}</td><td data-label="Tên dịch vụ"><span className="cell-main">{service.name}</span></td><td data-label="Đơn giá" className="money-cell">{formatMoney(service.unitPrice)}</td><td data-label="Tổng">{formatNumber(item.totalUnits)}</td><td data-label="Đã dùng">{formatNumber(item.usedUnits)}</td><td data-label="Còn lại">{formatNumber(item.remainingUnits)}</td></tr>)}</tbody></table></div> : <EmptyState message="Gói này chưa có dịch vụ được cấu hình." />}</div> : <div className="sold-card-balance"><span>Số dư ban đầu<strong>{formatMoney(item.openingBalance)}</strong></span><span>Đã sử dụng<strong>{formatMoney(item.openingBalance - item.currentBalance)}</strong></span><span>Còn lại<strong>{formatMoney(item.currentBalance)}</strong></span></div>}
    </div> : item.usages.length ? <div className="table-scroll sold-card-history"><table className="data-table inline-detail-table"><thead><tr><th>Ngày thực hiện</th><th>Tên dịch vụ</th><th>Biến động số buổi</th><th>Mã giao dịch</th><th>Ghi chú</th></tr></thead><tbody>{item.usages.map((usage: Record<string, any>) => <tr key={usage.id}><td data-label="Ngày thực hiện">{formatDateTime(usage.occurredAt)}</td><td data-label="Tên dịch vụ">{usage.serviceName ?? 'Sử dụng gói'}</td><td data-label="Biến động">-{formatNumber(usage.unitsUsed)}</td><td data-label="Mã giao dịch"><span className="cell-main link">{usage.invoiceCode ?? '-'}</span></td><td data-label="Ghi chú">{usage.note ?? '-'}</td></tr>)}</tbody></table></div> : <EmptyState message="Chưa có lịch sử sử dụng cho gói hoặc thẻ này." />}
  </div>;
}
