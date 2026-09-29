import { useState, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { formatMoney, formatNumber } from '@/lib/format';
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
import { LoadingState } from '@/components/data-display/DataState';

function getItemIcon(itemType: string) {
  switch (itemType) {
    case 'product':
      return 'ph ph-package';
    case 'service':
      return 'ph ph-sparkle';
    case 'package':
      return 'ph ph-stack';
    case 'account_card':
      return 'ph ph-credit-card';
    default:
      return 'ph ph-tag';
  }
}

export function MobileProductsView() {
  const [search, setSearch] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState('');
  const [sortValue, setSortValue] = useState<string>('price_desc');

  const sortOptions = [
    { value: 'price_desc', label: 'Giá bán: Cao → thấp' },
    { value: 'price_asc', label: 'Giá bán: Thấp → cao' },
    { value: 'name_asc', label: 'Tên hàng: A → Z' },
    { value: 'name_desc', label: 'Tên hàng: Z → A' },
    { value: 'stock_desc', label: 'Tồn kho: Nhiều → ít' },
    { value: 'stock_asc', label: 'Tồn kho: Ít → nhiều' },
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
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['mobile-products', search, typeFilter, categoryFilter, stockStatusFilter],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      getProducts({
        search,
        type: typeFilter,
        category: categoryFilter,
        stockStatus: stockStatusFilter,
        status: 'active',
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

  // Sort and group by category
  const sortedRows = useMemo(() => {
    return [...rawRows].sort((a, b) => {
      if (sortValue === 'price_desc') {
        return Number(b.salePrice || 0) - Number(a.salePrice || 0);
      }
      if (sortValue === 'price_asc') {
        return Number(a.salePrice || 0) - Number(b.salePrice || 0);
      }
      if (sortValue === 'name_asc') {
        return String(a.name || '').localeCompare(String(b.name || ''));
      }
      if (sortValue === 'name_desc') {
        return String(b.name || '').localeCompare(String(a.name || ''));
      }
      if (sortValue === 'stock_desc') {
        return Number(b.stockQuantity ?? -1) - Number(a.stockQuantity ?? -1);
      }
      if (sortValue === 'stock_asc') {
        return Number(a.stockQuantity ?? -1) - Number(b.stockQuantity ?? -1);
      }
      return 0;
    });
  }, [rawRows, sortValue]);

  const groupedCategories = useMemo(() => {
    const map = new Map<string, ApiRecord[]>();
    sortedRows.forEach((row) => {
      const cat = row.category || (row.itemType === 'package' ? 'GÓI DỊCH VỤ' : 'KHÁC');
      const list = map.get(cat) || [];
      list.push(row);
      map.set(cat, list);
    });
    return Array.from(map.entries());
  }, [sortedRows]);

  const totalStockCount = useMemo(() => {
    return rawRows.reduce((sum, r) => sum + (Number(r.stockQuantity) > 0 ? Number(r.stockQuantity) : 0), 0);
  }, [rawRows]);

  const handleApplyFilter = () => {
    setTypeFilter(draftType);
    setCategoryFilter(draftCategory);
    setStockStatusFilter(draftStockStatus);
    setIsFilterOpen(false);
  };

  const handleResetFilter = () => {
    setDraftType('');
    setDraftCategory('');
    setDraftStockStatus('');
    setTypeFilter('');
    setCategoryFilter('');
    setStockStatusFilter('');
    setIsFilterOpen(false);
  };

  const openFilterSheet = () => {
    setDraftType(typeFilter);
    setDraftCategory(categoryFilter);
    setDraftStockStatus(stockStatusFilter);
    setIsFilterOpen(true);
  };

  return (
    <div className="mobile-inventory-view">
      <MobilePageHeader
        title="Hàng hóa" backTo="/m/more"
        actions={(
          <>
            <button
              type="button"
              className={`btn btn-ghost btn-icon m-header-action${isSearchVisible ? ' is-active' : ''}`}
              onClick={() => setIsSearchVisible((prev) => !prev)}
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
            <span>{stockStatusFilter === 'in_stock' ? 'Còn tồn kho' : stockStatusFilter === 'below_min' ? 'Dưới định mức' : 'Tồn kho'}</span>
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
            {totalRows} hàng hóa{totalRows > rawRows.length ? ` · Đã tải ${rawRows.length}` : ''} · Tồn đã tải: {formatNumber(totalStockCount)}
          </div>
        </div>
      </MobilePageHeader>

      {/* 4. Grouped Section List */}
      <div className="mobile-inventory-sections-wrapper">
        {isLoading ? (
          <LoadingState compact label="Đang tải dữ liệu hàng hóa..." />
        ) : rawRows.length === 0 ? (
          <MobileEmptyState
              title="Chưa có hàng hóa phù hợp"
              description="Thử tìm kiếm với từ khóa khác hoặc điều chỉnh bộ lọc."
            />
        ) : (
          <>
            {groupedCategories.map(([categoryName, items]) => (
              <div key={categoryName} className="mobile-inventory-section">
              <div className="mobile-inventory-section-title">{categoryName}</div>
              <div className="mobile-inventory-section-card">
                {items.map((row) => {
                  const isPackage = row.itemType === 'package';
                  const isAccountCard = row.itemType === 'account_card';
                  const isService = row.itemType === 'service';

                  return (
                    <div
                      key={`${row.itemType}-${row.itemId}`}
                      className="mobile-inventory-row-item"
                      onClick={() => setSelectedItem(row)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedItem(row); } }}
                    >
                      <div className={`mobile-row-avatar is-${row.itemType}`}>
                        <i className={getItemIcon(row.itemType)} />
                      </div>

                      <div className="mobile-row-info">
                        <div className="mobile-row-name">{row.name}</div>
                        <div className="mobile-row-sub">
                          {isService && row.durationMinutes ? (
                            <>Thời lượng: <strong>{row.durationMinutes} phút</strong></>
                          ) : isAccountCard && row.cardValue ? (
                            <>Mệnh giá: {formatMoney(row.cardValue)}</>
                          ) : isPackage && row.packageDetails ? (
                            <>Gói dịch vụ, liệu trình</>
                          ) : row.itemType === 'product' && row.stockQuantity !== null ? (
                            <>Tồn: <strong>{formatNumber(row.stockQuantity)}</strong> {row.unit || ''}</>
                          ) : (
                            row.code || 'Gói dịch vụ, liệu trình'
                          )}
                        </div>
                      </div>

                      <div className="mobile-row-price">
                        {formatMoney(row.salePrice)}
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>
            ))}
            {hasNextPage && (
              <button
                type="button"
                className="mobile-inventory-load-more"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? 'Đang tải thêm…' : 'Tải thêm hàng hóa'}
              </button>
            )}
          </>
        )}
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
        <div className="mobile-create-type-list">
          {([
            ['product', 'ph ph-package', 'Sản phẩm', 'Có tồn kho, giá vốn và đơn vị tính'],
            ['service', 'ph ph-sparkle', 'Dịch vụ', 'Có thời lượng, hoa hồng tua và tư vấn bán'],
            ['package', 'ph ph-stack', 'Gói dịch vụ', 'Gồm nhiều dịch vụ hoặc liệu trình'],
            ['account_card', 'ph ph-credit-card', 'Thẻ tài khoản', 'Có mệnh giá và phạm vi thanh toán'],
          ] as const).map(([type, icon, label, description]) => (
            <button
              key={type}
              type="button"
              className="mobile-create-type-option"
              onClick={() => {
                setIsCreateMenuOpen(false);
                setIsCreatingType(type);
              }}
            >
              <span className={`mobile-create-type-icon is-${type}`}><i className={icon} /></span>
              <span className="mobile-create-type-copy"><strong>{label}</strong><small>{description}</small></span>
              <i className="ph ph-caret-right" aria-hidden="true" />
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
          <label htmlFor="mobile-product-type-filter" className="mobile-filter-field-label">Loại hàng</label>
          <Select
            id="mobile-product-type-filter"
            triggerClassName="mobile-filter-select"
            variant="filter"
            fullWidth
            value={draftType}
            onChange={setDraftType}
            options={[{ value: '', label: 'Tất cả loại hàng' }, { value: 'product', label: 'Sản phẩm' }, { value: 'service', label: 'Dịch vụ' }, { value: 'package', label: 'Gói dịch vụ, liệu trình' }, { value: 'account_card', label: 'Thẻ tài khoản' }]}
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
            options={[{ value: '', label: 'Tất cả trạng thái tồn' }, { value: 'in_stock', label: 'Còn tồn kho (> 0)' }, { value: 'out_of_stock', label: 'Hết hàng (tồn ≤ 0)' }, { value: 'below_min', label: 'Dưới định mức tồn' }]}
          />
        </div>
      </MobileFilterSheet>

      {/* 6. Inset Detail View Bottom Sheet (Screenshots 1 style) */}
      <MobileDetailSheet
        isOpen={selectedItem !== null}
        title="Thông tin chi tiết"
        onClose={() => setSelectedItem(null)}
      >
        {selectedItem && (
          <div className="mobile-detail-page-container">
            {/* THÔNG TIN CƠ BẢN Card */}
            <div className="mobile-detail-section-card">
              <div className="mobile-detail-card-header">
                <span className="mobile-detail-card-title">Thông tin cơ bản</span>
                <button
                  type="button"
                  className="mobile-detail-edit-link"
                  onClick={() => {
                    setEditInitialTab('information');
                    setEditingItem(selectedItem);
                  }}
                >
                  Sửa
                </button>
              </div>

              <h2 className="mobile-detail-main-name">{selectedItem.name}</h2>

              <div className="mobile-detail-status-pills">
                <span className="mobile-detail-pill is-gray">Cho phép bán</span>
                <span className="mobile-detail-pill is-green">Đang kinh doanh</span>
              </div>

              <div className="mobile-detail-grid-2col">
                <div className="mobile-detail-grid-item">
                  <span className="mobile-detail-grid-label">Mã hàng</span>
                  <span className="mobile-detail-grid-value">{selectedItem.code}</span>
                </div>

                <div className="mobile-detail-grid-item">
                  {/* Empty right cell if needed */}
                </div>

                <div className="mobile-detail-grid-item">
                  <span className="mobile-detail-grid-label">Loại hàng</span>
                  <span className="mobile-detail-grid-value">
                    {selectedItem.itemType === 'product'
                      ? 'Sản phẩm'
                      : selectedItem.itemType === 'service'
                      ? 'Dịch vụ'
                      : selectedItem.itemType === 'package'
                      ? 'Gói dịch vụ'
                      : 'Thẻ tài khoản'}
                  </span>
                </div>

                <div className="mobile-detail-grid-item">
                  <span className="mobile-detail-grid-label">Nhóm hàng</span>
                  <span className="mobile-detail-grid-value">{selectedItem.category || 'gói dịch vụ'}</span>
                </div>

                <div className="mobile-detail-grid-item">
                  <span className="mobile-detail-grid-label">Giá bán</span>
                  <span className="mobile-detail-grid-value">{formatMoney(selectedItem.salePrice)}</span>
                </div>

                <div className="mobile-detail-grid-item">
                  <span className="mobile-detail-grid-label">
                    {selectedItem.itemType === 'account_card' ? 'Mệnh giá' : 'Giá vốn'}
                  </span>
                  <span className="mobile-detail-grid-value">
                    {selectedItem.itemType === 'account_card'
                      ? formatMoney(selectedItem.cardValue || selectedItem.salePrice)
                      : selectedItem.itemType === 'product'
                      ? formatMoney(selectedItem.costPrice)
                      : '---'}
                  </span>
                </div>
              </div>
            </div>

            {/* THẺ KHO / QUẢN LÝ TỒN */}
            {selectedItem.itemType === 'product' && (
              <div className="mobile-detail-section-card is-compact">
                <div className="mobile-detail-nav-row is-static is-flush">
                  <span>Quản lý tồn kho</span>
                  <strong>{formatNumber(selectedItem.stockQuantity || 0)} {selectedItem.unit || ''}</strong>
                </div>
              </div>
            )}

            {/* THÊM HÌNH ẢNH */}
            <div className="mobile-detail-section-card is-compact">
              <button type="button" className="mobile-detail-blue-action" onClick={() => {
                setEditInitialTab('details');
                setEditingItem(selectedItem);
              }}>
                + Thêm hình ảnh
              </button>
            </div>

            {/* THỜI HẠN */}
            <div className="mobile-detail-section-card">
              <div className="mobile-detail-card-header">
                <span className="mobile-detail-card-title">Thời hạn</span>
                <button type="button" className="mobile-detail-edit-link" onClick={() => {
                  setEditInitialTab('information');
                  setEditingItem(selectedItem);
                }}>Sửa</button>
              </div>

              <div className="mobile-detail-nav-row is-flush">
                <span className="text-strong">Hạn sử dụng</span>
                <span className="text-strong">Vô thời hạn</span>
              </div>
            </div>

            {/* PHẠM VI THANH TOÁN */}
            <div className="mobile-detail-section-card">
              <div className="mobile-detail-card-header">
                <span className="mobile-detail-card-title">Phạm vi thanh toán</span>
                <button type="button" className="mobile-detail-edit-link" onClick={() => {
                  setEditInitialTab('information');
                  setEditingItem(selectedItem);
                }}>Sửa</button>
              </div>

              <div className="text-strong">
                Tất cả loại hàng
              </div>

              <div className="mobile-detail-supporting-text">Áp dụng cho tất cả loại hàng.</div>
            </div>
          </div>
        )}
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
