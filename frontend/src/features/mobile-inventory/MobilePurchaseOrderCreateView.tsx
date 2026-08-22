import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { appConfig } from '@/app/config';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/DataState';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { Select } from '@/components/ui/Select/Select';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { formatMoney, formatNumber } from '@/lib/format';
import { toOptions, useMetadata } from '@/services/metadata';
import { statusLabels, type ApiRecord } from '@/types/api';
import { createPurchaseOrder, getProducts, getSuppliers } from '@/features/inventory/inventory.api';
import './mobile-inventory.css';

interface DraftItem extends ApiRecord {
  quantity: number;
  unitCost: number;
}

export function MobilePurchaseOrderCreateView() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const metadata = useMetadata();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [otherCost, setOtherCost] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [note, setNote] = useState('');

  const products = useQuery({
    queryKey: ['purchase-catalog'],
    queryFn: () => getProducts({ type: 'product', status: 'active', page: 1, pageSize: appConfig.purchaseCatalogPageSize }),
  });
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: getSuppliers });
  const mutation = useMutation({
    mutationFn: createPurchaseOrder,
    onSuccess: (payload) => {
      notify('Lưu phiếu thành công', `${payload.data.code} đã được lưu.`);
      navigate('/m/purchase-orders');
    },
    onError: (error) => notify('Không thể lưu phiếu', error.message),
  });

  const results = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return [];
    return (products.data?.data ?? [])
      .filter((item) => `${item.code} ${item.name}`.toLowerCase().includes(keyword))
      .slice(0, 8);
  }, [products.data, search]);

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const due = Math.max(0, subtotal - discount + otherCost);

  const addItem = (item: ApiRecord) => {
    setItems((current) => current.some((row) => row.itemId === item.itemId)
      ? current
      : [...current, { ...item, quantity: 1, unitCost: item.lastPurchasePrice || item.costPrice }]);
    setSearch('');
  };

  const updateItem = (id: number, patch: Partial<DraftItem>) => {
    setItems((current) => current.map((item) => item.itemId === id ? { ...item, ...patch } : item));
  };

  const save = (status: string) => {
    if (!supplierId) return notify('Thiếu nhà cung cấp', 'Hãy chọn nhà cung cấp trước khi lưu phiếu.');
    if (!items.length) return notify('Phiếu nhập trống', 'Hãy thêm ít nhất một sản phẩm.');
    mutation.mutate({
      supplierId: Number(supplierId),
      status,
      discount,
      otherCost,
      amountPaid,
      paymentMethod,
      note,
      items: items.map((item) => ({
        productId: item.itemId,
        quantity: item.quantity,
        unitCost: item.unitCost,
        discount: 0,
      })),
    });
  };

  if (products.isPending || suppliers.isPending) return <LoadingState />;
  if (products.error || suppliers.error) {
    return <ErrorState error={(products.error || suppliers.error)!} onRetry={() => { products.refetch(); suppliers.refetch(); }} />;
  }

  return (
    <main className="mobile-po-create-page">
      <section className="mobile-po-create-section" aria-labelledby="mobile-po-products-title">
        <h1 id="mobile-po-products-title" className="mobile-po-create-title">Sản phẩm nhập</h1>
        <label className="mobile-po-create-search">
          <i className="ph ph-magnifying-glass" aria-hidden="true" />
          <span className="sr-only">Tìm sản phẩm để nhập</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo mã hoặc tên sản phẩm"
          />
        </label>

        {search && (
          <div className="mobile-po-search-results" aria-live="polite">
            {results.length ? results.map((item) => (
              <button type="button" key={item.itemId} onClick={() => addItem(item)}>
                <span><strong>{item.name}</strong><small>{item.code} · Tồn {formatNumber(item.stockQuantity)}</small></span>
                <span><strong>{formatMoney(item.lastPurchasePrice || item.costPrice)}</strong><i className="ph ph-plus-circle" aria-hidden="true" /></span>
              </button>
            )) : <p>Không tìm thấy sản phẩm.</p>}
          </div>
        )}

        <div className="mobile-po-draft-list">
          {items.length ? items.map((item) => (
            <article className="mobile-po-draft-card" key={item.itemId}>
              <div className="mobile-po-draft-heading">
                <div><strong>{item.name}</strong><small>{item.code} · Tồn {formatNumber(item.stockQuantity)}</small></div>
                <button type="button" aria-label={`Xóa ${item.name}`} onClick={() => setItems((current) => current.filter((row) => row.itemId !== item.itemId))}>
                  <i className="ph ph-trash" aria-hidden="true" />
                </button>
              </div>
              <div className="mobile-po-draft-fields">
                <label><span>Số lượng</span><input type="number" min="0.01" step="1" value={item.quantity} onChange={(event) => updateItem(item.itemId, { quantity: Math.max(0.01, Number(event.target.value) || 1) })} /></label>
                <label><span>Giá nhập</span><MoneyInput value={item.unitCost} onChange={(unitCost) => updateItem(item.itemId, { unitCost })} /></label>
              </div>
              <div className="mobile-po-draft-total"><span>Thành tiền</span><strong>{formatMoney(item.quantity * item.unitCost)}</strong></div>
            </article>
          )) : <EmptyState message="Tìm và chọn sản phẩm để bắt đầu phiếu nhập." />}
        </div>
      </section>

      <section className="mobile-po-create-section" aria-labelledby="mobile-po-summary-title">
        <h2 id="mobile-po-summary-title" className="mobile-po-create-title">Thông tin phiếu</h2>
        <label className="mobile-po-field"><span>Nhà cung cấp <em>*</em></span><Select aria-label="Nhà cung cấp" value={supplierId} onChange={setSupplierId} placeholder="Chọn nhà cung cấp" fullWidth options={[{ value: '', label: 'Chọn nhà cung cấp' }, ...(suppliers.data?.data.map((supplier) => ({ value: String(supplier.id), label: `${supplier.name}${supplier.phone ? ` - ${supplier.phone}` : ''}` })) ?? [])]} /></label>
        <div className="mobile-po-create-total"><span>Tổng tiền hàng</span><strong>{formatMoney(subtotal)}</strong></div>
        <label className="mobile-po-field"><span>Giảm giá</span><MoneyInput value={discount} onChange={setDiscount} suffix="đ" /></label>
        <label className="mobile-po-field"><span>Chi phí nhập khác</span><MoneyInput value={otherCost} onChange={setOtherCost} suffix="đ" /></label>
        <div className="mobile-po-create-total is-due"><span>Cần trả nhà cung cấp</span><strong>{formatMoney(due)}</strong></div>
        <label className="mobile-po-field"><span>Tiền trả nhà cung cấp</span><MoneyInput value={amountPaid} onChange={setAmountPaid} suffix="đ" /></label>
        <label className="mobile-po-field"><span>Phương thức</span><Select aria-label="Phương thức thanh toán" value={paymentMethod} onChange={setPaymentMethod} fullWidth options={toOptions(metadata.data?.data.filters.purchaseOrders.paymentMethods ?? [], statusLabels)} /></label>
        <label className="mobile-po-field"><span>Ghi chú</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ghi chú cho phiếu nhập" /></label>
      </section>

      <div className="mobile-po-create-actions">
        <button type="button" className="secondary-button" disabled={mutation.isPending} onClick={() => save('draft')}>Lưu tạm</button>
        <button type="button" className="primary-button" disabled={mutation.isPending} onClick={() => save('completed')}>{mutation.isPending ? 'Đang lưu…' : 'Hoàn thành'}</button>
      </div>
    </main>
  );
}
