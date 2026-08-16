import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { appConfig } from '@/app/config';
import { Link, useNavigate } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/DataState';
import { Select } from '@/components/ui/Select/Select';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { toOptions, useMetadata } from '@/services/metadata';
import { statusLabels, type ApiRecord } from '@/types/api';
import { createPurchaseOrder, getProducts, getSuppliers } from '../inventory.api';

interface DraftItem extends ApiRecord { quantity: number; unitCost: number }

export function PurchaseOrderCreateView() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [otherCost, setOtherCost] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [note, setNote] = useState('');
  const metadata = useMetadata();
  const products = useQuery({ queryKey: ['purchase-catalog'], queryFn: () => getProducts({ type: 'product', status: 'active', page: 1, pageSize: appConfig.purchaseCatalogPageSize }) });
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: getSuppliers });
  const mutation = useMutation({ mutationFn: createPurchaseOrder, onSuccess: (payload) => { notify('Lưu phiếu thành công', `${payload.data.code} đã được lưu.`); navigate('/purchase-orders'); }, onError: (error) => notify('Không thể lưu phiếu', error.message) });
  const results = useMemo(() => !search.trim() ? [] : (products.data?.data ?? []).filter((item) => `${item.code} ${item.name}`.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 8), [products.data, search]);
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const due = Math.max(0, subtotal - discount + otherCost);
  const updateItem = (id: number, patch: Partial<DraftItem>) => setItems((current) => current.map((item) => item.itemId === id ? { ...item, ...patch } : item));
  const addItem = (item: ApiRecord) => { setItems((current) => current.some((row) => row.itemId === item.itemId) ? current : [...current, { ...item, quantity: 1, unitCost: item.lastPurchasePrice || item.costPrice }]); setSearch(''); };
  const save = (status: string) => {
    if (!supplierId) return notify('Thiếu nhà cung cấp', 'Hãy chọn nhà cung cấp trước khi lưu phiếu.');
    if (!items.length) return notify('Phiếu nhập trống', 'Hãy thêm ít nhất một sản phẩm.');
    mutation.mutate({ supplierId: Number(supplierId), status, discount, otherCost, amountPaid, paymentMethod, note, items: items.map((item) => ({ productId: item.itemId, quantity: item.quantity, unitCost: item.unitCost, discount: 0 })) });
  };

  if (products.isPending || suppliers.isPending) return <main className="workspace"><LoadingState /></main>;
  if (products.error || suppliers.error) return <main className="workspace"><ErrorState error={(products.error || suppliers.error)!} onRetry={() => { products.refetch(); suppliers.refetch(); }} /></main>;

  return <main className="workspace"><div className="purchase-create-shell"><section className="purchase-create-main"><div className="purchase-create-heading"><Link className="back-button" to="/purchase-orders" aria-label="Quay lại"><i className="ph ph-arrow-left" /></Link><h1>Nhập hàng</h1><label className="search-control purchase-product-search"><i className="ph ph-magnifying-glass" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm sản phẩm theo mã hoặc tên" /></label></div>{search && <div className="purchase-search-results">{results.length ? results.map((item) => <button type="button" key={item.itemId} onClick={() => addItem(item)}><span><strong>{item.name}</strong><small>{item.code} · Tồn {formatNumber(item.stockQuantity)}</small></span><strong>{formatMoney(item.lastPurchasePrice || item.costPrice)}</strong><i className="ph ph-plus-circle" /></button>) : <p>Không tìm thấy sản phẩm.</p>}</div>}<div className="purchase-items-panel">{items.length ? <div className="table-scroll"><table className="data-table purchase-edit-table"><thead><tr><th>Sản phẩm</th><th>Tồn kho</th><th>Số lượng</th><th>Giá nhập</th><th>Thành tiền</th><th /></tr></thead><tbody>{items.map((item) => <tr key={item.itemId}><td><span className="cell-main">{item.name}</span><small className="cell-sub">{item.code} · {item.unit}</small></td><td className="numeric-cell">{formatNumber(item.stockQuantity)}</td><td><input className="line-input" type="number" min="0.01" step="1" value={item.quantity} onChange={(event) => updateItem(item.itemId, { quantity: Math.max(0.01, Number(event.target.value) || 1) })} /></td><td><input className="line-input money" type="number" min="0" step="1000" value={item.unitCost} onChange={(event) => updateItem(item.itemId, { unitCost: Math.max(0, Number(event.target.value) || 0) })} /></td><td className="money-cell">{formatMoney(item.quantity * item.unitCost)}</td><td><button className="row-action" type="button" aria-label="Xóa" onClick={() => setItems((current) => current.filter((row) => row.itemId !== item.itemId))}><i className="ph ph-trash" /></button></td></tr>)}</tbody></table></div> : <EmptyState message="Tìm và chọn sản phẩm để bắt đầu phiếu nhập." />}</div></section><aside className="purchase-summary-panel"><div className="purchase-meta"><span>Phiếu nhập mới</span><strong>{formatDateTime(new Date())}</strong></div>        <div className="form-field">
          <label>Nhà cung cấp</label>
          <Select
            value={supplierId}
            onChange={setSupplierId}
            placeholder="Chọn nhà cung cấp"
            variant="filter"
            fullWidth
            options={[
              { value: '', label: 'Chọn nhà cung cấp' },
              ...(suppliers.data?.data.map((supplier) => ({
                value: String(supplier.id),
                label: `${supplier.name}${supplier.phone ? ` - ${supplier.phone}` : ''}`,
              })) ?? []),
            ]}
          />
        </div>
        <div className="purchase-totals">
          <div><span>Tổng tiền hàng</span><strong>{formatMoney(subtotal)}</strong></div>
          <label><span>Giảm giá</span><input className="money-input" type="number" min="0" value={discount} onChange={(event) => setDiscount(Number(event.target.value) || 0)} /></label>
          <label><span>Chi phí nhập khác</span><input className="money-input" type="number" min="0" value={otherCost} onChange={(event) => setOtherCost(Number(event.target.value) || 0)} /></label>
          <div className="purchase-due"><span>Cần trả nhà cung cấp</span><strong>{formatMoney(due)}</strong></div>
          <label><span>Tiền trả nhà cung cấp</span><input className="money-input" type="number" min="0" value={amountPaid} onChange={(event) => setAmountPaid(Number(event.target.value) || 0)} /></label>
          <div className="form-field">
            <span className="field-label">Phương thức</span>
            <Select
              value={paymentMethod}
              onChange={setPaymentMethod}
              variant="filter"
              fullWidth
              options={toOptions(metadata.data?.data.filters.purchaseOrders.paymentMethods ?? [], statusLabels)}
            />
          </div>
          <label className="form-field"><span>Ghi chú</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ghi chú cho phiếu nhập" /></label>
        </div><div className="purchase-submit-actions"><button className="secondary-button" type="button" disabled={mutation.isPending} onClick={() => save('draft')}>Lưu tạm</button><button className="primary-button" type="button" disabled={mutation.isPending} onClick={() => save('completed')}>Hoàn thành</button></div></aside></div></main>;
}
