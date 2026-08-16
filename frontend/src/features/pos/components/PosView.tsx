import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ErrorState } from '@/components/data-display/DataState';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatMoney } from '@/lib/format';
import { createPosAppointment, updatePosAppointment, createPosCustomer, getPosAppointments, getPosCatalog, getPosStaff, searchPosCustomers, getPosCustomerAvailablePackages, type PosReceiptData } from '../pos.api';
import { layoutOverlappingAppointments } from '../calendar-layout';
import { CustomerCreateDialog } from '@/features/operations/components/CustomerCreateDialog';
import { PosCheckoutModal } from './PosCheckoutModal';
import { PosReceiptPrint } from './PosReceiptPrint';
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
}

interface PosLine extends CatalogItem { quantity: number }

interface PosCustomer {
  id: number;
  name: string;
  phone?: string;
}

interface InvoiceDraft {
  id: number;
  name: string;
  customerSearch: string;
  customer: PosCustomer | null;
  lines: PosLine[];
}

interface CalendarSelection {
  startsAt: Date;
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
    queryKey: ['pos-catalog', deferredCatalogSearch, catalogFilter],
    queryFn: () => getPosCatalog(deferredCatalogSearch, catalogFilter),
  });

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
      if (!current) return { ...invoice, lines: [...invoice.lines, { ...item, quantity: 1 }] };
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

  const removeLine = (line: PosLine) => updateActive((invoice) => ({
    ...invoice,
    lines: invoice.lines.filter((current) => !(current.itemId === line.itemId && current.itemType === line.itemType)),
  }));

  const handleCheckoutSuccess = (receipt: PosReceiptData, shouldPrint: boolean) => {
    setIsCheckoutOpen(false);
    notify('Thanh toán thành công', `Hóa đơn ${receipt.code} với số tiền ${formatMoney(receipt.total)} đã được ghi nhận.`);

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
                  {customers.isPending ? <div className="pos-customer-message">Đang tìm khách hàng...</div> : !customers.data?.data.length ? <div className="pos-customer-message">Không tìm thấy khách hàng</div> : customers.data.data.map((customer) => <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { updateActive((invoice) => ({ ...invoice, customerSearch: customer.name, customer: { id: customer.id, name: customer.name, phone: customer.phone } })); setCustomerOpen(false); }} key={customer.id}><span className="pos-customer-avatar">{String(customer.name).trim().charAt(0).toUpperCase()}</span><span><strong>{customer.name}</strong><small>{customer.phone || customer.code}</small></span></button>)}
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
                  <div className="pos-line-copy"><strong>{line.name}</strong><small>{line.code} · {formatMoney(line.salePrice)}</small></div>
                  <div className="pos-quantity" aria-label={`Số lượng ${line.name}`}>
                    <button type="button" onClick={() => changeQuantity(line, -1)} aria-label="Giảm số lượng"><i className="ph ph-minus" /></button>
                    <span>{line.quantity}</span>
                    <button type="button" onClick={() => changeQuantity(line, 1)} disabled={line.itemType === 'product' && line.quantity >= Number(line.stockQuantity ?? 0)} aria-label="Tăng số lượng"><i className="ph ph-plus" /></button>
                  </div>
                  <strong className="pos-line-total">{formatMoney(line.salePrice * line.quantity)}</strong>
                  <button className="pos-remove-line" type="button" onClick={() => removeLine(line)} aria-label={`Xóa ${line.name}`}><i className="ph ph-trash" /></button>
                </article>)}
              </div>
            )}
          </div>

          <footer className="pos-bill-footer">
            <div className="pos-bill-note"><button type="button"><i className="ph ph-note-pencil" />Ghi chú</button><span>{activeInvoice.customer?.name ?? 'Khách lẻ'}</span></div>
            <div className="pos-total-row"><span>Tổng thanh toán</span><strong>{formatMoney(subtotal)}</strong></div>
            <button className="pos-pay-button" type="button" disabled={!activeInvoice.lines.length} onClick={() => setIsCheckoutOpen(true)}><i className="ph ph-credit-card" aria-hidden="true" />Thanh toán {formatMoney(subtotal)}</button>
          </footer>
        </section>
      </div>}
      {isCheckoutOpen && (
        <PosCheckoutModal
          customer={activeInvoice.customer}
          lines={activeInvoice.lines}
          staffList={staffList}
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
    </main>
  );
}

