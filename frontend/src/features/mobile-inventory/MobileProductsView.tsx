import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { GoodsCreateDialog } from '@/features/inventory/components/GoodsCreateDialog';
import { Select } from '@/components/ui/Select/Select';
import { getProducts, type InventoryItemType } from '@/features/inventory/inventory.api';
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
import { InventoryItemDetails } from '@/features/inventory/components/InventoryItemDetails';
import { InventoryListRow } from '@/features/inventory/components/InventoryListRow';
import { inventoryTypes, inventoryTypeOptions } from '@/features/inventory/inventory-ui';

export function MobileProductsView() {
  const [search, setSearch] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [draftStatus, setDraftStatus] = useState('active');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState('');
  const [sortValue, setSortValue] = useState<string>('price_desc');

  const sortOptions = [
    { value: 'price_desc', label: 'Giá bán cao' },
    { value: 'price_asc', label: 'Giá bán thấp' },
    { value: 'name_asc', label: 'Tên A → Z' },
    { value: 'name_desc', label: 'Tên Z → A' },
    { value: 'stock_desc', label: 'Tồn nhiều nhất' },
    { value: 'stock_asc', label: 'Tồn ít nhất' },
  ];

  // Draft filters for bottom sheet
  const [draftType, setDraftType] = useState('');
  const [draftCategory, setDraftCategory] = useState('');
  const [draftStockStatus, setDraftStockStatus] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [selectedItem, setSelectedItem] = useState<ApiRecord | null>(null);
  const [editingItem, setEditingItem] = useState<ApiRecord | null>(null);
  const [isCreatingType, setIsCreatingType] = useState<InventoryItemType | null>(null);
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [editInitialTab, setEditInitialTab] = useState<'information' | 'details'>('information');

  const {
    data: productsData,
    isLoading, error, refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['mobile-products', search, typeFilter, categoryFilter, stockStatusFilter, statusFilter, sortValue],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      getProducts({
        search, sort: sortValue,
        type: typeFilter,
        category: categoryFilter,
        stockStatus: stockStatusFilter,
        status: statusFilter,
        page: pageParam,
        pageSize: 100,
      }),
    getNextPageParam: (lastPage) => {
      const pagination = lastPage.meta?.pagination;
      return pagination && pagination.page < pagination.totalPages ? pagination.page + 1 : undefined;
    },
  });

  const rawRows = (productsData?.pages.flatMap((page) => page.data) ?? []) as ApiRecord[];
  const meta = productsData?.pages[0]?.meta;
  const totalRows = meta?.pagination?.total ?? rawRows.length;
  const categories = meta?.categories ?? [];

  const handleApplyFilter = () => {
    setTypeFilter(draftType);
    setStatusFilter(draftStatus);
    setCategoryFilter(draftCategory);
    setStockStatusFilter(draftStockStatus);
    setIsFilterOpen(false);
  };

  const handleResetFilter = () => {
    setDraftType('');
    setDraftStatus('active');
    setStatusFilter('active');
    setDraftCategory('');
    setDraftStockStatus('');
    setTypeFilter('');
    setCategoryFilter('');
    setStockStatusFilter('');
    setIsFilterOpen(false);
  };

  const openFilterSheet = () => {
    setDraftType(typeFilter);
    setDraftStatus(statusFilter);
    setDraftCategory(categoryFilter);
    setDraftStockStatus(stockStatusFilter);
    setIsFilterOpen(true);
  };

  return (
    <div className="m-page">
      <MobilePageHeader
        title="Hàng hóa" backTo="/m/more"
        actions={(
          <>
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

          <button type="button" className={`chip ${statusFilter !== 'active' ? 'is-active' : ''}`} onClick={openFilterSheet}>{statusFilter === 'active' ? 'Đang kinh doanh' : statusFilter === 'inactive' ? 'Ngừng kinh doanh' : 'Mọi trạng thái'}</button>
          <button
            type="button"
            className={`chip ${categoryFilter ? 'is-active' : ''}`}
            onClick={openFilterSheet}
          >
            <span>{categoryFilter ? categoryFilter : 'Tất cả nhóm hàng'}</span>
            <i className="ph ph-caret-down" />
          </button>

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
                : 'Tất cả loại hàng'}
            </span>
            <i className="ph ph-caret-down" />
          </button>

          <button
            type="button"
            className={`chip ${stockStatusFilter ? 'is-active' : ''}`}
            onClick={openFilterSheet}
          >
            <span>{stockStatusFilter === 'in_stock' ? 'Còn tồn kho' : stockStatusFilter === 'low' ? 'Dưới định mức' : stockStatusFilter === 'out' ? 'Hết hàng' : 'Tồn kho'}</span>
            <i className="ph ph-caret-down" />
          </button>
        </div>

        <div className="m-summary-bar">
          <MobileSortDropdown
            value={sortValue}
            options={sortOptions}
            onChange={setSortValue}
          />

          <div className="m-summary-count">
            {totalRows} hàng hóa{totalRows > rawRows.length ? ` · đã tải ${rawRows.length}` : ''}
          </div>
        </div>
      </MobilePageHeader>

      <div className="m-body">
        {isLoading ? <LoadingState compact label="Đang tải dữ liệu hàng hóa…" />
          : error && !rawRows.length ? <ErrorState compact error={error} onRetry={() => refetch()} />
          : !rawRows.length ? <MobileEmptyState title="Chưa có hàng hóa phù hợp" description={search ? 'Thử từ khóa khác hoặc đổi bộ lọc.' : undefined} />
          : <>
            <div className="m-list">{rawRows.map(item => <InventoryListRow key={`${item.itemType}:${item.itemId}`} item={item} onClick={() => setSelectedItem(item)} />)}</div>
            {error && <ErrorState compact error={error} onRetry={() => fetchNextPage()} />}
            {hasNextPage && <button type="button" className="btn btn-secondary btn-block" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>{isFetchingNextPage ? 'Đang tải thêm…' : 'Tải thêm hàng hóa'}</button>}
          </>}
      </div>

      {/* 5. Floating Action Button (FAB) for Creating Goods */}
      <button
        type="button"
        className="m-fab"
        onClick={() => setIsCreateMenuOpen(true)}
        aria-label="Thêm hàng hóa"
        title="Thêm hàng hóa / Dịch vụ"
      >
        <i className="ph ph-plus" />
      </button>

      <MobileDetailSheet
        isOpen={isCreateMenuOpen}
        title="Chọn loại hàng hóa"
        subtitle="Loại đã chọn quyết định các trường thông tin cần nhập"
        onClose={() => setIsCreateMenuOpen(false)}
      >
        <div className="m-list">
          {Object.entries(inventoryTypes).map(([type, item]) => (
            <button key={type} type="button" className="m-list-row" onClick={() => { setIsCreateMenuOpen(false); setIsCreatingType(type as InventoryItemType); }}>
              <span className={`m-list-avatar is-${type}`}><i className={`ph ${item.icon}`} aria-hidden="true" /></span>
              <span className="m-list-copy"><strong>{item.label}</strong><small>{item.description}</small></span>
              <span className="m-list-value"><i className="ph ph-caret-right" aria-hidden="true" /></span>
            </button>
          ))}
        </div>
      </MobileDetailSheet>

      {/* Filter Bottom Sheet */}
      <MobileFilterSheet
        isOpen={isFilterOpen}
        title="Bộ lọc hàng hóa"
        onClose={() => setIsFilterOpen(false)}
        onReset={handleResetFilter}
        onApply={handleApplyFilter}
      >
        <div className="mobile-filter-field">
          <label htmlFor="mobile-product-status-filter" className="mobile-filter-field-label">Trạng thái kinh doanh</label>
          <Select id="mobile-product-status-filter" fullWidth value={draftStatus} onChange={setDraftStatus}
            options={[{ value: 'active', label: 'Đang kinh doanh' }, { value: 'inactive', label: 'Ngừng kinh doanh' }, { value: '', label: 'Tất cả' }]} />
        </div>
        <div className="mobile-filter-field">
          <label htmlFor="mobile-product-type-filter" className="mobile-filter-field-label">Loại hàng</label>
          <Select
            id="mobile-product-type-filter"
            triggerClassName="mobile-filter-select"
            variant="filter"
            fullWidth
            value={draftType}
            onChange={setDraftType}
            options={[{ value: '', label: 'Tất cả loại hàng' }, ...inventoryTypeOptions]}
          />
        </div>

        <div className="mobile-filter-field">
          <label htmlFor="mobile-product-category-filter" className="mobile-filter-field-label">Nhóm hàng</label>
          <Select
            id="mobile-product-category-filter"
            triggerClassName="mobile-filter-select"
            variant="filter"
            fullWidth
            value={draftCategory}
            onChange={setDraftCategory}
            options={[{ value: '', label: 'Tất cả nhóm' }, ...categories.map((category) => ({ value: category, label: category }))]}
          />
        </div>

        <div className="mobile-filter-field">
          <label htmlFor="mobile-product-stock-filter" className="mobile-filter-field-label">Tồn kho</label>
          <Select
            id="mobile-product-stock-filter"
            triggerClassName="mobile-filter-select"
            variant="filter"
            fullWidth
            value={draftStockStatus}
            onChange={setDraftStockStatus}
            options={[{ value: '', label: 'Tất cả trạng thái tồn' }, { value: 'in_stock', label: 'Còn tồn kho (> 0)' }, { value: 'out', label: 'Hết hàng (tồn ≤ 0)' }, { value: 'low', label: 'Dưới định mức tồn' }]}
          />
        </div>
      </MobileFilterSheet>

      <MobileDetailSheet
        isOpen={selectedItem !== null} title="Thông tin hàng hóa" onClose={() => setSelectedItem(null)}
        footerActions={<>
          <button type="button" className="btn btn-secondary" onClick={() => { setEditInitialTab('details'); setEditingItem(selectedItem); }}>Ảnh, mô tả</button>
          <button type="button" className="btn btn-primary" onClick={() => { setEditInitialTab('information'); setEditingItem(selectedItem); }}><i className="ph ph-pencil-simple" aria-hidden="true" />Chỉnh sửa</button>
        </>}
      >
        {selectedItem && <InventoryItemDetails type={selectedItem.itemType as InventoryItemType} itemId={Number(selectedItem.itemId)} />}
      </MobileDetailSheet>

      {/* Creation Modal */}
      {isCreatingType && (
        <GoodsCreateDialog
          type={isCreatingType}
          onClose={() => setIsCreatingType(null)}
        />
      )}

      {editingItem && (
        <GoodsCreateDialog
          type={editingItem.itemType as InventoryItemType}
          itemId={Number(editingItem.itemId || editingItem.id)}
          initialData={editingItem}
          initialTab={editInitialTab}
          onClose={() => setEditingItem(null)}
        />
      )}
    </div>
  );
}
