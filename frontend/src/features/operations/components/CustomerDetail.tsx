import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/DataState';
import { StatusBadge } from '@/components/data-display/Badges';
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { statusLabels } from '@/types/api';
import { getCustomer, getCustomerActivity } from '../operations.api';

type ActivityKind = 'orders' | 'appointments' | 'packages' | 'cards';
type CustomerTab = 'overview' | ActivityKind | 'debt';

function ActivityTable({ customerId, kind }: { customerId: number; kind: ActivityKind }) {
  const query = useQuery({ queryKey: ['customer-activity', customerId, kind], queryFn: () => getCustomerActivity(customerId, kind) });
  if (query.isPending) return <LoadingState />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const rows = query.data.data;
  if (!rows.length) return <EmptyState message="Khách hàng chưa có dữ liệu trong mục này." />;

  if (kind === 'orders') {
    return (
      <div className="table-scroll" style={{ padding: '16px 20px' }}>
        <table className="kiotviet-payroll-table">
          <thead>
            <tr>
              <th>Mã hóa đơn</th>
              <th>Thời gian</th>
              <th>Thanh toán</th>
              <th style={{ textAlign: 'right' }}>Tổng tiền</th>
              <th style={{ textAlign: 'center' }}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={{ fontWeight: 600, color: '#0052cc' }}>{row.code}</td>
                <td>{formatDateTime(row.occurredAt)}</td>
                <td>{statusLabels[row.paymentMethod] ?? row.paymentMethod}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>{formatMoney(row.amount)}</td>
                <td style={{ textAlign: 'center' }}><StatusBadge status={row.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (kind === 'appointments') {
    return (
      <div className="table-scroll" style={{ padding: '16px 20px' }}>
        <table className="kiotviet-payroll-table">
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Mã dịch vụ</th>
              <th>Tên dịch vụ</th>
              <th>Nhân viên</th>
              <th style={{ textAlign: 'center' }}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{formatDateTime(row.occurredAt)}</td>
                <td style={{ fontWeight: 600, color: '#0052cc' }}>{row.serviceCode ?? '-'}</td>
                <td style={{ fontWeight: 600 }}>{row.serviceName ?? '-'}</td>
                <td>{row.staffName ?? '-'}</td>
                <td style={{ textAlign: 'center' }}><StatusBadge status={row.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (kind === 'packages') {
    return (
      <div className="table-scroll" style={{ padding: '16px 20px' }}>
        <table className="kiotviet-payroll-table">
          <thead>
            <tr>
              <th>Mã gói</th>
              <th>Tên gói</th>
              <th>Ngày bán</th>
              <th style={{ textAlign: 'right' }}>Đã dùng</th>
              <th style={{ textAlign: 'right' }}>Còn lại</th>
              <th style={{ textAlign: 'center' }}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={{ fontWeight: 600, color: '#0052cc' }}>{row.code}</td>
                <td style={{ fontWeight: 600 }}>{row.name}</td>
                <td>{formatDate(row.soldAt)}</td>
                <td style={{ textAlign: 'right' }}>{formatNumber(row.usedUnits)} lượt</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: '#0052cc' }}>{formatNumber(row.totalUnits - row.usedUnits)} lượt</td>
                <td style={{ textAlign: 'center' }}><StatusBadge status={row.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="table-scroll" style={{ padding: '16px 20px' }}>
      <table className="kiotviet-payroll-table">
        <thead>
          <tr>
            <th>Mã thẻ</th>
            <th>Tên thẻ</th>
            <th>Ngày bán</th>
            <th style={{ textAlign: 'right' }}>Số dư ban đầu</th>
            <th style={{ textAlign: 'right' }}>Số dư hiện tại</th>
            <th style={{ textAlign: 'center' }}>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td style={{ fontWeight: 600, color: '#0052cc' }}>{row.code}</td>
              <td style={{ fontWeight: 600 }}>{row.name}</td>
              <td>{formatDate(row.soldAt)}</td>
              <td style={{ textAlign: 'right' }}>{formatMoney(row.openingBalance)}</td>
              <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>{formatMoney(row.currentBalance)}</td>
              <td style={{ textAlign: 'center' }}><StatusBadge status={row.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CustomerDetail({ id }: { id: number }) {
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
    <div className="customer-detail" style={{ background: '#ffffff', borderTop: '2px solid #0052cc', borderBottom: '1px solid #cbd5e1' }}>
      <div className="inline-detail-tabs" role="tablist" aria-label="Chi tiết khách hàng">
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

      {tab === 'overview' ? (
        <div className="customer-overview" style={{ padding: '16px 20px' }}>
          <div className="customer-profile-head" style={{ marginBottom: 16 }}>
            <span className="customer-profile-avatar" style={{ background: '#e0f2fe', color: '#0052cc' }}>
              <i className="ph ph-user" />
            </span>
            <div>
              <strong style={{ fontSize: 16 }}>{customer.name}</strong>
              <span style={{ fontSize: 13, color: '#64748b', marginRight: 12 }}>
                <i className="ph ph-identification-card" /> {customer.code}
              </span>
              <span style={{ fontSize: 13, color: '#64748b' }}>
                <i className="ph ph-users" /> {customer.group}
              </span>
            </div>
            <small style={{ fontSize: 12, color: '#64748b' }}>
              {customer.branchName}<br />
              Ngày tạo: {formatDate(customer.createdAt)}
            </small>
          </div>

          <div
            className="customer-value-strip"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 12,
              background: '#f8fafc',
              padding: 12,
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              marginBottom: 16,
              fontSize: 14,
            }}
          >
            <div>Tổng bán: <strong style={{ color: '#0052cc' }}>{formatMoney(customer.totalSpent)}</strong></div>
            <div>Ghé thăm: <strong>{formatNumber(customer.visitCount)}</strong></div>
            <div>Số dư thẻ: <strong style={{ color: '#059669' }}>{formatMoney(customer.cardBalance)}</strong></div>
            <div>Nợ: <strong style={{ color: '#e11d48' }}>{formatMoney(customer.debtBalance)}</strong></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px 24px', fontSize: 14.5 }}>
            <div>
              <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Số điện thoại:</span>
              <strong>{customer.phone ?? 'Chưa có'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Nhóm khách hàng:</span>
              <strong>{customer.group}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Lần cuối đến:</span>
              <strong>{customer.lastVisit ? formatDateTime(customer.lastVisit) : 'Chưa có'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Gói đang dùng:</span>
              <strong>{formatNumber(customer.activePackages)}</strong>
            </div>
          </div>
        </div>
      ) : tab === 'debt' ? (
        <div className="customer-debt-panel" style={{ padding: '24px 20px', fontSize: 14.5 }}>
          <span style={{ color: '#64748b', display: 'block', marginBottom: 4 }}>Công nợ hiện tại:</span>
          <strong style={{ fontSize: 20, color: customer.debtBalance > 0 ? '#e11d48' : '#059669' }}>
            {formatMoney(customer.debtBalance)}
          </strong>
          <p style={{ color: '#64748b', marginTop: 8 }}>
            {customer.debtBalance > 0 ? 'Khách hàng đang có khoản cần thu.' : 'Khách hàng không có công nợ.'}
          </p>
        </div>
      ) : (
        <ActivityTable customerId={id} kind={tab} />
      )}
    </div>
  );
}
