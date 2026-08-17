import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { updateInventoryItem } from '@/features/inventory/inventory.api';
import { MoneyInput } from '@/components/forms/MoneyInput';
import type { ApiRecord } from '@/types/api';
import '@/features/mobile-common/mobile-common.css';

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

  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

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
    <div className="mobile-form-sheet-backdrop" data-testid="mobile-product-edit-sheet">
      <div className="mobile-form-sheet-container">
        {/* Sticky Header */}
        <header className="mobile-form-sheet-header">
          <button
            type="button"
            className="mobile-form-back-btn"
            onClick={onClose}
            aria-label="Quay lại"
            disabled={mutation.isPending}
          >
            <i className="ph ph-caret-left" />
          </button>
          <h2 className="mobile-form-sheet-title">Sửa thông tin cơ bản</h2>
        </header>

        {/* Scrollable Body */}
        <form onSubmit={handleSave} className="mobile-form-sheet-body">
          {mutation.error && (
            <div className="mobile-form-card-field has-error" style={{ padding: '12px 14px' }}>
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
              <select
                id="product-edit-category"
                className="mobile-form-card-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="Chăm sóc salon">Chăm sóc salon</option>
                <option value="Chăm sóc da">Chăm sóc da</option>
                <option value="Trị liệu chuyên sâu">Trị liệu chuyên sâu</option>
                <option value="Gói dịch vụ">Gói dịch vụ</option>
                <option value="Mỹ phẩm cao cấp">Mỹ phẩm cao cấp</option>
                <option value="Thẻ tài khoản">Thẻ tài khoản</option>
              </select>
              <div className="mobile-form-card-accessory">
                <i className="ph ph-caret-right" />
              </div>
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

        {/* Sticky Footer Action Button */}
        <footer className="mobile-form-sheet-footer">
          <button
            type="button"
            className="mobile-form-save-btn"
            onClick={handleSave}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Đang lưu...' : 'Lưu'}
          </button>
        </footer>
      </div>
    </div>
  );
}
