import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ErrorState } from '@/components/data-display/DataState';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { Select } from '@/components/ui/Select/Select';
import { DateTimePickerField } from '@/components/ui/DateTimePicker';
import { useAuth } from '@/features/auth/AuthProvider';
import { useWebSocket } from '@/hooks/useWebSocket';
import { DEFAULT_BRANCH_TIME_ZONE, addCalendarDays, formatDateOnly, localDateTimeFromInstant, parseIsoDate, parseLocalDateTime, startOfIsoWeek, zonedLocalDateTimeToIso } from '@/lib/date';
import { formatMoney } from '@/lib/format';
import { createPosAppointment, updatePosAppointment, createPosCustomer, getPosAppointments, getPosCatalog, getPosInvoice, getPosPaymentRequests, getPosPriceQuote, getPosStaff, searchPosCustomers, getPosCustomerAvailablePackages, getPosCustomerServicePackages, type PosReceiptData, type ServicePackageOption } from '../pos.api';
import { layoutOverlappingAppointments } from '../calendar-layout';
import { CustomerCreateDialog } from '@/features/operations/components/CustomerCreateDialog';
import { PosCheckoutModal } from './PosCheckoutModal';
import { PosReceiptPrint } from './PosReceiptPrint';
import { UsePackageModal } from './UsePackageModal';
import '@/features/pos/pos.css';

type CatalogFilter = '' | 'service' | 'package' | 'account_card' | 'product';
type PosMode = 'calendar' | 'invoice';

interface CatalogItem {
  itemId: number;
  itemType: Exclude<CatalogFilter, ''>;
  code: string;
  name: string;
  category: string;
  unit: string;
  salePrice: number;
  stockQuantity: number | null;
  commissionType?: 'percent' | 'fixed' | null;
  commissionRate?: number;
  usePackageId?: number | null;
  usePackageServiceId?: number | null;
}

interface PosLine extends CatalogItem {
  quantity: number;
  staffId: number | null;
  commissionType: 'percent' | 'fixed' | null;
  commissionRate: number;
}

interface PosCustomer {
  id: number;
  name: string;
  phone?: string;
}

interface InvoiceDraft {
  id: number;
  serverInvoiceId?: number;
  name: string;
  customerSearch: string;
  customer: PosCustomer | null;
  lines: PosLine[];
}

interface CalendarSelection {
  startsAt: string;
  durationMinutes: number;
}

const STORAGE_KEY_PREFIX = 'annachill-pos-drafts-v2:';
const MAX_INVOICES = 8;
const SLOT_HEIGHT = 88;
const CALENDAR_START_HOUR = 8;
const CALENDAR_END_HOUR = 21;

const filters: Array<{ value: CatalogFilter; label: string; icon: string }> = [
  { value: '', label: 'Tất cả', icon: 'ph-squares-four' },
  { value: 'service', label: 'Dịch vụ', icon: 'ph-sparkle' },
  { value: 'package', label: 'Gói dịch vụ', icon: 'ph-gift' },
  { value: 'account_card', label: 'Thẻ tài khoản', icon: 'ph-credit-card' },
  { value: 'product', label: 'Sản phẩm', icon: 'ph-package' },
];

const itemIcons: Record<Exclude<CatalogFilter, ''>, string> = {
  service: 'ph-sparkle',
  package: 'ph-gift',
  account_card: 'ph-credit-card',
  product: 'ph-package',
};

function makeInvoice(id: number): InvoiceDraft {
  return { id, name: `Hóa đơn ${id}`, customerSearch: '', customer: null, lines: [] };
}

