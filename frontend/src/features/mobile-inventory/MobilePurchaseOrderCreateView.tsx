import { usePurchaseOrderForm } from '@/features/inventory/usePurchaseOrderForm';
import { statusLabels } from '@/types/api';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/DataState';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { Select } from '@/components/ui/Select/Select';
import { formatMoney, formatNumber } from '@/lib/format';
import { toOptions } from '@/services/metadata';
import { MobilePageHeader } from '@/components/ui/MobilePageHeader/MobilePageHeader';

export function MobilePurchaseOrderCreateView() {
  const { search, setSearch, items, supplierId, setSupplierId, discount, setDiscount, otherCost, setOtherCost,
    amountPaid, setAmountPaid, paymentMethod, setPaymentMethod, note, setNote,
    products, suppliers, metadata, mutation, subtotal, due, addItem, updateItem, removeItem, save, results,
  } = usePurchaseOrderForm('/m/purchase-orders');

  if (suppliers.isPending || suppliers.error) {
    return (
      <div className="m-page">
        <MobilePageHeader title="Tạo phiếu nhập" backTo="/m/purchase-orders" />
        {suppliers.error
          ? <ErrorState compact error={suppliers.error} onRetry={() => { suppliers.refetch(); }} />
          : <LoadingState compact />}
      </div>
    );
  }

  return (
    <div className="m-page">
      <MobilePageHeader title="Tạo phiếu nhập" backTo="/m/purchase-orders" />
      <div className="m-body">
      <section className="card card-body form-stack" aria-labelledby="mobile-po-products-title">
        <h2 id="mobile-po-products-title" className="card-title">Sản phẩm nhập</h2>
        <label className="input-group">
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
            {products.isFetching ? <p>Đang tìm sản phẩm…</p> : products.error ? <ErrorState error={products.error} onRetry={() => products.refetch()} /> : results.length ? results.map((item) => (
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
                <button type="button" aria-label={`Xóa ${item.name}`} onClick={() => removeItem(item.itemId)}>
                  <i className="ph ph-trash" aria-hidden="true" />
                </button>
              </div>
              <div className="mobile-po-draft-fields">
                <label><span>Số lượng</span><input className="input" type="number" min="0.01" step="any" inputMode="decimal" value={item.quantity} onChange={(event) => updateItem(item.itemId, { quantity: Number(event.target.value) })} /></label>
                <label><span>Giá nhập</span><MoneyInput suffix="đ" value={item.unitCost} onChange={(unitCost) => updateItem(item.itemId, { unitCost })} /></label>
              </div>
              <div className="mobile-po-draft-total"><span>Thành tiền</span><strong>{formatMoney(item.quantity * item.unitCost)}</strong></div>
            </article>
          )) : <EmptyState message="Tìm và chọn sản phẩm để bắt đầu phiếu nhập." />}
        </div>
      </section>

      <section className="card card-body form-stack" aria-labelledby="mobile-po-summary-title">
        <h2 id="mobile-po-summary-title" className="card-title">Thông tin phiếu</h2>
        <label className="field"><span>Nhà cung cấp <span className="field-required">*</span></span><Select aria-label="Nhà cung cấp" value={supplierId} onChange={setSupplierId} placeholder="Chọn nhà cung cấp" fullWidth options={[{ value: '', label: 'Chọn nhà cung cấp' }, ...(suppliers.data?.data.map((supplier) => ({ value: String(supplier.id), label: `${supplier.name}${supplier.phone ? ` - ${supplier.phone}` : ''}` })) ?? [])]} /></label>
        <div className="mobile-po-create-total"><span>Tổng tiền hàng</span><strong>{formatMoney(subtotal)}</strong></div>
        <label className="field"><span>Giảm giá</span><MoneyInput value={discount} onChange={setDiscount} suffix="đ"  /></label>
        <label className="field"><span>Chi phí nhập khác</span><MoneyInput value={otherCost} onChange={setOtherCost} suffix="đ"  /></label>
        <div className="mobile-po-create-total is-due"><span>Cần trả nhà cung cấp</span><strong>{formatMoney(due)}</strong></div>
        <label className="field"><span>Tiền trả nhà cung cấp</span><MoneyInput value={amountPaid} onChange={setAmountPaid} suffix="đ"  /></label>
        <label className="field"><span>Phương thức</span><Select aria-label="Phương thức thanh toán" value={paymentMethod} onChange={setPaymentMethod} fullWidth options={toOptions(metadata.data?.data.filters.purchaseOrders.paymentMethods ?? [], statusLabels)} /></label>
        <label className="field"><span>Ghi chú</span><textarea className="textarea" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ghi chú cho phiếu nhập" /></label>
      </section>

      </div>
      <div className="m-footer">
        <button type="button" className="btn btn-secondary" disabled={mutation.isPending} onClick={() => save('draft')}>Lưu tạm</button>
        <button type="button" className="btn btn-primary" disabled={mutation.isPending} onClick={() => save('completed')}>{mutation.isPending ? 'Đang lưu…' : 'Hoàn thành'}</button>
      </div>
    </div>
  );
}
