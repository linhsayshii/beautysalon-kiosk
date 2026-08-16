import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { formatMoney } from '@/lib/format';
import { getPricebooks, updatePrice } from '@/features/inventory/inventory.api';
import {
  MobileSearchBar,
  MobileFilterSheet,
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

export function MobilePricebooksView() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [pricebookId, setPricebookId] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Draft filters for bottom sheet
  const [draftPricebookId, setDraftPricebookId] = useState('');
  const [draftCategory, setDraftCategory] = useState('');
  const [draftType, setDraftType] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Sorting
  const [sortBy, setSortBy] = useState<'price' | 'name' | 'cost'>('price');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Detail Sheet
  const [selectedItem, setSelectedItem] = useState<ApiRecord | null>(null);

  const { notify } = useToast();
  const client = useQueryClient();

  const { data: pricebooksData, isLoading } = useQuery({
    queryKey: ['mobile-pricebooks', search, pricebookId, categoryFilter, typeFilter],
    queryFn: () =>
      getPricebooks({
        search,
        pricebookId,
        category: categoryFilter,
        type: typeFilter,
        pageSize: 100,
      }),
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
      client.invalidateQueries({ queryKey: ['mobile-pricebooks'] });
      client.invalidateQueries({ queryKey: ['pricebooks'] });
    },
    onError: (error) => notify('Không thể lưu giá', error.message),
  });

  const rawRows = (pricebooksData?.data ?? []) as ApiRecord[];
  const meta = pricebooksData?.meta;
  const pricebooksList = meta?.pricebooks ?? [];
  const currentBook = meta?.pricebook ?? { id: 1, name: 'Bảng giá chung' };
  const categories = meta?.categories ?? [];

  // Sort rows
  const sortedRows = useMemo(() => {
    return [...rawRows].sort((a, b) => {
      if (sortBy === 'price') {
        const pA = Number(a.bookPrice ?? a.salePrice ?? 0);
        const pB = Number(b.bookPrice ?? b.salePrice ?? 0);
        return sortOrder === 'desc' ? pB - pA : pA - pB;
      }
      if (sortBy === 'name') {
        return sortOrder === 'desc'
          ? String(b.name).localeCompare(String(a.name))
          : String(a.name).localeCompare(String(b.name));
      }
      if (sortBy === 'cost') {
        const cA = Number(a.costPrice ?? 0);
        const cB = Number(b.costPrice ?? 0);
        return sortOrder === 'desc' ? cB - cA : cA - cB;
      }
      return 0;
    });
  }, [rawRows, sortBy, sortOrder]);

  // Group by category
  const groupedCategories = useMemo(() => {
    const map = new Map<string, ApiRecord[]>();
    sortedRows.forEach((row) => {
      const cat = row.category || (row.itemType === 'package' ? 'GÓI DỊCH VỤ' : 'MẶT HÀNG CHUNG');
      const list = map.get(cat) || [];
      list.push(row);
      map.set(cat, list);
    });
    return Array.from(map.entries());
  }, [sortedRows]);

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
    setDraftPricebookId(pricebookId || String(currentBook.id || ''));
    setDraftCategory(categoryFilter);
    setDraftType(typeFilter);
    setIsFilterOpen(true);
  };

  const toggleSort = () => {
    if (sortBy === 'price') {
      if (sortOrder === 'desc') setSortOrder('asc');
      else {
        setSortBy('name');
        setSortOrder('asc');
      }
    } else if (sortBy === 'name') {
      setSortBy('cost');
      setSortOrder('desc');
    } else {
      setSortBy('price');
      setSortOrder('desc');
    }
  };

  const activeBookName = useMemo(() => {
    if (!pricebookId) return currentBook.name || 'Bảng giá chung';
    const found = pricebooksList.find((b) => String(b.id) === String(pricebookId));
    return found ? found.name : currentBook.name || 'Bảng giá chung';
  }, [pricebookId, pricebooksList, currentBook]);

  return (
    <div className="mobile-inventory-view">
      {/* 1. Header Top Navigation */}
      <div className="mobile-inventory-top-nav">
        <div className="mobile-inventory-nav-left">
          <button
            type="button"
            className="mobile-inventory-back-icon"
            onClick={() => navigate('/m/more')}
            aria-label="Quay lại"
          >
            <i className="ph ph-caret-left" />
          </button>
          <h1 className="mobile-inventory-nav-title">Thiết lập giá</h1>
        </div>

        <div className="mobile-inventory-nav-actions">
          <button
            type="button"
            className="mobile-inventory-nav-btn"
            onClick={() => setIsSearchVisible((prev) => !prev)}
            aria-label="Tìm kiếm"
          >
            <i className="ph ph-magnifying-glass" />
          </button>
          <button
            type="button"
            className="mobile-inventory-nav-btn"
            onClick={toggleSort}
            aria-label="Sắp xếp"
            title={`Sắp xếp: ${
              sortBy === 'price'
                ? `Giá bán ${sortOrder === 'desc' ? 'cao → thấp' : 'thấp → cao'}`
                : sortBy === 'name'
                ? `Tên hàng ${sortOrder === 'asc' ? 'A → Z' : 'Z → A'}`
                : `Giá vốn ${sortOrder === 'desc' ? 'cao → thấp' : 'thấp → cao'}`
            }`}
          >
            <i className="ph ph-arrows-down-up" />
          </button>
        </div>
      </div>

      {/* Inline Search Bar */}
      {isSearchVisible && (
        <div className="mobile-inventory-search-bar-wrap">
          <MobileSearchBar
            value={search}
            placeholder="Tìm theo tên, mã hàng..."
            onChange={setSearch}
          />
        </div>
      )}

      {/* 2. Filter Strip */}
      <div className="mobile-inventory-filter-strip">
        <button
          type="button"
          className="mobile-filter-icon-btn"
          onClick={openFilterSheet}
          aria-label="Mở bộ lọc"
        >
          <i className="ph ph-faders" />
        </button>

        {/* Pricebook Chip */}
        <button
          type="button"
          className={`mobile-filter-chip ${pricebookId ? 'is-active' : ''}`}
          onClick={openFilterSheet}
        >
          <span>Bảng giá: {activeBookName}</span>
          <i className="ph ph-caret-down" />
        </button>

        {/* Category Chip */}
        <button
          type="button"
          className={`mobile-filter-chip ${categoryFilter ? 'is-active' : ''}`}
          onClick={openFilterSheet}
        >
          <span>{categoryFilter ? categoryFilter : 'Tất cả nhóm'}</span>
          <i className="ph ph-caret-down" />
        </button>

        {/* Type Chip */}
        <button
          type="button"
          className={`mobile-filter-chip ${typeFilter ? 'is-active' : ''}`}
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

      {/* 3. Summary & Sort Bar */}
      <div className="mobile-inventory-summary-bar">
        <button type="button" className="mobile-inventory-sort-selector" onClick={toggleSort}>
          <span>
            {sortBy === 'price'
              ? `Giá bán ${sortOrder === 'desc' ? 'cao → thấp' : 'thấp → cao'}`
              : sortBy === 'name'
              ? 'Tên hàng'
              : 'Giá vốn'}
          </span>
          <i className="ph ph-caret-down" />
        </button>

        <div className="mobile-inventory-count-summary">
          {rawRows.length} mặt hàng
        </div>
      </div>

      {/* 4. Grouped Section List */}
      <div className="mobile-inventory-sections-wrapper">
        {isLoading ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b' }}>
            Đang tải bảng giá...
          </div>
        ) : rawRows.length === 0 ? (
          <div style={{ padding: '24px 16px' }}>
            <MobileEmptyState
              title="Không tìm thấy hàng hóa trong bảng giá"
              description="Thử tìm kiếm với từ khóa khác hoặc điều chỉnh bộ lọc."
            />
          </div>
        ) : (
          groupedCategories.map(([categoryName, items]) => (
            <div key={categoryName} className="mobile-inventory-section">
              <div className="mobile-inventory-section-title">{categoryName} ({items.length})</div>
              <div className="mobile-inventory-section-card">
                {items.map((row) => {
                  const currentPrice = Number(row.bookPrice ?? row.salePrice ?? 0);
                  const effectivePId = Number(pricebookId || currentBook.id || 1);

                  return (
                    <div
                      key={`${row.itemType}-${row.itemId}`}
                      className="mobile-pricebook-row-item"
                    >
                      <div
                        className="mobile-pricebook-row-top"
                        onClick={() => setSelectedItem(row)}
                        role="button"
                        tabIndex={0}
                      >
                        {/* Square rounded avatar */}
                        <div className={`mobile-row-avatar is-${row.itemType}`}>
                          <i className={getItemIcon(row.itemType)} />
                        </div>

                        {/* Info block */}
                        <div className="mobile-row-info">
                          <div className="mobile-row-name">{row.name}</div>
                          <div className="mobile-pricebook-cost-line">
                            {row.costPrice !== undefined && row.costPrice !== null && (
                              <span>Giá vốn: <strong>{formatMoney(row.costPrice)}</strong></span>
                            )}
                            {row.lastPurchasePrice !== undefined && row.lastPurchasePrice !== null && (
                              <span> · Nhập cuối: <strong>{formatMoney(row.lastPurchasePrice)}</strong></span>
                            )}
                          </div>
                        </div>

                        <div className="mobile-pricebook-row-chevron">
                          <i className="ph ph-caret-right" />
                        </div>
                      </div>

                      {/* Quick MoneyInput bar */}
                      <div className="mobile-pricebook-quick-input-bar">
                        <span className="mobile-pricebook-input-label">
                          Giá ({activeBookName}):
                        </span>
                        <div className="mobile-pricebook-input-box">
                          <MoneyInput
                            defaultValue={currentPrice}
                            suffix="đ"
                            disabled={mutation.isPending}
                            aria-label={`Giá bán ${row.name}`}
                            onBlur={(event) => {
                              const salePrice = Math.max(
                                0,
                                Number(event.target.value.replace(/\D/g, '')) || 0
                              );
                              if (salePrice !== currentPrice) {
                                mutation.mutate({
                                  pId: effectivePId,
                                  itemType: row.itemType,
                                  itemId: row.itemId,
                                  salePrice,
                                });
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
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
          <select
            className="mobile-filter-select"
            value={draftPricebookId}
            aria-label="Chọn bảng giá"
            onChange={(e) => setDraftPricebookId(e.target.value)}
          >
            {pricebooksList.map((book) => (
              <option key={book.id} value={String(book.id)}>
                {book.name}
              </option>
            ))}
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
          <label className="mobile-filter-field-label">Loại hàng</label>
          <select
            className="mobile-filter-select"
            value={draftType}
            onChange={(e) => setDraftType(e.target.value)}
          >
            <option value="">Tất cả loại</option>
            <option value="product">Sản phẩm</option>
            <option value="service">Dịch vụ</option>
            <option value="package">Gói dịch vụ</option>
            <option value="account_card">Thẻ tài khoản</option>
          </select>
        </div>
      </MobileFilterSheet>

      {/* 5. Inset Detail View Bottom Sheet */}
      <MobileDetailSheet
        isOpen={selectedItem !== null}
        title="Thông tin giá & Lợi nhuận"
        onClose={() => setSelectedItem(null)}
      >
        {selectedItem && (() => {
          const cost = Number(selectedItem.costPrice || 0);
          const retail = Number(selectedItem.salePrice || 0);
          const book = Number(selectedItem.bookPrice ?? selectedItem.salePrice ?? 0);
          const margin = book > 0 && cost > 0 ? Math.round(((book - cost) / book) * 100) : null;

          return (
            <div className="mobile-pricebook-detail-wrapper">
              {/* Header Card */}
              <div className="mobile-pricebook-detail-card">
                <div className="mobile-pricebook-detail-header-row">
                  <h2 className="mobile-pricebook-detail-name">{selectedItem.name}</h2>
                  <span className="mobile-pricebook-detail-code">{selectedItem.code}</span>
                </div>

                <div className="mobile-detail-status-pills" style={{ marginTop: '6px' }}>
                  <span className="mobile-detail-pill is-gray">
                    {selectedItem.itemType === 'product'
                      ? 'Sản phẩm'
                      : selectedItem.itemType === 'service'
                      ? 'Dịch vụ'
                      : selectedItem.itemType === 'package'
                      ? 'Gói dịch vụ'
                      : 'Thẻ tài khoản'}
                  </span>
                  <span className="mobile-detail-pill is-green">
                    {selectedItem.category || 'Chung'}
                  </span>
                </div>
              </div>

              {/* So sánh giá Card */}
              <div className="mobile-pricebook-detail-card">
                <div className="mobile-pricebook-card-section-title">SO SÁNH BẢNG GIÁ</div>

                <div className="mobile-pricebook-compare-grid">
                  <div className="mobile-pricebook-compare-cell">
                    <span className="mobile-pricebook-compare-lbl">Giá vốn</span>
                    <span className="mobile-pricebook-compare-val">
                      {cost > 0 ? formatMoney(cost) : '---'}
                    </span>
                  </div>

                  <div className="mobile-pricebook-compare-cell">
                    <span className="mobile-pricebook-compare-lbl">Giá nhập cuối</span>
                    <span className="mobile-pricebook-compare-val">
                      {selectedItem.lastPurchasePrice ? formatMoney(selectedItem.lastPurchasePrice) : '---'}
                    </span>
                  </div>

                  <div className="mobile-pricebook-compare-cell">
                    <span className="mobile-pricebook-compare-lbl">Giá niêm yết (gốc)</span>
                    <span className="mobile-pricebook-compare-val">
                      {formatMoney(retail)}
                    </span>
                  </div>

                  <div className="mobile-pricebook-compare-cell is-highlight">
                    <span className="mobile-pricebook-compare-lbl">Giá {activeBookName}</span>
                    <span className="mobile-pricebook-compare-val" style={{ color: '#0062eb' }}>
                      {formatMoney(book)}
                    </span>
                  </div>
                </div>

                {margin !== null && (
                  <div className="mobile-pricebook-margin-box">
                    <span>Biên lợi nhuận ước tính:</span>
                    <strong style={{ color: margin >= 30 ? '#10b981' : margin > 0 ? '#f59e0b' : '#e11d48' }}>
                      {margin}%
                    </strong>
                  </div>
                )}
              </div>

              {/* Actions Card: Sửa chi tiết */}
              <div className="mobile-pricebook-detail-card">
                <button
                  type="button"
                  className="mobile-pricebook-action-edit-btn"
                  onClick={() => {
                    notify('Thông tin hàng hóa', `Mặt hàng: ${selectedItem.name} (${formatMoney(book)})`);
                  }}
                >
                  Xem chi tiết hàng hóa
                </button>
              </div>
            </div>
          );
        })()}
      </MobileDetailSheet>
    </div>
  );
}
