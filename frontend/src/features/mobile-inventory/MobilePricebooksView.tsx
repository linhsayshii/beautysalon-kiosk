import { useState, useMemo } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPricebooks, updatePrice, type Pricebook } from '@/features/inventory/inventory.api';
import { PricebookDialog } from '@/features/inventory/components/PricebooksView';
import { InventoryListRow } from '@/features/inventory/components/InventoryListRow';
import { DetailHead, ValueStrip } from '@/components/data-display/InlineDetail';
import { inventoryTypes } from '@/features/inventory/inventory-ui';
import type { InventoryItemType } from '@/features/inventory/inventory.api';
import { invalidateInventoryQueries } from '@/features/inventory/invalidateInventoryQueries';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { Select } from '@/components/ui/Select/Select';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { formatMoney } from '@/lib/format';
import {
  MobileSearchBar,
  MobileFilterSheet,
  MobileDetailSheet,
  MobileEmptyState,
  MobileSortDropdown,
} from '@/features/mobile-common';
import type { ApiRecord } from '@/types/api';
import { MobilePageHeader } from '@/components/ui/MobilePageHeader/MobilePageHeader';
import { ErrorState, LoadingState } from '@/components/data-display/DataState';

export function MobilePricebooksView() {
  const [search, setSearch] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [pricebookId, setPricebookId] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Pricebook dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Partial<Pricebook> | null>(null);

  // Draft filters for bottom sheet
  const [draftPricebookId, setDraftPricebookId] = useState('');
  const [draftCategory, setDraftCategory] = useState('');
  const [draftType, setDraftType] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Sorting
  const [sortValue, setSortValue] = useState<string>('price_desc');

  const sortOptions = [
    { value: 'price_desc', label: 'Giá bán cao' },
    { value: 'price_asc', label: 'Giá bán thấp' },
    { value: 'name_asc', label: 'Tên A → Z' },
    { value: 'name_desc', label: 'Tên Z → A' },
    { value: 'cost_desc', label: 'Giá vốn cao' },
    { value: 'cost_asc', label: 'Giá vốn thấp' },
  ];

  // Detail Sheet
  const [selectedItem, setSelectedItem] = useState<ApiRecord | null>(null);
  const [draftPrice, setDraftPrice] = useState(0);

  const { notify } = useToast();
  const client = useQueryClient();

  const {
    data: pricebooksData,
    isLoading, error, refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['mobile-pricebooks', search, pricebookId, categoryFilter, typeFilter, sortValue],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      getPricebooks({
        search, sort: sortValue,
        pricebookId,
        category: categoryFilter,
        type: typeFilter,
        page: pageParam,
        pageSize: 100,
      }),
    getNextPageParam: (lastPage) => {
      const pagination = lastPage.meta?.pagination;
      return pagination && pagination.page < pagination.totalPages ? pagination.page + 1 : undefined;
    },
  });

  const mutation = useMutation({
    mutationFn: ({
      pId,
      itemType,
      itemId,
      salePrice,
    }: {
      pId: number;
      itemType: string;
      itemId: number;
      salePrice: number;
    }) => updatePrice(pId, itemType, itemId, salePrice),
    onSuccess: () => {
      notify('Đã lưu giá', 'Bảng giá đã được cập nhật thành công.');
      void invalidateInventoryQueries(client);
      setSelectedItem(null);
    },
    onError: (error) => notify('Không thể lưu giá', error.message),
  });

  const rawRows = (pricebooksData?.pages.flatMap((page) => page.data) ?? []) as ApiRecord[];
  const meta = pricebooksData?.pages[0]?.meta;
  const totalRows = meta?.pagination?.total ?? rawRows.length;
  const pricebooksList = meta?.pricebooks ?? [];
  const currentBook = meta?.pricebook;
  const pricebookOptions = [
    { value: '', label: pricebooksList.find(book => book.isDefault)?.name || 'Bảng giá chung' },
    ...pricebooksList
      .filter((book) => !book.isDefault)
      .map((book) => ({ value: String(book.id), label: `${book.name}${book.active ? '' : ' (Ngừng)'}` })),
  ];
  const categories = meta?.categories ?? [];

  const handleApplyFilter = () => {
    setPricebookId(draftPricebookId);
    setCategoryFilter(draftCategory);
    setTypeFilter(draftType);
    setIsFilterOpen(false);
  };

  const handleResetFilter = () => {
    setDraftPricebookId('');
    setDraftCategory('');
    setDraftType('');
    setPricebookId('');
    setCategoryFilter('');
    setTypeFilter('');
    setIsFilterOpen(false);
  };

  const openFilterSheet = () => {
    setDraftPricebookId(pricebookId);
    setDraftCategory(categoryFilter);
    setDraftType(typeFilter);
    setIsFilterOpen(true);
  };

  const activeBookName = useMemo(() => {
    if (!pricebookId) return currentBook?.name || 'Bảng giá chung';
    const found = pricebooksList.find((b) => String(b.id) === String(pricebookId));
    return found ? found.name : currentBook?.name || 'Bảng giá chung';
  }, [pricebookId, pricebooksList, currentBook]);

  return (
    <div className="m-page">
      <MobilePageHeader
        title="Thiết lập giá" backTo="/m/more"
        actions={(
          <>
            <button
              type="button"
              className="btn btn-ghost btn-icon m-header-action"
              disabled={!currentBook} onClick={() => { setEditingBook(currentBook as Partial<Pricebook>); setDialogOpen(true); }}
              aria-label="Sửa bảng giá đang chọn"
            >
              <i className="ph ph-pencil-simple" />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-icon m-header-action"
              onClick={() => { setEditingBook(null); setDialogOpen(true); }}
              aria-label="Thêm bảng giá"
            >
              <i className="ph ph-plus" />
            </button>
            <button
              type="button"
              className={`btn btn-ghost btn-icon m-header-action${isSearchVisible ? ' is-active' : ''}`}
              onClick={() => { if (isSearchVisible) setSearch(''); setIsSearchVisible(!isSearchVisible); }}
              aria-label="Tìm kiếm"
            >
              <i className="ph ph-magnifying-glass" />
            </button>
          </>
        )}
      >
        {isSearchVisible && (
          <MobileSearchBar
            value={search}
            placeholder="Tìm theo tên, mã hàng..."
            onChange={setSearch}
            autoFocus
          />
        )}

        <div className="m-chip-strip">
          <button
            type="button"
            className="chip chip-icon"
            onClick={openFilterSheet}
            aria-label="Mở bộ lọc"
          >
            <i className="ph ph-faders" />
          </button>

          {/* Pricebook Chip */}
          <button
            type="button"
            className={`chip ${pricebookId ? 'is-active' : ''}`}
            onClick={openFilterSheet}
          >
            <span>Bảng giá: {activeBookName}</span>
            <i className="ph ph-caret-down" />
          </button>

          {/* Category Chip */}
          <button
            type="button"
            className={`chip ${categoryFilter ? 'is-active' : ''}`}
            onClick={openFilterSheet}
          >
            <span>{categoryFilter ? categoryFilter : 'Tất cả nhóm'}</span>
            <i className="ph ph-caret-down" />
          </button>

          {/* Type Chip */}
          <button
            type="button"
            className={`chip ${typeFilter ? 'is-active' : ''}`}
            onClick={openFilterSheet}
          >
            <span>
              {typeFilter === 'product'
                ? 'Sản phẩm'
                : typeFilter === 'service'
                ? 'Dịch vụ'
                : typeFilter === 'package'
                ? 'Gói dịch vụ'
                : typeFilter === 'account_card'
                ? 'Thẻ tài khoản'
                : 'Tất cả loại'}
            </span>
            <i className="ph ph-caret-down" />
          </button>
        </div>

        <div className="m-summary-bar">
          <MobileSortDropdown
            value={sortValue}
            options={sortOptions}
            onChange={setSortValue}
          />

          <div className="m-summary-count" aria-live="polite">
            {totalRows} mặt hàng{totalRows > rawRows.length ? ` · đã tải ${rawRows.length}` : ''}{mutation.isPending ? ' · Đang lưu giá…' : ''}
          </div>
        </div>
      </MobilePageHeader>

      <div className="m-body">
        {isLoading ? <LoadingState compact label="Đang tải bảng giá…" />
          : error && !rawRows.length ? <ErrorState compact error={error} onRetry={() => refetch()} />
          : !rawRows.length ? <MobileEmptyState title="Không tìm thấy hàng hóa trong bảng giá" description={search ? 'Thử từ khóa khác hoặc đổi bộ lọc.' : undefined} />
          : <>
            <div className="m-list">{rawRows.map(item => <InventoryListRow key={`${item.itemType}:${item.itemId}`} item={item} price={item.bookPrice} onClick={() => { mutation.reset(); setSelectedItem(item); setDraftPrice(Number(item.bookPrice ?? item.salePrice)); }} />)}</div>
            {error && <ErrorState compact error={error} onRetry={() => fetchNextPage()} />}
            {hasNextPage && <button type="button" className="btn btn-secondary btn-block" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>{isFetchingNextPage ? 'Đang tải thêm…' : 'Tải thêm mặt hàng'}</button>}
          </>}
      </div>

      {/* Filter Bottom Sheet */}
      <MobileFilterSheet
        isOpen={isFilterOpen}
        title="Bộ lọc bảng giá"
        onClose={() => setIsFilterOpen(false)}
        onReset={handleResetFilter}
        onApply={handleApplyFilter}
      >
        <div className="mobile-filter-field">
          <label className="mobile-filter-field-label">Bảng giá</label>
          <Select
            triggerClassName="mobile-filter-select"
            variant="filter"
            fullWidth
            value={draftPricebookId}
            aria-label="Chọn bảng giá"
            onChange={setDraftPricebookId}
            options={pricebookOptions}
          />
        </div>

        <div className="mobile-filter-field">
          <label className="mobile-filter-field-label">Nhóm hàng</label>
          <Select
            aria-label="Nhóm hàng"
            triggerClassName="mobile-filter-select"
            variant="filter"
            fullWidth
            value={draftCategory}
            onChange={setDraftCategory}
            options={[{ value: '', label: 'Tất cả nhóm' }, ...categories.map((category) => ({ value: category, label: category }))]}
          />
        </div>

        <div className="mobile-filter-field">
          <label className="mobile-filter-field-label">Loại hàng</label>
          <Select
            aria-label="Loại hàng"
            triggerClassName="mobile-filter-select"
            variant="filter"
            fullWidth
            value={draftType}
            onChange={setDraftType}
            options={[{ value: '', label: 'Tất cả loại' }, { value: 'product', label: 'Sản phẩm' }, { value: 'service', label: 'Dịch vụ' }, { value: 'package', label: 'Gói dịch vụ' }, { value: 'account_card', label: 'Thẻ tài khoản' }]}
          />
        </div>
      </MobileFilterSheet>

      <MobileDetailSheet isOpen={selectedItem !== null} title="Thiết lập giá bán" subtitle={activeBookName}
        onClose={() => { if (!mutation.isPending) setSelectedItem(null); }}
        footerActions={<button type="button" className="btn btn-primary" disabled={mutation.isPending || selectedItem?.active === false || !currentBook || draftPrice === Number(selectedItem?.bookPrice ?? selectedItem?.salePrice)} onClick={() => {
          if (selectedItem && currentBook && !mutation.isPending) mutation.mutate({ pId: Number(currentBook.id), itemType: selectedItem.itemType, itemId: selectedItem.itemId, salePrice: draftPrice });
        }}>{mutation.isPending ? 'Đang lưu…' : 'Lưu giá'}</button>}
      >
        {selectedItem && <div className="form-stack">
          <DetailHead icon={inventoryTypes[selectedItem.itemType as InventoryItemType].icon} title={selectedItem.name} meta={selectedItem.code} />
          <ValueStrip items={[
            { label: 'Giá vốn', value: formatMoney(selectedItem.costPrice) },
            { label: 'Giá niêm yết', value: formatMoney(selectedItem.salePrice) },
          ]} />
          <label className="field"><span className="field-label">Giá bán trong {activeBookName}</span><MoneyInput aria-label={`Giá bán ${selectedItem.name}`} value={draftPrice} onChange={setDraftPrice} suffix="đ" disabled={mutation.isPending || selectedItem.active === false} /></label>
          <p className="field-hint">{selectedItem.active === false ? 'Hãy bật lại kinh doanh trong Hàng hóa trước khi sửa giá.' : 'Giá chỉ được cập nhật khi bấm Lưu giá.'}</p>
          {mutation.error && <ErrorState compact error={mutation.error} onRetry={() => mutation.reset()} />}
        </div>}
      </MobileDetailSheet>

      {/* Pricebook Dialog */}
      <PricebookDialog open={dialogOpen} pricebook={editingBook} onClose={() => setDialogOpen(false)} onSuccess={() => setDialogOpen(false)} />
    </div>
  );
}
