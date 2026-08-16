import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GoodsTypeBadge } from '@/components/data-display/Badges';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { formatMoney } from '@/lib/format';
import { getPricebooks, updatePrice } from '@/features/inventory/inventory.api';
import {
  MobileSearchBar,
  MobileFilterSheet,
  MobileCard,
  MobileEmptyState,
} from '@/features/mobile-common';
import type { ApiRecord } from '@/types/api';
import './mobile-inventory.css';

export function MobilePricebooksView() {
  const [search, setSearch] = useState('');
  const [pricebookId, setPricebookId] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Draft filters for filter sheet
  const [draftCategory, setDraftCategory] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const { notify } = useToast();
  const client = useQueryClient();

  const { data: pricebooksData, isLoading } = useQuery({
    queryKey: ['mobile-pricebooks', search, pricebookId, categoryFilter],
    queryFn: () =>
      getPricebooks({
        search,
        pricebookId,
        category: categoryFilter,
        pageSize: 50,
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

  const rows = (pricebooksData?.data ?? []) as ApiRecord[];
  const meta = pricebooksData?.meta;
  const pricebooksList = meta?.pricebooks ?? [];
  const currentBook = meta?.pricebook ?? { id: 0, name: 'Bảng giá chung' };
  const categories = meta?.categories ?? [];

  const handleApplyFilter = () => {
    setCategoryFilter(draftCategory);
    setIsFilterOpen(false);
  };

  const handleResetFilter = () => {
    setDraftCategory('');
    setCategoryFilter('');
    setIsFilterOpen(false);
  };

  const openFilterSheet = () => {
    setDraftCategory(categoryFilter);
    setIsFilterOpen(true);
  };

  return (
    <div className="mobile-inventory-view">
      {/* Header */}
      <div className="mobile-inventory-header">
        <div className="mobile-inventory-header-top">
          <h2 className="mobile-inventory-title">Thiết lập giá</h2>
        </div>

        {/* Pricebook Dropdown Selector */}
        <div className="mobile-pricebook-selector">
          <label htmlFor="mobile-pricebook-select">
            <i className="ph ph-notebook" style={{ marginRight: '4px' }} /> Bảng giá:
          </label>
          <select
            id="mobile-pricebook-select"
            aria-label="Chọn bảng giá"
            className="mobile-pricebook-select"
            value={pricebookId || String(currentBook.id || '')}
            onChange={(e) => setPricebookId(e.target.value)}
          >
            {pricebooksList.map((book) => (
              <option key={book.id} value={String(book.id)}>
                {book.name}
              </option>
            ))}
          </select>
        </div>

        {/* Search Bar + Filter */}
        <MobileSearchBar
          value={search}
          placeholder="Tìm mã hoặc tên hàng..."
          onChange={setSearch}
          onFilterClick={openFilterSheet}
          activeFilterCount={categoryFilter ? 1 : 0}
        />
      </div>

      {/* Pricebook items card list */}
      <div className="mobile-inventory-list">
        {isLoading ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-500)' }}>
            Đang tải bảng giá...
          </div>
        ) : rows.length === 0 ? (
          <MobileEmptyState
            title="Không tìm thấy hàng hóa trong bảng giá"
            description="Thử tìm kiếm với từ khóa khác hoặc chuyển sang nhóm hàng khác."
          />
        ) : (
          rows.map((row) => {
            const currentPrice = Number(row.bookPrice ?? row.salePrice ?? 0);
            return (
              <MobileCard
                key={`${row.itemType}-${row.itemId}`}
                title={row.name}
                subtitle={row.code}
                badge={{
                  text: row.category || 'Chung',
                  tone: row.itemType === 'product' ? 'blue' : 'violet',
                }}
                avatar={
                  <div className={`mobile-goods-avatar is-${row.itemType}`}>
                    <i
                      className={
                        row.itemType === 'product'
                          ? 'ph ph-package'
                          : row.itemType === 'service'
                          ? 'ph ph-sparkle'
                          : 'ph ph-stack'
                      }
                    />
                  </div>
                }
                details={[
                  {
                    label: 'Loại',
                    value: <GoodsTypeBadge type={row.itemType} />,
                  },
                  {
                    label: 'Giá vốn',
                    value: formatMoney(row.costPrice),
                  },
                  {
                    label: 'Giá nhập cuối',
                    value: formatMoney(row.lastPurchasePrice),
                  },
                  {
                    label: 'Giá niêm yết cũ',
                    value: formatMoney(row.salePrice),
                  },
                ]}
                action={
                  <div className="mobile-price-edit-row" style={{ width: '100%' }}>
                    <span className="mobile-price-edit-label">
                      Giá ({currentBook.name || 'Bảng giá'}):
                    </span>
                    <div className="mobile-price-edit-input-wrap">
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
                              pId: currentBook.id,
                              itemType: row.itemType,
                              itemId: row.itemId,
                              salePrice,
                            });
                          }
                        }}
                      />
                    </div>
                  </div>
                }
              />
            );
          })
        )}
      </div>

      {/* Filter Sheet */}
      <MobileFilterSheet
        isOpen={isFilterOpen}
        title="Bộ lọc bảng giá"
        onClose={() => setIsFilterOpen(false)}
        onReset={handleResetFilter}
        onApply={handleApplyFilter}
      >
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
      </MobileFilterSheet>
    </div>
  );
}
