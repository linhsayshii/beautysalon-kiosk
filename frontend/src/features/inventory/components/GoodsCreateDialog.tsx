import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appConfig } from '@/app/config';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { Select } from '@/components/ui/Select/Select';
import { Combobox } from '@/components/ui/Combobox/Combobox';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { formatMoney } from '@/lib/format';
import { createInventoryItem, getInventoryItem, getProducts, updateInventoryItem } from '../inventory.api';
import type { CreateInventoryItemInput, InventoryItemType } from '../inventory.api';
import type { ApiRecord } from '@/types/api';
import { Modal } from '@/components/ui/Modal/Modal';
import { BarcodeInput } from '@/components/ui/BarcodeScanner/BarcodeScannerModal';
import { ProductImageField } from './ProductImageField';

type CommissionType = 'percent' | 'fixed' | null;

interface GoodsCreateDialogProps {
  type: InventoryItemType;
  onClose: () => void;
  itemId?: number;
  initialData?: ApiRecord;
  initialTab?: 'information' | 'details';
}
interface PackageItem { serviceId: string; units: number }

const typeCopy: Record<InventoryItemType, { title: string; noun: string; editTitle: string }> = {
  product: { title: 'Tạo sản phẩm', noun: 'sản phẩm', editTitle: 'Chỉnh sửa sản phẩm' },
  service: { title: 'Tạo dịch vụ', noun: 'dịch vụ', editTitle: 'Chỉnh sửa dịch vụ' },
  package: { title: 'Tạo gói dịch vụ, liệu trình', noun: 'gói dịch vụ', editTitle: 'Chỉnh sửa gói dịch vụ' },
  account_card: { title: 'Tạo thẻ tài khoản', noun: 'thẻ tài khoản', editTitle: 'Chỉnh sửa thẻ tài khoản' },
};

const initialForm = {
  name: '', code: '', barcode: '', category: '', brand: '', unit: 'cái',
  salePrice: '0', costPrice: '0', initialStock: '0', minStock: '0', maxStock: '',
  durationMinutes: '30', validityDays: '', usageSchedule: 'flexible', faceValue: '0',
  active: true, imageUrl: '', description: '', note: '',
};

const numeric = (value: string) => Number(value) || 0;

function buildFormFromItem(data: ApiRecord) {
  return {
    name: String(data.name ?? ''),
    code: String(data.code ?? ''),
    barcode: String(data.barcode ?? ''),
    category: String(data.category ?? ''),
    brand: String(data.brand ?? ''),
    unit: String(data.unit ?? 'cái'),
    salePrice: String(data.salePrice ?? 0),
    costPrice: String(data.costPrice ?? 0),
    initialStock: String(data.initialStock ?? data.stockQuantity ?? 0),
    minStock: String(data.minStock ?? 0),
    maxStock: data.maxStock ? String(data.maxStock) : '',
    durationMinutes: String(data.durationMinutes ?? 30),
    validityDays: data.validityDays ? String(data.validityDays) : '',
    usageSchedule: String(data.usageSchedule ?? 'flexible'),
    faceValue: String(data.faceValue ?? 0),
    active: data.active !== false,
    imageUrl: String(data.imageUrl ?? ''),
    description: String(data.description ?? ''),
    note: String(data.note ?? ''),
  };
}

function buildCommissionFromItem(data: ApiRecord) {
  const ct = data.commissionType ?? null;
  const tt = data.tourCommissionType ?? null;
  return {
    commissionType: ct,
    commissionRate: ct === 'percent' ? Number(data.commissionRate ?? 0) * 100 : Number(data.commissionRate ?? 0),
    tourCommissionType: tt,
    tourCommissionRate: tt === 'percent' ? Number(data.tourCommissionRate ?? 0) * 100 : Number(data.tourCommissionRate ?? 0),
  };
}

