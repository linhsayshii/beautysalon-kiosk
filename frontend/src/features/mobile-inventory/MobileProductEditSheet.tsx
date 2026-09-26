import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { updateInventoryItem } from '@/features/inventory/inventory.api';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { Select } from '@/components/ui/Select/Select';
import type { ApiRecord } from '@/types/api';
import { BottomSheet } from '@/components/ui/Sheet/BottomSheet';

export interface MobileProductEditSheetProps {
  isOpen: boolean;
  item: ApiRecord | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function MobileProductEditSheet({
  isOpen,
  item,
  onClose,
  onSuccess,
}: MobileProductEditSheetProps) {
  const queryClient = useQueryClient();
  let notify = (_title: string, _msg: string = '') => {};
  try {
    const toast = useToast();
    if (toast && toast.notify) {
      notify = (t: string, m?: string) => toast.notify(t, m || '');
    }
  } catch {
    // Fallback if rendered outside ToastProvider in tests
  }

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [unit, setUnit] = useState('cái');
  const [salePrice, setSalePrice] = useState<number>(0);
  const [costPrice, setCostPrice] = useState<number>(0);
  const [active, setActive] = useState(true);
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (item) {
      setName(String(item.name || ''));
      setCode(String(item.code || ''));
      setCategory(String(item.category || (item.itemType === 'package' ? 'Gói dịch vụ' : 'Chăm sóc salon')));
      setDurationMinutes(String(item.durationMinutes || (item.itemType === 'service' ? '60' : '')));
      setUnit(String(item.unit || (item.itemType === 'service' ? 'lần' : item.itemType === 'package' ? 'gói' : 'cái')));
      setSalePrice(Number(item.salePrice || item.price || item.listPrice || 0));
      setCostPrice(Number(item.costPrice || 0));
      setActive(item.active !== false);
      setDescription(String(item.description || ''));
      setErrors({});
    }
  }, [item]);

  const mutation = useMutation({
    mutationFn: (body: ApiRecord) => {
      if (!item) throw new Error('Không có thông tin hàng hóa');
      return updateInventoryItem(item.itemType, item.itemId || item.id, body);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['mobile-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['pricebooks'] });
      notify('Thành công', `Đã cập nhật hàng hóa ${res.data?.name || name}`);
      if (onSuccess) onSuccess();
      onClose();
    },
  });

  if (!isOpen || !item) return null;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Vui lòng nhập tên hàng';
    if (!code.trim()) errs.code = 'Vui lòng nhập mã hàng';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    mutation.mutate({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      category: category.trim() || 'Chăm sóc salon',
      salePrice: Number(salePrice) || 0,
      costPrice: Number(costPrice) || 0,
      durationMinutes: item.itemType === 'service' ? Number(durationMinutes) || 30 : undefined,
      unit: item.itemType === 'product' ? unit : undefined,
      active,
      description: description.trim() || undefined,
    });
  };

  const isServiceOrPackage = item.itemType === 'service' || item.itemType === 'package';

  return (
    <BottomSheet
      open={isOpen && Boolean(item)}
      onClose={() => { if (!mutation.isPending) onClose(); }}
      title="Sửa thông tin cơ bản"
      height="full"
      tone="muted"
      testId="mobile-product-edit-sheet"
      footer={(
        <button type="button" className="btn btn-primary btn-lg" onClick={handleSave} disabled={mutation.isPending}>
          {mutation.isPending ? 'Đang lưu...' : 'Lưu'}
        </button>
      )}
    >
      <form onSubmit={handleSave} className="form-stack">
        {mutation.error && (
          <div className="mobile-form-card-field has-error">
            <span className="mobile-form-card-error">
              <i className="ph ph-warning-circle" /> {(mutation.error as Error).message || 'Có lỗi xảy ra khi lưu hàng hóa'}
            </span>
          </div>
        )}

        {/* Tên hàng */}
        <div className={`mobile-form-card-field ${errors.name ? 'has-error' : ''}`}>
          <label htmlFor="product-edit-name" className="mobile-form-card-label">
            Tên hàng<span className="required-star">*</span>
          </label>
          <div className="mobile-form-card-row">
            <input
              id="product-edit-name"
              className="mobile-form-card-input"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
              }}
              placeholder="Nhập tên hàng hóa"
            />
          </div>
          {errors.name && <span className="mobile-form-card-error">{errors.name}</span>}
        </div>

        {/* Mã hàng */}
        <div className={`mobile-form-card-field ${errors.code ? 'has-error' : ''}`}>
          <label htmlFor="product-edit-code" className="mobile-form-card-label">
            Mã hàng<span className="required-star">*</span>
          </label>
          <div className="mobile-form-card-row">
            <input
              id="product-edit-code"
              className="mobile-form-card-input"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                if (errors.code) setErrors((prev) => ({ ...prev, code: '' }));
              }}
              placeholder="SP000000"
            />
            <div className="mobile-form-card-accessory">
              <i className="ph ph-scan" />
            </div>
          </div>
          {errors.code && <span className="mobile-form-card-error">{errors.code}</span>}
        </div>

        {/* Thời lượng hoặc Đơn vị tính */}
        {isServiceOrPackage ? (
          <div className="mobile-form-card-field">
            <label htmlFor="product-edit-duration" className="mobile-form-card-label">
              Thời lượng
            </label>
            <div className="mobile-form-card-row">
              <input
                id="product-edit-duration"
                type="number"
                className="mobile-form-card-input"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                placeholder="60"
              />
              <span className="mobile-form-card-accessory">Phút</span>
            </div>
          </div>
        ) : (
          <div className="mobile-form-card-field">
            <label htmlFor="product-edit-unit" className="mobile-form-card-label">
              Đơn vị tính
            </label>
            <div className="mobile-form-card-row">
              <input
                id="product-edit-unit"
                className="mobile-form-card-input"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="cái, chai, hộp..."
              />
            </div>
          </div>
        )}

        {/* Nhóm hàng */}
        <div className="mobile-form-card-field">
          <label htmlFor="product-edit-category" className="mobile-form-card-label">
            Nhóm hàng
          </label>
          <div className="mobile-form-card-row">
            <Select
              id="product-edit-category"
              triggerClassName="mobile-form-card-select"
              fullWidth
              value={category}
              onChange={setCategory}
              options={['Chăm sóc salon', 'Chăm sóc da', 'Trị liệu chuyên sâu', 'Gói dịch vụ', 'Mỹ phẩm cao cấp', 'Thẻ tài khoản'].map((itemCategory) => ({ value: itemCategory, label: itemCategory }))}
            />
          </div>
        </div>

        {/* 2-col Grid: Giá bán & Giá vốn */}
        <div className="mobile-form-card-grid-2">
          <div className="mobile-form-card-field">
            <label htmlFor="product-edit-sale-price" className="mobile-form-card-label">
              Giá bán
            </label>
            <div className="mobile-form-card-row">
              <MoneyInput
                id="product-edit-sale-price"
                className="mobile-form-card-input"
                wrapperClassName="mobile-form-card-money-input"
                value={salePrice}
                onChange={(val) => setSalePrice(val)}
                placeholder="0"
                suffix="đ"
              />
              <div className="mobile-form-card-accessory">
                <i className="ph ph-tag" />
              </div>
            </div>
          </div>

          <div className="mobile-form-card-field">
            <label htmlFor="product-edit-cost-price" className="mobile-form-card-label">
              Giá vốn
            </label>
            <div className="mobile-form-card-row">
              <MoneyInput
                id="product-edit-cost-price"
                className="mobile-form-card-input"
                wrapperClassName="mobile-form-card-money-input"
                value={costPrice}
                onChange={(val) => setCostPrice(val)}
                placeholder="0"
                suffix="đ"
              />
            </div>
          </div>
        </div>

        {/* Cho phép bán (Switch toggle) */}
        <div className="mobile-form-card-switch">
          <span className="mobile-form-switch-label">Cho phép bán</span>
          <label className="mobile-form-toggle-switch">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            <span className="mobile-form-toggle-slider" />
          </label>
        </div>
      </form>
    </BottomSheet>
  );
}
