import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appConfig } from '@/app/config';
import { GoodsTypeBadge } from '@/components/data-display/Badges';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/DataState';
import { Pagination } from '@/components/data-display/Pagination';
import { SummaryStrip } from '@/components/data-display/SummaryStrip';
import { FilterPanel, SelectFilter } from '@/components/forms/FilterPanel';
import { SearchToolbar } from '@/components/forms/SearchToolbar';
import { PageHeader } from '@/components/ui/PageHeader/PageHeader';
import { exportCsv } from '@/lib/export';
import { formatMoney, formatNumber } from '@/lib/format';
import { getProducts } from '../inventory.api';
import type { InventoryItemType } from '../inventory.api';
import { statusLabels } from '@/types/api';
import { toOptions, useMetadata } from '@/services/metadata';
import { GoodsCreateMenu } from './GoodsCreateMenu';
import { GoodsCreateDialog } from './GoodsCreateDialog';

const initialFilters = { search: '', type: '', category: '', stockStatus: '', status: 'active' };

export function ProductsView() {
  const metadata = useMetadata();
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [editItem, setEditItem] = useState<{ type: InventoryItemType; itemId: number; data: Record<string, unknown> } | null>(null);
  const query = useQuery({ queryKey: ['products', filters, page], queryFn: () => getProducts({ page, pageSize: appConfig.defaultPageSize, ...filters }) });
  const rows = query.data?.data ?? [];
  const summary = query.data?.meta.summary;
  const apply = () => { setFilters(draft); setPage(1); };
  const reset = () => { setDraft(initialFilters); setFilters(initialFilters); setPage(1); };

  return <main className="workspace"><div className="workspace-shell">
    <PageHeader title="Danh sách hàng hóa" subtitle="Sản phẩm, dịch vụ, gói dịch vụ, thẻ tài khoản và tồn kho tại chi nhánh." extraActions={<><GoodsCreateMenu /><button className="secondary-button" type="button" onClick={() => exportCsv(rows, 'products')}><i className="ph ph-export" />Xuất file</button></>} />
    <SummaryStrip items={[
      { label: 'Tổng hàng hóa', value: formatNumber(summary?.total), note: 'Tất cả loại hàng' },
      { label: 'Sản phẩm', value: formatNumber(summary?.products), note: 'Có theo dõi tồn kho', tone: 'green' },
      { label: 'Dịch vụ, gói & thẻ', value: formatNumber(Number(summary?.services ?? 0) + Number(summary?.packages ?? 0) + Number(summary?.account_cards ?? 0)), note: 'Không theo dõi tồn', tone: 'violet' },
      { label: 'Dưới định mức', value: formatNumber(summary?.low_stock), note: 'Cần nhập thêm', tone: 'orange' },
    ]} />
    <div className="workspace-grid"><FilterPanel title="Bộ lọc hàng hóa" onApply={apply} onReset={reset}>
      <SelectFilter label="Loại hàng" value={draft.type} onChange={(type) => setDraft({ ...draft, type })} options={[{ value: '', label: 'Tất cả' }, ...toOptions(metadata.data?.data.filters.products.types ?? [], statusLabels)]} />
      <SelectFilter label="Nhóm hàng" value={draft.category} onChange={(category) => setDraft({ ...draft, category })} options={[{ value: '', label: 'Tất cả' }, ...(query.data?.meta.categories ?? []).map((category) => ({ value: category, label: category }))]} />
      <SelectFilter label="Tồn kho" value={draft.stockStatus} onChange={(stockStatus) => setDraft({ ...draft, stockStatus })} options={[{ value: '', label: 'Tất cả' }, ...toOptions(metadata.data?.data.filters.products.stockStatuses ?? [], statusLabels)]} />
      <SelectFilter label="Trạng thái" value={draft.status} onChange={(status) => setDraft({ ...draft, status })} options={[...toOptions(metadata.data?.data.filters.products.statuses ?? [], statusLabels), { value: '', label: 'Tất cả' }]} />
    </FilterPanel><section className="data-panel"><SearchToolbar value={draft.search} placeholder="Tìm theo mã, tên hàng hoặc thương hiệu" onChange={(search) => setDraft({ ...draft, search })} onSearch={apply} onRefresh={() => query.refetch()} />
      {query.isPending ? <LoadingState /> : query.error ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : !rows.length ? <EmptyState /> : <><div className="table-scroll"><table className="data-table goods-table"><thead><tr><th><input className="table-checkbox" type="checkbox" aria-label="Chọn tất cả" /></th><th>Mã hàng hóa</th><th>Tên hàng</th><th>Loại hàng</th><th>Nhóm hàng</th><th>Giá bán</th><th>Giá vốn</th><th>Tồn kho</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.itemType}-${row.itemId}`}><td className="mobile-hide"><input className="table-checkbox" type="checkbox" aria-label={`Chọn ${row.code}`} /></td><td data-label="Mã hàng"><span className="cell-main link">{row.code}</span><small className="cell-sub">{row.brand ?? ''}</small></td><td data-label="Tên hàng"><span className="cell-main">{row.name}</span><small className="cell-sub">{row.unit}</small></td><td data-label="Loại hàng"><GoodsTypeBadge type={row.itemType} /></td><td data-label="Nhóm">{row.category}</td><td data-label="Giá bán" className="money-cell">{formatMoney(row.salePrice)}</td><td data-label="Giá vốn" className="money-cell">{row.itemType === 'product' ? formatMoney(row.costPrice) : '-'}</td><td data-label="Tồn kho" className={`numeric-cell ${row.itemType === 'product' && row.stockQuantity < row.minStock ? 'stock-low' : ''}`}>
              <span className="cell-inline-value">{row.stockQuantity === null ? '---' : formatNumber(row.stockQuantity)}</span>
              <button className="row-edit-button" type="button" aria-label={`Chỉnh sửa ${row.name}`} onClick={() => setEditItem({ type: row.itemType as InventoryItemType, itemId: Number(row.itemId), data: row })}><i className="ph ph-pencil-simple" /></button>
            </td></tr>)}</tbody></table></div><Pagination pagination={query.data?.meta.pagination} onChange={setPage} /></>}
    </section></div>
    {editItem && <GoodsCreateDialog type={editItem.type} itemId={editItem.itemId} initialData={editItem.data} onClose={() => setEditItem(null)} />}
  </div></main>;
}
