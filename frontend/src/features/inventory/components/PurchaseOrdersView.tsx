import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appConfig } from '@/app/config';
import { Link } from 'react-router-dom';
import { StatusBadge } from '@/components/data-display/Badges';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/DataState';
import { Pagination } from '@/components/data-display/Pagination';
import { SummaryStrip } from '@/components/data-display/SummaryStrip';
import { DateRangeFilter, FilterPanel, SelectFilter } from '@/components/forms/FilterPanel';
import { SearchToolbar } from '@/components/forms/SearchToolbar';
import { PageHeader } from '@/components/ui/PageHeader/PageHeader';
import { monthStartIso, todayIso } from '@/lib/date';
import { exportCsv } from '@/lib/export';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { getPurchaseOrders } from '../inventory.api';
import { PurchaseOrderDetail } from './PurchaseOrderDetail';
import { statusLabels } from '@/types/api';
import { toOptions, useMetadata } from '@/services/metadata';

const initialFilters = { search: '', status: '', dateFrom: monthStartIso(), dateTo: todayIso() };

export function PurchaseOrdersView() {
  const metadata = useMetadata();
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<number | null>(null);
  const query = useQuery({ queryKey: ['purchase-orders', filters, page], queryFn: () => getPurchaseOrders({ page, pageSize: appConfig.defaultPageSize, ...filters }) });
  const rows = query.data?.data ?? [];
  const summary = query.data?.meta.summary;
  const apply = () => { setFilters(draft); setPage(1); setExpanded(null); };
  const togglePurchase = (id: number) => setExpanded((current) => current === id ? null : id);

  return <main className="workspace"><div className="workspace-shell">
    <PageHeader title="Nhập hàng" subtitle="Theo dõi phiếu nhập, nhà cung cấp, thanh toán và công nợ." />
    <SummaryStrip items={[
      { label: 'Tổng phiếu', value: formatNumber(summary?.totalOrders), note: 'Theo bộ lọc hiện tại' },
      { label: 'Giá trị nhập', value: formatMoney(summary?.totalDue), note: 'Tổng cần trả NCC', tone: 'green' },
      { label: 'Còn nợ NCC', value: formatMoney(summary?.totalDebt), note: 'Chưa thanh toán', tone: 'orange' },
      { label: 'Phiếu tạm', value: formatNumber(summary?.drafts), note: 'Cần hoàn thành', tone: 'violet' },
    ]} />
    <div className="workspace-grid"><FilterPanel title="Bộ lọc nhập hàng" onApply={apply} onReset={() => { setDraft(initialFilters); setFilters(initialFilters); setPage(1); setExpanded(null); }}>
      <DateRangeFilter label="Ngày nhận" from={draft.dateFrom} to={draft.dateTo} onFromChange={(dateFrom) => setDraft({ ...draft, dateFrom })} onToChange={(dateTo) => setDraft({ ...draft, dateTo })} />
      <SelectFilter label="Trạng thái" value={draft.status} onChange={(status) => setDraft({ ...draft, status })} options={[{ value: '', label: 'Tất cả' }, ...toOptions(metadata.data?.data.filters.purchaseOrders.statuses ?? [], statusLabels)]} />
    </FilterPanel><section className="data-panel"><SearchToolbar value={draft.search} placeholder="Tìm theo mã phiếu hoặc nhà cung cấp" onChange={(search) => setDraft({ ...draft, search })} onSearch={apply} onRefresh={() => query.refetch()} actions={<><Link className="primary-button" to="/purchase-orders/new"><i className="ph ph-plus" />Nhập hàng</Link><button className="secondary-button" type="button" onClick={() => exportCsv(rows, 'purchase-orders')}><i className="ph ph-export" />Xuất file</button></>} />
      {query.isPending ? <LoadingState /> : query.error ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : !rows.length ? <EmptyState /> : <><div className="table-scroll"><table className="data-table purchase-table"><thead><tr><th><input className="table-checkbox" type="checkbox" aria-label="Chọn tất cả" /></th><th>Mã nhập hàng</th><th>Ngày tạo</th><th>Ngày nhập</th><th>Nhà cung cấp</th><th>Mặt hàng</th><th>Cần trả NCC</th><th>Trạng thái</th></tr></thead><tbody>{rows.map((row) => <Fragment key={row.id}><tr className={`purchase-row expandable-data-row ${expanded === row.id ? 'is-expanded' : ''}`} onClick={() => togglePurchase(row.id)}><td className="mobile-hide"><input className="table-checkbox" type="checkbox" aria-label={`Chọn ${row.code}`} onClick={(event) => event.stopPropagation()} /></td><td data-label="Mã phiếu"><span className="cell-main link">{row.code}</span></td><td data-label="Ngày tạo">{formatDateTime(row.createdAt)}</td><td data-label="Ngày nhập">{formatDateTime(row.receivedAt)}</td><td data-label="Nhà cung cấp"><span className="cell-main">{row.supplier.name}</span><small className="cell-sub">{row.supplier.phone ?? ''}</small></td><td data-label="Mặt hàng" className="numeric-cell">{formatNumber(row.itemCount)}</td><td data-label="Cần trả" className="money-cell">{formatMoney(row.amountDue)}</td><td data-label="Trạng thái"><StatusBadge status={row.status} purchase /></td></tr>{expanded === row.id && <tr className="purchase-detail-row expandable-detail-row"><td colSpan={8}><PurchaseOrderDetail id={row.id} /></td></tr>}</Fragment>)}</tbody></table></div><Pagination pagination={query.data?.meta.pagination} onChange={(nextPage) => { setExpanded(null); setPage(nextPage); }} /></>}
    </section></div>
  </div></main>;
}
