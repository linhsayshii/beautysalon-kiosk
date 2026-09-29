import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatMoney } from '@/lib/format';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/DataState';
import { Select } from '@/components/ui/Select/Select';
import { getPosCatalog, getPosInvoice, getPosPaymentRequests, getPosPriceQuote, getPosStaff, getPosCustomerServicePackages, type PosReceiptData, type ServicePackageOption } from '@/features/pos/pos.api';
import { PosReceiptPrint } from '@/features/pos/components/PosReceiptPrint';
import { UsePackageModal } from '@/features/pos/components/UsePackageModal';
import { MobileCartBottomSheet } from './MobileCartBottomSheet';
import { MobileSearchBar } from '@/features/mobile-common';

type CatalogFilter = '' | 'service' | 'package' | 'account_card' | 'product';

interface CatalogItem {
  itemId: number;
  itemType: Exclude<CatalogFilter, ''>;
  code: string;
  name: string;
  category: string;
  unit: string;
  salePrice: number;
  stockQuantity: number | null;
  commissionType: 'percent' | 'fixed' | null;
  commissionRate: number;
}

interface PosLine extends CatalogItem {
  quantity: number;
  staffId: number | null;
  usePackageId?: number | null;
  usePackageServiceId?: number | null;
}

interface PosCustomer {
  id: number;
  name: string;
  phone?: string;
}

const filterTabs: Array<{ value: CatalogFilter; label: string }> = [
  { value: '', label: 'Tất cả' },
  { value: 'service', label: 'Dịch vụ' },
  { value: 'package', label: 'Gói DV' },
  { value: 'account_card', label: 'Thẻ TK' },
  { value: 'product', label: 'Sản phẩm' },
];

