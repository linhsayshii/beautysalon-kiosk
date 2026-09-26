import { useState, useMemo, useEffect } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { Select } from '@/components/ui/Select/Select';
import { DatePickerField } from '@/components/ui/DateTimePicker';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { formatMoney } from '@/lib/format';
import { createPricebook, deletePricebook, getPricebook, getPricebooks, updatePrice, updatePricebook } from '@/features/inventory/inventory.api';
import type { CreatePricebookInput, Pricebook, UpdatePricebookInput } from '@/features/inventory/inventory.api';
import { PricebookCustomerPicker } from '@/features/inventory/components/PricebookCustomerPicker';
import {
  MobileSearchBar,
  MobileFilterSheet,
  MobileDetailSheet,
  MobileEmptyState,
  MobileSortDropdown,
} from '@/features/mobile-common';
import type { ApiRecord } from '@/types/api';
import { MobilePageHeader } from '@/components/ui/MobilePageHeader/MobilePageHeader';
import { BottomSheet } from '@/components/ui/Sheet/BottomSheet';
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

interface MobilePricebookDialogProps {
  open: boolean;
  pricebook?: Partial<Pricebook> | null;
  onClose: () => void;
  onSuccess: () => void;
}

function MobilePricebookDialog({ open, pricebook, onClose, onSuccess }: MobilePricebookDialogProps) {
  const [form, setForm] = useState<CreatePricebookInput>({
    code: pricebook?.code ?? '',
    name: pricebook?.name ?? '',
    active: pricebook?.active ?? true,
    effectiveFrom: pricebook?.effectiveFrom ?? null,
    effectiveTo: pricebook?.effectiveTo ?? null,
    customerIds: [],
    copyFromDefault: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const detailsQuery = useQuery({
    queryKey: ['pricebook-detail', pricebook?.id],
    queryFn: () => getPricebook(pricebook!.id!),
    enabled: open && Boolean(pricebook?.id),
  });

  useEffect(() => {
    if (open) {
      const detail = detailsQuery.data?.data;
      setForm({
        code: detail?.code ?? pricebook?.code ?? '',
        name: detail?.name ?? pricebook?.name ?? '',
        active: detail?.active ?? pricebook?.active ?? true,
        effectiveFrom: detail?.effectiveFrom ?? pricebook?.effectiveFrom ?? null,
        effectiveTo: detail?.effectiveTo ?? pricebook?.effectiveTo ?? null,
        customerIds: detail?.customers?.map((customer) => customer.id) ?? [],
        copyFromDefault: true,
      });
      setErrors({});
    }
  }, [open, pricebook, detailsQuery.data]);

  const isEditing = !!pricebook?.id;

  const createMutation = useMutation({
    mutationFn: (data: CreatePricebookInput) => createPricebook(data),
    onSuccess: () => { notify('Đã tạo bảng giá', 'Bảng giá mới đã được thêm.'); queryClient.invalidateQueries({ queryKey: ['mobile-pricebooks'] }); queryClient.invalidateQueries({ queryKey: ['pricebooks'] }); onSuccess(); },
    onError: (error: Error) => notify('Không thể tạo bảng giá', error.message),
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdatePricebookInput) => {
      if (!pricebook?.id) throw new Error('Missing pricebook ID');
      return updatePricebook(pricebook.id, data);
    },
    onSuccess: () => { notify('Đã cập nhật bảng giá', 'Thông tin bảng giá đã được lưu.'); queryClient.invalidateQueries({ queryKey: ['mobile-pricebooks'] }); queryClient.invalidateQueries({ queryKey: ['pricebooks'] }); onSuccess(); },
    onError: (error: Error) => notify('Không thể cập nhật', error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!pricebook?.id) throw new Error('Missing pricebook ID');
      return deletePricebook(pricebook.id);
    },
    onSuccess: () => { notify('Đã xóa bảng giá', 'Bảng giá đã được xóa.'); queryClient.invalidateQueries({ queryKey: ['mobile-pricebooks'] }); queryClient.invalidateQueries({ queryKey: ['pricebooks'] }); onSuccess(); },
    onError: (error: Error) => notify('Không thể xóa bảng giá', error.message),
  });

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.code?.trim()) errs.code = 'Mã bảng giá là bắt buộc';
    else if (!/^[A-Z0-9._-]+$/i.test(form.code)) errs.code = 'Chỉ gồm chữ, số, dấu chấm, gạch ngang';
    if (!form.name?.trim()) errs.name = 'Tên bảng giá là bắt buộc';
    if (form.effectiveFrom && form.effectiveTo && form.effectiveFrom > form.effectiveTo) {
      errs.effectiveTo = 'Ngày kết thúc phải sau ngày bắt đầu';
    }
    if (!pricebook?.isDefault && !(form.customerIds?.length) && (!form.effectiveFrom || !form.effectiveTo)) {
      errs.effectiveTo = 'Bảng giá theo thời gian cần đủ ngày bắt đầu và kết thúc';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    if (isEditing) {
      updateMutation.mutate({ name: form.name, active: form.active, effectiveFrom: form.effectiveFrom, effectiveTo: form.effectiveTo, customerIds: form.customerIds });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleDelete = () => {
    if (confirm('Bạn có chắc muốn xóa bảng giá này?')) {
      deleteMutation.mutate();
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={isEditing ? 'Sửa bảng giá' : 'Thêm bảng giá mới'}
      closeOnBackdrop={!isPending}
      footer={(
        <>
          {isEditing && !pricebook?.isDefault && (
            <button type="button" className="btn btn-danger-soft" onClick={handleDelete} disabled={isPending}>Xóa</button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isPending}>Hủy</button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={isPending}>
            {isEditing ? 'Lưu' : 'Tạo mới'}
          </button>
        </>
      )}
    >
      <div className="field">
        <label className="field-label">Mã bảng giá <span className="field-required">*</span></label>
        <input type="text" className="input" aria-invalid={Boolean(errors.code)} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="BG-002" disabled={isEditing} />
        {errors.code && <span className="field-error">{errors.code}</span>}
      </div>
      <div className="field">
        <label className="field-label">Tên bảng giá <span className="field-required">*</span></label>
        <input type="text" className="input" aria-invalid={Boolean(errors.name)} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Bảng giá khuyến mãi" />
        {errors.name && <span className="field-error">{errors.name}</span>}
      </div>
      {!pricebook?.isDefault && <div className="field">
        <label className="field-label">Ngày bắt đầu</label>
        <DatePickerField className="input" value={form.effectiveFrom ?? ''} onChange={(effectiveFrom) => setForm({ ...form, effectiveFrom: effectiveFrom || null })} />
      </div>}
      {!pricebook?.isDefault && <div className="field">
        <label className="field-label">Ngày kết thúc</label>
        <DatePickerField className="input" value={form.effectiveTo ?? ''} onChange={(effectiveTo) => setForm({ ...form, effectiveTo: effectiveTo || null })} />
        {errors.effectiveTo && <span className="field-error">{errors.effectiveTo}</span>}
      </div>}
      {!pricebook?.isDefault && <div className="field">
        <label className="field-label">Khách hàng áp dụng (không bắt buộc)</label>
        <PricebookCustomerPicker value={form.customerIds ?? []} onChange={(customerIds) => setForm({ ...form, customerIds })} />
      </div>}
      {!isEditing && (
        <div className="field">
          <label className="check">
            <input type="checkbox" checked={form.copyFromDefault} onChange={(e) => setForm({ ...form, copyFromDefault: e.target.checked })} />
            <span>Copy giá từ bảng giá mặc định</span>
          </label>
        </div>
      )}
      {isEditing && !pricebook?.isDefault && (
        <div className="field">
          <label className="check">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            <span>Đang hoạt động</span>
          </label>
        </div>
      )}
    </BottomSheet>
  );
}

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
    { value: 'price_desc', label: 'Giá bán: Cao → thấp' },
    { value: 'price_asc', label: 'Giá bán: Thấp → cao' },
    { value: 'name_asc', label: 'Tên hàng: A → Z' },
    { value: 'name_desc', label: 'Tên hàng: Z → A' },
    { value: 'cost_desc', label: 'Giá vốn: Cao → thấp' },
    { value: 'cost_asc', label: 'Giá vốn: Thấp → cao' },
  ];

  // Detail Sheet
  const [selectedItem, setSelectedItem] = useState<ApiRecord | null>(null);

  const { notify } = useToast();
  const client = useQueryClient();

  const {
    data: pricebooksData,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['mobile-pricebooks', search, pricebookId, categoryFilter, typeFilter],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      getPricebooks({
        search,
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
      client.invalidateQueries({ queryKey: ['mobile-pricebooks'] });
      client.invalidateQueries({ queryKey: ['pricebooks'] });
    },
    onError: (error) => notify('Không thể lưu giá', error.message),
  });

  const rawRows = (pricebooksData?.pages.flatMap((page) => page.data) ?? []) as ApiRecord[];
  const meta = pricebooksData?.pages[0]?.meta;
  const totalRows = meta?.pagination?.total ?? rawRows.length;
  const pricebooksList = meta?.pricebooks ?? [];
  const currentBook = meta?.pricebook ?? { id: 1, name: 'Bảng giá chung' };
  const pricebookOptions = [
    { value: '', label: currentBook.name || 'Bảng giá chung' },
    ...pricebooksList
      .filter((book) => !book.isDefault)
      .map((book) => ({ value: String(book.id), label: `${book.name}${book.active ? '' : ' (Ngừng)'}` })),
  ];
  const categories = meta?.categories ?? [];

  // Sort rows
  const sortedRows = useMemo(() => {
    return [...rawRows].sort((a, b) => {
      if (sortValue === 'price_desc') {
        const pA = Number(a.bookPrice ?? a.salePrice ?? 0);
        const pB = Number(b.bookPrice ?? b.salePrice ?? 0);
        return pB - pA;
      }
      if (sortValue === 'price_asc') {
        const pA = Number(a.bookPrice ?? a.salePrice ?? 0);
        const pB = Number(b.bookPrice ?? b.salePrice ?? 0);
        return pA - pB;
      }
      if (sortValue === 'name_asc') {
        return String(a.name || '').localeCompare(String(b.name || ''));
      }
      if (sortValue === 'name_desc') {
        return String(b.name || '').localeCompare(String(a.name || ''));
      }
      if (sortValue === 'cost_desc') {
        const cA = Number(a.costPrice ?? 0);
        const cB = Number(b.costPrice ?? 0);
        return cB - cA;
      }
      if (sortValue === 'cost_asc') {
        const cA = Number(a.costPrice ?? 0);
        const cB = Number(b.costPrice ?? 0);
        return cA - cB;
      }
      return 0;
    });
  }, [rawRows, sortValue]);

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

  const activeBookName = useMemo(() => {
    if (!pricebookId) return currentBook.name || 'Bảng giá chung';
    const found = pricebooksList.find((b) => String(b.id) === String(pricebookId));
    return found ? found.name : currentBook.name || 'Bảng giá chung';
  }, [pricebookId, pricebooksList, currentBook]);

  return (
    <div className="mobile-inventory-view">
      <MobilePageHeader
        title="Thiết lập giá" backTo="/m/more"
        actions={(
          <>
            <button
              type="button"
              className="btn btn-ghost btn-icon m-header-action"
              onClick={() => { setEditingBook(currentBook as Partial<Pricebook>); setDialogOpen(true); }}
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
            {totalRows} mặt hàng{totalRows > rawRows.length ? ` · Đã tải ${rawRows.length}` : ''}{mutation.isPending ? ' · Đang lưu giá…' : ''}
          </div>
        </div>
      </MobilePageHeader>

      {/* 4. Grouped Section List */}
      <div className="mobile-inventory-sections-wrapper">
        {isLoading ? (
          <LoadingState compact label="Đang tải bảng giá..." />
        ) : rawRows.length === 0 ? (
          <MobileEmptyState
              title="Không tìm thấy hàng hóa trong bảng giá"
              description="Thử tìm kiếm với từ khóa khác hoặc điều chỉnh bộ lọc."
            />
        ) : (
          <>
            {groupedCategories.map(([categoryName, items]) => (
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
                        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedItem(row); } }}
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
                            wrapperClassName="input-suffix mobile-pricebook-money-input"
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
            ))}
            {hasNextPage && (
              <button
                type="button"
                className="mobile-inventory-load-more"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? 'Đang tải thêm…' : 'Tải thêm mặt hàng'}
              </button>
            )}
          </>
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

                <div className="mobile-detail-status-pills">
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
                    <span className="mobile-pricebook-compare-val text-primary">
                      {formatMoney(book)}
                    </span>
                  </div>
                </div>

                {margin !== null && (
                  <div className="mobile-pricebook-margin-box">
                    <span>Biên lợi nhuận ước tính:</span>
                    <strong className={margin >= 30 ? 'text-success' : margin > 0 ? 'text-warning' : 'text-danger'}>
                      {margin}%
                    </strong>
                  </div>
                )}
              </div>

            </div>
          );
        })()}
      </MobileDetailSheet>

      {/* Pricebook Dialog */}
      <MobilePricebookDialog open={dialogOpen} pricebook={editingBook} onClose={() => setDialogOpen(false)} onSuccess={() => setDialogOpen(false)} />
    </div>
  );
}
