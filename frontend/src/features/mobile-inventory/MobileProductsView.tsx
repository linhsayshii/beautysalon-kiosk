import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatMoney, formatNumber } from '@/lib/format';
import { GoodsTypeBadge } from '@/components/data-display/Badges';
import { GoodsCreateMenu } from '@/features/inventory/components/GoodsCreateMenu';
import { getProducts } from '@/features/inventory/inventory.api';
import {
  MobileSearchBar,
  MobileFilterSheet,
  MobileMetricCards,
  MobileCard,
  MobileDetailSheet,
  MobileEmptyState,
} from '@/features/mobile-common';
import type { ApiRecord } from '@/types/api';
import './mobile-inventory.css';

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
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState('');

  // Draft filters for bottom sheet
  const [draftType, setDraftType] = useState('');
  const [draftCategory, setDraftCategory] = useState('');
  const [draftStockStatus, setDraftStockStatus] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [selectedItem, setSelectedItem] = useState<ApiRecord | null>(null);

  const activeFilterCount =
    (typeFilter ? 1 : 0) +
    (categoryFilter ? 1 : 0) +
    (stockStatusFilter ? 1 : 0);

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['mobile-products', search, typeFilter, categoryFilter, stockStatusFilter],
    queryFn: () =>
      getProducts({
        search,
        type: typeFilter,
        category: categoryFilter,
        stockStatus: stockStatusFilter,
        status: 'active',
        pageSize: 50,
      }),
  });

  const rows = (productsData?.data ?? []) as ApiRecord[];
  const meta = productsData?.meta;
  const summary = meta?.summary;
  const categories = meta?.categories ?? [];

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
      {/* Header & Create Button */}
      <div className="mobile-inventory-header">
        <div className="mobile-inventory-header-top">
          <h2 className="mobile-inventory-title">Hàng hóa & Tồn kho</h2>
          <GoodsCreateMenu />
        </div>

        {/* Metric Cards */}
        <MobileMetricCards
          items={[
            {
              label: 'Tổng hàng hóa',
              value: formatNumber(summary?.total ?? rows.length),
              note: 'Tất cả loại hàng',
              tone: 'blue',
            },
            {
              label: 'Sản phẩm (tồn)',
              value: formatNumber(summary?.products ?? rows.filter((r) => r.itemType === 'product').length),
              note: 'Có theo dõi tồn kho',
              tone: 'green',
            },
            {
              label: 'Dịch vụ & Gói',
              value: formatNumber(
                Number(summary?.services ?? 0) +
                  Number(summary?.packages ?? 0) +
                  Number(summary?.account_cards ?? 0) ||
                  rows.filter((r) => r.itemType !== 'product').length
              ),
              note: 'Không theo dõi tồn',
              tone: 'violet',
            },
            {
              label: 'Dưới định mức',
              value: formatNumber(
                summary?.low_stock ??
                  rows.filter((r) => r.itemType === 'product' && r.stockQuantity < r.minStock).length
              ),
              note: 'Cần nhập thêm',
              tone: 'orange',
            },
          ]}
        />

        {/* Search Bar with Filter Sheet */}
        <MobileSearchBar
          value={search}
          placeholder="Tìm mã, tên, mã vạch..."
          onChange={setSearch}
          onFilterClick={openFilterSheet}
          activeFilterCount={activeFilterCount}
        />
      </div>

      {/* Product / Service Card List */}
      <div className="mobile-inventory-list">
        {isLoading ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-500)' }}>
            Đang tải danh sách hàng hóa...
          </div>
        ) : rows.length === 0 ? (
          <MobileEmptyState
            title="Không tìm thấy hàng hóa"
            description="Thử tìm kiếm với từ khóa khác hoặc thay đổi bộ lọc hàng hóa."
          />
        ) : (
          rows.map((row) => {
            const isProduct = row.itemType === 'product';
            const isLowStock = isProduct && row.stockQuantity !== null && row.stockQuantity < (row.minStock || 0);

            return (
              <MobileCard
                key={`${row.itemType}-${row.itemId}`}
                title={row.name}
                subtitle={row.code + (row.barcode ? ` · ${row.barcode}` : '')}
                badge={{
                  text: row.category || 'Chung',
                  tone: row.itemType === 'product' ? 'blue' : 'violet',
                }}
                avatar={
                  <div className={`mobile-goods-avatar is-${row.itemType}`}>
                    <i className={getItemIcon(row.itemType)} />
                  </div>
                }
                details={[
                  {
                    label: 'Loại hàng',
                    value: <GoodsTypeBadge type={row.itemType} />,
                  },
                  {
                    label: 'Đơn vị',
                    value: row.unit || '---',
                  },
                  {
                    label: 'Giá bán',
                    value: (
                      <span style={{ color: 'var(--blue-600)', fontWeight: 750 }}>
                        {formatMoney(row.salePrice)}
                      </span>
                    ),
                  },
                  {
                    label: isProduct ? 'Giá vốn' : 'Thời lượng',
                    value: isProduct
                      ? formatMoney(row.costPrice)
                      : row.durationMinutes
                      ? `${row.durationMinutes} phút`
                      : '---',
                  },
                  {
                    label: 'Tồn kho',
                    value: isProduct ? (
                      <span
                        className={`mobile-stock-badge ${isLowStock ? 'is-low' : 'is-normal'}`}
                      >
                        {formatNumber(row.stockQuantity)}{' '}
                        {isLowStock && <i className="ph-fill ph-warning-circle" />}
                      </span>
                    ) : (
                      'Không quản lý'
                    ),
                  },
                  {
                    label: 'Định mức tồn',
                    value: isProduct ? `${formatNumber(row.minStock || 0)} - ${row.maxStock ? formatNumber(row.maxStock) : '∞'}` : '---',
                  },
                ]}
                onClick={() => setSelectedItem(row)}
              />
            );
          })
        )}
      </div>

      {/* Filter Sheet */}
      <MobileFilterSheet
        isOpen={isFilterOpen}
        title="Bộ lọc hàng hóa"
        onClose={() => setIsFilterOpen(false)}
        onReset={handleResetFilter}
        onApply={handleApplyFilter}
      >
        <div className="mobile-filter-field">
          <label className="mobile-filter-field-label">Loại hàng</label>
          <select
            className="mobile-filter-select"
            value={draftType}
            onChange={(e) => setDraftType(e.target.value)}
          >
            <option value="">Tất cả loại hàng</option>
            <option value="product">Sản phẩm</option>
            <option value="service">Dịch vụ</option>
            <option value="package">Gói dịch vụ, liệu trình</option>
            <option value="account_card">Thẻ tài khoản</option>
          </select>
        </div>

        <div className="mobile-filter-field">
          <label className="mobile-filter-field-label">Nhóm hàng</label>
          <select
            className="mobile-filter-select"
            value={draftCategory}
            onChange={(e) => setDraftCategory(e.target.value)}
          >
            <option value="">Tất cả nhóm</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="mobile-filter-field">
          <label className="mobile-filter-field-label">Tồn kho</label>
          <select
            className="mobile-filter-select"
            value={draftStockStatus}
            onChange={(e) => setDraftStockStatus(e.target.value)}
          >
            <option value="">Tất cả trạng thái tồn</option>
            <option value="in_stock">Còn tồn kho (&gt; 0)</option>
            <option value="out_of_stock">Hết hàng (tồn ≤ 0)</option>
            <option value="below_min">Dưới định mức tồn</option>
          </select>
        </div>
      </MobileFilterSheet>

      {/* Detail Bottom Sheet */}
      <MobileDetailSheet
        isOpen={selectedItem !== null}
        title={selectedItem?.name || 'Chi tiết hàng hóa'}
        subtitle={selectedItem?.code}
        onClose={() => setSelectedItem(null)}
      >
        {selectedItem && (
          <div className="mobile-inventory-detail-content">
            {/* Header info */}
            <div className="mobile-inventory-detail-header-card">
              <div className={`mobile-goods-avatar is-${selectedItem.itemType}`}>
                <i className={getItemIcon(selectedItem.itemType)} />
              </div>
              <div className="mobile-inventory-detail-main-info">
                <span className="mobile-inventory-detail-name">{selectedItem.name}</span>
                <div className="mobile-inventory-detail-tags">
                  <span className="mobile-inventory-tag is-code">
                    <i className="ph ph-barcode" /> {selectedItem.code}
                  </span>
                  {selectedItem.category && (
                    <span className="mobile-inventory-tag">
                      <i className="ph ph-folder" /> {selectedItem.category}
                    </span>
                  )}
                  {selectedItem.brand && (
                    <span className="mobile-inventory-tag">
                      <i className="ph ph-tag" /> {selectedItem.brand}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick 4-fact strip */}
            <div className="mobile-inventory-detail-facts-grid">
              <div className="mobile-inventory-fact-box">
                <span className="mobile-inventory-fact-label">Giá bán</span>
                <span className="mobile-inventory-fact-val" style={{ color: 'var(--blue-600)' }}>
                  {formatMoney(selectedItem.salePrice)}
                </span>
              </div>
              <div className="mobile-inventory-fact-box">
                <span className="mobile-inventory-fact-label">
                  {selectedItem.itemType === 'product' ? 'Giá vốn' : 'Thời lượng'}
                </span>
                <span className="mobile-inventory-fact-val">
                  {selectedItem.itemType === 'product'
                    ? formatMoney(selectedItem.costPrice)
                    : selectedItem.durationMinutes
                    ? `${selectedItem.durationMinutes} phút`
                    : '---'}
                </span>
              </div>
              <div className="mobile-inventory-fact-box">
                <span className="mobile-inventory-fact-label">Tồn hiện tại</span>
                <span
                  className="mobile-inventory-fact-val"
                  style={{
                    color:
                      selectedItem.itemType === 'product' &&
                      selectedItem.stockQuantity < selectedItem.minStock
                        ? 'var(--red)'
                        : 'var(--green)',
                  }}
                >
                  {selectedItem.itemType === 'product'
                    ? `${formatNumber(selectedItem.stockQuantity)} ${selectedItem.unit || ''}`
                    : 'Không quản lý'}
                </span>
              </div>
              <div className="mobile-inventory-fact-box">
                <span className="mobile-inventory-fact-label">Định mức tồn</span>
                <span className="mobile-inventory-fact-val">
                  {selectedItem.itemType === 'product'
                    ? `${formatNumber(selectedItem.minStock || 0)} - ${selectedItem.maxStock ? formatNumber(selectedItem.maxStock) : '∞'}`
                    : '---'}
                </span>
              </div>
            </div>

            {/* General Info Card */}
            <div className="mobile-inventory-detail-card">
              <h4>Thông tin chi tiết</h4>
              <div className="mobile-inventory-info-row">
                <span className="mobile-inventory-info-label">Loại hàng:</span>
                <GoodsTypeBadge type={selectedItem.itemType} />
              </div>
              <div className="mobile-inventory-info-row">
                <span className="mobile-inventory-info-label">Nhóm hàng:</span>
                <span className="mobile-inventory-info-val">{selectedItem.category || 'Chung'}</span>
              </div>
              <div className="mobile-inventory-info-row">
                <span className="mobile-inventory-info-label">Đơn vị tính:</span>
                <span className="mobile-inventory-info-val">{selectedItem.unit || '---'}</span>
              </div>
              {selectedItem.barcode && (
                <div className="mobile-inventory-info-row">
                  <span className="mobile-inventory-info-label">Mã vạch:</span>
                  <span className="mobile-inventory-info-val">{selectedItem.barcode}</span>
                </div>
              )}
              {selectedItem.brand && (
                <div className="mobile-inventory-info-row">
                  <span className="mobile-inventory-info-label">Thương hiệu:</span>
                  <span className="mobile-inventory-info-val">{selectedItem.brand}</span>
                </div>
              )}
              <div className="mobile-inventory-info-row">
                <span className="mobile-inventory-info-label">Trạng thái bán:</span>
                <span
                  className="mobile-inventory-info-val"
                  style={{ color: selectedItem.active !== false ? 'var(--green)' : 'var(--red)' }}
                >
                  {selectedItem.active !== false ? 'Đang kinh doanh' : 'Ngừng kinh doanh'}
                </span>
              </div>
              {selectedItem.description && (
                <div
                  className="mobile-inventory-info-row"
                  style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}
                >
                  <span className="mobile-inventory-info-label">Mô tả:</span>
                  <span className="mobile-inventory-info-val" style={{ textAlign: 'left' }}>
                    {selectedItem.description}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </MobileDetailSheet>
    </div>
  );
}