export function MobilePosView() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const invoiceIdParam = searchParams.get('invoice');
  const appointmentIdParam = searchParams.get('appointment');

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<CatalogFilter>('');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('');
  const [cartLines, setCartLines] = useState<PosLine[]>([]);
  const [customer, setCustomer] = useState<PosCustomer | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCartExpanded, setIsCartExpanded] = useState(true);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [servicePackages, setServicePackages] = useState<ServicePackageOption[]>([]);

  const invoiceId = invoiceIdParam ? Number(invoiceIdParam) : null;
  const appointmentId = appointmentIdParam ? Number(appointmentIdParam) : null;

  const loadedInvoice = useRef<number | null>(null);
  useEffect(() => {
    loadedInvoice.current = null;
    setCartLines([]);
    setCustomer(null);
    setIsCartOpen(false);
  }, [invoiceId]);

  // Fetch invoice if editing existing draft
  const invoiceQuery = useQuery({
    queryKey: ['pos-invoice', invoiceId],
    queryFn: () => getPosInvoice(invoiceId!),
    enabled: !!invoiceId,
  });
  const paymentRequestsQuery = useQuery({
    queryKey: ['pos-payment-requests'],
    queryFn: getPosPaymentRequests,
    refetchInterval: 10_000,
  });
  const incompleteServiceCount = useMemo(() => {
    const progress = (invoiceQuery.data?.data as any)?.serviceProgress;
    return Math.max(0, Number(progress?.total || 0) - Number(progress?.completed || 0));
  }, [invoiceQuery.data]);

  // Populate cart from invoice when loaded
  useEffect(() => {
    if (invoiceQuery.data?.data && loadedInvoice.current !== invoiceId) {
      const invoice = invoiceQuery.data.data as any;
      if (invoice.status !== 'draft') return;
      loadedInvoice.current = invoiceId;
      // Set customer from invoice
      if (invoice.customer) {
        setCustomer({
          id: invoice.customer.id,
          name: invoice.customer.name,
          phone: invoice.customer.phone,
        });
      }
      // Map invoice items to cart lines
      const lines: PosLine[] = (invoice.items || []).map((item: any) => ({
        itemId: item.itemType === 'service'
          ? item.serviceId
          : item.itemType === 'product'
          ? item.productId
          : item.itemType === 'package'
          ? item.packageId
          : item.accountCardId,
        itemType: item.itemType as Exclude<CatalogFilter, ''>,
        code: item.code || '',
        name: item.name,
        category: item.category || '',
        unit: item.unit || 'lần',
        salePrice: item.unitPrice,
        stockQuantity: null,
        commissionType: item.commissionType || null,
        commissionRate: item.commissionRate || 0,
        quantity: item.quantity,
        staffId: item.staffId || null,
        usePackageId: item.customerPackageId || null,
        usePackageServiceId: item.customerPackageId ? item.serviceId : null,
      }));
      setCartLines(lines);
      setIsCartExpanded(true);
      if (searchParams.get('checkout') === '1') setIsCartOpen(true);
    }
  }, [invoiceQuery.data, invoiceId, searchParams]);

  // Check for available service packages when customer changes
  useEffect(() => {
    if (customer && !invoiceId) {
      getPosCustomerServicePackages(customer.id)
        .then((res: any) => {
          const packages = res?.data || [];
          if (packages.length > 0) {
            setServicePackages(packages);
            setShowPackageModal(true);
          }
        })
        .catch(console.error);
    }
  }, [customer?.id, invoiceId]);

  const [receiptToPrint, setReceiptToPrint] = useState<PosReceiptData | null>(null);

  // Fetch Pos Catalog
  const catalogQuery = useQuery({
    queryKey: ['pos-catalog', search, activeTab, customer?.id ?? null],
    queryFn: () => getPosCatalog(search, activeTab, customer?.id),
  });

  useEffect(() => {
    if (!cartLines.length || invoiceId) return;
    let cancelled = false;
    getPosPriceQuote(customer?.id, cartLines)
      .then((response) => {
        if (cancelled) return;
        const prices = new Map(response.data.map((item) => [`${item.itemType}:${item.itemId}`, item.salePrice]));
        setCartLines((lines) => lines.map((line) => ({
          ...line,
          salePrice: line.usePackageId ? 0 : prices.get(`${line.itemType}:${line.itemId}`) ?? line.salePrice,
        })));
      })
      .catch(console.error);
    return () => { cancelled = true; };
  }, [customer?.id]);

  // Fetch staff list
  const { data: staffResponse } = useQuery({
    queryKey: ['pos-staff'],
    queryFn: getPosStaff,
  });
  const staffList = (staffResponse?.data || []) as Array<{ id: number; name: string }>;

  const catalogItems = useMemo(() => {
    return (catalogQuery.data?.data || []) as unknown as CatalogItem[];
  }, [catalogQuery.data]);

  // Extract unique subcategories
  const subCategories = useMemo(() => {
    const set = new Set<string>();
    catalogItems.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set);
  }, [catalogItems]);

  // Filter items by subcategory if selected
  const filteredItems = useMemo(() => {
    if (!selectedSubCategory) return catalogItems;
    return catalogItems.filter((item) => item.category === selectedSubCategory);
  }, [catalogItems, selectedSubCategory]);

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, CatalogItem[]> = {};
    filteredItems.forEach((item) => {
      const cat = item.category ? item.category.toUpperCase() : 'KHÁC';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [filteredItems]);

  // Cart total calculations
  const totalCartCount = useMemo(() => {
    return cartLines.reduce((sum, item) => sum + item.quantity, 0);
  }, [cartLines]);

  const totalCartAmount = useMemo(() => {
    return cartLines.reduce((sum, item) => sum + item.salePrice * item.quantity, 0);
  }, [cartLines]);

  const totalCommission = useMemo(() => {
    return cartLines.reduce((sum, line) => {
      if (!line.staffId) return sum;
      if (!line.commissionType || !line.commissionRate) return sum;

      const revenue = line.salePrice * line.quantity;
      let amount = 0;

      if (line.commissionType === 'percent') {
        amount = (revenue * line.commissionRate) / 100;
      } else {
        amount = line.quantity * line.commissionRate;
      }

      return sum + amount;
    }, 0);
  }, [cartLines]);

  // Add or increment item
  const handleAddItem = (item: CatalogItem) => {
    setCartLines((prev) => {
      const existing = prev.find((l) => l.itemId === item.itemId && l.itemType === item.itemType);
      if (existing) {
        return prev.map((l) =>
          l.itemId === item.itemId && l.itemType === item.itemType
            ? { ...l, quantity: l.quantity + 1 }
            : l
        );
      }
      // Preserve commission data from catalog item
      return [...prev, { ...item, quantity: 1, staffId: null }];
    });
  };

  // Update staff for a line
  const handleUpdateLineStaff = (itemId: number, itemType: string, staffId: number | null) => {
    setCartLines((prev) =>
      prev.map((l) =>
        l.itemId === itemId && l.itemType === itemType
          ? { ...l, staffId }
          : l
      )
    );
  };

  // Update quantity or remove
  const handleUpdateQuantity = (itemId: number, itemType: string, delta: number) => {
    setCartLines((prev) => {
      return prev
        .map((l) => {
          if (l.itemId === itemId && l.itemType === itemType) {
            const newQty = l.quantity + delta;
            return newQty > 0 ? { ...l, quantity: newQty } : null;
          }
          return l;
        })
        .filter(Boolean) as PosLine[];
    });
  };

  // Handle service selection from package modal
  const handlePackageServiceSelect = (customerPackageId: number, serviceId: number) => {
    const pkg = servicePackages.find(p => p.customerPackageId === customerPackageId);
    const svc = pkg?.services.find(s => s.serviceId === serviceId);

    if (pkg && svc) {
      const newLine: PosLine = {
        itemId: serviceId,
        itemType: 'service',
        code: svc.serviceCode,
        name: svc.serviceName,
        category: 'Từ gói',
        unit: 'lượt',
        salePrice: 0,
        stockQuantity: null,
        commissionType: null,
        commissionRate: 0,
        quantity: 1,
        staffId: null,
        usePackageId: customerPackageId,
        usePackageServiceId: serviceId,
      };

      setCartLines(prev => [...prev, newLine]);
    }

    setShowPackageModal(false);
    setServicePackages([]);
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'service':
        return 'ph-sparkle';
      case 'package':
        return 'ph-sparkle';
      case 'account_card':
        return 'ph-credit-card';
      case 'product':
        return 'ph-package';
      default:
        return 'ph-sparkle';
    }
  };

  return (
    <div className="mobile-pos-container">
      {paymentRequestsQuery.data?.data?.length ? (
        <section className="mobile-pos-payment-requests" aria-label="Hóa đơn chờ thanh toán">
          <div className="mobile-pos-payment-requests-head">
            <strong>Chờ thanh toán</strong>
            <span>{paymentRequestsQuery.data.data.length} hóa đơn</span>
          </div>
          <div className="mobile-pos-payment-request-list">
            {paymentRequestsQuery.data.data.map((request) => (
              <article key={request.id} className={`mobile-pos-payment-request ${invoiceId === request.id ? 'is-selected' : ''}`} aria-current={invoiceId === request.id ? 'true' : undefined}>
                <div>
                  <strong>{request.customer.name}</strong>
                  <span>{request.serviceProgress.completed}/{request.serviceProgress.total} dịch vụ đã xong</span>
                  {request.requestedByName && <small>Chuyển bởi {request.requestedByName}</small>}
                </div>
                <button type="button" onClick={() => { navigate(`/m/pos?invoice=${request.id}`); setIsCartExpanded(true); }}>{invoiceId === request.id ? '✓ Đang thanh toán' : 'Thanh toán'}</button>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      {/* Sticky Top Controls Cluster */}
      <div className="mobile-pos-sticky-top-controls">
        <MobileSearchBar value={search} placeholder="Tìm hàng hóa" onChange={setSearch} />

        {/* Category filter */}
        <div className="m-chip-strip">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className="chip"
              aria-pressed={activeTab === tab.value}
              onClick={() => {
                setActiveTab(tab.value);
                setSelectedSubCategory('');
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Subcategory dropdown / pill */}
        <div className="mobile-pos-filter-row">
          <div className="chip">
            <i className="ph ph-funnel" />
            <Select
              aria-label="Nhóm hàng"
              value={selectedSubCategory}
              onChange={setSelectedSubCategory}
              variant="ghost"
              options={[{ value: '', label: 'Tất cả nhóm hàng' }, ...subCategories.map((category) => ({ value: category, label: category }))]}
            />
          </div>
          <span className="text-muted">
            {filteredItems.length} mặt hàng
          </span>
        </div>
      </div>

      {/* Grouped Items List */}
      {catalogQuery.isPending ? (
        <LoadingState compact />
      ) : catalogQuery.error ? (
        <ErrorState compact error={catalogQuery.error} onRetry={() => catalogQuery.refetch()} />
      ) : Object.keys(groupedItems).length === 0 ? (
        <EmptyState compact title="Không tìm thấy mặt hàng nào" message={null} />
      ) : (
        <div className="mobile-pos-groups">
          {Object.entries(groupedItems).map(([groupName, items]) => (
            <div key={groupName} className="mobile-pos-group">
              <div className="mobile-pos-group-title">{groupName}</div>
              <div className="mobile-pos-group-items">
                {items.map((item) => {
                  const inCart = cartLines.find(
                    (l) => l.itemId === item.itemId && l.itemType === item.itemType
                  );
                  return (
                    <button
                      type="button"
                      key={`${item.itemType}-${item.itemId}`}
                      className="mobile-pos-card"
                      onClick={() => handleAddItem(item)}
                    >
                      <div className="mobile-pos-card-left">
                        <div className={`mobile-pos-card-icon is-${item.itemType}`}>
                          <i className={`ph ${getItemIcon(item.itemType)}`} />
                        </div>
                        <div className="mobile-pos-card-info">
                          <div className="mobile-pos-card-name">{item.name}</div>
                          <div className="mobile-pos-card-subtitle">
                            {item.category || item.unit || 'Dịch vụ'} {item.code ? `• ${item.code}` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="mobile-pos-card-right">
                        <div className="mobile-pos-card-price">{formatMoney(item.salePrice)}</div>
                        {inCart && (
                          <div className="mobile-pos-card-badge">
                            {inCart.quantity}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Collapsible Cart */}
      <div className={`mobile-cart ${isCartExpanded ? 'expanded' : 'collapsed'}`}>
        <button
          type="button"
          className="cart-header"
          onClick={() => setIsCartExpanded(!isCartExpanded)}
        >
          <span className="cart-title">
            <i className="ph ph-shopping-cart-simple" />
            {invoiceId ? <span className="cart-invoice-identity"><strong>Đang thanh toán · {invoiceQuery.data?.data?.code || 'Đang tải…'}</strong><small>{customer?.name || 'Đang tải khách hàng…'} · {totalCartCount} mục</small></span> : <>Giỏ hàng ({totalCartCount})</>}
          </span>
          <span className="cart-toggle">
            {isCartExpanded ? '▼' : '▲'}
          </span>
        </button>

        {invoiceId && <button type="button" className="cart-close-invoice" onClick={() => { setIsCartOpen(false); setCartLines([]); setCustomer(null); navigate('/m/pos'); }}>Đóng hóa đơn</button>}
        {invoiceId && invoiceQuery.isError && <p role="alert">Không thể tải hóa đơn. <button onClick={() => invoiceQuery.refetch()}>Thử lại</button></p>}
        {invoiceId && invoiceQuery.data?.data && invoiceQuery.data.data.status !== 'draft' && <p role="status">Hóa đơn đã ghi nhận thanh toán. <button onClick={() => navigate(`/m/orders?invoice=${invoiceId}`)}>Xem hóa đơn / Thu nợ</button></p>}
        {isCartExpanded && (
          <div className="cart-items">
            {cartLines.map((line) => (
              <div key={`${line.itemType}-${line.itemId}`} className="cart-item">
                <div className="item-main">
                  <div className="item-info">
                    <span className="item-name">{line.name}</span>
                    <span className="item-price">{formatMoney(line.salePrice)} x {line.quantity}</span>
                  </div>
                </div>

                <div className="item-meta">
                  <div className="staff-select">
                    <label>NV:</label>
                    <Select<number | string>
                      aria-label={`Nhân viên thực hiện ${line.name}`}
                      value={line.staffId ?? ''}
                      onChange={(staffId) => handleUpdateLineStaff(line.itemId, line.itemType, staffId === '' ? null : Number(staffId))}
                      size="sm"
                      triggerClassName="mobile-pos-staff-trigger"
                      options={[{ value: '', label: '-- Chọn --' }, ...staffList.map((staff) => ({ value: staff.id, label: staff.name }))]}
                    />
                  </div>

                  <div className="commission-badge">
                    HH: {line.staffId && line.commissionType && line.commissionRate
                      ? formatMoney(Math.round(
                          line.commissionType === 'percent'
                            ? (line.salePrice * line.quantity * line.commissionRate) / 100
                            : line.commissionRate
                        ))
                      : '-'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Always visible summary */}
        <div className="cart-summary">
          <div className="summary-row">
            <span>Tạm tính:</span>
            <span className="amount">{formatMoney(totalCartAmount)}</span>
          </div>
          <div className="summary-row commission">
            <span>HH dự kiến:</span>
            <span className="amount">{formatMoney(totalCommission)}</span>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-lg checkout-btn"
          disabled={cartLines.length === 0 || Boolean(invoiceId && (invoiceQuery.isPending || invoiceQuery.isError || invoiceQuery.data?.data?.status !== 'draft'))}
          onClick={() => setIsCartOpen(true)}
        >
          Thanh toán · {formatMoney(Math.max(0, totalCartAmount - Number(invoiceQuery.data?.data?.discount || 0)))}
        </button>
      </div>

      {/* Cart & Checkout Bottom Sheet */}
      {isCartOpen && (
        <MobileCartBottomSheet
          lines={cartLines}
          customer={customer}
          appointmentId={appointmentId}
          invoiceId={invoiceId}
          invoiceCode={invoiceQuery.data?.data?.code}
          initialDiscount={Number(invoiceQuery.data?.data?.discount || 0)}
          customerLocked={Boolean(invoiceId && (invoiceQuery.data?.data?.fromAppointment || invoiceQuery.data?.data?.serviceProgress?.total > 0))}
          incompleteServiceCount={incompleteServiceCount}
          onSelectCustomer={(value) => { if (!(invoiceId && (invoiceQuery.data?.data?.fromAppointment || invoiceQuery.data?.data?.serviceProgress?.total > 0))) setCustomer(value); }}
          onUpdateQuantity={handleUpdateQuantity}
          onUpdateLineStaff={handleUpdateLineStaff}
          onClose={() => setIsCartOpen(false)}
          onSuccess={(receipt) => {
            setIsCartOpen(false);
            setCartLines([]);
            setCustomer(null);
            setReceiptToPrint(receipt);
            navigate('/m/pos', { replace: true });
          }}
        />
      )}

      {/* Print Receipt Modal */}
      {receiptToPrint && (
        <PosReceiptPrint receipt={receiptToPrint} onClose={() => setReceiptToPrint(null)} />
      )}

      {/* Use Package Modal */}
      <UsePackageModal
        isOpen={showPackageModal}
        packages={servicePackages}
        onClose={() => {
          setShowPackageModal(false);
          setServicePackages([]);
        }}
        onSelect={handlePackageServiceSelect}
      />
    </div>
  );
}
