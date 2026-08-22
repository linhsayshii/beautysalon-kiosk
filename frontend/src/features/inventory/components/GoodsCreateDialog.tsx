import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, RefObject } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appConfig } from '@/app/config';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { Select } from '@/components/ui/Select/Select';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { formatMoney } from '@/lib/format';
import { createInventoryItem, getInventoryItem, getProducts, updateInventoryItem } from '../inventory.api';
import type { CreateInventoryItemInput, InventoryItemType } from '../inventory.api';
import type { ApiRecord } from '@/types/api';
import { useMobileDialog } from '@/features/mobile-common/useMobileDialog';

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
  return {
    commissionType: ct,
    commissionRate: ct === 'percent' ? Number(data.commissionRate ?? 0) * 100 : Number(data.commissionRate ?? 0),
  };
}

export function GoodsCreateDialog({ type, onClose, itemId, initialData, initialTab = 'information' }: GoodsCreateDialogProps) {
  const isEdit = Boolean(itemId && initialData);
  const [tab, setTab] = useState<'information' | 'details'>(initialTab);
  const [form, setForm] = useState(initialData ? buildFormFromItem(initialData) : initialForm);
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
  const nameRef = useRef<HTMLInputElement>(null);
  const { dialogRef, titleId } = useMobileDialog({ isOpen: true, onClose, initialFocusRef: nameRef });
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const copy = typeCopy[type];
  const needsCatalog = type === 'package' || type === 'account_card';
  const catalog = useQuery({
    queryKey: ['goods-create-catalog', type],
    queryFn: () => getProducts({ type: type === 'package' ? 'service' : '', status: 'active', page: 1, pageSize: appConfig.purchaseCatalogPageSize }),
    enabled: needsCatalog,
  });
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
      const { commissionType: ct, commissionRate: cr } = buildCommissionFromItem(source);
      setCommissionType(ct);
      setCommissionRate(cr);
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
    if (!validate()) return;
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
    };
    mutation.mutate(payload);
  };

  return <div className="goods-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !mutation.isPending) onClose(); }}>
    <section ref={dialogRef as RefObject<HTMLElement>} className="goods-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
      <header className="goods-dialog-header">
        <h2 id={titleId}>{isEdit ? copy.editTitle : copy.title}</h2>
        <button type="button" onClick={onClose} disabled={mutation.isPending} aria-label="Đóng"><i className="ph ph-x" /></button>
      </header>
      <div className="goods-dialog-tabs" role="tablist" aria-label="Nội dung hàng hóa">
        <button id="goods-tab-information" type="button" role="tab" aria-controls="goods-panel" aria-selected={tab === 'information'} className={tab === 'information' ? 'is-active' : ''} onClick={() => setTab('information')}>Thông tin</button>
        <button id="goods-tab-details" type="button" role="tab" aria-controls="goods-panel" aria-selected={tab === 'details'} className={tab === 'details' ? 'is-active' : ''} onClick={() => setTab('details')}>Hình ảnh, mô tả, ghi chú</button>
      </div>
      <form onSubmit={submit} noValidate>
        <div id="goods-panel" className="goods-dialog-body" role="tabpanel" aria-labelledby={tab === 'information' ? 'goods-tab-information' : 'goods-tab-details'}>
          {itemQuery.error && <div className="goods-form-alert" role="alert"><i className="ph ph-warning-circle" /><span><strong>Không thể tải thông tin đầy đủ</strong><small>{itemQuery.error.message}</small></span></div>}
          {mutation.error && <div className="goods-form-alert" role="alert"><i className="ph ph-warning-circle" /><span><strong>Không thể lưu {copy.noun}</strong><small>{mutation.error.message}</small></span></div>}
          {tab === 'information' ? <>
            <div className="goods-field full-field"><label htmlFor="goods-name">Tên hàng <span>*</span></label><input ref={nameRef} id="goods-name" value={form.name} onChange={(event) => update('name', event.target.value)} aria-invalid={Boolean(errors.name)} placeholder={`Nhập tên ${copy.noun}`} />{errors.name && <small className="field-error">{errors.name}</small>}</div>
            <div className="goods-form-grid">
              <div className="goods-field"><label htmlFor="goods-code">Mã hàng</label><input id="goods-code" value={form.code} onChange={(event) => update('code', event.target.value.toUpperCase())} placeholder="Tự động nếu để trống" /></div>
              {type === 'product' ? <div className="goods-field"><label htmlFor="goods-barcode">Mã vạch</label><input id="goods-barcode" value={form.barcode} onChange={(event) => update('barcode', event.target.value)} placeholder="Nhập mã vạch" /></div> : type === 'service' ? <div className="goods-field"><label htmlFor="goods-duration">Thời lượng</label><div className="input-suffix"><input id="goods-duration" type="number" min="1" value={form.durationMinutes} onChange={(event) => update('durationMinutes', event.target.value)} /><span>phút</span></div>{errors.durationMinutes && <small className="field-error">{errors.durationMinutes}</small>}</div> : <div className="goods-field"><label htmlFor="goods-validity">Thời hạn sử dụng</label><div className="input-suffix"><input id="goods-validity" type="number" min="1" value={form.validityDays} onChange={(event) => update('validityDays', event.target.value)} placeholder="Không giới hạn" /><span>ngày</span></div></div>}
              <div className="goods-field"><label htmlFor="goods-category">Nhóm hàng</label><input id="goods-category" value={form.category} onChange={(event) => update('category', event.target.value)} placeholder="Nhập hoặc chọn nhóm hàng" list="goods-categories" /><datalist id="goods-categories">{(catalog.data?.meta.categories ?? []).map((category) => <option key={category} value={category} />)}</datalist></div>
              <div className="goods-field"><label htmlFor="goods-brand">Thương hiệu</label><input id="goods-brand" value={form.brand} onChange={(event) => update('brand', event.target.value)} placeholder="Nhập thương hiệu" /></div>
            </div>
            <label className="goods-active-check"><input type="checkbox" checked={form.active} onChange={(event) => update('active', event.target.checked)} />Cho phép bán</label>

            <section className="goods-form-section"><div className="goods-section-heading"><span><strong>{type === 'account_card' ? 'Giá bán, mệnh giá' : 'Giá bán, giá vốn'}</strong><small>Giá được đồng bộ sang bảng giá chung khi lưu.</small></span><i className="ph ph-caret-up" /></div><div className="goods-form-grid">
              <div className="goods-field"><label htmlFor="goods-sale-price">Giá bán</label><MoneyInput id="goods-sale-price" suffix="đ" value={numeric(form.salePrice)} onChange={(val) => update('salePrice', String(val))} />{errors.salePrice && <small className="field-error">{errors.salePrice}</small>}</div>
              {type === 'account_card' ? <div className="goods-field"><label htmlFor="goods-face-value">Mệnh giá sử dụng</label><MoneyInput id="goods-face-value" suffix="đ" value={numeric(form.faceValue)} onChange={(val) => update('faceValue', String(val))} />{errors.faceValue && <small className="field-error">{errors.faceValue}</small>}</div> : <div className="goods-field"><label htmlFor="goods-cost-price">Giá vốn</label><MoneyInput id="goods-cost-price" suffix="đ" value={numeric(form.costPrice)} onChange={(val) => update('costPrice', String(val))} />{errors.costPrice && <small className="field-error">{errors.costPrice}</small>}</div>}
            </div></section>

            <section className="goods-form-section">
              <div className="goods-section-heading">
                <span>
                  <strong>Hoa hồng</strong>
                  <small>Thiết lập hoa hồng cho nhân viên khi bán {copy.noun}.</small>
                </span>
                <i className="ph ph-caret-up" />
              </div>
              <div className="commission-inline">
                <label className="commission-toggle">
                  <input
                    type="checkbox"
                    checked={commissionType !== null}
                    onChange={(e) => {
                      setCommissionType(e.target.checked ? 'percent' : null);
                      setCommissionRate(0);
                    }}
                  />
                  <span>Cho phép tính hoa hồng</span>
                </label>

                {commissionType !== null && (
                  <>
                    <div className="commission-config-row">
                      <div className="commission-segments" role="radiogroup" aria-label="Loại hoa hồng">
                        <button
                          type="button"
                          className={`commission-segment ${commissionType === 'percent' ? 'is-active' : ''}`}
                          onClick={() => setCommissionType('percent')}
                        >
                          % giá bán
                        </button>
                        <button
                          type="button"
                          className={`commission-segment ${commissionType === 'fixed' ? 'is-active' : ''}`}
                          onClick={() => setCommissionType('fixed')}
                        >
                          Số tiền cố định
                        </button>
                      </div>

                      <div className="commission-rate-row">
                        {commissionType === 'percent' ? (
                          <div className="input-suffix commission-rate-input">
                            <input
                              id="goods-commission-rate"
                              type="text"
                              inputMode="numeric"
                              value={commissionRate}
                              onChange={(event) => setCommissionRate(Number(event.target.value.replace(/\D/g, '')) || 0)}
                              placeholder="0"
                            />
                            <span>%</span>
                          </div>
                        ) : (
                          <MoneyInput
                            id="goods-commission-rate"
                            suffix="đ"
                            value={commissionRate}
                            onChange={(val) => setCommissionRate(val)}
                            placeholder="0"
                            wrapperClassName="input-suffix commission-rate-input"
                          />
                        )}

                        {commissionType === 'percent' && (
                          <div className="commission-preview">
                            ≈ {formatMoney(numeric(form.salePrice) * (commissionRate / 100))} / {copy.noun}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>

            {type === 'product' && <section className="goods-form-section"><div className="goods-section-heading"><span><strong>Tồn kho</strong><small>{isEdit ? 'Điều chỉnh số lượng tồn hiện tại và cảnh báo tồn.' : 'Thiết lập số lượng ban đầu và cảnh báo tồn.'}</small></span><i className="ph ph-caret-up" /></div><div className="goods-form-grid three-columns"><div className="goods-field"><label htmlFor="goods-stock">{isEdit ? 'Tồn hiện tại' : 'Tồn ban đầu'}</label><input id="goods-stock" type="number" min="0" value={form.initialStock} onChange={(event) => update('initialStock', event.target.value)} /></div><div className="goods-field"><label htmlFor="goods-min-stock">Tồn tối thiểu</label><input id="goods-min-stock" type="number" min="0" value={form.minStock} onChange={(event) => update('minStock', event.target.value)} /></div><div className="goods-field"><label htmlFor="goods-max-stock">Tồn tối đa</label><input id="goods-max-stock" type="number" min="1" value={form.maxStock} onChange={(event) => update('maxStock', event.target.value)} placeholder="Không giới hạn" aria-invalid={Boolean(errors.maxStock)} />{errors.maxStock && <small className="field-error">{errors.maxStock}</small>}</div></div><div className="goods-field compact-field"><label htmlFor="goods-unit">Đơn vị tính</label><input id="goods-unit" value={form.unit} onChange={(event) => update('unit', event.target.value)} /></div></section>}

            {type === 'package' && <section className="goods-form-section"><div className="goods-section-heading"><span><strong>Dịch vụ trong gói</strong><small>Gói được liên kết trực tiếp với các dịch vụ đã tạo.</small></span><i className="ph ph-caret-up" /></div>{catalog.isPending ? <div className="goods-inline-state">Đang tải danh sách dịch vụ...</div> : catalog.error ? <div className="goods-inline-state error">{catalog.error.message}</div> : <><div className="goods-link-picker"><Select value={serviceToAdd} onChange={setServiceToAdd} placeholder="Chọn dịch vụ" fullWidth className="goods-service-select" options={[{ value: '', label: 'Chọn dịch vụ' }, ...availableServices.filter((service) => !packageItems.some((item) => item.serviceId === String(service.itemId))).map((service) => ({ value: String(service.itemId), label: `${service.name} (${formatMoney(service.salePrice)})` }))]} /><button className="secondary-button" type="button" onClick={addService} disabled={!serviceToAdd}><i className="ph ph-plus" />Thêm dịch vụ</button></div>{selectedServices.length ? <div className="linked-items-list">{selectedServices.map((item) => <div key={item.serviceId}><span><strong>{item.service?.name ?? `Dịch vụ #${item.serviceId}`}</strong><small>{item.service?.code}</small></span><label>Số buổi<input type="number" min="1" value={item.units} onChange={(event) => setPackageItems((current) => current.map((row) => row.serviceId === item.serviceId ? { ...row, units: Math.max(1, Number(event.target.value) || 1) } : row))} /></label><button type="button" aria-label="Xóa dịch vụ khỏi gói" onClick={() => setPackageItems((current) => current.filter((row) => row.serviceId !== item.serviceId))}><i className="ph ph-trash" /></button></div>)}</div> : <div className="goods-inline-state">Chưa có dịch vụ trong gói. Hãy tạo dịch vụ trước nếu danh sách đang trống.</div>}</>}{errors.packageItems && <small className="field-error section-error">{errors.packageItems}</small>}<div className="goods-field compact-field"><label htmlFor="goods-schedule">Lịch sử dụng</label><Select id="goods-schedule" value={form.usageSchedule} onChange={(val) => update('usageSchedule', val)} fullWidth options={[{ value: 'flexible', label: 'Tự do' }, { value: 'scheduled', label: 'Theo lịch' }]} /></div></section>}

            {type === 'account_card' && <section className="goods-form-section"><div className="goods-section-heading"><span><strong>Phạm vi thanh toán</strong><small>Chọn loại hàng và hàng hóa được phép thanh toán bằng thẻ.</small></span><i className="ph ph-caret-up" /></div><div className="scope-type-options">{[['product', 'Sản phẩm'], ['service', 'Dịch vụ'], ['package', 'Gói dịch vụ, liệu trình']].map(([value, label]) => <label key={value}><input type="checkbox" checked={allowedTypes.includes(value)} onChange={() => toggleAllowedType(value)} />{label}</label>)}</div>{errors.allowedTypes && <small className="field-error section-error">{errors.allowedTypes}</small>}<div className="scope-items"><strong>Giới hạn theo hàng hóa cụ thể</strong><small>Không chọn mục nào nghĩa là áp dụng cho toàn bộ loại hàng đã chọn.</small>{catalog.isPending ? <div className="goods-inline-state">Đang tải hàng hóa...</div> : availableItems.filter((item) => allowedTypes.includes(item.itemType)).length ? <div className="scope-item-grid">{availableItems.filter((item) => allowedTypes.includes(item.itemType)).map((item) => { const key = `${item.itemType}:${item.itemId}`; return <label key={key}><input type="checkbox" checked={scopeItems.includes(key)} onChange={() => setScopeItems((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key])} /><span><strong>{item.name}</strong><small>{item.code}</small></span></label>; })}</div> : <div className="goods-inline-state">Chưa có hàng hóa để giới hạn phạm vi.</div>}</div></section>}
          </> : <div className="goods-details-tab">
            <div className="goods-field"><label htmlFor="goods-image">Đường dẫn hình ảnh</label><input id="goods-image" type="url" value={form.imageUrl} onChange={(event) => update('imageUrl', event.target.value)} placeholder="https://..." /><small className="field-help">Có thể bổ sung dịch vụ lưu trữ ảnh sau. Hiện tại đường dẫn được lưu trực tiếp trong database.</small></div>
            <div className="goods-field"><label htmlFor="goods-description">Mô tả</label><textarea id="goods-description" rows={6} value={form.description} onChange={(event) => update('description', event.target.value)} placeholder={`Mô tả ${copy.noun}`} /></div>
            <div className="goods-field"><label htmlFor="goods-note">Ghi chú nội bộ</label><textarea id="goods-note" rows={4} value={form.note} onChange={(event) => update('note', event.target.value)} placeholder="Thông tin chỉ dùng trong nội bộ" /></div>
          </div>}
        </div>
        <footer className="goods-dialog-footer"><button className="secondary-button" type="button" onClick={onClose} disabled={mutation.isPending}>Bỏ qua</button><button className="primary-button" type="submit" disabled={mutation.isPending || itemQuery.isPending || Boolean(itemQuery.error)}>{mutation.isPending ? 'Đang lưu...' : itemQuery.isPending ? 'Đang tải...' : 'Lưu'}</button></footer>
      </form>
    </section>
  </div>;
}
