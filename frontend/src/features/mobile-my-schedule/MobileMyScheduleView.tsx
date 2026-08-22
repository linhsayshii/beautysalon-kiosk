import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { getPosAppointments } from '@/features/pos/pos.api';
import { getOrders } from '@/features/operations/operations.api';
import './mobile-my-schedule.css';

interface ScheduleItem {
  type: 'appointment' | 'invoice';
  id: number;
  time: string;
  customer: string;
  status: string;
  // appointment fields
  service?: string;
  invoiceId?: number;
  // invoice fields
  items?: Array<{ name: string; quantity: number }>;
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch {
    return '--:--';
  }
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Chờ phục vụ',
  waiting: 'Đang chờ',
  in_service: 'Đang làm',
  completed: 'Đã xong',
  cancelled: 'Đã hủy',
  no_show: 'Không đến',
};

export function Component() {
  return <MobileMyScheduleView />;
}

export default Component;

export function MobileMyScheduleView() {
  const { account } = useAuth();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(() => toIsoDate(new Date()));
  const dateFrom = selectedDate;
  const dateTo = selectedDate;

  const appointmentsQuery = useQuery({
    queryKey: ['pos-appointments', dateFrom, dateTo],
    queryFn: () => getPosAppointments(dateFrom, dateTo),
    enabled: !!account?.staffId,
  });

  const draftsQuery = useQuery({
    queryKey: ['orders-drafts', dateFrom, dateTo, account?.staffId],
    queryFn: () => getOrders({
      status: 'draft',
      staffId: account?.staffId ?? undefined,
      dateFrom,
      dateTo,
    }),
    enabled: !!account?.staffId,
  });

  const items = useMemo((): ScheduleItem[] => {
    const aptItems: ScheduleItem[] = (appointmentsQuery.data?.data ?? [])
      .filter((apt: any) => String(apt.staff?.id) === String(account?.staffId))
      .map((apt: any) => ({
        type: 'appointment' as const,
        id: apt.id,
        time: apt.startsAt,
        customer: apt.customer?.name || 'Khách vãng lai',
        service: apt.service?.name,
        status: apt.status,
        invoiceId: apt.invoiceId,
      }));

    const draftItems: ScheduleItem[] = (draftsQuery.data?.data ?? []).map((inv: any) => ({
      type: 'invoice' as const,
      id: inv.id,
      time: inv.issuedAt,
      customer: inv.customer?.name || 'Khách vãng lai',
      items: inv.items?.map((item: any) => ({ name: item.name, quantity: item.quantity })),
      status: 'draft',
    }));

    return [...aptItems, ...draftItems].sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
    );
  }, [appointmentsQuery.data, draftsQuery.data, account?.staffId]);

  const isLoading = appointmentsQuery.isLoading || draftsQuery.isLoading;
  const error = appointmentsQuery.error || draftsQuery.error;

  return (
    <div className="mobile-my-schedule-view">
      {/* Sticky Header */}
      <div className="mobile-my-schedule-header">
        <h1 className="mobile-my-schedule-title">Lịch của tôi</h1>
        <div className="mobile-my-schedule-date-wrap">
          <input
            type="date"
            className="mobile-my-schedule-date-input"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            aria-label="Chọn ngày"
          />
          <div className="mobile-my-schedule-date-chip">
            <i className="ph ph-calendar" />
            <span>{selectedDate.split('-').reverse().slice(0, 2).join('/')}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mobile-my-schedule-body">
        {isLoading && (
          <div className="mobile-my-schedule-loading">Đang tải...</div>
        )}
        {error && (
          <div className="mobile-my-schedule-error">Không tải được lịch</div>
        )}
        {!isLoading && !error && items.length === 0 && (
          <div className="mobile-my-schedule-empty">
            <div className="mobile-my-schedule-empty-icon">
              <i className="ph ph-calendar-blank" />
            </div>
            <p className="mobile-my-schedule-empty-msg">Không có lịch hẹn nào hôm nay</p>
          </div>
        )}
        {!isLoading && !error && items.length > 0 && (
          <div className="mobile-my-schedule-list">
            {items.map((item) => {
              const time = formatTime(item.time);
              const statusLabel = STATUS_LABELS[item.status] || item.status;

              if (item.type === 'appointment') {
                return (
                  <div key={`apt-${item.id}`} className="my-schedule-item appointment">
                    <div className="my-schedule-item-icon">📅</div>
                    <div className="my-schedule-item-content">
                      <div className="my-schedule-item-top-row">
                        <span className="my-schedule-item-time">{time}</span>
                        <span className="my-schedule-status-badge">{statusLabel}</span>
                      </div>
                      <div className="my-schedule-item-customer">{item.customer}</div>
                      {item.service && (
                        <div className="my-schedule-item-service">{item.service}</div>
                      )}
                    </div>
                    {item.invoiceId && (
                      <button
                        className="my-schedule-checkout-btn"
                        onClick={() => navigate(`/m/pos?invoice=${item.invoiceId}&appointment=${item.id}`)}
                      >
                        Thanh toán
                      </button>
                    )}
                  </div>
                );
              }

              return (
                <div key={`inv-${item.id}`} className="my-schedule-item invoice">
                  <div className="my-schedule-item-icon">📄</div>
                  <div className="my-schedule-item-content">
                    <div className="my-schedule-item-top-row">
                      <span className="my-schedule-item-time">{time}</span>
                      <span className="my-schedule-status-badge draft">Đơn nháp</span>
                    </div>
                    <div className="my-schedule-item-customer">{item.customer}</div>
                    {item.items && item.items.length > 0 && (
                      <div className="my-schedule-item-service">
                        {item.items.map((i) => i.name).join(', ')}
                      </div>
                    )}
                  </div>
                  <button
                    className="my-schedule-checkout-btn"
                    onClick={() => navigate(`/m/pos?invoice=${item.id}`)}
                  >
                    Thanh toán
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
