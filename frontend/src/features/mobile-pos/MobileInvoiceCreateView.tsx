import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { formatMoney, formatNumber } from '@/lib/format';
import { MoneyInput } from '@/components/forms/MoneyInput';
import {
  checkoutPosInvoice,
  getPosCatalog,
  getPosStaff,
  type PosCheckoutPayload,
  type PosReceiptData,
} from '@/features/pos/pos.api';
import { PosReceiptPrint } from '@/features/pos/components/PosReceiptPrint';
import {
  MobileCustomerSelectSheet,
  type MobileCustomer,
} from '@/features/mobile-common/MobileCustomerSelectSheet';
import {
  MobileServiceItemDetailSheet,
  type ConfiguredServiceItem,
} from '@/features/mobile-common/MobileServiceItemDetailSheet';
import '@/features/mobile-appointments/mobile-appointments.css';
import '@/features/mobile-pos/mobile-pos.css';

type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'wallet';


export function MobileInvoiceCreateView() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notify } = useToast();

  // State
  const [customer, setCustomer] = useState<MobileCustomer | null>(null);
  const [configuredItems, setConfiguredItems] = useState<ConfiguredServiceItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [discountType, setDiscountType] = useState<'vnd' | 'percent'>('vnd');
  const [discountInput, setDiscountInput] = useState<number>(0);
  const [note, setNote] = useState<string>('');

  // Modals & Sub-sheets
  const [isCustomerSheetOpen, setIsCustomerSheetOpen] = useState(false);
  const [isCatalogSheetOpen, setIsCatalogSheetOpen] = useState(false);
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [tempNote, setTempNote] = useState('');
  const [receiptToPrint, setReceiptToPrint] = useState<PosReceiptData | null>(null);

  // Active item in detail sheet
  const [activeEditingItem, setActiveEditingItem] = useState<ConfiguredServiceItem | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Catalog search & tab filters
  const [catalogSearch, setCatalogSearch] = useState('');
  const [activeCatalogTab, setActiveCatalogTab] = useState<string>('');

  // Fetch Catalog & Staff queries
  const { data: catalogResponse } = useQuery({
    queryKey: ['pos-catalog', catalogSearch, activeCatalogTab],
    queryFn: () => getPosCatalog(catalogSearch, activeCatalogTab),
  });

  const { data: staffResponse } = useQuery({
    queryKey: ['pos-staff'],
    queryFn: getPosStaff,
  });

  const catalogItems = useMemo(() => {
    return (catalogResponse?.data || []) as unknown as Array<{
      itemId: number;
      itemType: 'product' | 'service' | 'package' | 'account_card';
      code: string;
      name: string;
      category: string;
      unit: string;
      salePrice: number;
      stockQuantity: number | null;
    }>;
  }, [catalogResponse]);

  const staffList = useMemo(() => {
    return (staffResponse?.data || []) as unknown as Array<{
      id: number;
      name: string;
      role: string;
      avatarTone?: string;
    }>;
  }, [staffResponse]);

  // Subtotal & Total calculations
  const subtotal = useMemo(() => {
    return configuredItems.reduce(
      (sum, item) => sum + (item.unitPrice || 0) * (item.quantity || 1),
      0
    );
  }, [configuredItems]);

  const discountAmount = useMemo(() => {
    if (discountType === 'percent') {
      const pct = Math.min(100, Math.max(0, discountInput));
      return Math.round((subtotal * pct) / 100);
    }
    return Math.min(subtotal, Math.max(0, discountInput));
  }, [subtotal, discountType, discountInput]);

  const totalPayment = useMemo(() => {
    return Math.max(0, subtotal - discountAmount);
  }, [subtotal, discountAmount]);

  // Checkout Mutation
  const checkoutMutation = useMutation({
    mutationFn: (payload: PosCheckoutPayload) => checkoutPosInvoice(payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['pos-catalog'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setReceiptToPrint(res.data);
      notify('Tạo hóa đơn thành công', `Hóa đơn ${res.data.code} đã hoàn tất.`);
    },
    onError: (err: any) => {
      notify('Lỗi thanh toán hóa đơn', err?.message || 'Không thể tạo hóa đơn. Vui lòng thử lại.');
    },
  });

  // Handle open catalog to add service / product
  const handleOpenCatalog = () => {
    setIsCatalogSheetOpen(true);
  };

  // When catalog item is tapped, prepare configured item and open detail sheet immediately
  const handleSelectCatalogItem = (catItem: (typeof catalogItems)[0]) => {
    const newItem: ConfiguredServiceItem = {
      itemId: catItem.itemId,
      itemType: catItem.itemType,
      name: catItem.name,
      unitPrice: catItem.salePrice,
      quantity: 1,
      durationMinutes: 60,
      startsAt: new Date(),
      staffId: null,
      staffName: null,
      position: null,
    };
    setActiveEditingItem(newItem);
    setEditingIndex(null); // Adding new
    setIsCatalogSheetOpen(false);
    setIsDetailSheetOpen(true);
  };

  // When tapping an already added item in the list
  const handleEditItem = (item: ConfiguredServiceItem, index: number) => {
    setActiveEditingItem(item);
    setEditingIndex(index);
    setIsDetailSheetOpen(true);
  };

  // Saving item from detail sheet
  const handleSaveConfiguredItem = (savedItem: ConfiguredServiceItem) => {
    if (editingIndex !== null && editingIndex >= 0) {
      setConfiguredItems((prev) =>
        prev.map((item, idx) => (idx === editingIndex ? savedItem : item))
      );
    } else {
      setConfiguredItems((prev) => [...prev, savedItem]);
    }
  };

  // Remove item
  const handleRemoveItem = (index: number) => {
    setConfiguredItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Handle Clear Form
  const handleClearAll = () => {
    setCustomer(null);
    setConfiguredItems([]);
    setDiscountInput(0);
    setPaymentMethod('cash');
    setNote('');
  };

  // Submit Checkout
  const handleCheckout = () => {
    if (configuredItems.length === 0) {
      notify('Chưa có dịch vụ, sản phẩm', 'Vui lòng thêm ít nhất một món vào hóa đơn.');
      return;
    }

    const payload: PosCheckoutPayload = {
      customerId: customer?.id ?? null,
      staffId: configuredItems[0]?.staffId || null,
      discount: discountAmount,
      paymentMethod,
      amountPaid: totalPayment,
      note: note.trim() || undefined,
      lines: configuredItems.map((item) => ({
        itemType: item.itemType,
        itemId: item.itemId,
        quantity: item.quantity || 1,
        staffId: item.staffId || null,
      })),
    };

    checkoutMutation.mutate(payload);
  };

  return (
    <div className="mobile-form-view-container">
      {/* Top Header */}
      <header className="mobile-form-header">
        <div className="mobile-form-header-left">
          <button
            type="button"
            className="mobile-form-back-btn"
            onClick={() => navigate(-1)}
            aria-label="Quay lại"
          >
            <i className="ph ph-caret-left" />
          </button>
          <h1 className="mobile-form-header-title">Tạo hóa đơn</h1>
        </div>

        <div className="mobile-form-header-actions">
          {configuredItems.length > 0 && (
            <button
              type="button"
              className="mobile-form-icon-btn"
              onClick={handleClearAll}
              aria-label="Làm mới"
              title="Làm mới giỏ"
            >
              <i className="ph ph-trash" />
            </button>
          )}

          <button
            type="button"
            className={`mobile-form-icon-btn ${note ? 'has-note' : ''}`}
            onClick={() => {
              setTempNote(note);
              setIsNoteDialogOpen(true);
            }}
            aria-label="Ghi chú hóa đơn"
            title="Ghi chú"
          >
            <i className="ph ph-note" />
          </button>
        </div>
      </header>

      {/* Main Body Form Cards */}
      <div className="mobile-form-body">
        {/* Card 1: Customer Selection */}
        <section className="mobile-form-card">
          <div
            className="mobile-form-row"
            onClick={() => setIsCustomerSheetOpen(true)}
            role="button"
            tabIndex={0}
          >
            <div className="mobile-form-row-left">
              <div className="mobile-form-row-icon is-customer">
                <i className="ph ph-user" />
              </div>
              <div className="mobile-form-row-info">
                {customer ? (
                  <>
                    <span className="mobile-form-row-title">{customer.name}</span>
                    <span className="mobile-form-row-subtitle">
                      {customer.phone || 'Chưa lưu số điện thoại'}
                      {customer.remainingPackageUnits !== undefined &&
                        customer.remainingPackageUnits > 0 && (
                          <span> • Còn {customer.remainingPackageUnits} buổi DV</span>
                        )}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="mobile-form-row-title">Khách lẻ / Vãng lai</span>
                    <span className="mobile-form-row-subtitle">
                      Chạm để tìm hoặc thêm khách hàng
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="mobile-form-row-right">
              {customer ? (
                <button
                  type="button"
                  className="mobile-form-row-clear"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCustomer(null);
                  }}
                  aria-label="Xóa khách hàng"
                >
                  <i className="ph ph-x" />
                </button>
              ) : (
                <i className="ph ph-caret-right" />
              )}
            </div>
          </div>
        </section>

        {/* Card 2: Services & Products List */}
        <section className="mobile-form-card mobile-form-items-card">
          {configuredItems.length === 0 ? (
            /* Empty State */
            <div className="mobile-form-empty-items">
              <div className="mobile-form-empty-icon">
                <i className="ph ph-shopping-bag" />
              </div>
              <div className="mobile-form-empty-text">
                Chưa có dịch vụ, sản phẩm trong hóa đơn
              </div>
              <button
                type="button"
                className="mobile-form-add-btn"
                onClick={handleOpenCatalog}
              >
                <i className="ph ph-plus-circle" />
                <span>Thêm dịch vụ, sản phẩm</span>
              </button>
            </div>
          ) : (
            /* Non-Empty State */
            <div>
              <div className="mobile-form-items-list">
                {configuredItems.map((item, idx) => (
                  <div
                    key={`${item.itemId}-${idx}`}
                    className="mobile-form-item-card"
                    onClick={() => handleEditItem(item, idx)}
                  >
                    <div className="mobile-form-item-main">
                      <div className="mobile-form-item-left">
                        <div className="mobile-form-item-icon">
                          <i
                            className={
                              item.itemType === 'service'
                                ? 'ph ph-sparkle'
                                : item.itemType === 'package'
                                ? 'ph ph-gift'
                                : item.itemType === 'account_card'
                                ? 'ph ph-credit-card'
                                : 'ph ph-package'
                            }
                          />
                        </div>
                        <div>
                          <div className="mobile-form-item-name">
                            {item.quantity > 1 ? `${item.quantity}x ` : ''}
                            {item.name}
                          </div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>
                            {formatMoney(item.unitPrice)} / cái, lần
                          </div>
                        </div>
                      </div>
                      <div className="mobile-form-item-price">
                        {formatNumber((item.unitPrice || 0) * item.quantity)}
                      </div>
                    </div>

                    {/* Assigned tags */}
                    <div className="mobile-form-item-tags">
                      {item.staffName ? (
                        <span className="mobile-form-tag is-staff">
                          <i className="ph ph-user-check" />
                          {item.staffName}
                        </span>
                      ) : (
                        <span className="mobile-form-tag">
                          <i className="ph ph-user" />
                          Chưa chọn nhân viên
                        </span>
                      )}

                      {item.position && (
                        <span className="mobile-form-tag is-pos">
                          <i className="ph ph-map-pin" />
                          {item.position}
                        </span>
                      )}

                      <button
                        type="button"
                        className="mobile-form-item-remove-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveItem(idx);
                        }}
                        aria-label="Xóa mặt hàng"
                      >
                        <i className="ph ph-trash" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="mobile-form-add-btn"
                onClick={handleOpenCatalog}
              >
                <i className="ph ph-plus" />
                <span>Thêm dịch vụ, sản phẩm</span>
              </button>
            </div>
          )}
        </section>

        {/* Card 3: Payment Method & Discount */}
        <section className="mobile-form-card" style={{ padding: 14 }}>
          {/* Payment Method Pills */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-700)' }}>
              Phương thức thanh toán
            </span>
            <div className="mobile-payment-methods">
              <button
                type="button"
                className={`mobile-pay-method-btn ${paymentMethod === 'cash' ? 'is-active' : ''}`}
                onClick={() => setPaymentMethod('cash')}
              >
                <i className="ph ph-money" />
                <span>Tiền mặt</span>
              </button>
              <button
                type="button"
                className={`mobile-pay-method-btn ${paymentMethod === 'bank_transfer' ? 'is-active' : ''}`}
                onClick={() => setPaymentMethod('bank_transfer')}
              >
                <i className="ph ph-qr-code" />
                <span>VietQR / CK</span>
              </button>
              <button
                type="button"
                className={`mobile-pay-method-btn ${paymentMethod === 'card' ? 'is-active' : ''}`}
                onClick={() => setPaymentMethod('card')}
              >
                <i className="ph ph-credit-card" />
                <span>Quẹt thẻ</span>
              </button>
              <button
                type="button"
                className={`mobile-pay-method-btn ${paymentMethod === 'wallet' ? 'is-active' : ''}`}
                onClick={() => setPaymentMethod('wallet')}
              >
                <i className="ph ph-wallet" />
                <span>Thẻ tài khoản</span>
              </button>
            </div>
          </div>

          {/* Discount Field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-700)' }}>
                Chiết khấu / Giảm giá
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  style={{
                    padding: '2px 8px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    border: '1px solid #cbd5e1',
                    background: discountType === 'vnd' ? '#2563eb' : '#ffffff',
                    color: discountType === 'vnd' ? '#ffffff' : '#475569',
                    cursor: 'pointer',
                  }}
                  onClick={() => setDiscountType('vnd')}
                >
                  VNĐ
                </button>
                <button
                  type="button"
                  style={{
                    padding: '2px 8px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    border: '1px solid #cbd5e1',
                    background: discountType === 'percent' ? '#2563eb' : '#ffffff',
                    color: discountType === 'percent' ? '#ffffff' : '#475569',
                    cursor: 'pointer',
                  }}
                  onClick={() => setDiscountType('percent')}
                >
                  %
                </button>
              </div>
            </div>

            {discountType === 'vnd' ? (
              <MoneyInput
                placeholder="0"
                value={discountInput}
                onChange={(val) => setDiscountInput(val)}
                suffix="đ"
                style={{
                  width: '100%',
                  height: 40,
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  padding: '0 12px',
                  fontSize: 14,
                  fontWeight: 600,
                  background: '#ffffff',
                  boxSizing: 'border-box',
                }}
              />
            ) : (
              <input
                type="number"
                min="0"
                max="100"
                placeholder="0"
                value={discountInput || ''}
                onChange={(e) => setDiscountInput(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                style={{
                  width: '100%',
                  height: 40,
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  padding: '0 12px',
                  fontSize: 14,
                  fontWeight: 600,
                  background: '#ffffff',
                  boxSizing: 'border-box',
                }}
              />
            )}
          </div>

          {/* Summary Box */}
          <div className="mobile-checkout-summary">
            <div className="mobile-summary-row">
              <span style={{ color: '#64748b' }}>Tổng tiền hàng:</span>
              <span style={{ fontWeight: 600 }}>{formatMoney(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="mobile-summary-row" style={{ color: '#dc2626' }}>
                <span>Giảm giá:</span>
                <span>-{formatMoney(discountAmount)}</span>
              </div>
            )}
            <div className="mobile-summary-row total-row">
              <span>Tổng thanh toán:</span>
              <span style={{ color: '#1d4ed8', fontSize: 16 }}>{formatMoney(totalPayment)}</span>
            </div>
          </div>
        </section>
      </div>

      {/* Fixed Bottom Checkout Button */}
      <footer className="mobile-form-footer">
        <button
          type="button"
          className="mobile-form-submit-btn"
          onClick={handleCheckout}
          disabled={checkoutMutation.isPending || configuredItems.length === 0}
          style={{
            background: '#2563eb',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
          }}
        >
          {checkoutMutation.isPending ? (
            <>
              <i className="ph ph-spinner spin" />
              <span>Đang thanh toán...</span>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <i className="ph ph-check-circle" style={{ fontSize: 18 }} />
              <span>Thanh toán & In hóa đơn ({formatMoney(totalPayment)})</span>
            </div>
          )}
        </button>
      </footer>

      {/* Customer Select Sheet */}
      <MobileCustomerSelectSheet
        isOpen={isCustomerSheetOpen}
        selectedCustomerId={customer?.id}
        onClose={() => setIsCustomerSheetOpen(false)}
        onSelectCustomer={(c) => {
          setCustomer(c);
          setIsCustomerSheetOpen(false);
        }}
      />

      {/* Catalog Sheet */}
      {isCatalogSheetOpen && (
        <div
          className="mobile-catalog-sheet-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCatalogSheetOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Chọn dịch vụ, sản phẩm"
        >
          <div className="mobile-catalog-sheet">
            <header className="mobile-catalog-sheet-header">
              <h3>Chọn dịch vụ, sản phẩm</h3>
              <button
                type="button"
                className="mobile-appointment-back-btn"
                onClick={() => setIsCatalogSheetOpen(false)}
                aria-label="Đóng"
              >
                <i className="ph ph-x" />
              </button>
            </header>

            {/* Filter Tabs in Catalog */}
            <div
              style={{
                display: 'flex',
                gap: 6,
                padding: '8px 16px',
                background: '#f8fafc',
                overflowX: 'auto',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              {[
                { value: '', label: 'Tất cả' },
                { value: 'service', label: 'Dịch vụ' },
                { value: 'package', label: 'Gói DV' },
                { value: 'account_card', label: 'Thẻ TK' },
                { value: 'product', label: 'Sản phẩm' },
              ].map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  style={{
                    padding: '4px 12px',
                    borderRadius: 14,
                    fontSize: 12.5,
                    fontWeight: 600,
                    border: '1px solid',
                    borderColor: activeCatalogTab === tab.value ? '#2563eb' : '#cbd5e1',
                    background: activeCatalogTab === tab.value ? '#eff6ff' : '#ffffff',
                    color: activeCatalogTab === tab.value ? '#1d4ed8' : '#475569',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                  }}
                  onClick={() => setActiveCatalogTab(tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="mobile-catalog-sheet-search">
              <i className="ph ph-magnifying-glass" />
              <input
                type="text"
                placeholder="Tìm tên dịch vụ, sản phẩm..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                autoFocus
              />
            </div>

            <div className="mobile-catalog-items-list">
              {catalogItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
                  Không tìm thấy mặt hàng nào
                </div>
              ) : (
                catalogItems.map((cat) => (
                  <div
                    key={`${cat.itemType}-${cat.itemId}`}
                    className="mobile-catalog-item-row"
                    onClick={() => handleSelectCatalogItem(cat)}
                  >
                    <div className="mobile-catalog-item-info">
                      <span className="mobile-catalog-item-name">{cat.name}</span>
                      <span className="mobile-catalog-item-cat">
                        {cat.category || 'Dịch vụ'} {cat.code ? `• ${cat.code}` : ''}
                      </span>
                    </div>
                    <span className="mobile-catalog-item-price">
                      {formatNumber(cat.salePrice)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Service Item Detail Sheet */}
      <MobileServiceItemDetailSheet
        isOpen={isDetailSheetOpen}
        item={activeEditingItem}
        staffList={staffList}
        onClose={() => {
          setIsDetailSheetOpen(false);
          setActiveEditingItem(null);
          setEditingIndex(null);
        }}
        onSaveItem={handleSaveConfiguredItem}
      />

      {/* Note Dialog */}
      {isNoteDialogOpen && (
        <div
          className="mobile-note-dialog-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsNoteDialogOpen(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="mobile-note-dialog">
            <div className="mobile-note-dialog-header">
              <h3>Ghi chú hóa đơn</h3>
              <button
                type="button"
                className="mobile-appointment-back-btn"
                onClick={() => setIsNoteDialogOpen(false)}
              >
                <i className="ph ph-x" />
              </button>
            </div>
            <div className="mobile-note-dialog-body">
              <textarea
                placeholder="Nhập ghi chú cho hóa đơn..."
                value={tempNote}
                onChange={(e) => setTempNote(e.target.value)}
                autoFocus
              />
            </div>
            <div className="mobile-note-dialog-footer">
              <button
                type="button"
                className="mobile-note-cancel-btn"
                onClick={() => setIsNoteDialogOpen(false)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="mobile-note-save-btn"
                onClick={() => {
                  setNote(tempNote);
                  setIsNoteDialogOpen(false);
                }}
              >
                Lưu ghi chú
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Receipt Modal on Success */}
      {receiptToPrint && (
        <PosReceiptPrint
          receipt={receiptToPrint}
          onClose={() => {
            setReceiptToPrint(null);
            navigate(-1);
          }}
        />
      )}
    </div>
  );
}