interface CommissionSectionProps {
  id: string;
  title: string;
  description: string;
  type: CommissionType;
  /** Percent as a whole number (10 = 10%) or a fixed amount in dong. */
  rate: number;
  onTypeChange: (type: CommissionType) => void;
  onRateChange: (rate: number) => void;
  salePrice: number;
  noun: string;
}

function CommissionSection({ id, title, description, type, rate, onTypeChange, onRateChange, salePrice, noun }: CommissionSectionProps) {
  const lowerTitle = title.toLowerCase();
  return (
    <section className="form-section is-card" role="group" aria-labelledby={`${id}-title`}>
      <div className="form-section-head"><div><h3 className="form-section-title" id={`${id}-title`}>{title}</h3><p className="form-section-text">{description}</p></div></div>
      <div className="commission-inline">
        <label className="commission-toggle">
          <input
            type="checkbox"
            checked={type !== null}
            onChange={(e) => {
              onTypeChange(e.target.checked ? 'percent' : null);
              onRateChange(0);
            }}
          />
          <span>Cho phép tính {lowerTitle}</span>
        </label>

        {type !== null && (
          <div className="commission-config-row">
            <div className="segmented" role="group" aria-label={`Loại ${lowerTitle}`}>
              <button type="button" aria-pressed={type === 'percent'} onClick={() => onTypeChange('percent')}>
                % giá bán
              </button>
              <button type="button" aria-pressed={type === 'fixed'} onClick={() => onTypeChange('fixed')}>
                Số tiền cố định
              </button>
            </div>

            <div className="commission-rate-row">
              {type === 'percent' ? (
                <div className="input-suffix commission-rate-input">
                  <input
                    id={`${id}-rate`}
                    type="text"
                    inputMode="numeric"
                    aria-label={`Mức ${lowerTitle}`}
                    value={rate}
                    onChange={(event) => onRateChange(Number(event.target.value.replace(/\D/g, '')) || 0)}
                    placeholder="0"
                  />
                  <span>%</span>
                </div>
              ) : (
                <MoneyInput
                  id={`${id}-rate`}
                  aria-label={`Mức ${lowerTitle}`}
                  suffix="đ"
                  value={rate}
                  onChange={onRateChange}
                  placeholder="0"
                  wrapperClassName="input-suffix commission-rate-input"
                />
              )}

              {type === 'percent' && (
                <div className="commission-preview">
                  ≈ {formatMoney(salePrice * (rate / 100))} / {noun}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function GoodsCreateDialog({ type, onClose, itemId, initialData, initialTab = 'information' }: GoodsCreateDialogProps) {
  const isEdit = Boolean(itemId && initialData);
  const [tab, setTab] = useState<'information' | 'details'>(initialTab);
  const [form, setForm] = useState(initialData ? buildFormFromItem(initialData) : initialForm);
  const [imageUploading, setImageUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [packageItems, setPackageItems] = useState<PackageItem[]>([]);
  const [serviceToAdd, setServiceToAdd] = useState('');
  const [allowedTypes, setAllowedTypes] = useState<string[]>(['product', 'service', 'package']);
  const [scopeItems, setScopeItems] = useState<string[]>([]);
  const [commissionType, setCommissionType] = useState<CommissionType>(
    initialData ? buildCommissionFromItem(initialData).commissionType : null,
  );
  const [commissionRate, setCommissionRate] = useState(
    initialData ? buildCommissionFromItem(initialData).commissionRate : 0,
  );
  const [tourCommissionType, setTourCommissionType] = useState<CommissionType>(
    initialData ? buildCommissionFromItem(initialData).tourCommissionType : null,
  );
  const [tourCommissionRate, setTourCommissionRate] = useState(
    initialData ? buildCommissionFromItem(initialData).tourCommissionRate : 0,
  );
  const nameRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const copy = typeCopy[type];
  const needsCatalog = type === 'package' || type === 'account_card';
  const catalog = useQuery({
    queryKey: ['goods-create-catalog', type],
    queryFn: () => getProducts({ type: type === 'package' ? 'service' : '', status: 'active', page: 1, pageSize: appConfig.purchaseCatalogPageSize }),
    enabled: needsCatalog,
  });
  // The products endpoint returns every category of the branch whatever the filters, so one row is enough.
  const categoriesQuery = useQuery({
    queryKey: ['goods-create-catalog', 'categories'],
    queryFn: () => getProducts({ page: 1, pageSize: 1 }),
  });
  const categories = useMemo(() => (categoriesQuery.data?.meta.categories ?? []).filter(Boolean), [categoriesQuery.data]);
  const itemQuery = useQuery({
    queryKey: ['inventory-item', type, itemId],
    queryFn: () => getInventoryItem(type, Number(itemId)),
    enabled: isEdit,
  });
  const availableItems = catalog.data?.data ?? [];
  const availableServices = type === 'package' ? availableItems : [];
  const selectedServices = useMemo(() => packageItems.map((item) => ({
    ...item,
    service: availableServices.find((service) => String(service.itemId) === item.serviceId),
  })), [availableServices, packageItems]);

  useEffect(() => {
    const source = itemQuery.data?.data ?? initialData;
    if (source) {
      setForm(buildFormFromItem(source));
      const commission = buildCommissionFromItem(source);
      setCommissionType(commission.commissionType);
      setCommissionRate(commission.commissionRate);
      setTourCommissionType(commission.tourCommissionType);
      setTourCommissionRate(commission.tourCommissionRate);
      if (Array.isArray(source.packageItems)) {
        setPackageItems(source.packageItems.map((item: { serviceId: number; units: number }) => ({
          serviceId: String(item.serviceId),
          units: Number(item.units ?? 1),
        })));
      }
      if (Array.isArray(source.allowedTypes)) {
        setAllowedTypes(source.allowedTypes.map(String));
      }
      if (Array.isArray(source.scopeItems)) {
        setScopeItems(source.scopeItems.map((item: { itemType: string; itemId: number }) => `${item.itemType}:${item.itemId}`));
      }
    }
  }, [initialData, itemQuery.data]);

  const mutation = useMutation({
    mutationFn: (payload: CreateInventoryItemInput) => {
      if (isEdit && itemId) {
        return updateInventoryItem(type, itemId, payload as ApiRecord);
      }
      return createInventoryItem(payload);
    },
    onSuccess: (payload) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['pricebooks'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-catalog'] });
      queryClient.invalidateQueries({ queryKey: ['goods-create-catalog'] });
      queryClient.invalidateQueries({ queryKey: ['customer-packages'] });
      queryClient.invalidateQueries({ queryKey: ['pos-catalog'] });
      notify(
        isEdit ? `Đã cập nhật ${copy.noun}` : `Đã tạo ${copy.noun}`,
        `${payload.data.code} đã được ${isEdit ? 'cập nhật' : 'lưu'} vào database.`,
      );
      onClose();
    },
  });

  const update = (key: keyof typeof initialForm, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  };

  const addService = () => {
    if (!serviceToAdd || packageItems.some((item) => item.serviceId === serviceToAdd)) return;
    setPackageItems((current) => [...current, { serviceId: serviceToAdd, units: 1 }]);
    setServiceToAdd('');
    setErrors((current) => ({ ...current, packageItems: '' }));
  };

  const toggleAllowedType = (itemType: string) => {
    setAllowedTypes((current) => current.includes(itemType) ? current.filter((value) => value !== itemType) : [...current, itemType]);
    setScopeItems((current) => current.filter((key) => !key.startsWith(`${itemType}:`)));
    setErrors((current) => ({ ...current, allowedTypes: '' }));
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Hãy nhập tên hàng.';
    if (numeric(form.salePrice) < 0) next.salePrice = 'Giá bán không được âm.';
    if (numeric(form.costPrice) < 0) next.costPrice = 'Giá vốn không được âm.';
    if (form.maxStock && numeric(form.maxStock) < numeric(form.minStock)) next.maxStock = 'Tồn tối đa phải lớn hơn hoặc bằng tồn tối thiểu.';
    if (type === 'service' && numeric(form.durationMinutes) <= 0) next.durationMinutes = 'Thời lượng phải lớn hơn 0.';
    if (type === 'package' && !packageItems.length) next.packageItems = 'Hãy thêm ít nhất một dịch vụ vào gói.';
    if (type === 'account_card' && numeric(form.faceValue) <= 0) next.faceValue = 'Mệnh giá phải lớn hơn 0.';
    if (type === 'account_card' && !allowedTypes.length) next.allowedTypes = 'Chọn ít nhất một loại hàng được thanh toán.';
    setErrors(next);
    if (Object.keys(next).length) setTab('information');
    return !Object.keys(next).length;
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (imageUploading || !validate()) return;
    const payload: CreateInventoryItemInput = {
      type,
      name: form.name.trim(),
      code: form.code.trim(),
      category: form.category.trim(),
      brand: form.brand.trim(),
      salePrice: numeric(form.salePrice),
      costPrice: numeric(form.costPrice),
      active: form.active,
      imageUrl: form.imageUrl.trim(),
      description: form.description.trim(),
      note: form.note.trim(),
      barcode: form.barcode.trim(),
      unit: form.unit.trim(),
      initialStock: numeric(form.initialStock),
      minStock: numeric(form.minStock),
      maxStock: form.maxStock ? numeric(form.maxStock) : null,
      durationMinutes: numeric(form.durationMinutes),
      validityDays: form.validityDays ? numeric(form.validityDays) : null,
      usageSchedule: form.usageSchedule,
      faceValue: numeric(form.faceValue),
      packageItems: packageItems.map((item) => ({ serviceId: Number(item.serviceId), units: item.units })),
      allowedTypes,
      scopeItems: scopeItems.map((key) => { const [itemType, itemId] = key.split(':'); return { itemType, itemId: Number(itemId) }; }),
      commissionType: commissionType,
      commissionRate: commissionType === 'percent' ? commissionRate / 100 : commissionRate,
      tourCommissionType: type === 'service' ? tourCommissionType : null,
      tourCommissionRate: type !== 'service' ? 0 : tourCommissionType === 'percent' ? tourCommissionRate / 100 : tourCommissionRate,
    };
    mutation.mutate(payload);
  };

  const closeUnlessSaving = () => { if (!mutation.isPending) onClose(); };
  return <Modal
    open
    onClose={closeUnlessSaving}
    title={isEdit ? copy.editTitle : copy.title}
    size="xl"
    className="modal-fill"
    nested
    closeOnBackdrop={!mutation.isPending}
    initialFocusRef={nameRef}
    headerExtra={<div className="tabs" role="tablist" aria-label="Nội dung hàng hóa">
        <button id="goods-tab-information" type="button" role="tab" aria-controls="goods-panel" aria-selected={tab === 'information'} className={`tab${tab === 'information' ? ' is-active' : ''}`} onClick={() => setTab('information')}>Thông tin</button>
        <button id="goods-tab-details" type="button" role="tab" aria-controls="goods-panel" aria-selected={tab === 'details'} className={`tab${tab === 'details' ? ' is-active' : ''}`} onClick={() => setTab('details')}>Hình ảnh, mô tả, ghi chú</button>
      </div>}
  >
      <form onSubmit={submit} noValidate>
        <div id="goods-panel" className="modal-body" role="tabpanel" aria-labelledby={tab === 'information' ? 'goods-tab-information' : 'goods-tab-details'}>
          {itemQuery.error && <div className="alert alert-danger" role="alert"><i className="ph ph-warning-circle" /><div><strong>Không thể tải thông tin đầy đủ</strong><small>{itemQuery.error.message}</small></div></div>}
          {mutation.error && <div className="alert alert-danger" role="alert"><i className="ph ph-warning-circle" /><div><strong>Không thể lưu {copy.noun}</strong><small>{mutation.error.message}</small></div></div>}
          {tab === 'information' ? <>
            <div className="field"><label className="field-label" htmlFor="goods-name">Tên hàng <span className="field-required">*</span></label><input ref={nameRef} className="input" id="goods-name" value={form.name} onChange={(event) => update('name', event.target.value)} aria-invalid={Boolean(errors.name)} placeholder={`Nhập tên ${copy.noun}`} />{errors.name && <small className="field-error">{errors.name}</small>}</div>
            <div className="form-grid">
              <div className="field"><label className="field-label" htmlFor="goods-code">Mã hàng</label><input className="input" id="goods-code" value={form.code} onChange={(event) => update('code', event.target.value.toUpperCase())} placeholder="Tự động nếu để trống" /></div>
              {type === 'product' ? <div className="field"><label className="field-label" htmlFor="goods-barcode">Mã vạch</label><BarcodeInput id="goods-barcode" value={form.barcode} onChange={(value) => update('barcode', value)} /></div> : type === 'service' ? <div className="field"><label className="field-label" htmlFor="goods-duration">Thời lượng</label><div className="input-suffix"><input id="goods-duration" type="number" min="1" value={form.durationMinutes} onChange={(event) => update('durationMinutes', event.target.value)} /><span>phút</span></div>{errors.durationMinutes && <small className="field-error">{errors.durationMinutes}</small>}</div> : <div className="field"><label className="field-label" htmlFor="goods-validity">Thời hạn sử dụng</label><div className="input-suffix"><input id="goods-validity" type="number" min="1" value={form.validityDays} onChange={(event) => update('validityDays', event.target.value)} placeholder="Không giới hạn" /><span>ngày</span></div></div>}
              <div className="field"><label className="field-label" htmlFor="goods-category">Nhóm hàng</label><Combobox id="goods-category" value={form.category} onChange={(value) => update('category', value)} placeholder="Nhập hoặc chọn nhóm hàng" options={categories} /></div>
              <div className="field"><label className="field-label" htmlFor="goods-brand">Thương hiệu</label><input className="input" id="goods-brand" value={form.brand} onChange={(event) => update('brand', event.target.value)} placeholder="Nhập thương hiệu" /></div>
            </div>
            <label className="check"><input type="checkbox" checked={form.active} onChange={(event) => update('active', event.target.checked)} />Cho phép bán</label>

            <section className="form-section is-card"><div className="form-section-head"><div><h3 className="form-section-title">{type === 'account_card' ? 'Giá bán, mệnh giá' : 'Giá bán, giá vốn'}</h3><p className="form-section-text">Giá được đồng bộ sang bảng giá chung khi lưu.</p></div></div><div className="form-grid">
              <div className="field"><label className="field-label" htmlFor="goods-sale-price">Giá bán</label><MoneyInput id="goods-sale-price" suffix="đ" value={numeric(form.salePrice)} onChange={(val) => update('salePrice', String(val))} />{errors.salePrice && <small className="field-error">{errors.salePrice}</small>}</div>
              {type === 'account_card' ? <div className="field"><label className="field-label" htmlFor="goods-face-value">Mệnh giá sử dụng</label><MoneyInput id="goods-face-value" suffix="đ" value={numeric(form.faceValue)} onChange={(val) => update('faceValue', String(val))} />{errors.faceValue && <small className="field-error">{errors.faceValue}</small>}</div> : <div className="field"><label className="field-label" htmlFor="goods-cost-price">Giá vốn</label><MoneyInput id="goods-cost-price" suffix="đ" value={numeric(form.costPrice)} onChange={(val) => update('costPrice', String(val))} />{errors.costPrice && <small className="field-error">{errors.costPrice}</small>}</div>}
            </div></section>

            <CommissionSection
              id="goods-commission"
              title={type === 'service' ? 'Hoa hồng tư vấn bán' : type === 'product' ? 'Hoa hồng bán' : 'Hoa hồng'}
              description={type === 'service'
                ? 'Trả cho nhân viên tư vấn bán được chọn trên từng dòng dịch vụ.'
                : `Thiết lập hoa hồng cho nhân viên khi bán ${copy.noun}.`}
              type={commissionType}
              rate={commissionRate}
              onTypeChange={setCommissionType}
              onRateChange={setCommissionRate}
              salePrice={numeric(form.salePrice)}
              noun={copy.noun}
            />

            {type === 'service' && <CommissionSection
              id="goods-tour-commission"
              title="Hoa hồng tua"
              description="Trả cho nhân viên thực hiện mỗi lượt làm dịch vụ."
              type={tourCommissionType}
              rate={tourCommissionRate}
              onTypeChange={setTourCommissionType}
              onRateChange={setTourCommissionRate}
              salePrice={numeric(form.salePrice)}
              noun="lượt"
            />}

            {type === 'product' && <section className="form-section is-card"><div className="form-section-head"><div><h3 className="form-section-title">Tồn kho</h3><p className="form-section-text">{isEdit ? 'Điều chỉnh số lượng tồn hiện tại và cảnh báo tồn.' : 'Thiết lập số lượng ban đầu và cảnh báo tồn.'}</p></div></div><div className="form-grid form-grid-3"><div className="field"><label className="field-label" htmlFor="goods-stock">{isEdit ? 'Tồn hiện tại' : 'Tồn ban đầu'}</label><input className="input" id="goods-stock" type="number" min="0" value={form.initialStock} onChange={(event) => update('initialStock', event.target.value)} /></div><div className="field"><label className="field-label" htmlFor="goods-min-stock">Tồn tối thiểu</label><input className="input" id="goods-min-stock" type="number" min="0" value={form.minStock} onChange={(event) => update('minStock', event.target.value)} /></div><div className="field"><label className="field-label" htmlFor="goods-max-stock">Tồn tối đa</label><input className="input" id="goods-max-stock" type="number" min="1" value={form.maxStock} onChange={(event) => update('maxStock', event.target.value)} placeholder="Không giới hạn" aria-invalid={Boolean(errors.maxStock)} />{errors.maxStock && <small className="field-error">{errors.maxStock}</small>}</div></div><div className="field field-compact"><label className="field-label" htmlFor="goods-unit">Đơn vị tính</label><input className="input" id="goods-unit" value={form.unit} onChange={(event) => update('unit', event.target.value)} /></div></section>}

            {type === 'package' && <section className="form-section is-card"><div className="form-section-head"><div><h3 className="form-section-title">Dịch vụ trong gói</h3><p className="form-section-text">Gói được liên kết trực tiếp với các dịch vụ đã tạo.</p></div></div>{catalog.isPending ? <div className="goods-inline-state">Đang tải danh sách dịch vụ...</div> : catalog.error ? <div className="goods-inline-state error">{catalog.error.message}</div> : <><div className="goods-link-picker"><Select value={serviceToAdd} onChange={setServiceToAdd} placeholder="Chọn dịch vụ" fullWidth className="goods-service-select" options={[{ value: '', label: 'Chọn dịch vụ' }, ...availableServices.filter((service) => !packageItems.some((item) => item.serviceId === String(service.itemId))).map((service) => ({ value: String(service.itemId), label: `${service.name} (${formatMoney(service.salePrice)})` }))]} /><button className="btn btn-secondary" type="button" onClick={addService} disabled={!serviceToAdd}><i className="ph ph-plus" />Thêm dịch vụ</button></div>{selectedServices.length ? <div className="linked-items-list">{selectedServices.map((item) => <div key={item.serviceId}><span><strong>{item.service?.name ?? `Dịch vụ #${item.serviceId}`}</strong><small>{item.service?.code}</small></span><label>Số buổi<input type="number" min="1" value={item.units} onChange={(event) => setPackageItems((current) => current.map((row) => row.serviceId === item.serviceId ? { ...row, units: Math.max(1, Number(event.target.value) || 1) } : row))} /></label><button type="button" aria-label="Xóa dịch vụ khỏi gói" onClick={() => setPackageItems((current) => current.filter((row) => row.serviceId !== item.serviceId))}><i className="ph ph-trash" /></button></div>)}</div> : <div className="goods-inline-state">Chưa có dịch vụ trong gói. Hãy tạo dịch vụ trước nếu danh sách đang trống.</div>}</>}{errors.packageItems && <small className="field-error section-error">{errors.packageItems}</small>}<div className="field field-compact"><label className="field-label" htmlFor="goods-schedule">Lịch sử dụng</label><Select id="goods-schedule" value={form.usageSchedule} onChange={(val) => update('usageSchedule', val)} fullWidth options={[{ value: 'flexible', label: 'Tự do' }, { value: 'scheduled', label: 'Theo lịch' }]} /></div></section>}

            {type === 'account_card' && <section className="form-section is-card"><div className="form-section-head"><div><h3 className="form-section-title">Phạm vi thanh toán</h3><p className="form-section-text">Chọn loại hàng và hàng hóa được phép thanh toán bằng thẻ.</p></div></div><div className="scope-type-options">{[['product', 'Sản phẩm'], ['service', 'Dịch vụ'], ['package', 'Gói dịch vụ, liệu trình']].map(([value, label]) => <label key={value}><input type="checkbox" checked={allowedTypes.includes(value)} onChange={() => toggleAllowedType(value)} />{label}</label>)}</div>{errors.allowedTypes && <small className="field-error section-error">{errors.allowedTypes}</small>}<div className="scope-items"><strong>Giới hạn theo hàng hóa cụ thể</strong><small>Không chọn mục nào nghĩa là áp dụng cho toàn bộ loại hàng đã chọn.</small>{catalog.isPending ? <div className="goods-inline-state">Đang tải hàng hóa...</div> : availableItems.filter((item) => allowedTypes.includes(item.itemType)).length ? <div className="scope-item-grid">{availableItems.filter((item) => allowedTypes.includes(item.itemType)).map((item) => { const key = `${item.itemType}:${item.itemId}`; return <label key={key}><input type="checkbox" checked={scopeItems.includes(key)} onChange={() => setScopeItems((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key])} /><span><strong>{item.name}</strong><small>{item.code}</small></span></label>; })}</div> : <div className="goods-inline-state">Chưa có hàng hóa để giới hạn phạm vi.</div>}</div></section>}
          </> : <div className="goods-details-tab">
            <ProductImageField value={form.imageUrl} onChange={(url) => update('imageUrl', url)} onUploadingChange={setImageUploading} disabled={mutation.isPending} />
            <div className="field"><label className="field-label" htmlFor="goods-description">Mô tả</label><textarea className="textarea" id="goods-description" rows={6} value={form.description} onChange={(event) => update('description', event.target.value)} placeholder={`Mô tả ${copy.noun}`} /></div>
            <div className="field"><label className="field-label" htmlFor="goods-note">Ghi chú nội bộ</label><textarea className="textarea" id="goods-note" rows={4} value={form.note} onChange={(event) => update('note', event.target.value)} placeholder="Thông tin chỉ dùng trong nội bộ" /></div>
          </div>}
        </div>
        <footer className="modal-footer"><button className="btn btn-secondary" type="button" onClick={onClose} disabled={mutation.isPending}>Bỏ qua</button><button className="btn btn-primary" type="submit" disabled={mutation.isPending || imageUploading || (isEdit && itemQuery.isPending) || Boolean(itemQuery.error)}>{mutation.isPending ? 'Đang lưu...' : imageUploading ? 'Đang tải ảnh...' : isEdit && itemQuery.isPending ? 'Đang tải...' : 'Lưu'}</button></footer>
      </form>
  </Modal>;
}
