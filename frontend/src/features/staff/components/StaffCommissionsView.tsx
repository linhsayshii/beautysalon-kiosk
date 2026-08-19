import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AvatarName } from '@/components/data-display/AvatarName';
import { StatusBadge } from '@/components/data-display/Badges';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/DataState';
import { Pagination } from '@/components/data-display/Pagination';
import { SummaryStrip } from '@/components/data-display/SummaryStrip';
import { DateRangeFilter } from '@/components/forms/FilterPanel';
import { PageHeader } from '@/components/ui/PageHeader/PageHeader';
import { useDrawer } from '@/components/ui/Drawer/DrawerProvider';
import { monthStartIso, todayIso } from '@/lib/date';
import { formatDate, formatMoney, formatNumber, formatPercent } from '@/lib/format';
import { getCommissions } from '../staff.api';

export function StaffCommissionsView() {
  const [activeTab, setActiveTab] = useState<'by_staff' | 'details'>('by_staff');
  const [draft, setDraft] = useState({ from: monthStartIso(), to: todayIso() });
  const [range, setRange] = useState(draft);
  const { openDrawer } = useDrawer();

  const query = useQuery({
    queryKey: ['staff-commissions', range],
    queryFn: () => getCommissions(range.from, range.to),
  });

  const data = query.data?.data;
  const rows = data?.rows ?? [];
  const byStaff = data?.byStaff ?? [];

  const totalRevenue = rows.reduce((sum: number, row: Record<string, any>) => sum + Number(row.revenue), 0);
  const totalCommission = rows.reduce((sum: number, row: Record<string, any>) => sum + Number(row.amount), 0);
  const serviceCommission = rows
    .filter((r: Record<string, any>) => r.commissionType === 'service')
    .reduce((sum: number, row: Record<string, any>) => sum + Number(row.amount), 0);
  const consultingCommission = rows
    .filter((r: Record<string, any>) => r.commissionType === 'consulting')
    .reduce((sum: number, row: Record<string, any>) => sum + Number(row.amount), 0);

  return (
    <main className="workspace">
      <div className="workspace-shell">
        <PageHeader
          title="Bảng hoa hồng"
          subtitle="Tổng hợp và chi tiết hoa hồng theo nhân viên, thực hiện dịch vụ và tư vấn bán hàng."
        />

        <SummaryStrip
          items={[
            { label: 'Tổng hoa hồng', value: formatMoney(totalCommission), note: 'Tất cả nhân viên', tone: 'green' },
            { label: 'HH Thực hiện DV', value: formatMoney(serviceCommission), note: 'Kỹ thuật viên làm dịch vụ', tone: 'blue' },
            { label: 'HH Tư vấn bán hàng', value: formatMoney(consultingCommission), note: 'Tư vấn mỹ phẩm / gói', tone: 'violet' },
            { label: 'Doanh thu phát sinh', value: formatMoney(totalRevenue), note: 'Có tính hoa hồng', tone: 'orange' },
          ]}
        />

        <section className="data-panel">
          <div className="data-toolbar" style={{ justifyContent: 'space-between' }}>
            <div className="commission-view-tabs goods-dialog-tabs" style={{ padding: 0, border: 0 }}>
              <button
                type="button"
                className={activeTab === 'by_staff' ? 'is-active' : ''}
                onClick={() => setActiveTab('by_staff')}
              >
                <i className="ph ph-users" style={{ marginRight: 6 }} />
                Tổng hợp theo nhân viên ({byStaff.length})
              </button>
              <button
                type="button"
                className={activeTab === 'details' ? 'is-active' : ''}
                onClick={() => setActiveTab('details')}
              >
                <i className="ph ph-receipt" style={{ marginRight: 6 }} />
                Chi tiết giao dịch ({rows.length})
              </button>
            </div>

            <div className="table-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <DateRangeFilter
                label="Kỳ hoa hồng"
                from={draft.from}
                to={draft.to}
                onFromChange={(from) => setDraft({ ...draft, from })}
                onToChange={(to) => setDraft({ ...draft, to })}
                layout="inline"
              />
              <button className="secondary-button" type="button" onClick={() => setRange(draft)}>
                <i className="ph ph-funnel" />
                Lọc
              </button>
            </div>
          </div>

          {query.isPending ? (
            <LoadingState />
          ) : query.error ? (
            <ErrorState error={query.error} onRetry={() => query.refetch()} />
          ) : activeTab === 'by_staff' ? (
            !byStaff.length ? (
              <EmptyState message="Không có dữ liệu nhân viên trong kỳ này." />
            ) : (
              <>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Nhân viên</th>
                        <th style={{ textAlign: 'right' }}>DT Dịch vụ</th>
                        <th style={{ textAlign: 'right', color: 'var(--blue-700)' }}>HH Thực hiện DV</th>
                        <th style={{ textAlign: 'right' }}>DT Tư vấn</th>
                        <th style={{ textAlign: 'right', color: 'var(--violet)' }}>HH Tư vấn bán hàng</th>
                        <th style={{ textAlign: 'right', color: 'var(--green)' }}>Tổng hoa hồng</th>
                        <th>Lượt phát sinh</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {byStaff.map((staff: Record<string, any>) => (
                        <tr key={staff.id}>
                          <td data-label="Nhân viên">
                            <AvatarName
                              name={staff.name}
                              subtitle={`${staff.code || ''} ${staff.role ? `• ${staff.role}` : ''}`}
                              tone={staff.avatarTone}
                            />
                          </td>
                          <td data-label="DT Dịch vụ" className="money-cell" style={{ textAlign: 'right' }}>
                            {formatMoney(staff.serviceRevenue || 0)}
                          </td>
                          <td
                            data-label="HH Thực hiện"
                            className="money-cell"
                            style={{ textAlign: 'right', color: 'var(--blue-700)', fontWeight: 750 }}
                          >
                            {formatMoney(staff.serviceAmount || 0)}
                          </td>
                          <td data-label="DT Tư vấn" className="money-cell" style={{ textAlign: 'right' }}>
                            {formatMoney(staff.consultingRevenue || 0)}
                          </td>
                          <td
                            data-label="HH Tư vấn"
                            className="money-cell"
                            style={{ textAlign: 'right', color: 'var(--violet)', fontWeight: 750 }}
                          >
                            {formatMoney(staff.consultingAmount || 0)}
                          </td>
                          <td
                            data-label="Tổng hoa hồng"
                            className="money-cell"
                            style={{ textAlign: 'right', color: 'var(--green)', fontSize: '13px', fontWeight: 800 }}
                          >
                            {formatMoney(staff.amount || 0)}
                          </td>
                          <td data-label="Lượt phát sinh" className="numeric-cell">
                            {formatNumber(staff.transactionCount || 0)}
                          </td>
                          <td className="mobile-hide">
                            <button
                              className="row-action"
                              aria-label="Xem chi tiết"
                              title="Xem chi tiết nhân viên"
                              onClick={() =>
                                openDrawer(staff.name, [
                                  {
                                    title: 'Thông tin nhân viên',
                                    rows: [
                                      ['Mã nhân viên', staff.code || '-'],
                                      ['Chức danh', staff.role || '-'],
                                      ['Số lượt ghi nhận', formatNumber(staff.transactionCount || 0)],
                                    ],
                                  },
                                  {
                                    title: 'Hoa hồng Thực hiện Dịch vụ',
                                    rows: [
                                      ['Doanh thu dịch vụ', formatMoney(staff.serviceRevenue || 0)],
                                      ['Hoa hồng dịch vụ', formatMoney(staff.serviceAmount || 0)],
                                    ],
                                  },
                                  {
                                    title: 'Hoa hồng Tư vấn Bán hàng',
                                    rows: [
                                      ['Doanh thu tư vấn', formatMoney(staff.consultingRevenue || 0)],
                                      ['Hoa hồng tư vấn', formatMoney(staff.consultingAmount || 0)],
                                    ],
                                  },
                                  {
                                    title: 'Tổng cộng',
                                    rows: [['Tổng hoa hồng thụ hưởng', formatMoney(staff.amount || 0)]],
                                  },
                                ])
                              }
                            >
                              <i className="ph ph-caret-right" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  pagination={{ page: 1, pageSize: byStaff.length, total: byStaff.length, totalPages: 1 }}
                  onChange={() => undefined}
                />
              </>
            )
          ) : !rows.length ? (
            <EmptyState message="Không có lượt hoa hồng nào trong kỳ này." />
          ) : (
            <>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ngày</th>
                      <th>Nhân viên</th>
                      <th>Loại hoa hồng</th>
                      <th>Nguồn / Hàng hóa - Dịch vụ</th>
                      <th>Sản phẩm</th>
                      <th style={{ textAlign: 'right' }}>SL</th>
                      <th>Hóa đơn</th>
                      <th style={{ textAlign: 'right' }}>Doanh thu</th>
                      <th>Tỷ lệ</th>
                      <th style={{ textAlign: 'right' }}>Hoa hồng</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row: Record<string, any>) => (
                      <tr key={row.id}>
                        <td data-label="Ngày">{formatDate(row.occurredOn)}</td>
                        <td data-label="Nhân viên">
                          <AvatarName
                            name={row.staff.name}
                            subtitle={row.staff.code}
                            tone={row.staff.avatarTone}
                          />
                        </td>
                        <td data-label="Loại hoa hồng">
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: row.commissionType === 'consulting' ? '#f0edff' : 'var(--blue-50)',
                              color: row.commissionType === 'consulting' ? 'var(--violet)' : 'var(--blue-700)',
                              border: `1px solid ${row.commissionType === 'consulting' ? '#dcd6fa' : 'var(--blue-200)'}`,
                            }}
                          >
                            {row.commissionType === 'consulting' ? 'Tư vấn bán hàng' : 'Thực hiện dịch vụ'}
                          </span>
                        </td>
                        <td data-label="Nguồn">
                          <span className="cell-main">{row.sourceName}</span>
                        </td>
                        <td data-label="Sản phẩm">
                          <span className="cell-main">{row.productName || row.sourceName}</span>
                        </td>
                        <td data-label="SL" className="numeric-cell" style={{ textAlign: 'right' }}>
                          {formatNumber(row.itemQuantity ?? 1)}
                        </td>
                        <td data-label="Hóa đơn">
                          <span className="cell-main link">{row.invoiceCode ?? '-'}</span>
                        </td>
                        <td data-label="Doanh thu" className="money-cell" style={{ textAlign: 'right' }}>
                          {formatMoney(row.revenue)}
                        </td>
                        <td data-label="Tỷ lệ">{formatPercent(row.rate)}</td>
                        <td
                          data-label="Hoa hồng"
                          className="money-cell"
                          style={{
                            textAlign: 'right',
                            color: row.commissionType === 'consulting' ? 'var(--violet)' : 'var(--green)',
                            fontWeight: 750,
                          }}
                        >
                          {formatMoney(row.amount)}
                        </td>
                        <td data-label="Trạng thái">
                          <StatusBadge status={row.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                pagination={{ page: 1, pageSize: rows.length, total: rows.length, totalPages: 1 }}
                onChange={() => undefined}
              />
            </>
          )}
        </section>
      </div>
    </main>
  );
}
