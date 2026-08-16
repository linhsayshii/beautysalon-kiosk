import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appConfig } from '@/app/config';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/DataState';
import { Pagination } from '@/components/data-display/Pagination';
import { StatusBadge } from '@/components/data-display/Badges';
import { SummaryStrip } from '@/components/data-display/SummaryStrip';
import { FilterPanel, SelectFilter } from '@/components/forms/FilterPanel';
import { SearchToolbar } from '@/components/forms/SearchToolbar';
import { PageHeader } from '@/components/ui/PageHeader/PageHeader';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';
import { getCustomerCards } from '../operations.api';
import { statusLabels } from '@/types/api';
import { toOptions, useMetadata } from '@/services/metadata';
import { CustomerCardDetail } from './CustomerCardDetail';

const initialFilters = { search: '', status: '', itemType: '' };

function UsageDots({ used, total }: { used: number; total: number }) {
  const count = Math.min(total, 12);
  return <div className="usage-dots" aria-hidden="true">{Array.from({ length: count }, (_, index) => <span className={index < Math.round((used / total) * count) ? 'used' : ''} key={index} />)}</div>;
}

export function CustomerCardsView() {
  const metadata = useMetadata();
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['customer-cards', filters, page], queryFn: () => getCustomerCards({ page, pageSize: appConfig.defaultPageSize, ...filters }) });
  const rows = query.data?.data ?? [];
  const apply = () => { setFilters(draft); setPage(1); setExpanded(null); };
  const reset = () => { setDraft(initialFilters); setFilters(initialFilters); setPage(1); setExpanded(null); };
  const totalUsed = query.data?.meta.summary.totalUsed ?? rows.reduce((sum, row) => sum + Number(row.usedUnits ?? 0), 0);
  const totalBalance = query.data?.meta.summary.totalBalance ?? rows.reduce((sum, row) => sum + Number(row.currentBalance ?? 0), 0);

  return <main className="workspace"><div className="workspace-shell">
    <PageHeader title="Gói, thẻ đã bán" subtitle="Theo dõi gói dịch vụ, thẻ tài khoản, số lượt hoặc số dư còn lại của từng khách." />
    <SummaryStrip items={[
      { label: 'Tổng gói, thẻ đã bán', value: formatNumber(query.data?.meta.pagination.total), note: 'Theo bộ lọc hiện tại' },
      { label: 'Đang sử dụng', value: formatNumber(rows.filter((row) => row.status === 'active').length), note: 'Còn lượt, số dư hoặc còn hạn', tone: 'green' },
      { label: 'Tổng lượt đã dùng', value: formatNumber(totalUsed), note: 'Lượt dịch vụ đã trừ', tone: 'violet' },
      { label: 'Số dư thẻ', value: formatMoney(totalBalance), note: 'Tổng số dư còn sử dụng', tone: 'orange' },
    ]} />
    <div className="workspace-grid"><FilterPanel title="Bộ lọc gói thẻ" onApply={apply} onReset={reset}>
      <SelectFilter label="Loại hàng" value={draft.itemType} onChange={(itemType) => setDraft({ ...draft, itemType })} options={[{ value: '', label: 'Tất cả' }, { value: 'package', label: 'Gói dịch vụ' }, { value: 'account_card', label: 'Thẻ tài khoản' }]} />
      <SelectFilter label="Trạng thái" value={draft.status} onChange={(status) => setDraft({ ...draft, status })} options={[{ value: '', label: 'Tất cả' }, ...toOptions(metadata.data?.data.filters.customerPackages.statuses ?? [], statusLabels)]} />
    </FilterPanel><section className="data-panel"><SearchToolbar value={draft.search} placeholder="Tìm theo mã, tên gói hoặc khách hàng" onChange={(search) => setDraft({ ...draft, search })} onSearch={apply} onRefresh={() => query.refetch()} />
      {query.isPending ? <LoadingState /> : query.error ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : !rows.length ? <EmptyState message="Chưa có gói dịch vụ hoặc thẻ tài khoản nào được bán cho khách." /> : <><div className="table-scroll"><table className="data-table customer-cards-table"><thead><tr><th><input className="table-checkbox" type="checkbox" aria-label="Chọn tất cả" /></th><th>Mã gói, thẻ</th><th>Tên</th><th>Loại</th><th>Mã khách hàng</th><th>Khách hàng</th><th>Giá bán</th><th>Đã sử dụng</th><th>Còn lại</th><th>Hạn dùng</th><th>Trạng thái</th></tr></thead><tbody>{rows.map((row) => { const rowKey = `${row.itemType}-${row.id}`; return <Fragment key={rowKey}><tr className={`customer-card-row expandable-data-row ${expanded === rowKey ? 'is-expanded' : ''}`} onClick={() => setExpanded((current) => current === rowKey ? null : rowKey)}><td className="mobile-hide"><input className="table-checkbox" type="checkbox" aria-label={`Chọn ${row.code}`} onClick={(event) => event.stopPropagation()} /></td><td data-label="Mã"><span className="cell-main link">{row.code}</span></td><td data-label="Tên"><span className="cell-main">{row.itemName}</span><small className="cell-sub">Bán ngày {formatDate(row.soldAt)}</small></td><td data-label="Loại"><span className={`goods-type ${row.itemType}`}>{statusLabels[row.itemType] ?? row.itemType}</span></td><td data-label="Mã khách">{row.customer.code}</td><td data-label="Khách hàng"><span className="cell-main">{row.customer.name}</span><small className="cell-sub">{row.customer.phone ?? ''}</small></td><td data-label="Giá bán" className="money-cell">{formatMoney(row.salePrice)}</td><td data-label="Đã sử dụng">{row.itemType === 'account_card' ? formatMoney(Number(row.openingBalance) - Number(row.currentBalance)) : <div className="package-usage"><strong>{row.usedUnits}/{row.totalUnits} lượt</strong><UsageDots used={row.usedUnits} total={row.totalUnits} /></div>}</td><td data-label="Còn lại" className="numeric-cell"><strong>{row.itemType === 'account_card' ? formatMoney(row.currentBalance) : `${row.remainingUnits} lượt`}</strong></td><td data-label="Hạn dùng">{formatDate(row.expiresAt)}</td><td data-label="Trạng thái"><StatusBadge status={row.status} /></td></tr>{expanded === rowKey && <tr className="customer-card-detail-row expandable-detail-row"><td colSpan={11}><CustomerCardDetail id={row.id} itemType={row.itemType} /></td></tr>}</Fragment>; })}</tbody></table></div><Pagination pagination={query.data?.meta.pagination} onChange={(nextPage) => { setExpanded(null); setPage(nextPage); }} /></>}
    </section></div>
  </div></main>;
}