function CatalogSkeleton() {
  return <div className="pos-catalog-skeleton" aria-label="Đang tải danh mục">{Array.from({ length: 7 }, (_, index) => <span key={index} />)}</div>;
}

function toIsoDate(date: Date) {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function isSameDay(first: Date, second: Date) {
  return first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate();
}

interface AppointmentItem {
  id: number;
  startsAt: string;
  endsAt: string;
  status: string;
  note?: string;
  customer: { id: number | null; name: string; phone?: string };
  staff: { id: number | null; name?: string | null };
  service: { id: number | null; name?: string | null; salePrice?: number };
}

function PosCalendar() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selection, setSelection] = useState<CalendarSelection | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentItem | null>(null);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const dateFrom = toIsoDate(days[0]);
  const dateTo = toIsoDate(days[6]);
  const query = useQuery({ queryKey: ['pos-appointments', dateFrom, dateTo], queryFn: () => getPosAppointments(dateFrom, dateTo) });
  const appointments = (query.data?.data ?? []) as AppointmentItem[];
  const hours = Array.from({ length: CALENDAR_END_HOUR - CALENDAR_START_HOUR }, (_, index) => index + CALENDAR_START_HOUR);
  const rangeLabel = `${days[0].toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} - ${days[6].toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`;
  const today = toIsoDate(new Date());

  return <section className="pos-calendar" aria-label="Lịch hẹn theo tuần">
    <header className="pos-calendar-toolbar">
      <div><h1>Lịch hẹn</h1><span>{appointments.length} lịch trong tuần</span></div>
      <div className="pos-calendar-nav">
        <button type="button" onClick={() => setWeekStart(startOfWeek(new Date()))}>Hôm nay</button>
        <span className="pos-calendar-arrows"><button type="button" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Tuần trước"><i className="ph ph-caret-left" /></button><strong>{rangeLabel}</strong><button type="button" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Tuần sau"><i className="ph ph-caret-right" /></button></span>
      </div>
    </header>
    <div className="pos-calendar-scroll">
      <div className="pos-calendar-board">
        <div className="pos-calendar-days"><span />{days.map((day, index) => <div className={toIsoDate(day) === today ? 'is-today' : ''} key={toIsoDate(day)}><span>{['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'][index]}</span><strong>{day.getDate()}</strong></div>)}</div>
        <div className="pos-calendar-grid">
          <div className="pos-time-rail">{hours.map((hour) => <time style={{ top: (hour - CALENDAR_START_HOUR) * SLOT_HEIGHT }} key={hour}>{String(hour).padStart(2, '0')}:00</time>)}</div>
          {days.map((day) => {
            const dayAppointments = appointments.filter((appointment) => toIsoDate(new Date(appointment.startsAt)) === toIsoDate(day));
            const appointmentLayout = layoutOverlappingAppointments(dayAppointments.map((appointment) => {
              const startsAt = new Date(appointment.startsAt);
              const endsAt = new Date(appointment.endsAt);
              return {
                item: appointment,
                start: startsAt.getHours() * 60 + startsAt.getMinutes(),
                end: endsAt.getHours() * 60 + endsAt.getMinutes(),
              };
            }));
            return <div className={`pos-calendar-column ${toIsoDate(day) === today ? 'is-today' : ''}`} title="Bấm vào khoảng trống để tạo lịch hẹn" onClick={(event) => {
              if ((event.target as HTMLElement).closest('.pos-appointment')) return;
              const bounds = event.currentTarget.getBoundingClientRect();
              const clickedMinutes = (event.clientY - bounds.top) / SLOT_HEIGHT * 60;
              const roundedMinutes = Math.round(clickedMinutes / 15) * 15;
              const maximumMinutes = (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * 60 - 30;
              const minutes = Math.max(0, Math.min(maximumMinutes, roundedMinutes));
              const startsAt = new Date(day);
              startsAt.setHours(CALENDAR_START_HOUR + Math.floor(minutes / 60), minutes % 60, 0, 0);
              setEditingAppointment(null);
              setSelection({ startsAt, durationMinutes: 60 });
            }} key={toIsoDate(day)}>{appointmentLayout.map(({ item: appointment, start, end, column, columnCount }) => {
              const startsAt = new Date(appointment.startsAt);
              const endsAt = new Date(appointment.endsAt);
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
                  <time>{startsAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })} - {endsAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })}</time>
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
            const dayIndex = days.findIndex((day) => isSameDay(selection.startsAt, day));
            if (dayIndex < 0) return null;
            const startMinutes = (selection.startsAt.getHours() - CALENDAR_START_HOUR) * 60 + selection.startsAt.getMinutes();
            const endsAt = new Date(selection.startsAt.getTime() + selection.durationMinutes * 60_000);
            return <div className="pos-slot-selection" style={{ gridColumn: dayIndex + 2, top: startMinutes / 60 * SLOT_HEIGHT, height: Math.max(28, selection.durationMinutes / 60 * SLOT_HEIGHT - 3) }} aria-hidden="true">
              <strong>Lịch mới</strong><span>{selection.startsAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })} - {endsAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
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

function toDateTimeLocal(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

const APPOINTMENT_STATUS_OPTIONS = [
  { value: 'pending', label: 'Chờ xác nhận', dotClass: 'is-pending' },
  { value: 'confirmed', label: 'Chưa tới', dotClass: 'is-confirmed' },
  { value: 'waiting', label: 'Đang chờ', dotClass: 'is-waiting' },
  { value: 'in_service', label: 'Đang sử dụng', dotClass: 'is-in_service' },
  { value: 'completed', label: 'Đã xong', dotClass: 'is-completed' },
];

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

  const initialStart = initialAppointment ? new Date(initialAppointment.startsAt) : selection ? selection.startsAt : new Date();
  const initialDuration = initialAppointment
    ? Math.max(15, Math.round((new Date(initialAppointment.endsAt).getTime() - new Date(initialAppointment.startsAt).getTime()) / 60_000))
    : selection?.durationMinutes ?? 60;

  const [customerSearch, setCustomerSearch] = useState(initialAppointment?.customer.name ?? '');
  const [customer, setCustomer] = useState<PosCustomer | null>(
    initialAppointment?.customer.id ? { id: initialAppointment.customer.id, name: initialAppointment.customer.name, phone: initialAppointment.customer.phone } : null,
  );
  const [customerOpen, setCustomerOpen] = useState(false);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);

  const [selectedService, setSelectedService] = useState<{
    id: number;
    name: string;
    salePrice: number;
    fromPackageId?: number | null;
    packageName?: string;
    remainingUnits?: number;
  } | null>(
    initialAppointment?.service.id ? { id: initialAppointment.service.id, name: initialAppointment.service.name || 'Dịch vụ', salePrice: initialAppointment.service.salePrice || 0 } : null,
  );

  const [startsAt, setStartsAt] = useState(toDateTimeLocal(initialStart));
  const [duration, setDuration] = useState(initialDuration);
  const [status, setStatus] = useState(initialAppointment?.status ?? 'confirmed');
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  const [note, setNote] = useState(initialAppointment?.note ?? '');
  const [isNoteOpen, setIsNoteOpen] = useState(Boolean(initialAppointment?.note));

  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');

  const deferredCustomerSearch = useDeferredValue(customerSearch.trim());
  const deferredServiceSearch = useDeferredValue(serviceSearch.trim());
  const { notify } = useToast();

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isTimeModalOpen) setIsTimeModalOpen(false);
        else if (isServiceModalOpen) setIsServiceModalOpen(false);
        else if (statusMenuOpen) setStatusMenuOpen(false);
        else onClose();
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose, isTimeModalOpen, isServiceModalOpen, statusMenuOpen]);

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
    queryKey: ['pos-appointment-services', deferredServiceSearch],
    queryFn: () => getPosCatalog(deferredServiceSearch, 'service'),
    enabled: isServiceModalOpen || !selectedService,
  });

  const createMutation = useMutation({
    mutationFn: createPosAppointment,
    onSuccess: () => {
      notify('Đã tạo lịch hẹn', `${customer?.name ?? 'Khách hàng'} đã được thêm vào lịch.`);
      onSaved();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (body: any) => updatePosAppointment(initialAppointment!.id, body),
    onSuccess: () => {
      notify('Đã cập nhật lịch hẹn', `Thông tin lịch hẹn đã được lưu.`);
      onSaved();
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const currentStart = new Date(startsAt);
  const dateTitle = currentStart.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' });
  const timeTitle = currentStart.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  const currentStatusObj = APPOINTMENT_STATUS_OPTIONS.find((opt) => opt.value === status) ?? APPOINTMENT_STATUS_OPTIONS[1];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!customer) {
      notify('Chưa chọn khách hàng', 'Vui lòng tìm hoặc tạo khách hàng cho lịch hẹn.');
      return;
    }
    const start = new Date(startsAt);
    const end = new Date(start.getTime() + duration * 60_000);

    const payload = {
      customerId: customer.id,
      serviceId: selectedService ? selectedService.id : (initialAppointment?.service.id ?? null),
      staffId: null,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      status,
      note,
    };

    if (isEditing) {
      updateMutation.mutate(payload);
    } else {
      if (!selectedService) {
        notify('Chưa chọn dịch vụ', 'Vui lòng chọn ít nhất một dịch vụ cho lịch hẹn.');
        return;
      }
      createMutation.mutate(payload);
    }
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
              <button
                type="button"
                className="kv-drawer-time-btn"
                onClick={() => setIsTimeModalOpen(true)}
                title="Bấm để đổi ngày giờ & thời lượng"
              >
                <span id="kv-drawer-title">{timeTitle}, {dateTitle}</span>
                <i className="ph ph-pencil-simple" aria-hidden="true" />
              </button>
            </div>

            <div className="kv-drawer-actions">
              <button
                type="button"
                className="kv-status-dropdown-btn"
                onClick={() => setStatusMenuOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={statusMenuOpen}
              >
                <span>{currentStatusObj.label}</span>
                <i className="ph ph-caret-down" aria-hidden="true" />
              </button>

              {statusMenuOpen && (
                <div className="kv-status-menu" role="menu">
                  {APPOINTMENT_STATUS_OPTIONS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={`kv-status-item ${status === item.value ? 'is-selected' : ''}`}
                      onClick={() => {
                        setStatus(item.value);
                        setStatusMenuOpen(false);
                      }}
                    >
                      <span className="kv-status-left">
                        <span className={`kv-status-dot ${item.dotClass}`} />
                        <span>{item.label}</span>
                      </span>
                      {status === item.value && <i className="ph ph-check kv-status-check" aria-hidden="true" />}
                    </button>
                  ))}
                </div>
              )}

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
                        setSelectedService(null);
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
            {customer && availablePackages.data?.data && availablePackages.data.data.length > 0 && !selectedService && (
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
                  onClick={() => setIsServiceModalOpen(true)}
                >
                  Chọn gói
                </button>
              </div>
            )}

            {/* Services List / Empty State */}
            <div className="kv-services-card-area">
              {!selectedService ? (
                <div className="kv-empty-services">
                  <div className="kv-empty-illustration">
                    <i className="ph ph-receipt" />
                  </div>
                  <span className="kv-empty-text">Chưa có dịch vụ, sản phẩm</span>
                  <button
                    type="button"
                    className="kv-add-service-btn"
                    onClick={() => setIsServiceModalOpen(true)}
                  >
                    Thêm dịch vụ, sản phẩm
                  </button>
                </div>
              ) : (
                <div className="kv-selected-services-list">
                  <div className="kv-service-row">
                    <div className="kv-service-row-main">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {selectedService.fromPackageId && (
                          <span className="kv-package-badge">Trừ gói</span>
                        )}
                        <span className="kv-service-title">{selectedService.name}</span>
                      </div>
                      {selectedService.packageName && (
                        <small style={{ color: '#047857', fontWeight: 600, fontSize: '11.5px' }}>
                          Gói: {selectedService.packageName} (Còn {selectedService.remainingUnits} buổi)
                        </small>
                      )}
                      <div className="kv-service-meta">
                        <span className="kv-service-price">
                          {selectedService.fromPackageId ? '0 ₫ (Theo gói)' : formatMoney(selectedService.salePrice)}
                        </span>
                        <span>{duration} phút</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="kv-service-remove-btn"
                      onClick={() => setSelectedService(null)}
                      title="Xóa dịch vụ"
                    >
                      <i className="ph ph-trash" />
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="kv-add-service-btn"
                      style={{ fontSize: '12.5px', padding: '6px 14px' }}
                      onClick={() => setIsServiceModalOpen(true)}
                    >
                      Đổi dịch vụ
                    </button>
                  </div>
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

            {(createMutation.error || updateMutation.error) && (
              <div style={{ padding: '10px 12px', borderRadius: '10px', background: '#fee2e2', color: '#dc2626', fontSize: '12px' }}>
                <i className="ph ph-warning-circle" style={{ marginRight: '6px' }} />
                {(createMutation.error || updateMutation.error)?.message || 'Có lỗi xảy ra khi lưu lịch hẹn'}
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

        {/* Modal chọn thời gian & thời lượng */}
        {isTimeModalOpen && (
          <div className="kv-time-picker-modal">
            <header className="kv-time-picker-header">
              <h3>Thời gian lịch hẹn</h3>
              <button type="button" className="kv-drawer-close-btn" onClick={() => setIsTimeModalOpen(false)}>
                <i className="ph ph-x" />
              </button>
            </header>
            <div className="kv-time-picker-body">
              <div className="kv-time-form-group">
                <label>Thời điểm bắt đầu</label>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStartsAt(val);
                    const d = new Date(val);
                    if (!Number.isNaN(d.getTime())) {
                      onSelectionChange({ startsAt: d, durationMinutes: duration });
                    }
                  }}
                />
              </div>

              <div className="kv-time-form-group">
                <label>Thời lượng thực hiện</label>
                <select
                  value={duration}
                  onChange={(e) => {
                    const num = Number(e.target.value);
                    setDuration(num);
                    onSelectionChange({ startsAt: new Date(startsAt), durationMinutes: num });
                  }}
                >
                  <option value={15}>15 phút</option>
                  <option value={30}>30 phút</option>
                  <option value={45}>45 phút</option>
                  <option value={60}>1 giờ (60 phút)</option>
                  <option value={90}>1 giờ 30 phút</option>
                  <option value={120}>2 giờ</option>
                  <option value={180}>3 giờ</option>
                </select>
              </div>

              <button
                type="button"
                className="kv-save-btn"
                style={{ marginTop: 'auto' }}
                onClick={() => setIsTimeModalOpen(false)}
              >
                Xác nhận
              </button>
            </div>
          </div>
        )}

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
                        setSelectedService({
                          id: pkg.service.id,
                          name: pkg.service.name,
                          salePrice: 0,
                          fromPackageId: pkg.customerPackageId,
                          packageName: pkg.packageName,
                          remainingUnits: pkg.remainingUnits,
                        });
                        setIsServiceModalOpen(false);
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
                      setSelectedService({
                        id: svc.itemId,
                        name: svc.name,
                        salePrice: svc.salePrice,
                        fromPackageId: null,
                      });
                      setIsServiceModalOpen(false);
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
