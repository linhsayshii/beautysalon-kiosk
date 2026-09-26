import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/DataState';
import { StatusBadge } from '@/components/data-display/Badges';
import { DetailFacts, DetailHead, InlineDetail, ValueStrip } from '@/components/data-display/InlineDetail';
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { getCustomerCard } from '../operations.api';

export function CustomerCardDetail({ id, itemType }: { id: number; itemType: string }) {
  const [tab, setTab] = useState<'information' | 'history'>('information');
  const query = useQuery({ queryKey: ['customer-card', itemType, id], queryFn: () => getCustomerCard(itemType, id) });
  if (query.isPending) return <LoadingState />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const item = query.data.data;
  const isPackage = item.itemType === 'package';

  const tabs = [
    { value: 'information' as const, label: 'Thông tin' },
    { value: 'history' as const, label: 'Lịch sử sử dụng' },
  ];

  return (
    <InlineDetail className="sold-card-detail" label="Chi tiết gói thẻ" tabs={tabs} tab={tab} onTabChange={setTab}>
      {tab === 'information' ? (
        <>
          <DetailHead
            icon={isPackage ? 'ph-package' : 'ph-credit-card'}
            title={item.itemName}
            tags={<StatusBadge status={item.status} />}
            meta={<>Mã: <strong>{item.code}</strong> • Khách hàng: <strong>{item.customer.name}</strong> ({item.customer.code})</>}
          />
          <DetailFacts
            items={[
              { label: 'Giá bán', value: formatMoney(item.salePrice) },
              {
                label: isPackage ? 'Giá trị còn lại' : 'Số dư còn lại',
                value: isPackage ? `${formatNumber(item.remainingUnits)} lượt` : formatMoney(item.currentBalance),
                tone: 'primary',
              },
              { label: 'Thời gian bán', value: formatDateTime(item.soldAt) },
              { label: 'Hạn sử dụng', value: formatDate(item.expiresAt) },
            ]}
          />
          {isPackage ? (
            <>
              <p className="detail-section-title">Dịch vụ trong gói</p>
              {item.services.length ? (
                <div className="table-scroll">
                  <table className="detail-table">
                    <thead>
                      <tr>
                        <th>Mã dịch vụ</th>
                        <th>Tên dịch vụ</th>
                        <th className="is-num">Đơn giá trong gói</th>
                        <th className="is-num">Tổng</th>
                        <th className="is-num">Đã dùng</th>
                        <th className="is-num">Còn lại</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.services.map((service: Record<string, any>) => (
                        <tr key={service.id}>
                          <td className="is-code">{service.code}</td>
                          <td className="text-strong">{service.name}</td>
                          <td className="is-num">{formatMoney(service.unitPrice)}</td>
                          <td className="is-num">{formatNumber(item.totalUnits)}</td>
                          <td className="is-num">{formatNumber(item.usedUnits)}</td>
                          <td className="is-num text-strong text-primary">{formatNumber(item.remainingUnits)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <EmptyState message="Gói này chưa có dịch vụ được cấu hình." />}
            </>
          ) : (
            <ValueStrip
              items={[
                { label: 'Số dư ban đầu', value: formatMoney(item.openingBalance) },
                { label: 'Đã sử dụng', value: formatMoney(item.openingBalance - item.currentBalance), tone: 'danger' },
                { label: 'Còn lại', value: formatMoney(item.currentBalance), tone: 'success' },
              ]}
            />
          )}
        </>
      ) : item.usages.length ? (
        <div className="table-scroll">
          <table className="detail-table">
            <thead>
              <tr>
                <th>Ngày thực hiện</th>
                <th>Tên dịch vụ</th>
                <th className="is-num">Biến động số buổi</th>
                <th>Mã giao dịch</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {item.usages.map((usage: Record<string, any>) => (
                <tr key={usage.id}>
                  <td>{formatDateTime(usage.occurredAt)}</td>
                  <td>{usage.serviceName ?? 'Sử dụng gói'}</td>
                  <td className="is-num text-danger">-{formatNumber(usage.unitsUsed)}</td>
                  <td className="is-code">{usage.invoiceCode ?? '-'}</td>
                  <td className="text-muted">{usage.note ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState message="Chưa có lịch sử sử dụng cho gói hoặc thẻ này." />}
    </InlineDetail>
  );
}
