import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appConfig } from '@/app/config';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/DataState';
import { Pagination } from '@/components/data-display/Pagination';
import { SummaryStrip, type SummaryItem } from '@/components/data-display/SummaryStrip';
import { DateRangeFilter, FilterPanel, SelectFilter } from '@/components/forms/FilterPanel';
import { SearchToolbar } from '@/components/forms/SearchToolbar';
import { PageHeader } from '@/components/ui/PageHeader/PageHeader';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { useAuth } from '@/features/auth/AuthProvider';
import { hasPermission } from '@/features/auth/authorization';
import { monthStartIso, todayIso } from '@/lib/date';
import { exportCsv } from '@/lib/export';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { useMetadata } from '@/services/metadata';
import {
  fundLabels, getCashbookSummary, getCashVouchers, voucherTypeLabels,
  type CashFund, type CashVoucher, type CashVoucherType,
} from '../cashbook.api';
import { CashFundModal, type CashFundAction } from './CashFundModal';
import { CashVoucherCancelModal } from './CashVoucherCancelModal';
import { CashVoucherDetail } from './CashVoucherDetail';
import { CashVoucherModal } from './CashVoucherModal';

const initialFilters = { search: '', type: '', fund: '', category: '', status: '', dateFrom: monthStartIso(), dateTo: todayIso() };
const all = { value: '', label: 'Tất cả' };

