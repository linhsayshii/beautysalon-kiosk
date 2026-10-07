import { PageHeader } from '@/components/ui/PageHeader/PageHeader';
import { usePurchaseOrderForm } from '@/features/inventory/usePurchaseOrderForm';
import { statusLabels } from '@/types/api';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/DataState';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { Select } from '@/components/ui/Select/Select';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { toOptions } from '@/services/metadata';

export function PurchaseOrderCreateView() {
  const { search, setSearch, items, supplierId, setSupplierId, discount, setDiscount, otherCost, setOtherCost,
    amountPaid, setAmountPaid, paymentMethod, setPaymentMethod, note, setNote,
    products, suppliers, metadata, mutation, subtotal, due, addItem, updateItem, removeItem, save, results,
  } = usePurchaseOrderForm('/purchase-orders');

  if (suppliers.isPending) return <main className="page"><LoadingState /></main>;
  if (suppliers.error) return <main className="page"><ErrorState error={suppliers.error} onRetry={() => { suppliers.refetch(); }} /></main>;

  return <main className="page"><div className="page-stack"><PageHeader title="Tạo phiếu nhập" subtitle="Chọn sản phẩm, kiểm tra giá nhập và ghi nhận tiền trả nhà cung cấp." backTo="/purchase-orders" /><div className="purchase-create-shell"><section className="purchase-create-main"><div className="purchase-create-heading"><div className="purchase-product-search-wrap"><label className="search-control purchase-product-search"><i className="ph ph-magnifying-glass" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm sản phẩm theo mã hoặc tên" /></label>{search && <div className="purchase-search-results">{products.isFetching ? <p>Đang tìm sản phẩm…</p> : products.error ? <ErrorState error={products.error} onRetry={() => products.refetch()} /> : results.length ? results.map((item) => <button type="button" key={item.itemId} onClick={() => addItem(item)}><span><strong>{item.name}</strong><small>{item.code} · Tồn {formatNumber(item.stockQuantity)}</small></span><strong>{formatMoney(item.lastPurchasePrice ?? item.costPrice)}</strong><i className="ph ph-plus-circle" /></button>) : <p>Không tìm thấy sản phẩm.</p>}</div>}</div></div><div className="purchase-items-panel">{items.length ? <div className="table-scroll"><table className="data-table purchase-edit-table"><thead><tr><th>Sản phẩm</th><th>Tồn kho</th><th>Số lượng</th><th>Giá nhập</th><th>Thành tiền</th><th /></tr></thead><tbody>{items.map((item) => <tr key={item.itemId}><td><span className="cell-main">{item.name}</span><small className="cell-sub">{item.code} · {item.unit}</small></td><td className="numeric-cell">{formatNumber(item.stockQuantity)}</td><td><input className="line-input" type="number" min="0.01" step="any" inputMode="decimal" value={item.quantity} onChange={(event) => updateItem(item.itemId, { quantity: Number(event.target.value) })} /></td><td><MoneyInput className="line-input money" value={item.unitCost} onChange={(unitCost) => updateItem(item.itemId, { unitCost })} /></td><td className="money-cell">{formatMoney(item.quantity * item.unitCost)}</td><td><button className="row-action" type="button" aria-label="Xóa" onClick={() => removeItem(item.itemId)}><i className="ph ph-trash" /></button></td></tr>)}</tbody></table></div> : <EmptyState message="Tìm và chọn sản phẩm để bắt đầu phiếu nhập." />}</div></section><aside className="purchase-summary-panel"><div className="purchase-meta"><span>Phiếu nhập mới</span><strong>{formatDateTime(new Date())}</strong></div>        <div className="field">
          <label>Nhà cung cấp</label>
          <Select
            value={supplierId}
            onChange={setSupplierId}
            placeholder="Chọn nhà cung cấp"
            variant="filter"
            fullWidth
            align="right"
            menuClassName="purchase-supplier-select-menu"
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
          <label><span>Giảm giá</span><MoneyInput className="money-input" value={discount} onChange={setDiscount} /></label>
          <label><span>Chi phí nhập khác</span><MoneyInput className="money-input" value={otherCost} onChange={setOtherCost} /></label>
          <div className="purchase-due"><span>Cần trả nhà cung cấp</span><strong>{formatMoney(due)}</strong></div>
          <label><span>Tiền trả nhà cung cấp</span><MoneyInput className="money-input" value={amountPaid} onChange={setAmountPaid} /></label>
          <div className="field">
            <span className="field-label">Phương thức</span>
            <Select
              value={paymentMethod}
              onChange={setPaymentMethod}
              variant="filter"
              fullWidth
              options={toOptions(metadata.data?.data.filters.purchaseOrders.paymentMethods ?? [], statusLabels)}
            />
          </div>
          <label className="field"><span>Ghi chú</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ghi chú cho phiếu nhập" /></label>
        </div><div className="purchase-submit-actions"><button className="btn btn-secondary" type="button" disabled={mutation.isPending} onClick={() => save('draft')}>Lưu tạm</button><button className="btn btn-primary" type="button" disabled={mutation.isPending} onClick={() => save('completed')}>Hoàn thành</button></div></aside></div></div></main>;
}
