import { CustomerDebtPanel } from '@/features/debts/CustomerDebtPanel';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/DataState';
import { DetailFacts, DetailHead, InlineDetail, ValueStrip } from '@/components/data-display/InlineDetail';
import { StatusBadge, InvoiceStatusBadge } from '@/components/data-display/Badges';
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { statusLabels } from '@/types/api';
import type { ApiRecord } from '@/types/api';
import { getCustomer, getCustomerActivity } from '../operations.api';

type ActivityKind = 'orders' | 'appointments' | 'packages' | 'cards';
type CustomerTab = 'overview' | ActivityKind | 'debt';

function ActivityTable({ customerId, kind }: { customerId: number; kind: ActivityKind }) {
  const query = useQuery({
    queryKey: ['customer-activity', customerId, kind],
    queryFn: () => getCustomerActivity(customerId, kind),
  });

  if (query.isPending) return <LoadingState />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const rows = query.data.data;
  if (!rows.length) return <EmptyState message="Khách hàng chưa có dữ liệu trong mục này." />;

  if (kind === 'orders') {
    return (
      <div className="table-scroll">
        <table className="detail-table">
          <thead>
            <tr>
              <th>Mã hóa đơn</th>
              <th>Thời gian</th>
              <th>Thanh toán</th>
              <th className="is-num">Tổng tiền</th>
              <th className="is-center">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="is-code">{row.code}</td>
                <td>{formatDateTime(row.occurredAt)}</td>
                <td>{statusLabels[row.paymentMethod] ?? row.paymentMethod}</td>
                <td className="is-num text-strong text-success">
                  {formatMoney(row.amount)}
                </td>
                <td className="is-center">
                  <InvoiceStatusBadge status={row.status} paymentStatus={row.paymentStatus} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (kind === 'appointments') {
    return (
      <div className="table-scroll">
        <table className="detail-table">
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Mã dịch vụ</th>
              <th>Tên dịch vụ</th>
              <th>Nhân viên</th>
              <th className="is-center">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{formatDateTime(row.occurredAt)}</td>
                <td className="is-code">{row.serviceCode ?? '-'}</td>
                <td className="text-strong">{row.serviceName ?? '-'}</td>
                <td>{row.staffName ?? '-'}</td>
                <td className="is-center">
                  <StatusBadge status={row.status} appointment />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (kind === 'packages') {
    return (
      <div className="table-scroll">
        <table className="detail-table">
          <thead>
            <tr>
              <th>Mã gói</th>
              <th>Tên gói</th>
              <th>Ngày bán</th>
              <th className="is-num">Đã dùng</th>
              <th className="is-num">Còn lại</th>
              <th className="is-center">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="is-code">{row.code}</td>
                <td className="text-strong">{row.name}</td>
                <td>{formatDate(row.soldAt)}</td>
                <td className="is-num">{formatNumber(row.usedUnits)} lượt</td>
                <td className="is-num text-strong text-primary">
                  {formatNumber(row.totalUnits - row.usedUnits)} lượt
                </td>
                <td className="is-center">
                  <StatusBadge status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="table-scroll">
      <table className="detail-table">
        <thead>
          <tr>
            <th>Mã thẻ</th>
            <th>Tên thẻ</th>
            <th>Ngày bán</th>
            <th className="is-num">Số dư ban đầu</th>
            <th className="is-num">Số dư hiện tại</th>
            <th className="is-center">Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="is-code">{row.code}</td>
              <td className="text-strong">{row.name}</td>
              <td>{formatDate(row.soldAt)}</td>
              <td className="is-num">{formatMoney(row.openingBalance)}</td>
              <td className="is-num text-strong text-success">
                {formatMoney(row.currentBalance)}
              </td>
              <td className="is-center">
                <StatusBadge status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CustomerDetail({ id, onEdit }: { id: number; onEdit?: (customer: ApiRecord) => void }) {
  const [tab, setTab] = useState<CustomerTab>('overview');
  const query = useQuery({ queryKey: ['customer', id], queryFn: () => getCustomer(id) });

  if (query.isPending) return <LoadingState />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const customer = query.data.data;

  const tabs: { value: CustomerTab; label: string }[] = [
    { value: 'overview', label: 'Tổng quan' },
    { value: 'orders', label: 'Lịch sử bán hàng' },
    { value: 'appointments', label: 'Lịch làm dịch vụ' },
    { value: 'debt', label: 'Công nợ' },
    { value: 'packages', label: 'Gói dịch vụ' },
    { value: 'cards', label: 'Thẻ tài khoản' },
  ];

  return (
    <InlineDetail className="customer-detail" label={`Chi tiết khách hàng ${customer.name}`} tabs={tabs} tab={tab} onTabChange={setTab}>
      <DetailHead
        icon="ph-user"
        title={customer.name}
        tags={<>
          <span className="badge badge-info"><i className="ph ph-identification-card" aria-hidden="true" />{customer.code}</span>
          <span className="badge badge-neutral"><i className="ph ph-users" aria-hidden="true" />{customer.group}</span>
        </>}
        meta={<>Số điện thoại: <strong>{customer.phone || 'Chưa có'}</strong>{customer.email && ` • ${customer.email}`}</>}
        aside={<><div><strong>{customer.branchName || 'Chi nhánh mặc định'}</strong></div><div>Ngày tạo: {formatDate(customer.createdAt)}</div></>}
      />

      <ValueStrip
        items={[
          { label: 'Tổng bán', value: formatMoney(customer.totalSpent), tone: 'primary' },
          { label: 'Ghé thăm', value: `${formatNumber(customer.visitCount)} lượt` },
          { label: 'Số dư thẻ', value: formatMoney(customer.cardBalance), tone: 'success' },
          { label: 'Nợ', value: formatMoney(customer.debtBalance), tone: customer.debtBalance > 0 ? 'danger' : 'success' },
        ]}
      />

      {tab === 'overview' && (
        <DetailFacts
          items={[
            { label: 'Số điện thoại', value: customer.phone ?? 'Chưa có' },
            { label: 'Nhóm khách hàng', value: customer.group },
            { label: 'Lần cuối đến', value: customer.lastVisit ? formatDateTime(customer.lastVisit) : 'Chưa có' },
            { label: 'Gói đang dùng', value: `${formatNumber(customer.activePackages)} gói` },
            customer.address && { label: 'Địa chỉ', value: customer.address, span: 'wide' },
            customer.notes && { label: 'Ghi chú', value: customer.notes, span: 'wide' },
          ]}
        />
      )}

      {tab === 'overview' && onEdit && (
        <div className="detail-actions">
          <button className="btn btn-primary btn-sm" type="button" onClick={() => onEdit(customer)}>
            <i className="ph ph-pencil-simple" />
            <span>Cập nhật</span>
          </button>
        </div>
      )}

      {tab === 'debt' && <CustomerDebtPanel key={id} customerId={id} />}

      {tab !== 'overview' && tab !== 'debt' && (
        <ActivityTable customerId={id} kind={tab} />
      )}
    </InlineDetail>
  );
}
