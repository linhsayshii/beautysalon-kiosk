import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { DetailFacts } from '@/components/data-display/InlineDetail';
import { ErrorState, LoadingState } from '@/components/data-display/DataState';
import { MobileHeaderAction, MobilePageHeader } from '@/components/ui/MobilePageHeader/MobilePageHeader';
import { BottomSheet } from '@/components/ui/Sheet/BottomSheet';
import { Select } from '@/components/ui/Select/Select';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { useAuth } from '@/features/auth/AuthProvider';
import { hasPermission } from '@/features/auth/authorization';
import {
  fundLabels, getCashbookSummary, getCashVouchers, voucherSourceLabels, voucherTypeLabels,
  type CashVoucher, type CashVoucherType,
} from '@/features/cashbook/cashbook.api';
import { CashVoucherCancelModal } from '@/features/cashbook/components/CashVoucherCancelModal';
import { voucherCounterpartyLabel } from '@/features/cashbook/components/CashVoucherDetail';
import { CashVoucherFields } from '@/features/cashbook/components/CashVoucherFields';
import { useCashVoucherForm } from '@/features/cashbook/useCashVoucherForm';
import { periodRange, type ReportPeriod } from '@/features/reports/reports.api';
import { MobileDetailSheet, MobileEmptyState, MobileFilterSheet, MobileMetricCards, MobileSearchBar, MobileSegmentedControl } from '@/features/mobile-common';
import { formatDateOnly } from '@/lib/date';
import { formatDateTime, formatMoney, formatTime } from '@/lib/format';
import { useMetadata } from '@/services/metadata';
import { statusLabels } from '@/types/api';

const PAGE_SIZE = 20;
const datePresets: Array<{ value: ReportPeriod; label: string }> = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'yesterday', label: 'Hôm qua' },
  { value: 'last_7_days', label: '7 ngày qua' },
  { value: 'this_month', label: 'Tháng này' },
  { value: 'last_month', label: 'Tháng trước' },
];
type TypeFilter = 'all' | CashVoucherType;
interface Filters { period: ReportPeriod; fund: string; category: string; status: string }
const initialFilters: Filters = { period: 'this_month', fund: '', category: '', status: '' };

function MobileCashVoucherSheet({ initialType, onClose }: { initialType: CashVoucherType; onClose: () => void }) {
  const { notify } = useToast();
  const form = useCashVoucherForm(initialType, (result) => { notify('Đã ghi sổ quỹ', result.message); onClose(); });
  const pending = form.mutation.isPending;
  return (
    <BottomSheet open onClose={onClose} title="Lập phiếu thu chi" height="full" closeOnBackdrop={!pending}
      footer={<>
        <button className="btn btn-secondary" type="button" onClick={onClose} disabled={pending}>Bỏ qua</button>
        <button className="btn btn-primary" type="button" onClick={form.submit} disabled={Boolean(form.problem) || pending}>{pending ? 'Đang lưu…' : 'Lưu phiếu'}</button>
      </>}>
      <CashVoucherFields form={form} idPrefix="m-cash-voucher" />
      {form.problem && form.amount > 0 && <p className="m-note">{form.problem}</p>}
    </BottomSheet>
  );
}

