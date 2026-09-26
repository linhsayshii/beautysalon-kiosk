import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AvatarName } from '@/components/data-display/AvatarName';
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
  const staffSummary = data?.staffSummary ?? [];

  const totalRevenue = rows.reduce((sum: number, row: Record<string, any>) => sum + Number(row.revenue), 0);
  const totalCommission = rows.reduce((sum: number, row: Record<string, any>) => sum + Number(row.amount), 0);
  const serviceCommission = rows
    .filter((r: Record<string, any>) => r.commissionType === 'service')
    .reduce((sum: number, row: Record<string, any>) => sum + Number(row.amount), 0);
  const consultingCommission = rows
    .filter((r: Record<string, any>) => r.commissionType === 'consulting')
    .reduce((sum: number, row: Record<string, any>) => sum + Number(row.amount), 0);

  return (
    <main className="page">
      <div className="page-stack">
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
          <div className="data-toolbar">
            <div className="segmented" role="tablist" aria-label="Chế độ xem hoa hồng">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'by_staff'}
                className={activeTab === 'by_staff' ? 'is-active' : ''}
                onClick={() => setActiveTab('by_staff')}
              >
                <i className="ph ph-users" />
                Tổng hợp theo nhân viên ({staffSummary.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'details'}
                className={activeTab === 'details' ? 'is-active' : ''}
                onClick={() => setActiveTab('details')}
              >
                <i className="ph ph-receipt" />
                Chi tiết giao dịch ({rows.length})
              </button>
            </div>

            <div className="table-actions">
              <DateRangeFilter
                label="Kỳ hoa hồng"
                from={draft.from}
                to={draft.to}
                onFromChange={(from) => setDraft({ ...draft, from })}
                onToChange={(to) => setDraft({ ...draft, to })}
                layout="inline"
              />
              <button className="btn btn-secondary" type="button" onClick={() => setRange(draft)}>
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
            !staffSummary.length ? (
              <EmptyState message="Không có dữ liệu nhân viên trong kỳ này." />
            ) : (
              <>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Nhân viên</th>
                        <th className="is-num">DT Dịch vụ</th>
                        <th className="is-num text-primary">HH Thực hiện DV</th>
                        <th className="is-num">DT Tư vấn</th>
                        <th className="is-num text-violet">HH Tư vấn bán hàng</th>
                        <th className="is-num text-success">Tổng hoa hồng</th>
                        <th>Lượt phát sinh</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {staffSummary.map((summary) => (
                        <tr key={summary.staff.id}>
                          <td data-label="Nhân viên">
                            <AvatarName
                              name={summary.staff.name}
                              subtitle={`${summary.staff.code || ''} ${summary.staff.role ? `• ${summary.staff.role}` : ''}`}
                              tone={summary.staff.avatarTone}
                            />
                          </td>
                          <td data-label="DT Dịch vụ" className="money-cell is-num">
                            {formatMoney(summary.serviceRevenue)}
                          </td>
                          <td
                            data-label="HH Thực hiện"
                            className="money-cell is-num text-primary"
                          >
                            {formatMoney(summary.serviceAmount)}
                          </td>
                          <td data-label="DT Tư vấn" className="money-cell is-num">
                            {formatMoney(summary.consultingRevenue)}
                          </td>
                          <td
                            data-label="HH Tư vấn"
                            className="money-cell is-num text-violet"
                          >
                            {formatMoney(summary.consultingAmount)}
                          </td>
                          <td
                            data-label="Tổng hoa hồng"
                            className="money-cell is-num text-success"
                          >
                            {formatMoney(summary.totalAmount)}
                          </td>
                          <td data-label="Lượt phát sinh" className="numeric-cell">
                            {formatNumber(summary.transactionCount)}
                          </td>
                          <td className="mobile-hide">
                            <button
                              className="row-action"
                              aria-label="Xem chi tiết"
                              title="Xem chi tiết nhân viên"
                              onClick={() =>
                                openDrawer(summary.staff.name, [
                                  {
                                    title: 'Thông tin nhân viên',
                                    rows: [
                                      ['Mã nhân viên', summary.staff.code || '-'],
                                      ['Chức danh', summary.staff.role || '-'],
                                      ['Số lượt ghi nhận', formatNumber(summary.transactionCount)],
                                    ],
                                  },
                                  {
                                    title: 'Hoa hồng Thực hiện Dịch vụ',
                                    rows: [
                                      ['Doanh thu dịch vụ', formatMoney(summary.serviceRevenue)],
                                      ['Hoa hồng dịch vụ', formatMoney(summary.serviceAmount)],
                                    ],
                                  },
                                  {
                                    title: 'Hoa hồng Tư vấn Bán hàng',
                                    rows: [
                                      ['Doanh thu tư vấn', formatMoney(summary.consultingRevenue)],
                                      ['Hoa hồng tư vấn', formatMoney(summary.consultingAmount)],
                                    ],
                                  },
                                  {
                                    title: 'Tổng cộng',
                                    rows: [['Tổng hoa hồng thụ hưởng', formatMoney(summary.totalAmount)]],
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
                  pagination={{ page: 1, pageSize: staffSummary.length, total: staffSummary.length, totalPages: 1 }}
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
                      <th className="is-num">SL</th>
                      <th>Hóa đơn</th>
                      <th className="is-num">Doanh thu</th>
                      <th>Tỷ lệ</th>
                      <th className="is-num">Hoa hồng</th>
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
                          <span className={row.commissionType === 'consulting' ? 'badge badge-violet' : 'badge badge-info'}>
                            {row.commissionType === 'consulting' ? 'Tư vấn bán hàng' : 'Thực hiện dịch vụ'}
                          </span>
                        </td>
                        <td data-label="Nguồn">
                          <span className="cell-main">{row.sourceName}</span>
                        </td>
                        <td data-label="Sản phẩm">
                          <span className="cell-main">{row.productName || row.sourceName}</span>
                        </td>
                        <td data-label="SL" className="numeric-cell is-num">
                          {formatNumber(row.itemQuantity ?? 1)}
                        </td>
                        <td data-label="Hóa đơn">
                          <span className="cell-main link">{row.invoiceCode ?? '-'}</span>
                        </td>
                        <td data-label="Doanh thu" className="money-cell is-num">
                          {formatMoney(row.revenue)}
                        </td>
                        <td data-label="Tỷ lệ">{formatPercent(row.rate)}</td>
                        <td
                          data-label="Hoa hồng"
                          className={`money-cell is-num ${row.commissionType === 'consulting' ? 'text-violet' : 'text-success'}`}
                        >
                          {formatMoney(row.amount)}
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