function loadDrafts(accountId: number): InvoiceDraft[] {
  try {
    const stored = window.sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${accountId}`);
    if (!stored) return [makeInvoice(1)];
    const parsed = JSON.parse(stored) as InvoiceDraft[];
    return Array.isArray(parsed) && parsed.length ? parsed.slice(0, MAX_INVOICES) : [makeInvoice(1)];
  } catch {
    return [makeInvoice(1)];
  }
}

export function PosView() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { account } = useAuth();
  const accountId = account?.id ?? 0;
  const [invoices, setInvoices] = useState<InvoiceDraft[]>(() => loadDrafts(accountId));
  const [activeId, setActiveId] = useState(() => invoices[0].id);
  const [mode, setMode] = useState<PosMode>('invoice');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>('service');
  const [customerOpen, setCustomerOpen] = useState(false);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [receiptToPrint, setReceiptToPrint] = useState<PosReceiptData | null>(null);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [servicePackages, setServicePackages] = useState<ServicePackageOption[]>([]);
  const nextId = useRef(Math.max(...invoices.map((invoice) => invoice.id)) + 1);
  const deferredCatalogSearch = useDeferredValue(catalogSearch.trim());
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const activeInvoice = invoices.find((invoice) => invoice.id === activeId) ?? invoices[0];
  const deferredCustomerSearch = useDeferredValue(activeInvoice.customerSearch.trim());

  useEffect(() => {
    window.sessionStorage.setItem(`${STORAGE_KEY_PREFIX}${accountId}`, JSON.stringify(invoices));
  }, [accountId, invoices]);

  const catalog = useQuery({
    queryKey: ['pos-catalog', deferredCatalogSearch, catalogFilter, activeInvoice.customer?.id ?? null],
    queryFn: () => getPosCatalog(deferredCatalogSearch, catalogFilter, activeInvoice.customer?.id),
  });
  const requestedInvoiceId = searchParams.get('invoice') ? Number(searchParams.get('invoice')) : null;
  const requestedInvoice = useQuery({
    queryKey: ['pos-invoice', requestedInvoiceId],
    queryFn: () => getPosInvoice(requestedInvoiceId!),
    enabled: Boolean(requestedInvoiceId),
  });
  const paymentRequests = useQuery({
    queryKey: ['pos-payment-requests'],
    queryFn: getPosPaymentRequests,
    refetchInterval: 10_000,
  });

  useEffect(() => {
    const invoice = requestedInvoice.data?.data as any;
    if (!invoice) return;
    updateActive(() => ({
      id: activeId,
      serverInvoiceId: invoice.id,
      name: invoice.code,
      customerSearch: invoice.customer?.name || '',
      customer: invoice.customer?.id ? { id: invoice.customer.id, name: invoice.customer.name, phone: invoice.customer.phone } : null,
      lines: (invoice.items || []).map((item: any) => ({
        itemId: item.itemType === 'service' ? item.serviceId : item.itemType === 'product' ? item.productId : item.itemType === 'package' ? item.packageId : item.accountCardId,
        itemType: item.itemType,
        code: item.code || '', name: item.name, category: '', unit: item.unit || 'lần', salePrice: item.unitPrice,
        stockQuantity: null, quantity: item.quantity, staffId: item.staffId || null,
        commissionType: item.commissionType || null, commissionRate: item.commissionRate || 0,
        usePackageId: item.customerPackageId || null,
        usePackageServiceId: item.customerPackageId ? item.serviceId : null,
      })),
    }));
    setMode('invoice');
  }, [requestedInvoice.data]);

  const customers = useQuery({
    queryKey: ['pos-customers', deferredCustomerSearch],
    queryFn: () => searchPosCustomers(deferredCustomerSearch),
    enabled: customerOpen && deferredCustomerSearch.length >= 2,
  });

  const staffQuery = useQuery({
    queryKey: ['pos-staff'],
    queryFn: getPosStaff,
  });
  const staffList = (staffQuery.data?.data ?? []) as Array<{ id: number; name: string; role: string }>;

  const catalogItems = (catalog.data?.data ?? []) as CatalogItem[];
  const catalogGroups = useMemo(() => {
    const groups = new Map<string, CatalogItem[]>();
    catalogItems.forEach((item) => groups.set(item.category || 'Khác', [...(groups.get(item.category || 'Khác') ?? []), item]));
    return [...groups.entries()];
  }, [catalogItems]);

  const subtotal = activeInvoice.lines.reduce((sum, line) => sum + line.salePrice * line.quantity, 0);
  const itemCount = activeInvoice.lines.reduce((sum, line) => sum + line.quantity, 0);

  const updateActive = (updater: (invoice: InvoiceDraft) => InvoiceDraft) => {
    setInvoices((current) => current.map((invoice) => invoice.id === activeId ? updater(invoice) : invoice));
  };

  useEffect(() => {
    if (!activeInvoice.lines.length) return;
    let cancelled = false;
    getPosPriceQuote(activeInvoice.customer?.id, activeInvoice.lines)
      .then((response) => {
        if (cancelled) return;
        const prices = new Map(response.data.map((item) => [`${item.itemType}:${item.itemId}`, item.salePrice]));
        updateActive((invoice) => ({
          ...invoice,
          lines: invoice.lines.map((line) => ({
            ...line,
            salePrice: line.usePackageId ? 0 : prices.get(`${line.itemType}:${line.itemId}`) ?? line.salePrice,
          })),
        }));
      })
      .catch((error: Error) => notify('Không thể cập nhật bảng giá', error.message));
    return () => { cancelled = true; };
  }, [activeId, activeInvoice.customer?.id]);

  const addInvoice = () => {
    if (invoices.length >= MAX_INVOICES) {
      notify('Đã đạt giới hạn', `Mỗi quầy có thể mở tối đa ${MAX_INVOICES} hóa đơn cùng lúc.`);
      return;
    }
    const invoice = makeInvoice(nextId.current++);
    setInvoices((current) => [...current, invoice]);
    setActiveId(invoice.id);
    setMode('invoice');
  };

  const openPaymentRequest = (invoiceId: number) => {
    // The POS route remains mounted when only its query string changes. Switch
    // immediately so the calendar cannot remain visible while the invoice loads.
    setMode('invoice');
    navigate(`/pos?invoice=${invoiceId}`);
  };

  const closeInvoice = (id: number) => {
    if (invoices.length === 1) {
      setInvoices([makeInvoice(1)]);
      setActiveId(1);
      nextId.current = 2;
      return;
    }
    const index = invoices.findIndex((invoice) => invoice.id === id);
    const remaining = invoices.filter((invoice) => invoice.id !== id);
    setInvoices(remaining);
    if (activeId === id) setActiveId(remaining[Math.max(0, index - 1)]?.id ?? remaining[0].id);
  };

  const addItem = (item: CatalogItem) => {
    if (item.itemType === 'product' && Number(item.stockQuantity ?? 0) <= 0) return;
    updateActive((invoice) => {
      const current = invoice.lines.find((line) => line.itemId === item.itemId && line.itemType === item.itemType);
      if (!current) return { ...invoice, lines: [...invoice.lines, { ...item, quantity: 1, staffId: null, commissionType: item.commissionType ?? null, commissionRate: item.commissionRate ?? 0 }] };
      if (item.itemType === 'product' && current.quantity >= Number(item.stockQuantity ?? 0)) return invoice;
      return { ...invoice, lines: invoice.lines.map((line) => line === current ? { ...line, quantity: line.quantity + 1 } : line) };
    });
  };

  const changeQuantity = (line: PosLine, delta: number) => {
    updateActive((invoice) => ({
      ...invoice,
      lines: invoice.lines
        .map((current) => current.itemId === line.itemId && current.itemType === line.itemType
          ? { ...current, quantity: Math.min(current.quantity + delta, current.itemType === 'product' ? Number(current.stockQuantity ?? current.quantity) : 999) }
          : current)
        .filter((current) => current.quantity > 0),
    }));
  };

  const updateLineStaff = (line: PosLine, staffId: number | null) => {
    updateActive((invoice) => ({
      ...invoice,
      lines: invoice.lines.map((current) =>
        current.itemId === line.itemId && current.itemType === line.itemType
          ? { ...current, staffId }
          : current
      ),
    }));
  };

  const handlePackageServiceSelect = (customerPackageId: number, serviceId: number) => {
    const pkg = servicePackages.find(p => p.customerPackageId === customerPackageId);
    const svc = pkg?.services.find(s => s.serviceId === serviceId);

    if (pkg && svc) {
      addItem({
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
        usePackageId: customerPackageId,
        usePackageServiceId: serviceId,
      });
    }

    setShowPackageModal(false);
    setServicePackages([]);
  };

  function calculateExpectedCommission(line: PosLine): string {
    if (!line.staffId) return '-';
    if (!line.commissionType || !line.commissionRate) return '0đ';

    const revenue = line.salePrice * line.quantity;
    let amount = 0;

    if (line.commissionType === 'percent') {
      amount = revenue * line.commissionRate;
    } else {
      amount = line.quantity * line.commissionRate;
    }

    return formatMoney(Math.round(amount));
  }

  const removeLine = (line: PosLine) => updateActive((invoice) => ({
    ...invoice,
    lines: invoice.lines.filter((current) => !(current.itemId === line.itemId && current.itemType === line.itemType)),
  }));

  const handleCheckoutSuccess = (receipt: PosReceiptData, shouldPrint: boolean) => {
    setIsCheckoutOpen(false);
    notify('Đã chốt hóa đơn', `Hóa đơn ${receipt.code} · Đã thu ${formatMoney(receipt.amountPaid)} · Còn nợ ${formatMoney(receipt.debtAmount ?? 0)}.`);

    // Clear current invoice lines & customer
    updateActive((invoice) => ({
      ...invoice,
      lines: [],
      customer: null,
      customerSearch: '',
    }));

    // Invalidate caches to refresh data across system
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['pos-catalog'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['customers'] });
    queryClient.invalidateQueries({ queryKey: ['customer-packages'] });
    queryClient.invalidateQueries({ queryKey: ['staff-commissions'] });
    queryClient.invalidateQueries({ queryKey: ['pos-payment-requests'] });

    if (shouldPrint) {
      setReceiptToPrint(receipt);
    }
  };

  return (
    <main className="pos-workspace">
      <section className="pos-invoice-strip" aria-label="Các hóa đơn đang mở">
        <div className="pos-tabs" role="tablist" aria-label="Hóa đơn">
          <button className={`pos-calendar-tab ${mode === 'calendar' ? 'is-active' : ''}`} type="button" role="tab" aria-selected={mode === 'calendar'} onClick={() => setMode('calendar')}><i className="ph ph-calendar-dots" aria-hidden="true" /><span>Lịch hẹn</span></button>
          {invoices.map((invoice) => (
            <div className={`pos-tab ${mode === 'invoice' && invoice.id === activeId ? 'is-active' : ''}`} key={invoice.id}>
              <button className="pos-tab-select" type="button" role="tab" aria-selected={mode === 'invoice' && invoice.id === activeId} onClick={() => { setActiveId(invoice.id); setMode('invoice'); }}>
                <span>{invoice.name}</span>
                {invoice.lines.length > 0 && <small>{invoice.lines.reduce((sum, line) => sum + line.quantity, 0)}</small>}
              </button>
              <button className="pos-tab-close" type="button" aria-label={`Đóng ${invoice.name}`} onClick={() => closeInvoice(invoice.id)}><i className="ph ph-x" aria-hidden="true" /></button>
            </div>
          ))}
        </div>
        <button className="pos-add-invoice" type="button" onClick={addInvoice} aria-label="Thêm hóa đơn"><i className="ph ph-plus" aria-hidden="true" /></button>
        <div className="pos-shift-status"><i className="ph ph-storefront" aria-hidden="true" /><span>Chi nhánh trung tâm</span></div>
      </section>

      {paymentRequests.data?.data?.length ? (
        <section className="pos-payment-requests" aria-label="Hóa đơn chờ thanh toán">
          <div><strong>Chờ thanh toán</strong><span>{paymentRequests.data.data.length} hóa đơn đã hoàn thành dịch vụ</span></div>
          <div className="pos-payment-request-list">
            {paymentRequests.data.data.map((request) => (
              <article key={request.id}>
                <div><strong>{request.customer.name}</strong><span>{request.serviceProgress.completed}/{request.serviceProgress.total} dịch vụ đã xong</span></div>
                <button type="button" onClick={() => openPaymentRequest(request.id)}>Thanh toán</button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {mode === 'calendar' ? <PosCalendar /> : <div className="pos-layout">
        <section className="pos-catalog" aria-label="Danh mục bán hàng">
          <div className="pos-catalog-toolbar">
            <label className="pos-search">
              <i className="ph ph-magnifying-glass" aria-hidden="true" />
              <span className="sr-only">Tìm hàng hóa</span>
              <input value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder="Tìm theo mã, tên hàng hóa" />
              {catalogSearch && <button type="button" onClick={() => setCatalogSearch('')} aria-label="Xóa từ khóa"><i className="ph ph-x" /></button>}
            </label>
          </div>
          <div className="pos-filter-tabs" role="tablist" aria-label="Loại hàng hóa">
            {filters.map((filter) => <button className={catalogFilter === filter.value ? 'is-active' : ''} type="button" role="tab" aria-selected={catalogFilter === filter.value} onClick={() => setCatalogFilter(filter.value)} key={filter.value || 'all'}><i className={`ph ${filter.icon}`} aria-hidden="true" />{filter.label}</button>)}
          </div>
          <div className="pos-catalog-list" aria-live="polite">
            {catalog.isPending ? <CatalogSkeleton /> : catalog.error ? <ErrorState error={catalog.error} onRetry={() => catalog.refetch()} /> : !catalogItems.length ? (
              <div className="pos-empty-catalog"><i className="ph ph-magnifying-glass" aria-hidden="true" /><strong>Không tìm thấy hàng hóa</strong><span>Thử đổi từ khóa hoặc nhóm hàng đang chọn.</span></div>
            ) : catalogGroups.map(([category, items]) => (
              <section className="pos-catalog-group" key={category}>
                <h2>{category}</h2>
                <div className="pos-product-grid">
                  {items.map((item) => {
                    const soldOut = item.itemType === 'product' && Number(item.stockQuantity ?? 0) <= 0;
                    return <button className="pos-product" type="button" disabled={soldOut} onClick={() => addItem(item)} key={`${item.itemType}-${item.itemId}`}>
                      <span className={`pos-product-icon is-${item.itemType}`}><i className={`ph ${itemIcons[item.itemType]}`} aria-hidden="true" /></span>
                      <span className="pos-product-copy"><strong>{item.name}</strong><small>{item.code}{item.itemType === 'product' ? ` · Tồn ${item.stockQuantity ?? 0}` : ` · ${item.unit}`}</small></span>
                      <span className="pos-product-price">{soldOut ? 'Hết hàng' : formatMoney(item.salePrice)}</span>
                    </button>;
                  })}
                </div>
              </section>
            ))}
          </div>
        </section>

        <section className="pos-bill" aria-label={activeInvoice.name}>
          <div className="pos-customer-bar">
            <div className="pos-customer-search">
              <i className="ph ph-user" aria-hidden="true" />
              <input value={activeInvoice.customerSearch} onFocus={() => setCustomerOpen(true)} onBlur={() => window.setTimeout(() => setCustomerOpen(false), 120)} onChange={(event) => updateActive((invoice) => ({ ...invoice, customerSearch: event.target.value, customer: null }))} placeholder="Tìm tên, mã hoặc số điện thoại khách hàng" aria-label="Tìm khách hàng" />
              {activeInvoice.customer ? <span className="pos-customer-selected"><i className="ph ph-check" />Đã chọn</span> : <button type="button" aria-label="Thêm khách hàng" onClick={() => setIsAddingCustomer(true)}><i className="ph ph-plus" /></button>}
              {customerOpen && deferredCustomerSearch.length >= 2 && (
                <div className="pos-customer-results">
                  {customers.isPending ? <div className="pos-customer-message">Đang tìm khách hàng...</div> : !customers.data?.data.length ? <div className="pos-customer-message">Không tìm thấy khách hàng</div> : customers.data.data.map((customer) => <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => {
                    updateActive((invoice) => ({ ...invoice, customerSearch: customer.name, customer: { id: customer.id, name: customer.name, phone: customer.phone } }));
                    setCustomerOpen(false);
                    // Fetch service packages for this customer
                    getPosCustomerServicePackages(customer.id)
                      .then((res: any) => {
                        const packages = res?.data || [];
                        if (packages.length > 0) {
                          setServicePackages(packages);
                          setShowPackageModal(true);
                        }
                      })
                      .catch(console.error);
                  }} key={customer.id}><span className="pos-customer-avatar">{String(customer.name).trim().charAt(0).toUpperCase()}</span><span><strong>{customer.name}</strong><small>{customer.phone || customer.code}</small></span></button>)}
                </div>
              )}
            </div>
          </div>

          <div className="pos-bill-content">
            {!activeInvoice.lines.length ? <div className="pos-empty-bill"><span className="pos-empty-illustration"><i className="ph ph-receipt" /><i className="ph ph-check-circle" /></span><strong>Hóa đơn đang trống</strong><p>Chọn dịch vụ hoặc sản phẩm từ danh sách bên trái để bắt đầu.</p></div> : (
              <div className="pos-line-list">
                <div className="pos-line-heading"><span>{itemCount} mặt hàng</span><button type="button" onClick={() => updateActive((invoice) => ({ ...invoice, lines: [] }))}>Xóa tất cả</button></div>
                {activeInvoice.lines.map((line) => <article className="pos-line" key={`${line.itemType}-${line.itemId}`}>
                  <span className={`pos-line-icon is-${line.itemType}`}><i className={`ph ${itemIcons[line.itemType]}`} /></span>
                  <div className="pos-line-copy">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {line.usePackageId && <span className="kv-package-badge">Đã trừ gói</span>}
                      <strong>{line.name}</strong>
                    </div>
                    <small>{line.code} · {formatMoney(line.salePrice)}</small>
                  </div>
                  <div className="pos-quantity" aria-label={`Số lượng ${line.name}`}>
                    <button type="button" onClick={() => changeQuantity(line, -1)} aria-label="Giảm số lượng"><i className="ph ph-minus" /></button>
                    <span>{line.quantity}</span>
                    <button type="button" onClick={() => changeQuantity(line, 1)} disabled={line.itemType === 'product' && line.quantity >= Number(line.stockQuantity ?? 0)} aria-label="Tăng số lượng"><i className="ph ph-plus" /></button>
                  </div>
                  <div className="pos-line-staff">
                    <Select<number | string>
                      value={line.staffId ?? ''}
                      onChange={(staffId) => updateLineStaff(line, staffId === '' ? null : Number(staffId))}
                      aria-label={`Nhân viên cho ${line.name}`}
                      size="sm"
                      triggerClassName="pos-line-staff-trigger"
                      options={[{ value: '', label: '-- NV --' }, ...staffList.map((staff) => ({ value: staff.id, label: staff.name }))]}
                    />
                  </div>
                  <span className="pos-line-commission">{calculateExpectedCommission(line)}</span>
                  <strong className="pos-line-total">{formatMoney(line.salePrice * line.quantity)}</strong>
                  <button className="pos-remove-line" type="button" onClick={() => removeLine(line)} aria-label={`Xóa ${line.name}`}><i className="ph ph-trash" /></button>
                </article>)}
              </div>
            )}
          </div>

          <footer className="pos-bill-footer">
            <div className="pos-bill-note"><button type="button"><i className="ph ph-note-pencil" />Ghi chú</button><span>{activeInvoice.customer?.name ?? 'Chưa chọn khách hàng'}</span></div>
            <div className="pos-total-row"><span>Tổng thanh toán</span><strong>{formatMoney(subtotal)}</strong></div>
            <button className="pos-pay-button" type="button" disabled={!activeInvoice.lines.length} onClick={() => {
              if (!activeInvoice.customer) {
                notify('Cần chọn khách hàng', 'Vui lòng chọn hoặc thêm khách hàng trước khi thanh toán.');
                return;
              }
              setIsCheckoutOpen(true);
            }}><i className="ph ph-credit-card" aria-hidden="true" />Thanh toán {formatMoney(subtotal)}</button>
          </footer>
        </section>
      </div>}
      {isCheckoutOpen && (
        <PosCheckoutModal
          customer={activeInvoice.customer}
          lines={activeInvoice.lines}
          invoiceId={activeInvoice.serverInvoiceId}
          onClose={() => setIsCheckoutOpen(false)}
          onSuccess={handleCheckoutSuccess}
        />
      )}
      {receiptToPrint && (
        <PosReceiptPrint
          receipt={receiptToPrint}
          onClose={() => setReceiptToPrint(null)}
        />
      )}
      {isAddingCustomer && (
        <CustomerCreateDialog
          customMutationFn={createPosCustomer}
          onClose={() => setIsAddingCustomer(false)}
          onSuccess={(created) => {
            updateActive((invoice) => ({
              ...invoice,
              customerSearch: created.name,
              customer: { id: created.id, name: created.name, phone: created.phone },
            }));
          }}
        />
      )}
      <UsePackageModal
        isOpen={showPackageModal}
        packages={servicePackages}
        onClose={() => {
          setShowPackageModal(false);
          setServicePackages([]);
        }}
        onSelect={handlePackageServiceSelect}
      />
    </main>
  );
}

function CatalogSkeleton() {
  return <div className="pos-catalog-skeleton" aria-label="Đang tải danh mục">{Array.from({ length: 7 }, (_, index) => <span key={index} />)}</div>;
}

function timeFromLocalDateTime(value: string) {
  const parts = parseLocalDateTime(value);
  return parts ? `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}` : '--:--';
}

function minutesFromLocalDateTime(value: string) {
  const parts = parseLocalDateTime(value);
  return parts ? parts.hour * 60 + parts.minute : 0;
}

interface AppointmentItem {
  id: number;
  invoiceId: number | null;
  startsAt: string;
  endsAt: string;
  status: string;
  note?: string;
  customer: { id: number | null; name: string; phone?: string };
  staff: { id: number | null; name?: string | null };
  service: {
    id: number | null;
    name?: string | null;
    salePrice?: number;
    commissionType?: 'percent' | 'fixed' | null;
    commissionRate?: number;
  };
}

function PosCalendar() {
  const { account } = useAuth();
  const timeZone = account?.branchTimezone ?? DEFAULT_BRANCH_TIME_ZONE;
  const branchToday = localDateTimeFromInstant(new Date(), timeZone).slice(0, 10);
  const [weekStart, setWeekStart] = useState(() => startOfIsoWeek(branchToday));
  const [selection, setSelection] = useState<CalendarSelection | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentItem | null>(null);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addCalendarDays(weekStart, index)), [weekStart]);
  const dateFrom = days[0];
  const dateTo = days[6];
  const query = useQuery({ queryKey: ['pos-appointments', dateFrom, dateTo], queryFn: () => getPosAppointments(dateFrom, dateTo) });
  const appointments = (query.data?.data ?? []) as AppointmentItem[];
  const hours = Array.from({ length: CALENDAR_END_HOUR - CALENDAR_START_HOUR }, (_, index) => index + CALENDAR_START_HOUR);
  const rangeLabel = `${formatDateOnly(days[0], { day: '2-digit', month: '2-digit' })} - ${formatDateOnly(days[6], { day: '2-digit', month: '2-digit' })}`;
  const today = branchToday;

  useEffect(() => {
    setWeekStart(startOfIsoWeek(branchToday));
  }, [branchToday, timeZone]);

  return <section className="pos-calendar" aria-label="Lịch hẹn theo tuần">
    <header className="pos-calendar-toolbar">
      <div><h1>Lịch hẹn</h1><span>{appointments.length} lịch trong tuần</span></div>
      <div className="pos-calendar-nav">
        <button type="button" onClick={() => setWeekStart(startOfIsoWeek(branchToday))}>Hôm nay</button>
        <span className="pos-calendar-arrows"><button type="button" onClick={() => setWeekStart(addCalendarDays(weekStart, -7))} aria-label="Tuần trước"><i className="ph ph-caret-left" /></button><strong>{rangeLabel}</strong><button type="button" onClick={() => setWeekStart(addCalendarDays(weekStart, 7))} aria-label="Tuần sau"><i className="ph ph-caret-right" /></button></span>
      </div>
    </header>
    <div className="pos-calendar-scroll">
      <div className="pos-calendar-board">
        <div className="pos-calendar-days"><span />{days.map((day, index) => <div className={day === today ? 'is-today' : ''} key={day}><span>{['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'][index]}</span><strong>{parseIsoDate(day)?.day}</strong></div>)}</div>
        <div className="pos-calendar-grid">
          <div className="pos-time-rail">{hours.map((hour) => <time style={{ top: (hour - CALENDAR_START_HOUR) * SLOT_HEIGHT }} key={hour}>{String(hour).padStart(2, '0')}:00</time>)}</div>
          {days.map((day) => {
            const dayAppointments = appointments.filter((appointment) => localDateTimeFromInstant(appointment.startsAt, timeZone).slice(0, 10) === day);
            const appointmentLayout = layoutOverlappingAppointments(dayAppointments.map((appointment) => {
              const startsAt = localDateTimeFromInstant(appointment.startsAt, timeZone);
              const endsAt = localDateTimeFromInstant(appointment.endsAt, timeZone);
              return {
                item: appointment,
                start: minutesFromLocalDateTime(startsAt),
                end: minutesFromLocalDateTime(endsAt),
              };
            }));
            return <div className={`pos-calendar-column ${day === today ? 'is-today' : ''}`} title="Bấm vào khoảng trống để tạo lịch hẹn" onClick={(event) => {
              if ((event.target as HTMLElement).closest('.pos-appointment')) return;
              const bounds = event.currentTarget.getBoundingClientRect();
              const clickedMinutes = (event.clientY - bounds.top) / SLOT_HEIGHT * 60;
              const roundedMinutes = Math.round(clickedMinutes / 15) * 15;
              const maximumMinutes = (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * 60 - 30;
              const minutes = Math.max(0, Math.min(maximumMinutes, roundedMinutes));
              const startsAt = `${day}T${String(CALENDAR_START_HOUR + Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
              setEditingAppointment(null);
              setSelection({ startsAt, durationMinutes: 60 });
            }} key={day}>{appointmentLayout.map(({ item: appointment, start, end, column, columnCount }) => {
              const startsAt = localDateTimeFromInstant(appointment.startsAt, timeZone);
              const endsAt = localDateTimeFromInstant(appointment.endsAt, timeZone);
              const startMinutes = start - CALENDAR_START_HOUR * 60;
              const duration = Math.max(15, end - start);
              const columnWidth = 100 / columnCount;
              return <article
                className={`pos-appointment is-${appointment.status}`}
                style={{
                  top: startMinutes / 60 * SLOT_HEIGHT,
                  height: Math.max(40, duration / 60 * SLOT_HEIGHT - 4),
                  left: `calc(${column * columnWidth}% + 4px)`,
                  width: `calc(${columnWidth}% - 8px)`,
                  right: 'auto'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelection(null);
                  setEditingAppointment(appointment);
                }}
                key={appointment.id}
              >
                <div className="pos-appointment-header">
                  <time>{timeFromLocalDateTime(startsAt)} - {timeFromLocalDateTime(endsAt)}</time>
                  <span className="pos-app-badge" title="Đã có dịch vụ">$</span>
                </div>
                <strong className="pos-appointment-name">{appointment.customer.name}</strong>
                {duration >= 45 && (
                  <span className="pos-appointment-sub">
                    {appointment.service.name || appointment.note || (appointment.customer.phone ? appointment.customer.phone : '')}
                  </span>
                )}
              </article>;
            })}</div>;
          })}
          {selection && (() => {
            const selectionParts = parseLocalDateTime(selection.startsAt);
            const selectionDate = selectionParts
              ? `${selectionParts.year}-${String(selectionParts.month).padStart(2, '0')}-${String(selectionParts.day).padStart(2, '0')}`
              : '';
            const dayIndex = days.findIndex((day) => day === selectionDate);
            if (dayIndex < 0) return null;
            const startMinutes = minutesFromLocalDateTime(selection.startsAt) - CALENDAR_START_HOUR * 60;
            const endsAtMinutes = minutesFromLocalDateTime(selection.startsAt) + selection.durationMinutes;
            return <div className="pos-slot-selection" style={{ gridColumn: dayIndex + 2, top: startMinutes / 60 * SLOT_HEIGHT, height: Math.max(28, selection.durationMinutes / 60 * SLOT_HEIGHT - 3) }} aria-hidden="true">
              <strong>Lịch mới</strong><span>{timeFromLocalDateTime(selection.startsAt)} - {`${String(Math.floor(endsAtMinutes / 60) % 24).padStart(2, '0')}:${String(endsAtMinutes % 60).padStart(2, '0')}`}</span>
            </div>;
          })()}
        </div>
      </div>
      {query.isPending && <div className="pos-calendar-state">Đang tải lịch hẹn...</div>}
      {query.error && <div className="pos-calendar-state is-error"><ErrorState error={query.error} onRetry={() => query.refetch()} /></div>}
    </div>
    {(selection || editingAppointment) && (
      <AppointmentDrawer
        selection={selection}
        initialAppointment={editingAppointment}
        onSelectionChange={setSelection}
        onClose={() => {
          setSelection(null);
          setEditingAppointment(null);
        }}
        onSaved={() => {
          setSelection(null);
          setEditingAppointment(null);
          query.refetch();
        }}
      />
    )}
  </section>;
}