export function MobileCashbookView() {
  const { account } = useAuth();
  const canManage = account ? hasPermission(account.role, 'finance:read') : false;
  const metadata = useMetadata();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [type, setType] = useState<TypeFilter>('all');
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [draft, setDraft] = useState<Filters>(initialFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [creating, setCreating] = useState<CashVoucherType | null>(params.get('create') ? 'income' : null);
  // The quick-create action can land here while the page is already open.
  const createRequested = Boolean(params.get('create'));
  useEffect(() => { if (createRequested) setCreating('income'); }, [createRequested]);
  const [selected, setSelected] = useState<CashVoucher | null>(null);
  const [cancelling, setCancelling] = useState<CashVoucher | null>(null);

  const range = canManage ? periodRange(filters.period) : periodRange('today');
  const summaryQuery = useQuery({ queryKey: ['cashbook-summary', range], queryFn: () => getCashbookSummary(range), enabled: canManage });
  const listFilters = { ...range, type: type === 'all' ? '' : type, fund: filters.fund, category: filters.category, status: filters.status, search: search.trim() };
  const query = useInfiniteQuery({
    queryKey: ['mobile-cashbook', listFilters],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => getCashVouchers({ ...listFilters, page: pageParam, pageSize: PAGE_SIZE }),
    getNextPageParam: (lastPage) => {
      const pagination = lastPage.meta?.pagination;
      return pagination && pagination.page < pagination.totalPages ? pagination.page + 1 : undefined;
    },
  });
  const rows = query.data?.pages.flatMap((page) => page.data) ?? [];
  const meta = query.data?.pages[0]?.meta;
  const summary = summaryQuery.data?.data;

  const closeCreate = () => {
    setCreating(null);
    if (params.get('create')) setParams({}, { replace: true });
  };
  const periodLabel = canManage ? datePresets.find((preset) => preset.value === filters.period)?.label : 'Hôm nay';
  const categories = (metadata.data?.data.cashbook?.categories ?? []).filter((category) => type === 'all' || category.type === type);
  const activeFilters = [filters.fund, filters.category, filters.status].filter(Boolean).length;

  const groups = rows.reduce<Array<[string, CashVoucher[]]>>((result, row) => {
    const day = formatDateOnly(new Date(row.occurredAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const last = result[result.length - 1];
    if (last && last[0] === day) last[1].push(row); else result.push([day, [row]]);
    return result;
  }, []);

  return (
    <div className="m-page mobile-cashbook">
      <MobilePageHeader
        title="Sổ quỹ"
        backTo={canManage ? '/m/more' : '/m/pos'}
        actions={<MobileHeaderAction icon="ph ph-magnifying-glass" label="Tìm kiếm" active={searchVisible} onClick={() => { if (searchVisible) setSearch(''); setSearchVisible(!searchVisible); }} />}
      >
        {searchVisible && <MobileSearchBar value={search} placeholder="Tìm mã phiếu, người nộp/nhận, ghi chú" onChange={setSearch} autoFocus />}
        <MobileSegmentedControl<TypeFilter>
          value={type}
          onChange={(value) => { setType(value); setFilters((current) => ({ ...current, category: '' })); }}
          options={[{ value: 'all', label: 'Tất cả' }, { value: 'income', label: 'Phiếu thu' }, { value: 'expense', label: 'Phiếu chi' }]}
        />
        <div className="m-chip-strip">
          <button type="button" className="chip chip-icon" aria-label="Bộ lọc" aria-pressed={activeFilters > 0} onClick={() => { setDraft(filters); setFilterOpen(true); }}><i className="ph ph-faders" /></button>
          {canManage && datePresets.map((preset) => (
            <button key={preset.value} type="button" className="chip" aria-pressed={filters.period === preset.value} onClick={() => setFilters({ ...filters, period: preset.value })}>{preset.label}</button>
          ))}
        </div>
        <div className="m-summary-bar">
          <span className="m-summary-title">{periodLabel}</span>
          <span className="m-summary-count">
            Thu <strong className="text-success">{formatMoney(meta?.summary.income)}</strong> · Chi <strong className="text-danger">{formatMoney(meta?.summary.expense)}</strong>
          </span>
        </div>
      </MobilePageHeader>

      <div className="m-body">
        {canManage && summary && (
          <MobileMetricCards items={[
            { label: 'Tiền mặt', value: formatMoney(summary.funds.find((fund) => fund.fund === 'cash')?.currentBalance), note: 'Tồn hiện tại' },
            { label: 'Ngân hàng', value: formatMoney(summary.funds.find((fund) => fund.fund === 'bank')?.currentBalance), note: 'Tồn hiện tại' },
            { label: 'Tổng quỹ', value: formatMoney(summary.total.currentBalance), note: `Cuối kỳ ${formatMoney(summary.total.closing)}` },
          ]} />
        )}
        {canManage && summaryQuery.error && <ErrorState compact error={summaryQuery.error} onRetry={() => summaryQuery.refetch()} />}

        {query.isPending ? <LoadingState compact />
          : query.error && !rows.length ? <ErrorState compact error={query.error} onRetry={() => query.refetch()} />
            : !rows.length ? <MobileEmptyState icon="ph ph-wallet" title="Chưa có phiếu thu chi" description="Bấm + để lập phiếu thu hoặc phiếu chi." />
              : <>
                {groups.map(([day, items]) => (
                  <section className="mobile-cashbook-group" key={day}>
                    <div className="m-section-title">{day}</div>
                    <div className="card mobile-cashbook-list">
                      {items.map((row) => {
                        const cancelled = row.status === 'cancelled';
                        return (
                          <button type="button" key={row.id} className={`mobile-cashbook-row ${cancelled ? 'is-cancelled' : ''}`} onClick={() => setSelected(row)}>
                            <span className={`mobile-cashbook-icon is-${row.type}`} aria-hidden="true"><i className={`ph ${row.type === 'income' ? 'ph-arrow-down-left' : 'ph-arrow-up-right'}`} /></span>
                            <span className="mobile-cashbook-main">
                              <strong>{row.categoryLabel}</strong>
                              <small>{row.code} · {formatTime(row.occurredAt)} · {fundLabels[row.fund]}{row.counterpartyName ? ` · ${row.counterpartyName}` : ''}</small>
                            </span>
                            <span className="mobile-cashbook-amount">
                              <strong className={cancelled ? 'text-muted' : row.type === 'income' ? 'text-success' : 'text-danger'}>{row.type === 'income' ? '+' : '-'}{formatMoney(row.amount)}</strong>
                              {cancelled && <span className="status-badge cancelled">Đã hủy</span>}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
                {query.error && <ErrorState compact error={query.error} onRetry={() => query.fetchNextPage()} />}
                {query.hasNextPage && (
                  <button type="button" className="btn btn-secondary btn-block" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>{query.isFetchingNextPage ? 'Đang tải thêm…' : 'Xem thêm'}</button>
                )}
              </>}
      </div>

      <button type="button" className="m-fab" aria-label="Lập phiếu thu chi" onClick={() => setCreating('income')}><i className="ph ph-plus" /></button>

      <MobileFilterSheet isOpen={filterOpen} title="Lọc phiếu thu chi" onClose={() => setFilterOpen(false)}
        onReset={() => setDraft({ ...initialFilters, period: draft.period })}
        onApply={() => { setFilters(draft); setFilterOpen(false); }}>
        <div className="form-stack">
          <div className="field">
            <span className="field-label">Quỹ</span>
            <div className="chip-group">
              {[{ value: '', label: 'Tất cả' }, { value: 'cash', label: fundLabels.cash }, { value: 'bank', label: fundLabels.bank }].map((option) => (
                <button key={option.value} type="button" className="chip" aria-pressed={draft.fund === option.value} onClick={() => setDraft({ ...draft, fund: option.value })}>{option.label}</button>
              ))}
            </div>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="m-cash-filter-category">Loại thu chi</label>
            <Select<string> id="m-cash-filter-category" value={draft.category} onChange={(category) => setDraft({ ...draft, category })} fullWidth
              options={[{ value: '', label: 'Tất cả' }, ...categories.map((category) => ({ value: category.key, label: category.label }))]} />
          </div>
          <div className="field">
            <span className="field-label">Trạng thái</span>
            <div className="chip-group">
              {[{ value: '', label: 'Tất cả' }, { value: 'active', label: 'Đã ghi sổ' }, { value: 'cancelled', label: 'Đã hủy' }].map((option) => (
                <button key={option.value} type="button" className="chip" aria-pressed={draft.status === option.value} onClick={() => setDraft({ ...draft, status: option.value })}>{option.label}</button>
              ))}
            </div>
          </div>
        </div>
      </MobileFilterSheet>

      {selected && (
        <MobileDetailSheet isOpen title={`${voucherTypeLabels[selected.type]} ${selected.code}`} subtitle={selected.categoryLabel} onClose={() => setSelected(null)}
          footerActions={canManage && selected.cancellable ? <button type="button" className="btn btn-danger-soft" onClick={() => setCancelling(selected)}>Hủy phiếu</button> : undefined}>
          <section className="card card-body mobile-cashbook-detail">
          <div className="mobile-cashbook-detail-amount">
            <strong className={selected.status === 'cancelled' ? 'text-muted' : selected.type === 'income' ? 'text-success' : 'text-danger'}>{selected.type === 'income' ? '+' : '-'}{formatMoney(selected.amount)}</strong>
            <span className={`status-badge ${selected.status}`}>{selected.status === 'cancelled' ? 'Đã hủy' : 'Đã ghi sổ'}</span>
          </div>
          <DetailFacts columns={3} items={[
            { label: 'Thời gian', value: formatDateTime(selected.occurredAt) },
            { label: 'Quỹ', value: fundLabels[selected.fund] },
            { label: 'Hình thức', value: selected.paymentMethod ? statusLabels[selected.paymentMethod] ?? selected.paymentMethod : fundLabels[selected.fund] },
            { label: voucherCounterpartyLabel(selected), value: selected.counterpartyName || '-' },
            { label: 'Nguồn phiếu', value: voucherSourceLabels[selected.sourceType] },
            selected.sourceCode ? { label: 'Chứng từ gốc', value: selected.sourceCode, tone: 'primary' } : false,
            { label: 'Người lập', value: selected.createdByName ?? 'Hệ thống' },
            { label: 'Ghi chú', value: selected.note || '-', variant: 'note', span: 'full' },
            selected.status === 'cancelled' && { label: 'Lý do hủy', value: selected.cancelReason || '-', variant: 'note', span: 'full' },
          ]} />
          </section>
          {!selected.cancellable && selected.status === 'active' && <p className="m-note">Phiếu tạo tự động, điều chỉnh tại chứng từ gốc.</p>}
        </MobileDetailSheet>
      )}
      {creating && <MobileCashVoucherSheet initialType={creating} onClose={closeCreate} />}
      {cancelling && <CashVoucherCancelModal voucher={cancelling} onClose={() => { setCancelling(null); setSelected(null); }} />}
    </div>
  );
}