export function CashbookView() {
  const { account } = useAuth();
  const canManage = account ? hasPermission(account.role, 'finance:read') : false;
  const { notify } = useToast();
  const metadata = useMetadata();
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [creating, setCreating] = useState<CashVoucherType | null>(null);
  const [fundAction, setFundAction] = useState<CashFundAction | null>(null);
  const [cancelling, setCancelling] = useState<CashVoucher | null>(null);

  const range = { dateFrom: filters.dateFrom, dateTo: filters.dateTo };
  const summaryQuery = useQuery({ queryKey: ['cashbook-summary', range], queryFn: () => getCashbookSummary(range), enabled: canManage });
  const query = useQuery({ queryKey: ['cashbook', filters, page], queryFn: () => getCashVouchers({ ...filters, page, pageSize: appConfig.defaultPageSize }) });
  const rows = query.data?.data ?? [];
  const listSummary = query.data?.meta.summary;
  const summary = summaryQuery.data?.data;
  const fundBalance = (fund: CashFund) => summary?.funds.find((item) => item.fund === fund);

  const apply = () => { setPage(1); setExpanded(null); setFilters(draft); };
  const reset = () => { setDraft(initialFilters); setFilters(initialFilters); setPage(1); setExpanded(null); };
  const categories = (metadata.data?.data.cashbook?.categories ?? []).filter((category) => !draft.type || category.type === draft.type);

  const summaryItems: SummaryItem[] = canManage ? [
    { label: 'Quỹ đầu kỳ', value: formatMoney(summary?.total.opening), note: `Tiền mặt ${formatMoney(fundBalance('cash')?.opening)} · NH ${formatMoney(fundBalance('bank')?.opening)}` },
    { label: 'Tổng thu', value: formatMoney(summary?.total.income), note: 'Không gồm chuyển quỹ nội bộ', tone: 'green' },
    { label: 'Tổng chi', value: formatMoney(summary?.total.expense), note: 'Không gồm chuyển quỹ nội bộ', tone: 'red' },
    { label: 'Tồn quỹ cuối kỳ', value: formatMoney(summary?.total.closing), note: `Tiền mặt ${formatMoney(fundBalance('cash')?.closing)} · NH ${formatMoney(fundBalance('bank')?.closing)}`, tone: 'violet' },
  ] : [
    { label: 'Thu hôm nay', value: formatMoney(listSummary?.income), note: 'Các phiếu đang hiệu lực', tone: 'green' },
    { label: 'Chi hôm nay', value: formatMoney(listSummary?.expense), note: 'Các phiếu đang hiệu lực', tone: 'red' },
    { label: 'Số phiếu', value: formatNumber(listSummary?.total), note: 'Theo bộ lọc hiện tại' },
  ];

  const exportRows = () => exportCsv(rows.map((row) => ({
    'Mã phiếu': row.code,
    'Loại phiếu': voucherTypeLabels[row.type],
    'Thời gian': formatDateTime(row.occurredAt),
    'Loại thu chi': row.categoryLabel,
    'Người nộp/nhận': row.counterpartyName,
    'Quỹ': fundLabels[row.fund],
    'Giá trị': row.type === 'income' ? row.amount : -row.amount,
    'Trạng thái': row.status === 'cancelled' ? 'Đã hủy' : 'Đã ghi sổ',
    'Ghi chú': row.note,
  })), 'so-quy') || notify('Không có dữ liệu', 'Hãy tải dữ liệu trước khi xuất file.');

  return <main className="page"><div className="page-stack">
    <PageHeader
      title="Sổ quỹ"
      subtitle={canManage ? 'Theo dõi tồn quỹ tiền mặt, ngân hàng và các phiếu thu chi.' : 'Phiếu thu chi trong ngày hôm nay.'}
      actionLabel="Lập phiếu thu"
      onAction={() => setCreating('income')}
      extraActions={<>
        <button className="btn btn-secondary" type="button" onClick={exportRows}><i className="ph ph-export" />Xuất file</button>
        {canManage && <button className="btn btn-secondary" type="button" onClick={() => setFundAction('opening')}><i className="ph ph-flag-banner" />Số dư đầu kỳ</button>}
        {canManage && <button className="btn btn-secondary" type="button" onClick={() => setFundAction('transfer')}><i className="ph ph-arrows-left-right" />Chuyển quỹ</button>}
        <button className="btn btn-secondary" type="button" onClick={() => setCreating('expense')}><i className="ph ph-minus" />Lập phiếu chi</button>
      </>}
    />
    {canManage && summaryQuery.error ? <ErrorState compact error={summaryQuery.error} onRetry={() => summaryQuery.refetch()} /> : <SummaryStrip items={summaryItems} />}
    {canManage && summary && (
      <div className="cashbook-funds" aria-label="Tồn quỹ hiện tại">
        {summary.funds.map((fund) => (
          <article className="card cashbook-fund-card" key={fund.fund}>
            <span className={`cashbook-fund-icon is-${fund.fund}`} aria-hidden="true"><i className={`ph ${fund.fund === 'cash' ? 'ph-money' : 'ph-bank'}`} /></span>
            <div>
              <small>Tồn {fundLabels[fund.fund].toLowerCase()} hiện tại</small>
              <strong className={fund.currentBalance < 0 ? 'text-danger' : undefined}>{formatMoney(fund.currentBalance)}</strong>
            </div>
          </article>
        ))}
        <article className="card cashbook-fund-card">
          <span className="cashbook-fund-icon" aria-hidden="true"><i className="ph ph-wallet" /></span>
          <div><small>Tổng tồn quỹ hiện tại</small><strong>{formatMoney(summary.total.currentBalance)}</strong></div>
        </article>
      </div>
    )}
    <div className="page-grid">
      <FilterPanel title="Bộ lọc sổ quỹ" onApply={apply} onReset={reset}>
        {canManage && <DateRangeFilter label="Thời gian" from={draft.dateFrom} to={draft.dateTo} onFromChange={(dateFrom) => setDraft({ ...draft, dateFrom })} onToChange={(dateTo) => setDraft({ ...draft, dateTo })} />}
        <SelectFilter label="Loại phiếu" value={draft.type} onChange={(type) => setDraft({ ...draft, type, category: '' })} options={[all, { value: 'income', label: 'Phiếu thu' }, { value: 'expense', label: 'Phiếu chi' }]} />
        <SelectFilter label="Quỹ" value={draft.fund} onChange={(fund) => setDraft({ ...draft, fund })} options={[all, { value: 'cash', label: fundLabels.cash }, { value: 'bank', label: fundLabels.bank }]} />
        <SelectFilter label="Loại thu chi" value={draft.category} onChange={(category) => setDraft({ ...draft, category })} options={[all, ...categories.map((category) => ({ value: category.key, label: category.label }))]} />
        <SelectFilter label="Trạng thái" value={draft.status} onChange={(status) => setDraft({ ...draft, status })} options={[all, { value: 'active', label: 'Đã ghi sổ' }, { value: 'cancelled', label: 'Đã hủy' }]} />
      </FilterPanel>
      <section className="data-panel">
        <SearchToolbar value={draft.search} placeholder="Tìm mã phiếu, người nộp/nhận, ghi chú" onChange={(search) => setDraft({ ...draft, search })} onSearch={apply} onRefresh={() => { void query.refetch(); if (canManage) void summaryQuery.refetch(); }} />
        {query.isPending ? <LoadingState /> : query.error ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : !rows.length ? <EmptyState title="Chưa có phiếu thu chi" message="Các khoản thu bán hàng, thu nợ, chi lương và phiếu lập tay sẽ hiển thị tại đây." /> : <>
          <div className="table-scroll"><table className="data-table cashbook-table">
            <thead><tr><th>Mã phiếu</th><th>Thời gian</th><th>Loại thu chi</th><th>Người nộp/nhận</th><th>Quỹ</th><th className="text-right">Giá trị</th><th>Trạng thái</th></tr></thead>
            <tbody>{rows.map((row) => {
              const isExpanded = expanded === row.id;
              const cancelled = row.status === 'cancelled';
              return <Fragment key={row.id}>
                <tr className={`expandable-data-row ${isExpanded ? 'is-expanded' : ''} ${cancelled ? 'cashbook-row-cancelled' : ''}`} onClick={() => setExpanded(isExpanded ? null : row.id)} aria-expanded={isExpanded}>
                  <td data-label="Mã phiếu"><span className="cell-main link">{row.code}</span><small className="cell-sub">{voucherTypeLabels[row.type]}</small></td>
                  <td data-label="Thời gian" className="numeric-cell">{formatDateTime(row.occurredAt)}</td>
                  <td data-label="Loại thu chi"><span className="cell-main">{row.categoryLabel}</span>{row.sourceCode && <small className="cell-sub">{row.sourceCode}</small>}</td>
                  <td data-label="Người nộp/nhận">{row.counterpartyName || <span className="text-faint">-</span>}</td>
                  <td data-label="Quỹ">{fundLabels[row.fund]}</td>
                  <td data-label="Giá trị" className={`money-cell ${cancelled ? 'text-muted' : row.type === 'income' ? 'text-success' : 'text-danger'}`}>{row.type === 'income' ? '+' : '-'}{formatMoney(row.amount)}</td>
                  <td data-label="Trạng thái"><span className={`status-badge ${row.status}`}>{cancelled ? 'Đã hủy' : 'Đã ghi sổ'}</span></td>
                </tr>
                {isExpanded && <tr className="expandable-detail-row"><td colSpan={7}><CashVoucherDetail voucher={row} canCancel={canManage} onCancel={() => setCancelling(row)} /></td></tr>}
              </Fragment>;
            })}</tbody>
          </table></div>
          <Pagination pagination={query.data?.meta.pagination} onChange={(nextPage) => { setExpanded(null); setPage(nextPage); }} />
        </>}
      </section>
    </div>
    {creating && <CashVoucherModal initialType={creating} onClose={() => setCreating(null)} />}
    {fundAction && <CashFundModal action={fundAction} balances={summary?.funds} onClose={() => setFundAction(null)} />}
    {cancelling && <CashVoucherCancelModal voucher={cancelling} onClose={() => setCancelling(null)} />}
  </div></main>;
}
