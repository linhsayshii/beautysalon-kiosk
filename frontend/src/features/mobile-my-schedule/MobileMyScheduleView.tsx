import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { getMyWorkItems, updateMyWorkItemStatus } from '@/features/staff/staff.api';
import { useToast } from '@/components/ui/Toast/ToastProvider';
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
  invoiceStatus?: string | null;
  paymentRequestedAt?: string | null;
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
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [selectedDate, setSelectedDate] = useState(() => toIsoDate(new Date()));
  const dateFrom = selectedDate;
  const dateTo = selectedDate;

  const workItemsQuery = useQuery({
    queryKey: ['my-work-items', dateFrom, dateTo],
    queryFn: () => getMyWorkItems(dateFrom, dateTo),
    enabled: !!account?.staffId,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'in_service' | 'completed' }) => updateMyWorkItemStatus(id, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['my-work-items'] });
      queryClient.invalidateQueries({ queryKey: ['pos-appointments'] });
      notify(
        variables.status === 'completed' ? 'Đã hoàn thành công việc' : 'Đã bắt đầu phục vụ',
        variables.status === 'completed' ? 'Trạng thái dịch vụ đã được cập nhật.' : 'Công việc đã chuyển sang Đang làm.',
      );
    },
    onError: (error) => {
      notify('Không thể cập nhật công việc', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    },
  });

  const items = useMemo((): ScheduleItem[] => {
    const workItems = workItemsQuery.data?.data ?? {};
    const aptItems: ScheduleItem[] = (workItems.appointments ?? [])
      .filter((apt: any) => String(apt.staff?.id) === String(account?.staffId))
      .map((apt: any) => ({
        type: 'appointment' as const,
        id: apt.id,
        time: apt.startsAt,
        customer: apt.customer?.name || 'Khách vãng lai',
        service: apt.service?.name,
        status: apt.status,
        invoiceId: apt.invoiceId,
        invoiceStatus: apt.invoiceStatus,
        paymentRequestedAt: apt.paymentRequestedAt,
      }));

    // Keep the appointment as the source of truth when its checkout invoice
    // appears in the same response. This protects the mobile screen while an
    // older API response is cached during deployment.
    const appointmentInvoiceIds = new Set(
      aptItems.flatMap((item) => item.invoiceId == null ? [] : [String(item.invoiceId)]),
    );
    const draftItems: ScheduleItem[] = (workItems.drafts ?? [])
      .filter((inv: any) => !appointmentInvoiceIds.has(String(inv.id)))
      .map((inv: any) => ({
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
  }, [workItemsQuery.data, account?.staffId]);

  const isLoading = workItemsQuery.isLoading;
  const error = workItemsQuery.error;

  const getAppointmentAction = (item: ScheduleItem) => {
    if (item.status === 'confirmed' || item.status === 'waiting') {
      return {
        label: 'Bắt đầu',
        action: () => statusMutation.mutate({ id: item.id, status: 'in_service' }),
        disabled: statusMutation.isPending,
        tone: 'work',
      };
    }
    if (item.status === 'in_service') {
      return {
        label: 'Hoàn thành',
        action: () => {
          if (window.confirm('Xác nhận đã hoàn thành công việc này?')) {
            statusMutation.mutate({ id: item.id, status: 'completed' });
          }
        },
        disabled: statusMutation.isPending,
        tone: 'complete',
      };
    }
    return null;
  };

  return (
    <div className="mobile-my-schedule-view">
      <div className="mobile-my-schedule-sticky-header-cluster">
        <div className="mobile-my-schedule-top-nav">
          <h1 className="mobile-my-schedule-nav-title">Lịch của tôi</h1>
        </div>
        <div className="mobile-my-schedule-filter-strip">
          <div className="mobile-my-schedule-date-wrap">
            <input
              type="date"
              className="mobile-my-schedule-date-input"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              aria-label="Chọn ngày"
            />
            <button type="button" className="mobile-my-schedule-date-chip">
              <span>{selectedDate.split('-').reverse().slice(0, 2).join('/')}</span>
              <i className="ph ph-caret-down" />
            </button>
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
          <>
            <div className="mobile-my-schedule-section-header">
              Lịch ngày {selectedDate.split('-').reverse().slice(0, 2).join('/')} ({items.length})
            </div>
            <div className="mobile-my-schedule-list">
              {items.map((item) => {
                const time = formatTime(item.time);
                const statusLabel = STATUS_LABELS[item.status] || item.status;

                if (item.type === 'appointment') {
                  const action = getAppointmentAction(item);
                  return (
                    <div key={`apt-${item.id}`} className="my-schedule-item appointment">
                      <div className="my-schedule-item-icon" aria-hidden="true"><i className="ph ph-calendar-check" /></div>
                      <div className="my-schedule-item-content">
                        <div className="my-schedule-item-top-row">
                          <span className="my-schedule-item-time">{time}</span>
                          <span className="my-schedule-status-badge">{statusLabel}</span>
                        </div>
                        <div className="my-schedule-item-customer">{item.customer}</div>
                        {item.service && (
                          <div className="my-schedule-item-service">{item.service}</div>
                        )}
                        {item.status === 'completed' && item.invoiceStatus === 'paid' && (
                          <div className="my-schedule-payment-state">Đã thanh toán</div>
                        )}
                        {item.status === 'completed' && item.invoiceStatus === 'draft' && (
                          <div className="my-schedule-payment-state">
                            {item.paymentRequestedAt ? 'Đã chuyển thu ngân' : 'Chờ dịch vụ khác hoàn thành'}
                          </div>
                        )}
                      </div>
                      {action && (
                        <button
                          className={`my-schedule-action-btn is-${action.tone}`}
                          onClick={action.action}
                          disabled={action.disabled}
                        >
                          {action.label}
                        </button>
                      )}
                    </div>
                  );
                }

                return (
                  <div key={`inv-${item.id}`} className="my-schedule-item invoice">
                    <div className="my-schedule-item-icon" aria-hidden="true"><i className="ph ph-file-text" /></div>
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
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
