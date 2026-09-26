import { resynchronizeRealtimeQueries } from '@/context/RealtimeQuerySynchronizer';
import { PartialPaymentFields } from '@/features/debts/PartialPaymentFields';
import { CustomerDebtPanel } from '@/features/debts/CustomerDebtPanel';
import { usePaymentRequestKey } from '@/features/debts/debts.api';
import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { formatMoney, formatNumber } from '@/lib/format';
import { MoneyInput } from '@/components/forms/MoneyInput';
import {
  checkoutPosInvoice,
  getPosCatalog,
  getPosCustomerServicePackages,
  getPosPriceQuote,
  getPosStaff,
  type PosCheckoutPayload,
  type PosReceiptData,
  type ServicePackageOption,
} from '@/features/pos/pos.api';
import { PosReceiptPrint } from '@/features/pos/components/PosReceiptPrint';
import { UsePackageModal } from '@/features/pos/components/UsePackageModal';
import {
  MobileCustomerSelectSheet,
  type MobileCustomer,
} from '@/features/mobile-common/MobileCustomerSelectSheet';
import {
  MobileServiceItemDetailSheet,
  type ConfiguredServiceItem,
} from '@/features/mobile-common/MobileServiceItemDetailSheet';
import { MobileHeaderAction, MobilePageHeader } from '@/components/ui/MobilePageHeader/MobilePageHeader';
import { BottomSheet } from '@/components/ui/Sheet/BottomSheet';
import { EmptyState } from '@/components/data-display/DataState';

type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'wallet';


