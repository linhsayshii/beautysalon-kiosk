import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appConfig } from '@/app/config';
import { GoodsTypeBadge } from '@/components/data-display/Badges';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/DataState';
import { Pagination } from '@/components/data-display/Pagination';
import { FilterPanel, SelectFilter } from '@/components/forms/FilterPanel';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { SearchToolbar } from '@/components/forms/SearchToolbar';
import { PageHeader } from '@/components/ui/PageHeader/PageHeader';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { formatMoney } from '@/lib/format';
import { getPricebooks, updatePrice } from '../inventory.api';

const initialFilters = { search: '', pricebookId: '', category: '' };

export function PricebooksView() {
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const { notify } = useToast();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['pricebooks', filters, page], queryFn: () => getPricebooks({ page, pageSize: appConfig.defaultPageSize, ...filters }) });
  const mutation = useMutation({ mutationFn: ({ pricebookId, itemType, itemId, salePrice }: { pricebookId: number; itemType: string; itemId: number; salePrice: number }) => updatePrice(pricebookId, itemType, itemId, salePrice), onSuccess: () => { notify('Đã lưu giá', 'Bảng giá đã được cập nhật.'); client.invalidateQueries({ queryKey: ['pricebooks'] }); }, onError: (error) => notify('Không thể lưu giá', error.message) });
  const rows = query.data?.data ?? [];
  const book = query.data?.meta.pricebook ?? { id: 0, name: '' };
  const apply = () => { setFilters(draft); setPage(1); };

  return <main className="workspace"><div className="workspace-shell">
    <PageHeader title="Thiết lập giá" subtitle="Xem giá vốn, giá nhập cuối và cập nhật bảng giá bán." />
    <div className="workspace-grid"><FilterPanel title="Bảng giá" onApply={apply} onReset={() => { setDraft(initialFilters); setFilters(initialFilters); setPage(1); }}>
      <SelectFilter label="Bảng giá" value={draft.pricebookId} onChange={(pricebookId) => setDraft({ ...draft, pricebookId })} options={(query.data?.meta.pricebooks ?? []).map((item) => ({ value: String(item.id), label: item.name }))} />
      <SelectFilter label="Nhóm hàng" value={draft.category} onChange={(category) => setDraft({ ...draft, category })} options={[{ value: '', label: 'Tất cả' }, ...(query.data?.meta.categories ?? []).map((category) => ({ value: category, label: category }))]} />
    </FilterPanel><section className="data-panel"><SearchToolbar value={draft.search} placeholder="Tìm theo mã hoặc tên hàng" onChange={(search) => setDraft({ ...draft, search })} onSearch={apply} onRefresh={() => query.refetch()} />
      {query.isPending ? <LoadingState /> : query.error ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : !rows.length ? <EmptyState /> : <><div className="table-scroll"><table className="data-table pricebook-table"><thead><tr><th>Mã hàng hóa</th><th>Tên hàng</th><th>Loại</th><th>Giá vốn</th><th>Giá nhập cuối</th><th>{book?.name}</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.itemType}-${row.itemId}`}><td data-label="Mã hàng"><span className="cell-main">{row.code}</span></td><td data-label="Tên hàng"><span className="cell-main">{row.name}</span><small className="cell-sub">{row.category}</small></td><td data-label="Loại"><GoodsTypeBadge type={row.itemType} /></td><td data-label="Giá vốn" className="money-cell">{formatMoney(row.costPrice)}</td><td data-label="Giá nhập cuối" className="money-cell">{formatMoney(row.lastPurchasePrice)}</td><td data-label={book?.name}><MoneyInput wrapperClassName="price-input" suffix="đ" defaultValue={row.bookPrice} disabled={mutation.isPending} aria-label={`Giá bán ${row.name}`} onBlur={(event) => { const salePrice = Math.max(0, Number(event.target.value.replace(/\D/g, '')) || 0); if (salePrice !== Number(row.bookPrice)) mutation.mutate({ pricebookId: book.id, itemType: row.itemType, itemId: row.itemId, salePrice }); }} /></td></tr>)}</tbody></table></div><Pagination pagination={query.data?.meta.pagination} onChange={setPage} /></>}
    </section></div>
  </div></main>;
}
