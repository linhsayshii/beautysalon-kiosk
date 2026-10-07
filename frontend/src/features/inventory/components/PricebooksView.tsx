import { invalidateInventoryQueries } from '../invalidateInventoryQueries';
import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appConfig } from '@/app/config';
import { GoodsTypeBadge } from '@/components/data-display/Badges';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/DataState';
import { Pagination } from '@/components/data-display/Pagination';
import { FilterPanel, SelectFilter } from '@/components/forms/FilterPanel';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { SearchToolbar } from '@/components/forms/SearchToolbar';
import { PageHeader } from '@/components/ui/PageHeader/PageHeader';
import { DatePickerField } from '@/components/ui/DateTimePicker';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { formatMoney } from '@/lib/format';
import { createPricebook, deletePricebook, getPricebook, getPricebooks, updatePrice, updatePricebook } from '../inventory.api';
import type { CreatePricebookInput, Pricebook, UpdatePricebookInput } from '../inventory.api';
import { PricebookCustomerPicker } from './PricebookCustomerPicker';
import { Modal } from '@/components/ui/Modal/Modal';

const initialFilters = { search: '', pricebookId: '', category: '' };

interface PricebookDialogProps {
  open: boolean;
  pricebook?: Partial<Pricebook> | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function PricebookDialog({ open, pricebook, onClose, onSuccess }: PricebookDialogProps) {
  const [form, setForm] = useState<CreatePricebookInput>({
    code: '',
    name: '',
    active: true,
    effectiveFrom: null,
    effectiveTo: null,
    customerIds: [],
    copyFromDefault: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const initialized = useRef(false);
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const detailsQuery = useQuery({
    queryKey: ['pricebook-detail', pricebook?.id],
    queryFn: () => getPricebook(pricebook!.id!),
    enabled: open && Boolean(pricebook?.id),
  });

  useEffect(() => {
    if (!open) { initialized.current = false; return; }
    if (initialized.current || (pricebook?.id && !detailsQuery.data)) return;
    if (open) {
      initialized.current = true;
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
    onSuccess: () => { notify('Đã tạo bảng giá', 'Bảng giá mới đã được thêm.'); void invalidateInventoryQueries(queryClient); onSuccess(); },
    onError: (error: Error) => notify('Không thể tạo bảng giá', error.message),
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdatePricebookInput) => {
      if (!pricebook?.id) throw new Error('Missing pricebook ID');
      return updatePricebook(pricebook.id, data);
    },
    onSuccess: () => { notify('Đã cập nhật bảng giá', 'Thông tin bảng giá đã được lưu.'); void invalidateInventoryQueries(queryClient); onSuccess(); },
    onError: (error: Error) => notify('Không thể cập nhật', error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!pricebook?.id) throw new Error('Missing pricebook ID');
      return deletePricebook(pricebook.id);
    },
    onSuccess: () => { notify('Đã xóa bảng giá', 'Bảng giá đã được xóa.'); void invalidateInventoryQueries(queryClient); onSuccess(); },
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
    if (isPending || (isEditing && (detailsQuery.isPending || detailsQuery.error)) || !validate()) return;
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
    <Modal
      open={open}
      onClose={() => { if (!isPending) onClose(); }}
      className="modal-fill"
      title={isEditing ? 'Sửa bảng giá' : 'Thêm bảng giá mới'}
      size="lg"
      closeOnBackdrop={!isPending}
    >
      <div className="modal-body">
        {isEditing && detailsQuery.error && <ErrorState compact error={detailsQuery.error} onRetry={() => detailsQuery.refetch()} />}
        {isEditing && detailsQuery.isPending && <LoadingState compact />}
        <div className="form-grid">
          <div className="field">
            <label className="field-label" htmlFor="pricebook-code">Mã bảng giá <span className="field-required">*</span></label>
            <input type="text" className="input" aria-invalid={Boolean(errors.code)} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} id="pricebook-code" placeholder="BG-002" disabled={isEditing} />
            {errors.code && <span className="field-error">{errors.code}</span>}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="pricebook-name">Tên bảng giá <span className="field-required">*</span></label>
            <input type="text" className="input" aria-invalid={Boolean(errors.name)} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} id="pricebook-name" placeholder="Bảng giá khuyến mãi" />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>
          {!pricebook?.isDefault && <div className="field">
            <label className="field-label" htmlFor="pricebook-from">Ngày bắt đầu</label>
            <DatePickerField id="pricebook-from" className="input" value={form.effectiveFrom ?? ''} onChange={(effectiveFrom) => setForm({ ...form, effectiveFrom: effectiveFrom || null })} />
          </div>}
          {!pricebook?.isDefault && <div className="field">
            <label className="field-label" htmlFor="pricebook-to">Ngày kết thúc</label>
            <DatePickerField id="pricebook-to" className="input" aria-invalid={Boolean(errors.effectiveTo)} value={form.effectiveTo ?? ''} onChange={(effectiveTo) => setForm({ ...form, effectiveTo: effectiveTo || null })} />
            {errors.effectiveTo && <span className="field-error">{errors.effectiveTo}</span>}
          </div>}
          {!pricebook?.isDefault && <div className="field form-grid-full">
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
        </div>
      </div>
      <footer className="modal-footer">
        {isEditing && !pricebook?.isDefault && (
          <button type="button" className="btn btn-danger-soft modal-footer-start" onClick={handleDelete} disabled={isPending}>Xóa</button>
        )}
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isPending}>Hủy</button>
        <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={isPending || (isEditing && (detailsQuery.isPending || Boolean(detailsQuery.error)))}>
          {isEditing ? 'Lưu' : 'Tạo mới'}
        </button>
      </footer>
    </Modal>
  );
}

export function PricebooksView() {
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Partial<Pricebook> | null>(null);
  const { notify } = useToast();
  const client = useQueryClient();

  const query = useQuery({ queryKey: ['pricebooks', filters, page], queryFn: () => getPricebooks({ page, pageSize: appConfig.defaultPageSize, ...filters }) });
  const mutation = useMutation({
    mutationFn: ({ pricebookId, itemType, itemId, salePrice }: { pricebookId: number; itemType: string; itemId: number; salePrice: number }) => updatePrice(pricebookId, itemType, itemId, salePrice),
    onSuccess: () => { notify('Đã lưu giá', 'Bảng giá đã được cập nhật.'); void invalidateInventoryQueries(client); },
    onError: (error: Error) => notify('Không thể lưu giá', error.message),
  });

  const rows = query.data?.data ?? [];
  const book = query.data?.meta.pricebook ?? { id: 0, name: '' };
  const allBooks = query.data?.meta.pricebooks ?? [];
  const defaultBook = allBooks.find((item) => item.isDefault) ?? book;
  const additionalBooks = allBooks.filter((item) => !item.isDefault);
  const selectedBook = allBooks.find((item) => String(item.id) === String(book.id)) ?? allBooks.find((item) => item.isDefault);
  const apply = () => { setFilters(draft); setPage(1); };

  const openCreate = () => { setEditingBook(null); setDialogOpen(true); };
  const openEdit = (pb: typeof allBooks[0]) => {
    const fullBook: Partial<Pricebook> = {
      id: pb.id,
      code: pb.code,
      name: pb.name,
      active: pb.active,
      isDefault: pb.isDefault,
      effectiveFrom: pb.effectiveFrom ?? null,
      effectiveTo: pb.effectiveTo ?? null,
      createdAt: '',
    };
    setEditingBook(fullBook);
    setDialogOpen(true);
  };

  return (
    <main className="page">
      <div className="page-stack">
        <PageHeader title="Thiết lập giá" subtitle="Quản lý bảng giá và giá bán hàng hóa." actionLabel="Thêm bảng giá" onAction={openCreate} />
        <div className="page-grid">
          <FilterPanel title="Bảng giá" onApply={apply} onReset={() => { setDraft(initialFilters); setFilters(initialFilters); setPage(1); }}>
            <SelectFilter label="Nhóm hàng" value={draft.category} onChange={(category) => setDraft({ ...draft, category })} options={[{ value: '', label: 'Tất cả' }, ...(query.data?.meta.categories ?? []).map((category) => ({ value: category, label: category }))]} />
          </FilterPanel>
          <section className="data-panel">
            <div className="pricebook-toolbar">
              <div className="pricebook-strip" aria-label="Chọn bảng giá">
                <button
                  type="button"
                  className="chip"
                  aria-pressed={!draft.pricebookId}
                  onClick={() => { setDraft({ ...draft, pricebookId: '' }); setFilters({ ...draft, pricebookId: '' }); setPage(1); }}
                >
                  {defaultBook.name || 'Bảng giá chung'}
                </button>
                {additionalBooks.map((pb) => (
                  <button type="button" key={pb.id} className="chip" aria-pressed={String(draft.pricebookId) === String(pb.id)} onClick={() => { setDraft({ ...draft, pricebookId: String(pb.id) }); setFilters({ ...draft, pricebookId: String(pb.id) }); setPage(1); }}>
                    {pb.name}{pb.active ? '' : ' (Ngừng)'}
                  </button>
                ))}
              </div>
              <div className="pricebook-actions">
                <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => selectedBook && openEdit(selectedBook)} title={`Cài đặt ${book.name || 'bảng giá'}`} aria-label={`Cài đặt ${book.name || 'bảng giá'}`} disabled={!selectedBook}>
                  <i className="ph ph-gear" />
                </button>
              </div>
            </div>
            <SearchToolbar value={draft.search} placeholder="Tìm theo mã hoặc tên hàng" onChange={(search) => setDraft({ ...draft, search })} onSearch={apply} onRefresh={() => query.refetch()} />
            {query.isPending ? <LoadingState /> : query.error ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : !rows.length ? <EmptyState /> : (
              <>
                <div className="table-scroll">
                  <table className="data-table pricebook-table">
                    <thead>
                      <tr>
                        <th>Mã hàng hóa</th>
                        <th>Tên hàng</th>
                        <th>Loại</th>
                        <th>Giá vốn</th>
                        <th>Giá nhập cuối</th>
                        <th>{book?.name}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={`${row.itemType}-${row.itemId}`}>
                          <td data-label="Mã hàng"><span className="cell-main">{row.code}</span></td>
                          <td data-label="Tên hàng"><span className="cell-main">{row.name}</span><small className="cell-sub">{row.category}</small></td>
                          <td data-label="Loại"><GoodsTypeBadge type={row.itemType} /></td>
                          <td data-label="Giá vốn" className="money-cell">{formatMoney(row.costPrice)}</td>
                          <td data-label="Giá nhập cuối" className="money-cell">{formatMoney(row.lastPurchasePrice)}</td>
                          <td data-label={book?.name}>
                            <MoneyInput wrapperClassName="price-input" suffix="đ" defaultValue={row.bookPrice} disabled={mutation.isPending || row.active === false} aria-label={`Giá bán ${row.name}`} onBlur={(event) => { const salePrice = Math.max(0, Number(event.target.value.replace(/\D/g, '')) || 0); if (salePrice !== Number(row.bookPrice)) mutation.mutate({ pricebookId: book.id, itemType: row.itemType, itemId: row.itemId, salePrice }); }} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination pagination={query.data?.meta.pagination} onChange={setPage} />
              </>
            )}
          </section>
        </div>
        <PricebookDialog open={dialogOpen} pricebook={editingBook} onClose={() => setDialogOpen(false)} onSuccess={() => setDialogOpen(false)} />
      </div>
    </main>
  );
}
