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
                <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                  {formatMoney(row.amount)}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <StatusBadge status={row.status} />
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
                <td style={{ textAlign: 'center' }}>
                  <StatusBadge status={row.status} />
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
                <td style={{ textAlign: 'right', fontWeight: 700, color: '#0052cc' }}>
                  {formatNumber(row.totalUnits - row.usedUnits)} lượt
                </td>
                <td style={{ textAlign: 'center' }}>
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
              <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                {formatMoney(row.currentBalance)}
              </td>
              <td style={{ textAlign: 'center' }}>
                <StatusBadge status={row.status} />
              </td>
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
    <div
      className="customer-detail"
      style={{
        background: '#ffffff',
        borderTop: '2px solid #0052cc',
        borderBottom: '1px solid #cbd5e1',
        padding: 0,
      }}
    >
      {/* Layer 2: Inline Detail Tabs */}
      <div className="inline-detail-tabs" role="tablist" aria-label={`Chi tiết khách hàng ${customer.name}`}>
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

      <div style={{ padding: '16px 20px' }}>
        {/* Layer 3: Profile Head */}
        <div
          className="customer-profile-head"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span
              className="customer-profile-avatar"
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 58,
                height: 58,
                borderRadius: 16,
                background: '#e0f2fe',
                color: '#0052cc',
                fontSize: 28,
                flexShrink: 0,
              }}
            >
              <i className="ph ph-user" />
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 16, color: '#1e293b' }}>{customer.name}</strong>
                <span
                  style={{
                    fontSize: 12,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: '#e0f2fe',
                    color: '#0052cc',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <i className="ph ph-identification-card" />
                  {customer.code}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: '#f1f5f9',
                    color: '#475569',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <i className="ph ph-users" />
                  {customer.group}
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>
                <span>Số điện thoại: </span>
                <strong style={{ color: '#1e293b' }}>{customer.phone || 'Chưa có'}</strong>
                {customer.email && <span style={{ color: '#64748b' }}> • {customer.email}</span>}
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right', fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
            <div>
              <strong style={{ color: '#1e293b' }}>{customer.branchName || 'Chi nhánh mặc định'}</strong>
            </div>
            <div>Ngày tạo: {formatDate(customer.createdAt)}</div>
          </div>
        </div>

        {/* Layer 4: 4-Column Value Strip */}
        <div
          className="customer-value-strip"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
            background: '#f8fafc',
            padding: '12px 16px',
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            marginBottom: 16,
            fontSize: 14,
          }}
        >
          <div>
            <span style={{ color: '#64748b' }}>Tổng bán: </span>
            <strong style={{ color: '#0052cc' }}>{formatMoney(customer.totalSpent)}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Ghé thăm: </span>
            <strong style={{ color: '#1e293b' }}>{formatNumber(customer.visitCount)} lượt</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Số dư thẻ: </span>
            <strong style={{ color: '#059669' }}>{formatMoney(customer.cardBalance)}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Nợ: </span>
            <strong style={{ color: customer.debtBalance > 0 ? '#e11d48' : '#059669' }}>
              {formatMoney(customer.debtBalance)}
            </strong>
          </div>
        </div>

        {/* Layer 5: Tabs Content */}
        {tab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px 24px', fontSize: 14.5 }}>
            <div>
              <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Số điện thoại:</span>
              <strong style={{ color: '#1e293b' }}>{customer.phone ?? 'Chưa có'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Nhóm khách hàng:</span>
              <strong style={{ color: '#1e293b' }}>{customer.group}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Lần cuối đến:</span>
              <strong style={{ color: '#1e293b' }}>
                {customer.lastVisit ? formatDateTime(customer.lastVisit) : 'Chưa có'}
              </strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Gói đang dùng:</span>
              <strong style={{ color: '#1e293b' }}>{formatNumber(customer.activePackages)} gói</strong>
            </div>
            {customer.address && (
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Địa chỉ:</span>
                <strong style={{ color: '#1e293b' }}>{customer.address}</strong>
              </div>
            )}
            {customer.notes && (
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Ghi chú:</span>
                <strong style={{ color: '#1e293b' }}>{customer.notes}</strong>
              </div>
            )}
          </div>
        )}

        {tab === 'debt' && (
          <div className="customer-debt-panel" style={{ padding: '8px 0', fontSize: 14.5 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '16px 24px',
                marginBottom: 16,
              }}
            >
              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Công nợ hiện tại:</span>
                <strong style={{ fontSize: 18, color: customer.debtBalance > 0 ? '#e11d48' : '#059669' }}>
                  {formatMoney(customer.debtBalance)}
                </strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Số dư thẻ tài khoản:</span>
                <strong style={{ fontSize: 18, color: '#059669' }}>
                  {formatMoney(customer.cardBalance)}
                </strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Trạng thái công nợ:</span>
                <strong style={{ fontSize: 15, color: customer.debtBalance > 0 ? '#e11d48' : '#059669' }}>
                  {customer.debtBalance > 0 ? 'Khách đang có khoản cần thu' : 'Không có công nợ'}
                </strong>
              </div>
            </div>
            <p style={{ color: '#64748b', margin: 0 }}>
              {customer.debtBalance > 0
                ? 'Khách hàng đang có khoản cần thu theo các hóa đơn mua hàng / dịch vụ.'
                : 'Khách hàng hiện tại không có khoản nợ nào.'}
            </p>
          </div>
        )}

        {tab !== 'overview' && tab !== 'debt' && (
          <ActivityTable customerId={id} kind={tab} />
        )}
      </div>
    </div>
  );
}