const APPOINTMENT_STATUS_OPTIONS = [
  { value: 'pending', label: 'Chờ xác nhận', dotClass: 'is-pending' },
  { value: 'confirmed', label: 'Chưa tới', dotClass: 'is-confirmed' },
  { value: 'waiting', label: 'Đang chờ', dotClass: 'is-waiting' },
  { value: 'in_service', label: 'Đang sử dụng', dotClass: 'is-in_service' },
  { value: 'completed', label: 'Đã xong', dotClass: 'is-completed' },
];

type AppointmentServiceLine = {
  lineId: string;
  appointmentId?: number;
  id: number;
  name: string;
  salePrice: number;
  staffId: number | null;
  commissionType?: 'percent' | 'fixed' | null;
  commissionRate?: number;
  fromPackageId?: number | null;
  packageName?: string;
  remainingUnits?: number;
};

function AppointmentDrawer({
  selection,
  initialAppointment,
  onSelectionChange,
  onClose,
  onSaved,
}: {
  selection: CalendarSelection | null;
  initialAppointment?: AppointmentItem | null;
  onSelectionChange: (selection: CalendarSelection) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = Boolean(initialAppointment);
  const { account } = useAuth();
  const timeZone = account?.branchTimezone ?? DEFAULT_BRANCH_TIME_ZONE;

  const initialStart = initialAppointment
    ? localDateTimeFromInstant(initialAppointment.startsAt, timeZone)
    : selection?.startsAt ?? localDateTimeFromInstant(new Date(), timeZone);
  const initialDuration = initialAppointment
    ? Math.max(15, Math.round((new Date(initialAppointment.endsAt).getTime() - new Date(initialAppointment.startsAt).getTime()) / 60_000))
    : selection?.durationMinutes ?? 60;

  const [customerSearch, setCustomerSearch] = useState(initialAppointment?.customer.name ?? '');
  const [customer, setCustomer] = useState<PosCustomer | null>(
    initialAppointment?.customer.id ? { id: initialAppointment.customer.id, name: initialAppointment.customer.name, phone: initialAppointment.customer.phone } : null,
  );
  const [customerOpen, setCustomerOpen] = useState(false);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);

  const [selectedServices, setSelectedServices] = useState<AppointmentServiceLine[]>(
    initialAppointment?.service.id ? [{
      lineId: `appointment-${initialAppointment.id}`,
      appointmentId: initialAppointment.id,
      id: initialAppointment.service.id,
      name: initialAppointment.service.name || 'Dịch vụ',
      salePrice: initialAppointment.service.salePrice || 0,
      staffId: initialAppointment.staff.id ?? null,
      commissionType: initialAppointment.service.commissionType ?? null,
      commissionRate: initialAppointment.service.commissionRate ?? 0,
    }] : [],
  );

  const [startsAt, setStartsAt] = useState(initialStart);
  const [duration, setDuration] = useState(initialDuration);
  const [status, setStatus] = useState(initialAppointment?.status ?? 'confirmed');

  const [note, setNote] = useState(initialAppointment?.note ?? '');
  const [isNoteOpen, setIsNoteOpen] = useState(Boolean(initialAppointment?.note));

  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [replaceServiceLineId, setReplaceServiceLineId] = useState<string | null>(null);
  const [serviceSearch, setServiceSearch] = useState('');

  const deferredCustomerSearch = useDeferredValue(customerSearch.trim());
  const deferredServiceSearch = useDeferredValue(serviceSearch.trim());
  const { notify } = useToast();
  const { subscribe } = useWebSocket();
  const [hasRemoteAppointmentChange, setHasRemoteAppointmentChange] = useState(false);

  useEffect(() => {
    if (!isEditing || !initialAppointment) return;
    return subscribe<{ appointmentId?: number; actorAccountId?: number | null }>('appointment:updated', (_event, data) => {
      if (Number(data.appointmentId) !== initialAppointment.id) return;
      if (data.actorAccountId && Number(data.actorAccountId) === account?.id) return;
      setHasRemoteAppointmentChange(true);
      notify(
        'Lịch hẹn vừa được cập nhật ở thiết bị khác',
        'Dữ liệu bạn đang nhập được giữ nguyên. Hãy đóng và mở lại lịch hẹn trước khi tiếp tục chỉnh sửa.',
      );
    });
  }, [account?.id, initialAppointment, isEditing, notify, subscribe]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isServiceModalOpen) setIsServiceModalOpen(false);
        else onClose();
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose, isServiceModalOpen]);

  const customers = useQuery({
    queryKey: ['pos-appointment-customers', deferredCustomerSearch],
    queryFn: () => searchPosCustomers(deferredCustomerSearch),
    enabled: customerOpen && deferredCustomerSearch.length >= 2,
  });

  const availablePackages = useQuery({
    queryKey: ['pos-customer-available-packages', customer?.id],
    queryFn: () => getPosCustomerAvailablePackages(customer!.id),
    enabled: Boolean(customer?.id),
  });

  const services = useQuery({
    queryKey: ['pos-appointment-services', deferredServiceSearch, customer?.id ?? null],
    queryFn: () => getPosCatalog(deferredServiceSearch, 'service', customer?.id),
    enabled: isServiceModalOpen || selectedServices.length === 0,
  });
  const staffQuery = useQuery({ queryKey: ['pos-staff'], queryFn: getPosStaff });
  const staffList = (staffQuery.data?.data ?? []) as Array<{ id: number; name: string; role: string }>;
  const groupedInvoice = useQuery({
    queryKey: ['pos-invoice', initialAppointment?.invoiceId],
    queryFn: () => getPosInvoice(initialAppointment!.invoiceId!),
    enabled: isEditing && Boolean(initialAppointment?.invoiceId),
  });

  useEffect(() => {
    if (hasRemoteAppointmentChange) return;
    const invoice = groupedInvoice.data?.data as any;
    if (!invoice?.items?.length) return;
    const serviceLines = invoice.items
      .filter((item: any) => item.itemType === 'service' && item.appointment)
      .map((item: any) => ({
        lineId: `appointment-${item.appointment.id}`,
        appointmentId: item.appointment.id,
        id: item.serviceId,
        name: item.name,
        salePrice: item.unitPrice,
        staffId: item.appointment.staff?.id ?? item.staffId ?? null,
        commissionType: item.commissionType ?? null,
        commissionRate: item.commissionRate ?? 0,
        // Preserve the redemption source when reopening an appointment.  It
        // must survive a later save so POS does not turn a package session
        // back into a normally charged service.
        fromPackageId: item.customerPackageId ?? null,
      }));
    if (serviceLines.length) setSelectedServices(serviceLines);
  }, [groupedInvoice.data, hasRemoteAppointmentChange]);

  const saveMutation = useMutation({
    mutationFn: async ({ services: nextServices, removedAppointmentIds }: { services: AppointmentServiceLine[]; removedAppointmentIds: number[] }) => {
      const startsAtIso = zonedLocalDateTimeToIso(startsAt, timeZone);
      if (!startsAtIso) throw new Error('Thời điểm bắt đầu không hợp lệ');
      const endsAtIso = new Date(new Date(startsAtIso).getTime() + duration * 60_000).toISOString();
      const existing = nextServices.filter((service) => service.appointmentId);
      const additions = nextServices.filter((service) => !service.appointmentId);
      if (isEditing) {
        await Promise.all(existing.map((service) => updatePosAppointment(service.appointmentId!, {
          customerId: customer!.id,
          serviceId: service.id,
          staffId: service.staffId,
          status: service.appointmentId === initialAppointment!.id ? status : undefined,
          note: service.appointmentId === initialAppointment!.id ? note : undefined,
          startsAt: service.appointmentId === initialAppointment!.id ? startsAtIso : undefined,
          endsAt: service.appointmentId === initialAppointment!.id
            ? endsAtIso
            : undefined,
        })));
        if (additions.length) {
          await createPosAppointment({
            invoiceId: initialAppointment!.invoiceId,
            customerId: customer!.id,
            startsAt: startsAtIso,
            endsAt: endsAtIso,
            status,
            note,
            items: additions.map((service) => ({
              serviceId: service.id,
              staffId: service.staffId,
              quantity: 1,
              usePackageId: service.fromPackageId ?? null,
              usePackageServiceId: service.fromPackageId ? service.id : null,
            })),
          });
        }
        await Promise.all(removedAppointmentIds.map((appointmentId) => updatePosAppointment(appointmentId, { status: 'cancelled' })));
        return;
      }
      await createPosAppointment({
        customerId: customer!.id,
        startsAt: startsAtIso,
        endsAt: endsAtIso,
        status,
        note,
        items: additions.map((service) => ({
          serviceId: service.id,
          staffId: service.staffId,
          quantity: 1,
          usePackageId: service.fromPackageId ?? null,
          usePackageServiceId: service.fromPackageId ? service.id : null,
        })),
      });
    },
    onSuccess: () => {
      notify(isEditing ? 'Đã cập nhật lịch hẹn' : 'Đã tạo lịch hẹn', isEditing ? 'Các dịch vụ trong hóa đơn đã được lưu.' : `${customer?.name ?? 'Khách hàng'} đã được thêm vào lịch.`);
      onSaved();
    },
  });

  const isPending = saveMutation.isPending;
  const dateTitle = formatDateOnly(startsAt.slice(0, 10), { weekday: 'long', day: '2-digit', month: '2-digit' });
  const timeTitle = timeFromLocalDateTime(startsAt);
  const addOrReplaceService = (service: Omit<AppointmentServiceLine, 'lineId' | 'appointmentId' | 'staffId'>) => {
    setSelectedServices((current) => {
      if (!replaceServiceLineId) {
        return [...current, { ...service, lineId: crypto.randomUUID(), staffId: null }];
      }
      return current.map((item) => item.lineId === replaceServiceLineId
        ? { ...service, lineId: item.lineId, appointmentId: item.appointmentId, staffId: item.staffId }
        : item);
    });
    setReplaceServiceLineId(null);
    setIsServiceModalOpen(false);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!customer) {
      notify('Chưa chọn khách hàng', 'Vui lòng tìm hoặc tạo khách hàng cho lịch hẹn.');
      return;
    }
    if (!isEditing && !selectedServices.length) {
        notify('Chưa chọn dịch vụ', 'Vui lòng chọn ít nhất một dịch vụ cho lịch hẹn.');
        return;
    }
    const loadedInvoiceItems = (groupedInvoice.data?.data as any)?.items as any[] | undefined;
    const originalAppointmentIds = (loadedInvoiceItems?.length ? loadedInvoiceItems : [])
      .filter((item: any) => item.itemType === 'service' && item.appointment)
      .map((item: any) => Number(item.appointment.id));
    if (!originalAppointmentIds.length && initialAppointment) originalAppointmentIds.push(initialAppointment.id);
    const remainingAppointmentIds = new Set(selectedServices.flatMap((service) => service.appointmentId ? [service.appointmentId] : []));
    saveMutation.mutate({
      services: selectedServices,
      removedAppointmentIds: originalAppointmentIds.filter((id: number) => !remainingAppointmentIds.has(id)),
    });
  };

  const catalogServices = (services.data?.data ?? []) as CatalogItem[];

  return (
    <div className="appointment-drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="appointment-drawer" role="dialog" aria-modal="true" aria-labelledby="kv-drawer-title">
        <form onSubmit={submit}>
          {/* Header */}
          <header className="kv-drawer-header">
            <div className="kv-drawer-title-wrap">
              <span className="kv-drawer-sub">Lịch hẹn</span>
              <DateTimePickerField
                id="kv-drawer-title"
                className="kv-drawer-time-btn"
                value={startsAt}
                onChange={(value) => {
                  setStartsAt(value);
                  onSelectionChange({ startsAt: value, durationMinutes: duration });
                }}
                title="Đổi ngày giờ lịch hẹn"
                timeZone={timeZone}
                aria-label={`${timeTitle}, ${dateTitle}`}
              />
              <Select<number>
                value={duration}
                onChange={(nextDuration) => {
                  setDuration(nextDuration);
                  onSelectionChange({ startsAt, durationMinutes: nextDuration });
                }}
                size="sm"
                aria-label="Thời lượng thực hiện"
                triggerClassName="kv-duration-select"
                options={[{ value: 15, label: '15 phút' }, { value: 30, label: '30 phút' }, { value: 45, label: '45 phút' }, { value: 60, label: '1 giờ' }, { value: 90, label: '1 giờ 30 phút' }, { value: 120, label: '2 giờ' }, { value: 180, label: '3 giờ' }]}
              />
            </div>

            <div className="kv-drawer-actions">
              <Select
                value={status}
                onChange={setStatus}
                options={APPOINTMENT_STATUS_OPTIONS}
                aria-label="Trạng thái lịch hẹn"
                align="right"
                size="sm"
                triggerClassName="kv-status-dropdown-btn"
                renderOption={(option) => (
                  <span className="kv-status-left">
                    <span className={`kv-status-dot is-${option.value}`} />
                    <span>{option.label}</span>
                  </span>
                )}
              />

              <button type="button" className="kv-drawer-close-btn" onClick={onClose} aria-label="Đóng">
                <i className="ph ph-x" aria-hidden="true" />
              </button>
            </div>
          </header>

          {/* Body */}
          <div className="kv-drawer-body">
            {/* Customer Search Bar */}
            <div className="kv-customer-search-box">
              {customer ? (
                <div className="kv-customer-input-wrap">
                  <span className="kv-customer-selected-tag">
                    <i className="ph ph-user-check" />
                    <span>{customer.name} {customer.phone ? `(${customer.phone})` : ''}</span>
                    <button
                      type="button"
                      title="Chọn khách hàng khác"
                      onClick={() => {
                        setCustomer(null);
                        setCustomerSearch('');
                        setSelectedServices([]);
                      }}
                    >
                      <i className="ph ph-x" />
                    </button>
                  </span>
                </div>
              ) : (
                <div className="kv-customer-input-wrap">
                  <i className="ph ph-magnifying-glass" aria-hidden="true" />
                  <input
                    value={customerSearch}
                    onFocus={() => setCustomerOpen(true)}
                    onChange={(event) => {
                      setCustomerSearch(event.target.value);
                      setCustomer(null);
                    }}
                    placeholder="Tìm theo mã, tên, SĐT khách hàng"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="kv-customer-add-btn"
                    aria-label="Thêm khách hàng mới"
                    onClick={() => setIsAddingCustomer(true)}
                    title="Tạo khách hàng mới"
                  >
                    <i className="ph ph-plus" aria-hidden="true" />
                  </button>
                </div>
              )}

              {customerOpen && deferredCustomerSearch.length >= 2 && !customer && (
                <div className="kv-customer-dropdown">
                  {customers.isPending ? (
                    <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>Đang tìm kiếm...</div>
                  ) : !customers.data?.data.length ? (
                    <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>Không tìm thấy khách hàng</div>
                  ) : (
                    customers.data.data.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setCustomer({ id: item.id, name: item.name, phone: item.phone });
                          setCustomerSearch(item.name);
                          setCustomerOpen(false);
                        }}
                      >
                        <span className="kv-customer-avatar">{String(item.name).trim().charAt(0).toUpperCase()}</span>
                        <div className="kv-customer-info">
                          <strong>{item.name}</strong>
                          <small>{item.phone || item.code}</small>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Thẻ thông báo gói dịch vụ khả dụng của khách hàng */}
            {customer && availablePackages.data?.data && availablePackages.data.data.length > 0 && selectedServices.length === 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '12px',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="ph ph-gift" style={{ color: '#059669', fontSize: '18px' }} />
                  <div>
                    <strong style={{ display: 'block', color: '#065f46', fontSize: '12.5px' }}>
                      Khách có {availablePackages.data.data.length} gói dịch vụ còn lượt
                    </strong>
                    <small style={{ color: '#047857' }}>Có thể chọn dùng buổi trong gói</small>
                  </div>
                </div>
                <button
                  type="button"
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: '#10b981',
                    color: '#fff',
                    border: 0,
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                  onClick={() => { setReplaceServiceLineId(null); setIsServiceModalOpen(true); }}
                >
                  Chọn gói
                </button>
              </div>
            )}

            {/* Services List / Empty State */}
            <div className="kv-services-card-area">
              {selectedServices.length === 0 ? (
                <div className="kv-empty-services">
                  <div className="kv-empty-illustration">
                    <i className="ph ph-receipt" />
                  </div>
                  <span className="kv-empty-text">Chưa có dịch vụ, sản phẩm</span>
                  <button
                    type="button"
                    className="kv-add-service-btn"
                    onClick={() => { setReplaceServiceLineId(null); setIsServiceModalOpen(true); }}
                  >
                    Thêm dịch vụ, sản phẩm
                  </button>
                </div>
              ) : (
                <div className="kv-selected-services-list">
                  {selectedServices.map((service) => {
                    const commission = !service.staffId || !service.commissionType || !service.commissionRate
                      ? 0
                      : Math.round(service.commissionType === 'percent'
                        ? service.salePrice * service.commissionRate
                        : service.commissionRate);
                    return (
                      <div key={service.lineId} className="kv-service-row">
                        <div className="kv-service-row-main">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {service.fromPackageId && <span className="kv-package-badge">Trừ gói</span>}
                            <span className="kv-service-title">{service.name}</span>
                          </div>
                          {service.packageName && (
                            <small style={{ color: '#047857', fontWeight: 600, fontSize: '11.5px' }}>
                              Gói: {service.packageName} (Còn {service.remainingUnits} buổi)
                            </small>
                          )}
                          <div className="kv-service-meta">
                            <span className="kv-service-price">
                              {service.fromPackageId ? '0đ (Theo gói)' : formatMoney(service.salePrice)}
                            </span>
                            <span>{duration} phút</span>
                          </div>
                          <button
                            type="button"
                            className="kv-service-change-btn"
                            onClick={() => {
                              setReplaceServiceLineId(service.lineId);
                              setIsServiceModalOpen(true);
                            }}
                          >
                            Đổi dịch vụ
                          </button>
                          <div className="kv-service-assignment">
                            <Select<number | string>
                              aria-label={`Nhân viên thực hiện ${service.name}`}
                              value={service.staffId ?? ''}
                              onChange={(staffId) => setSelectedServices((current) => current.map((item) => (
                                item.lineId === service.lineId ? { ...item, staffId: staffId === '' ? null : Number(staffId) } : item
                              )))}
                              size="sm"
                              triggerClassName="kv-service-assignment-trigger"
                              options={[{ value: '', label: 'Chưa phân công' }, ...staffList.map((staff) => ({ value: staff.id, label: staff.name }))]}
                            />
                            <span className="kv-service-commission">Hoa hồng: <strong>{formatMoney(commission)}</strong></span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="kv-service-remove-btn"
                          onClick={() => setSelectedServices((current) => current.filter((item) => item.lineId !== service.lineId))}
                          title="Xóa dịch vụ"
                        >
                          <i className="ph ph-trash" />
                        </button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    className="kv-add-service-btn"
                    style={{ alignSelf: 'flex-start', fontSize: '12.5px', padding: '6px 14px' }}
                    onClick={() => { setReplaceServiceLineId(null); setIsServiceModalOpen(true); }}
                  >
                    Thêm dịch vụ
                  </button>
                </div>
              )}
            </div>

            {/* Ghi chú */}
            <div className="kv-note-box">
              <button
                type="button"
                className="kv-note-toggle-btn"
                onClick={() => setIsNoteOpen((prev) => !prev)}
              >
                <i className="ph ph-pencil-simple" aria-hidden="true" />
                <span>Ghi chú lịch hẹn {note ? '(Có nội dung)' : ''}</span>
              </button>

              {isNoteOpen && (
                <textarea
                  className="kv-note-textarea"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Nhập ghi chú hoặc yêu cầu của khách hàng..."
                  rows={3}
                />
              )}
            </div>

            {saveMutation.error && (
              <div style={{ padding: '10px 12px', borderRadius: '10px', background: '#fee2e2', color: '#dc2626', fontSize: '12px' }}>
                <i className="ph ph-warning-circle" style={{ marginRight: '6px' }} />
                {saveMutation.error?.message || 'Có lỗi xảy ra khi lưu lịch hẹn'}
              </div>
            )}
          </div>

          {/* Footer - No human icon per user request */}
          <footer className="kv-drawer-footer">
            <button
              type="submit"
              className="kv-save-btn"
              disabled={!customer || isPending}
            >
              {isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </footer>
        </form>

        {/* Modal chọn Dịch vụ / Sản phẩm */}
        {isServiceModalOpen && (
          <div className="kv-service-picker-modal">
            <header className="kv-service-picker-header">
              <h3>Chọn dịch vụ, sản phẩm</h3>
              <button type="button" className="kv-drawer-close-btn" onClick={() => setIsServiceModalOpen(false)}>
                <i className="ph ph-x" />
              </button>
            </header>
            <div className="kv-service-picker-search">
              <input
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                placeholder="Tìm dịch vụ theo tên hoặc mã..."
                autoFocus
              />
            </div>
            <div className="kv-service-picker-list">
              {/* Phần Gói dịch vụ của khách hàng (nếu có) */}
              {customer && availablePackages.data?.data && availablePackages.data.data.length > 0 && (
                <div className="kv-package-section">
                  <div className="kv-package-section-title">
                    <i className="ph ph-gift" />
                    <span>Gói dịch vụ của khách ({availablePackages.data.data.length} gói khả dụng)</span>
                  </div>
                  {availablePackages.data.data.map((pkg) => (
                    <button
                      type="button"
                      key={`pkg-${pkg.customerPackageId}-${pkg.service.id}`}
                      className="kv-package-card-item"
                      onClick={() => {
                        addOrReplaceService({
                          id: pkg.service.id,
                          name: pkg.service.name,
                          salePrice: 0,
                          commissionType: null,
                          commissionRate: 0,
                          fromPackageId: pkg.customerPackageId,
                          packageName: pkg.packageName,
                          remainingUnits: pkg.remainingUnits,
                        });
                      }}
                    >
                      <div>
                        <span className="kv-package-badge">Gói của khách</span>
                        <strong style={{ display: 'block', color: '#065f46', fontSize: '13.5px' }}>{pkg.service.name}</strong>
                        <small style={{ color: '#047857' }}>
                          Gói: {pkg.packageName} · {pkg.packageCode}
                        </small>
                      </div>
                      <span className="kv-package-remaining">Còn {pkg.remainingUnits}/{pkg.totalUnits} buổi</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Bảng giá dịch vụ thông thường */}
              {customer && availablePackages.data?.data && availablePackages.data.data.length > 0 && (
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', padding: '4px 4px 2px' }}>
                  Bảng giá dịch vụ salon
                </div>
              )}

              {services.isPending ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Đang tải danh sách dịch vụ...</div>
              ) : !catalogServices.length ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Không có dịch vụ nào phù hợp</div>
              ) : (
                catalogServices.map((svc) => (
                  <button
                    type="button"
                    key={svc.itemId}
                    className="kv-service-picker-item"
                    onClick={() => {
                      addOrReplaceService({
                        id: svc.itemId,
                        name: svc.name,
                        salePrice: svc.salePrice,
                        commissionType: svc.commissionType,
                        commissionRate: svc.commissionRate,
                        fromPackageId: null,
                      });
                    }}
                  >
                    <div>
                      <strong style={{ display: 'block', color: '#1e293b', fontSize: '13.5px' }}>{svc.name}</strong>
                      <small style={{ color: '#64748b' }}>{svc.code} · {svc.category || 'Dịch vụ'}</small>
                    </div>
                    <span style={{ color: '#059669', fontWeight: 700, fontSize: '13.5px' }}>{formatMoney(svc.salePrice)}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </aside>

      {isAddingCustomer && (
        <CustomerCreateDialog
          customMutationFn={createPosCustomer}
          onClose={() => setIsAddingCustomer(false)}
          onSuccess={(created) => {
            setCustomer({ id: created.id, name: created.name, phone: created.phone });
            setCustomerSearch(created.name);
            setCustomerOpen(false);
          }}
        />
      )}
    </div>
  );
}
