import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appConfig } from '@/app/config';
import { AvatarName } from '@/components/data-display/AvatarName';
import { ErrorState, EmptyState, LoadingState } from '@/components/data-display/DataState';
import { Pagination } from '@/components/data-display/Pagination';
import { StatusBadge } from '@/components/data-display/Badges';
import { SummaryStrip } from '@/components/data-display/SummaryStrip';
import { DateRangeFilter, FilterPanel, SelectFilter } from '@/components/forms/FilterPanel';
import { SearchToolbar } from '@/components/forms/SearchToolbar';
import { PageHeader } from '@/components/ui/PageHeader/PageHeader';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { monthStartIso, todayIso } from '@/lib/date';
import { exportCsv } from '@/lib/export';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { statusLabels } from '@/types/api';
import { toOptions, useMetadata } from '@/services/metadata';
import { getOrders } from '../operations.api';
import { OrderDetail } from './OrderDetail';

const initialFilters = { search: '', status: '', paymentMethod: '', dateFrom: monthStartIso(), dateTo: todayIso() };

export function OrdersView() {
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<number | null>(null);
  const { notify } = useToast();
  const metadata = useMetadata();
  const query = useQuery({ queryKey: ['orders', filters, page], queryFn: () => getOrders({ page, pageSize: appConfig.defaultPageSize, ...filters }) });
  const rows = query.data?.data ?? [];
  const summary = query.data?.meta.summary;
  const apply = () => { setPage(1); setExpanded(null); setFilters(draft); };
  const reset = () => { setDraft(initialFilters); setFilters(initialFilters); setPage(1); setExpanded(null); };
  const toggleOrder = (id: number) => setExpanded((current) => current === id ? null : id);

  return <main className="workspace"><div className="workspace-shell">
    <PageHeader title="Đơn hàng salon" subtitle="Theo dõi hóa đơn, thanh toán và trạng thái đơn tại tất cả quầy." extraActions={<button className="secondary-button" type="button" onClick={() => exportCsv(rows, 'orders') || notify('Không có dữ liệu', 'Hãy tải dữ liệu trước khi xuất file.')}><i className="ph ph-export" />Xuất file</button>} />
    <SummaryStrip items={[
      { label: 'Tổng đơn', value: formatNumber(summary?.totalOrders), note: 'Theo bộ lọc hiện tại' },
      { label: 'Doanh thu đã thu', value: formatMoney(summary?.paidRevenue), note: 'Không gồm đơn hoàn', tone: 'green' },
      { label: 'Đơn nháp', value: formatNumber(summary?.draftOrders), note: 'Cần hoàn tất', tone: 'orange' },
      { label: 'Đơn hoàn', value: formatNumber(summary?.refundedOrders), note: 'Đã hoàn tiền', tone: 'red' },
    ]} />
    <div className="workspace-grid">
      <FilterPanel title="Bộ lọc đơn hàng" onApply={apply} onReset={reset}>
        <SelectFilter label="Trạng thái" value={draft.status} onChange={(status) => setDraft({ ...draft, status })} options={[{ value: '', label: 'Tất cả' }, ...toOptions(metadata.data?.data.filters.orders.statuses ?? [], statusLabels)]} />
        <SelectFilter label="Thanh toán" value={draft.paymentMethod} onChange={(paymentMethod) => setDraft({ ...draft, paymentMethod })} options={[{ value: '', label: 'Tất cả' }, ...toOptions(metadata.data?.data.filters.orders.paymentMethods ?? [], statusLabels)]} />
        <DateRangeFilter label="Thời gian bán" from={draft.dateFrom} to={draft.dateTo} onFromChange={(dateFrom) => setDraft({ ...draft, dateFrom })} onToChange={(dateTo) => setDraft({ ...draft, dateTo })} />
      </FilterPanel>
      <section className="data-panel">
        <SearchToolbar value={draft.search} placeholder="Tìm mã đơn, khách hàng, số điện thoại" onChange={(search) => setDraft({ ...draft, search })} onSearch={apply} onRefresh={() => query.refetch()} />
        {query.isPending ? <LoadingState /> : query.error ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : !rows.length ? <EmptyState /> : <><div className="table-scroll orders-table-scroll"><table className="data-table orders-table"><thead><tr><th><input className="table-checkbox" type="checkbox" aria-label="Chọn tất cả" /></th><th>Mã đơn</th><th>Khách hàng</th><th>Nhân viên</th><th>Thời gian</th><th>Thanh toán</th><th>Tổng tiền</th><th>Trạng thái</th></tr></thead><tbody>{rows.map((row) => {
          const isExpanded = expanded === row.id;
          const detailId = `order-detail-${row.id}`;
          return <Fragment key={row.id}>
            <tr className={`order-row expandable-data-row ${isExpanded ? 'is-expanded' : ''}`} onClick={() => toggleOrder(row.id)}>
              <td className="mobile-hide"><input className="table-checkbox" type="checkbox" aria-label={`Chọn ${row.code}`} onClick={(event) => event.stopPropagation()} /></td>
              <td data-label="Mã đơn"><span className="cell-main link">{row.code}</span><small className="cell-sub">{row.salesChannel === 'online' ? 'Bán online' : row.salesChannel === 'phone' ? 'Qua điện thoại' : 'Tại salon'}</small></td>
              <td data-label="Khách hàng"><AvatarName name={row.customer.name} subtitle={row.customer.phone ?? row.customer.code ?? ''} /></td>
              <td data-label="Nhân viên">{row.staffName ?? '-'}</td>
              <td data-label="Thời gian" className="numeric-cell">{formatDateTime(row.issuedAt)}</td>
              <td data-label="Thanh toán">{statusLabels[row.paymentMethod] ?? row.paymentMethod}</td>
              <td data-label="Tổng tiền" className="money-cell">{formatMoney(row.total)}</td>
              <td data-label="Trạng thái"><StatusBadge status={row.status} /></td>
            </tr>
            {isExpanded && <tr className="order-detail-row expandable-detail-row" id={detailId}><td colSpan={8}><OrderDetail id={row.id} /></td></tr>}
          </Fragment>;
        })}</tbody></table></div><Pagination pagination={query.data?.meta.pagination} onChange={(nextPage) => { setExpanded(null); setPage(nextPage); }} /></>}
      </section>
    </div>
  </div></main>;
}
