import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appConfig } from '@/app/config';
import { AvatarName } from '@/components/data-display/AvatarName';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/DataState';
import { Pagination } from '@/components/data-display/Pagination';
import { SummaryStrip } from '@/components/data-display/SummaryStrip';
import { FilterPanel, SelectFilter } from '@/components/forms/FilterPanel';
import { SearchToolbar } from '@/components/forms/SearchToolbar';
import { PageHeader } from '@/components/ui/PageHeader/PageHeader';
import { exportCsv } from '@/lib/export';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { getCustomers } from '../operations.api';
import { statusLabels } from '@/types/api';
import { toOptions, useMetadata } from '@/services/metadata';
import { CustomerDetail } from './CustomerDetail';
import { CustomerCreateDialog } from './CustomerCreateDialog';

const initialFilters = { search: '', group: '', debtStatus: '' };

export function CustomersView() {
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const metadata = useMetadata();
  const query = useQuery({ queryKey: ['customers', filters, page], queryFn: () => getCustomers({ page, pageSize: appConfig.defaultPageSize, ...filters }) });
  const rows = query.data?.data ?? [];
  const summary = query.data?.meta.summary;
  const apply = () => { setFilters(draft); setPage(1); setExpanded(null); };
  const reset = () => { setDraft(initialFilters); setFilters(initialFilters); setPage(1); setExpanded(null); };

  return (
    <>
      <main className="workspace">
        <div className="workspace-shell">
          <PageHeader
            title="Khách hàng"
            subtitle="Quản lý hồ sơ, công nợ, lịch sử mua và các gói dịch vụ đang sử dụng."
            actionLabel="Thêm khách hàng"
            onAction={() => setIsCreating(true)}
            extraActions={
              <button className="secondary-button" type="button" onClick={() => exportCsv(rows, 'customers')}>
                <i className="ph ph-export" />Xuất file
              </button>
            }
          />
          <SummaryStrip
            items={[
              { label: 'Tổng khách hàng', value: formatNumber(summary?.totalCustomers), note: 'Tại chi nhánh hiện tại' },
              { label: 'Khách đang nợ', value: formatNumber(summary?.customersInDebt), note: 'Cần chăm sóc', tone: 'orange' },
              { label: 'Tổng công nợ', value: formatMoney(summary?.totalDebt), note: 'Dư nợ hiện tại', tone: 'red' },
              { label: 'Có gói đang dùng', value: formatNumber(rows.filter((row) => row.activePackages > 0).length), note: 'Khách có combo', tone: 'violet' },
            ]}
          />
          <div className="workspace-grid">
            <FilterPanel title="Bộ lọc khách hàng" onApply={apply} onReset={reset}>
              <SelectFilter label="Nhóm khách hàng" value={draft.group} onChange={(group) => setDraft({ ...draft, group })} options={[{ value: '', label: 'Tất cả' }, { value: 'Cá nhân', label: 'Cá nhân' }, { value: 'Công ty', label: 'Công ty' }]} />
              <SelectFilter label="Công nợ" value={draft.debtStatus} onChange={(debtStatus) => setDraft({ ...draft, debtStatus })} options={[{ value: '', label: 'Tất cả' }, ...toOptions(metadata.data?.data.filters.customers.debtStatuses ?? [], statusLabels)]} />
            </FilterPanel>
            <section className="data-panel">
              <SearchToolbar value={draft.search} placeholder="Tìm mã, tên hoặc số điện thoại" onChange={(search) => setDraft({ ...draft, search })} onSearch={apply} onRefresh={() => query.refetch()} />
              {query.isPending ? <LoadingState /> : query.error ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : !rows.length ? <EmptyState /> : (
                <>
                  <div className="table-scroll">
                    <table className="data-table customers-table">
                      <thead>
                        <tr>
                          <th><input className="table-checkbox" type="checkbox" aria-label="Chọn tất cả" /></th>
                          <th>Mã khách</th>
                          <th>Khách hàng</th>
                          <th>Nhóm khách</th>
                          <th>Lần cuối đến</th>
                          <th>Gói đang dùng</th>
                          <th>Tổng chi tiêu</th>
                          <th>Công nợ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <Fragment key={row.id}>
                            <tr className={`customer-row expandable-data-row ${expanded === row.id ? 'is-expanded' : ''}`} onClick={() => setExpanded((current) => current === row.id ? null : row.id)}>
                              <td className="mobile-hide"><input className="table-checkbox" type="checkbox" aria-label={`Chọn ${row.code}`} onClick={(event) => event.stopPropagation()} /></td>
                              <td data-label="Mã khách"><span className="cell-main link">{row.code}</span></td>
                              <td data-label="Khách hàng"><AvatarName name={row.name} subtitle={row.phone} tone="blue" /></td>
                              <td data-label="Nhóm khách"><span className="status-badge scheduled">{row.group}</span></td>
                              <td data-label="Lần cuối đến">{formatDateTime(row.lastVisit)}</td>
                              <td data-label="Gói đang dùng" className="numeric-cell">{formatNumber(row.activePackages)}</td>
                              <td data-label="Tổng chi tiêu" className="money-cell">{formatMoney(row.totalSpent)}</td>
                              <td data-label="Công nợ" className="money-cell" style={{ color: row.debtBalance ? 'var(--red)' : 'var(--green)' }}>{formatMoney(row.debtBalance)}</td>
                            </tr>
                            {expanded === row.id && (
                              <tr className="customer-detail-row expandable-detail-row">
                                <td colSpan={8}><CustomerDetail id={row.id} /></td>
                              </tr>
                            )}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination pagination={query.data?.meta.pagination} onChange={(nextPage) => { setExpanded(null); setPage(nextPage); }} />
                </>
              )}
            </section>
          </div>
        </div>
      </main>
      {isCreating && <CustomerCreateDialog onClose={() => setIsCreating(false)} />}
    </>
  );
}