export function MobileInvoiceCreateView() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notify } = useToast();

  // State
  const [customer, setCustomer] = useState<MobileCustomer | null>(null);
  const [configuredItems, setConfiguredItems] = useState<ConfiguredServiceItem[]>([]);
  const [amountInput, setAmountInput] = useState<number | null>(null);
  const [allowDebt, setAllowDebt] = useState(false);
  const [showDebt, setShowDebt] = useState(false);
  const requestKey = usePaymentRequestKey();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [discountType, setDiscountType] = useState<'vnd' | 'percent'>('vnd');
  const [discountInput, setDiscountInput] = useState<number>(0);
  const [note, setNote] = useState<string>('');

  // Modals & Sub-sheets
  const [isCustomerSheetOpen, setIsCustomerSheetOpen] = useState(false);
  const [isCatalogSheetOpen, setIsCatalogSheetOpen] = useState(false);
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [packagePromptCustomerId, setPackagePromptCustomerId] = useState<number | null>(null);
  const [tempNote, setTempNote] = useState('');
  const catalogSearchRef = useRef<HTMLInputElement>(null);
  const [receiptToPrint, setReceiptToPrint] = useState<PosReceiptData | null>(null);

  // Active item in detail sheet
  const [activeEditingItem, setActiveEditingItem] = useState<ConfiguredServiceItem | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Catalog search & tab filters
  const [catalogSearch, setCatalogSearch] = useState('');
  const [activeCatalogTab, setActiveCatalogTab] = useState<string>('');

  // Fetch Catalog & Staff queries
  const { data: catalogResponse } = useQuery({
    queryKey: ['pos-catalog', catalogSearch, activeCatalogTab, customer?.id ?? null],
    queryFn: () => getPosCatalog(catalogSearch, activeCatalogTab, customer?.id),
  });

  const servicePackagesQuery = useQuery({
    queryKey: ['pos-customer-service-packages', customer?.id ?? null],
    queryFn: () => getPosCustomerServicePackages(customer!.id),
    enabled: Boolean(customer?.id),
  });
  const servicePackages = (servicePackagesQuery.data?.data || []) as ServicePackageOption[];

  useEffect(() => {
    if (!customer?.id || servicePackagesQuery.isPending || packagePromptCustomerId === customer.id) return;

    setPackagePromptCustomerId(customer.id);
    if (servicePackages.length > 0) setIsPackageModalOpen(true);
  }, [customer?.id, packagePromptCustomerId, servicePackages, servicePackagesQuery.isPending]);

  useEffect(() => {
    if (!configuredItems.length) return;
    let cancelled = false;
    getPosPriceQuote(customer?.id, configuredItems)
      .then((response) => {
        if (cancelled) return;
        const prices = new Map(response.data.map((item) => [`${item.itemType}:${item.itemId}`, item.salePrice]));
        setConfiguredItems((items) => items.map((item) => ({
          ...item,
          unitPrice: item.usePackageId ? 0 : prices.get(`${item.itemType}:${item.itemId}`) ?? item.unitPrice,
        })));
      })
      .catch(console.error);
    return () => { cancelled = true; };
  }, [customer?.id]);

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
  const amountPaid = paymentMethod === 'wallet' ? totalPayment : amountInput ?? totalPayment;
  const checkoutMutation = useMutation({
    mutationFn: (payload: PosCheckoutPayload) => checkoutPosInvoice({...payload,requestKey:requestKey(payload)}),
    onSuccess: (res) => {
      resynchronizeRealtimeQueries(queryClient);
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

  const handlePackageServiceSelect = (customerPackageId: number, serviceId: number) => {
    const selectedPackage = servicePackages.find((pkg) => pkg.customerPackageId === customerPackageId);
    const selectedService = selectedPackage?.services.find((service) => service.serviceId === serviceId);
    if (!selectedPackage || !selectedService) {
      notify('Gói dịch vụ không khả dụng', 'Vui lòng chọn lại gói dịch vụ còn lượt.');
      return;
    }

    const existingItemIndex = configuredItems.findIndex(
      (item) => item.usePackageId === customerPackageId && item.usePackageServiceId === serviceId,
    );

    if (existingItemIndex >= 0) {
      setActiveEditingItem({
        ...configuredItems[existingItemIndex],
        maxQuantity: selectedService.availableUnits,
      });
      setEditingIndex(existingItemIndex);
    } else {
      setActiveEditingItem({
        itemId: selectedService.serviceId,
        itemType: 'service',
        name: selectedService.serviceName,
        unitPrice: 0,
        quantity: 1,
        durationMinutes: 60,
        startsAt: new Date(),
        staffId: null,
        staffName: null,
        position: null,
        usePackageId: customerPackageId,
        usePackageServiceId: selectedService.serviceId,
        packageName: selectedPackage.packageName,
        maxQuantity: selectedService.availableUnits,
      });
      setEditingIndex(null);
    }

    setIsPackageModalOpen(false);
    setIsDetailSheetOpen(true);
  };

  const handleCustomerSelected = (selectedCustomer: MobileCustomer) => {
    if (customer && customer.id !== selectedCustomer.id) {
      setConfiguredItems((items) => items.filter((item) => !item.usePackageId));
    }
    setCustomer(selectedCustomer);
    setPackagePromptCustomerId(null);
    setIsPackageModalOpen(false);
    setIsCustomerSheetOpen(false);
  };

  const handleCustomerCleared = () => {
    setCustomer(null);
    setConfiguredItems((items) => items.filter((item) => !item.usePackageId));
    setPackagePromptCustomerId(null);
    setIsPackageModalOpen(false);
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
    handleCustomerCleared();
    setConfiguredItems([]);
    setDiscountInput(0);
    setPaymentMethod('cash');
    setNote('');
  };

  // Submit Checkout
  const handleCheckout = () => {
    if (checkoutMutation.isPending || (amountPaid < totalPayment && !allowDebt) || (paymentMethod !== 'cash' && amountPaid > totalPayment)) return;
    if (configuredItems.length === 0) {
      notify('Chưa có dịch vụ, sản phẩm', 'Vui lòng thêm ít nhất một món vào hóa đơn.');
      return;
    }
    if (!customer) {
      notify('Cần chọn khách hàng', 'Vui lòng chọn hoặc thêm khách hàng trước khi thanh toán.');
      return;
    }

    const payload: PosCheckoutPayload = {
      customerId: customer.id,
      staffId: configuredItems[0]?.staffId || null,
      discount: discountAmount,
      paymentMethod,
      amountPaid,
      allowDebt,
      note: note.trim() || undefined,
      lines: configuredItems.map((item) => ({
        itemType: item.itemType,
        itemId: item.itemId,
        quantity: item.quantity || 1,
        staffId: item.staffId || null,
        usePackageId: item.usePackageId || null,
        usePackageServiceId: item.usePackageServiceId || null,
      })),
    };

    checkoutMutation.mutate(payload);
  };

  return (
    <div className="m-page mobile-form-view-container">
      <MobilePageHeader
        title="Tạo hóa đơn"
        onBack={() => navigate(-1)}
        actions={(
          <>
            {configuredItems.length > 0 && (
              <MobileHeaderAction icon="ph ph-trash" label="Làm mới" onClick={handleClearAll} />
            )}
            <MobileHeaderAction
              icon="ph ph-note"
              label="Ghi chú hóa đơn"
              tone={note ? 'soft' : 'ghost'}
              onClick={() => {
                setTempNote(note);
                setIsNoteDialogOpen(true);
              }}
            />
          </>
        )}
      />

      {/* Main Body Form Cards */}
      <div className="mobile-form-body">
        {/* Card 1: Customer Selection */}
        <section className="mobile-form-card">
          <div
            className="mobile-form-row"
            onClick={() => setIsCustomerSheetOpen(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setIsCustomerSheetOpen(true); } }}
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
                    <span className="mobile-form-row-title">Chọn khách hàng</span>
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
                    handleCustomerCleared();
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
                          <div className="text-muted">
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
                      <div className="mobile-form-item-tag-list">
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

                        {item.usePackageId && (
                          <span
                            className="mobile-form-tag is-package"
                            title={item.packageName ? `Trừ gói: ${item.packageName}` : 'Đã trừ gói'}
                          >
                            <i className="ph ph-ticket" />
                            <span className="mobile-form-package-tag-label">
                              {item.packageName ? `Trừ gói: ${item.packageName}` : 'Đã trừ gói'}
                            </span>
                          </span>
                        )}
                      </div>

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
        <section className="mobile-form-card invoice-payment-card">
          <div className="m-section">
            <span className="m-section-title">Phương thức thanh toán</span>
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

          <PartialPaymentFields customerId={customer?.id} total={totalPayment} amount={amountPaid} onAmountChange={setAmountInput} allowDebt={allowDebt} onAllowDebtChange={setAllowDebt} method={paymentMethod} disabled={checkoutMutation.isPending} />
          {customer && <><button type="button" className="btn btn-link btn-sm" onClick={()=>setShowDebt(!showDebt)}>{showDebt ? 'Ẩn công nợ' : 'Xem công nợ / Thu nợ cũ'}</button>{showDebt && <CustomerDebtPanel key={customer.id} customerId={customer.id} />}</>}
          {/* Discount Field */}
          <div className="m-section">
            <div className="m-section-head">
              <span className="m-section-title">Chiết khấu / Giảm giá</span>
              <div className="segmented" role="group" aria-label="Đơn vị giảm giá">
                <button type="button" aria-pressed={discountType === 'vnd'} onClick={() => setDiscountType('vnd')}>VNĐ</button>
                <button type="button" aria-pressed={discountType === 'percent'} onClick={() => setDiscountType('percent')}>%</button>
              </div>
            </div>

            {discountType === 'vnd' ? (
              <MoneyInput
                aria-label="Giảm giá theo số tiền"
                placeholder="0"
                value={discountInput}
                onChange={(val) => setDiscountInput(val)}
                suffix="đ"
                wrapperClassName="input-suffix mobile-money-input"
              />
            ) : (
              <input
                type="number"
                aria-label="Giảm giá theo phần trăm"
                min="0"
                max="100"
                placeholder="0"
                value={discountInput || ''}
                onChange={(e) => setDiscountInput(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                className="input"
              />
            )}
          </div>

          {/* Summary Box */}
          <div className="mobile-checkout-summary">
            <div className="mobile-summary-row">
              <span className="text-muted">Tổng tiền hàng:</span>
              <span className="text-strong">{formatMoney(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="mobile-summary-row text-danger">
                <span>Giảm giá:</span>
                <span>-{formatMoney(discountAmount)}</span>
              </div>
            )}
            <div className="mobile-summary-row total-row">
              <span>Tổng thanh toán:</span>
              <span className="text-primary">{formatMoney(totalPayment)}</span>
            </div>
          </div>
        </section>
      </div>

      <div className="m-footer">
        <button
          type="button"
          className="btn btn-primary btn-lg btn-block"
          onClick={handleCheckout}
          disabled={checkoutMutation.isPending || configuredItems.length === 0 || !customer || (amountPaid < totalPayment && !allowDebt) || (paymentMethod !== 'cash' && amountPaid > totalPayment)}
        >
          {checkoutMutation.isPending ? (
            <>
              <i className="ph ph-spinner spin" />
              <span>Đang thanh toán...</span>
            </>
          ) : (
            <>
              <i className="ph ph-check-circle" />
              <span>Chốt & In hóa đơn ({formatMoney(Math.min(amountPaid,totalPayment))})</span>
            </>
          )}
        </button>
      </div>

      {/* Customer Select Sheet */}
      <MobileCustomerSelectSheet
        isOpen={isCustomerSheetOpen}
        selectedCustomerId={customer?.id}
        onClose={() => setIsCustomerSheetOpen(false)}
        onSelectCustomer={handleCustomerSelected}
      />

      <UsePackageModal
        isOpen={isPackageModalOpen}
        packages={servicePackages}
        onClose={() => setIsPackageModalOpen(false)}
        onSelect={handlePackageServiceSelect}
      />

      <BottomSheet
        open={isCatalogSheetOpen}
        onClose={() => setIsCatalogSheetOpen(false)}
        title="Chọn dịch vụ, sản phẩm"
        height="full"
        initialFocusRef={catalogSearchRef}
        headerExtra={(
          <div className="sheet-toolbar">
            <label className="input-group">
              <i className="ph ph-magnifying-glass" aria-hidden="true" />
              <input
                ref={catalogSearchRef}
                type="search"
                aria-label="Tìm dịch vụ, sản phẩm"
                placeholder="Tìm tên dịch vụ, sản phẩm..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
              />
            </label>
            <div className="m-chip-strip" role="group" aria-label="Lọc loại hàng">
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
                  className="chip"
                  onClick={() => setActiveCatalogTab(tab.value)}
                  aria-pressed={activeCatalogTab === tab.value}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        )}
      >
        <div className="mobile-catalog-items-list">
        {catalogItems.length === 0 ? (
          <EmptyState compact title="Không tìm thấy mặt hàng nào" message={null} />
        ) : (
          catalogItems.map((cat) => (
            <button
              type="button"
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
            </button>
          ))
        )}
        </div>
      </BottomSheet>

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

      <BottomSheet
        open={isNoteDialogOpen}
        onClose={() => setIsNoteDialogOpen(false)}
        title="Ghi chú hóa đơn"
        footer={(
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setIsNoteDialogOpen(false)}>Hủy</button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setNote(tempNote);
                setIsNoteDialogOpen(false);
              }}
            >
              Lưu ghi chú
            </button>
          </>
        )}
      >
        <textarea
          className="textarea"
          rows={5}
          aria-label="Ghi chú hóa đơn"
          placeholder="Nhập ghi chú cho hóa đơn..."
          value={tempNote}
          onChange={(e) => setTempNote(e.target.value)}
          autoFocus
        />
      </BottomSheet>

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
