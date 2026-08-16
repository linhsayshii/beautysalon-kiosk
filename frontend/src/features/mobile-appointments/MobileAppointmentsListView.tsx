import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getPosAppointments } from '@/features/pos/pos.api';
import './mobile-appointments.css';

interface AppointmentData {
  id: number;
  startsAt: string;
  endsAt: string;
  status: string;
  note?: string;
  customer?: { id: number | null; name: string; phone?: string } | null;
  staff?: { id: number | null; name?: string | null } | null;
  service?: { id: number | null; name?: string | null; salePrice?: number } | null;
}

const STATUS_FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'confirmed', label: 'Chờ phục vụ' },
  { value: 'in_service', label: 'Đang làm' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'cancelled', label: 'Đã hủy' },
];

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Chờ phục vụ',
  waiting: 'Đang chờ',
  in_service: 'Đang làm',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
};

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

export function MobileAppointmentsListView() {
  const today = useMemo(() => new Date(), []);
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  }, []);

  const [dateMode, setDateMode] = useState<'today' | 'tomorrow' | 'custom'>('today');
  const [selectedDate, setSelectedDate] = useState<string>(() => toIsoDate(today));
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: appointmentsResponse, isLoading } = useQuery({
    queryKey: ['pos-appointments', selectedDate, selectedDate],
    queryFn: () => getPosAppointments(selectedDate, selectedDate),
  });

  const appointments = useMemo(() => {
    return (appointmentsResponse?.data || []) as AppointmentData[];
  }, [appointmentsResponse]);

  const filteredAppointments = useMemo(() => {
    if (statusFilter === 'all') return appointments;
    if (statusFilter === 'confirmed') {
      return appointments.filter(
        (a) => a.status === 'confirmed' || a.status === 'pending' || a.status === 'waiting'
      );
    }
    return appointments.filter((a) => a.status === statusFilter);
  }, [appointments, statusFilter]);

  const handleSelectDateMode = (mode: 'today' | 'tomorrow' | 'custom') => {
    setDateMode(mode);
    if (mode === 'today') {
      setSelectedDate(toIsoDate(today));
    } else if (mode === 'tomorrow') {
      setSelectedDate(toIsoDate(tomorrow));
    }
  };

  const handleCustomDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateMode('custom');
    setSelectedDate(e.target.value);
  };

  return (
    <div className="mobile-appointments-list-container">
      {/* Header */}
      <header className="mobile-appointments-list-header">
        <h1 className="mobile-appointments-list-title">
          Lịch dịch vụ
          <span className="mobile-appointments-count-badge">
            {filteredAppointments.length}
          </span>
        </h1>
      </header>

      {/* Date Filter Bar */}
      <div className="mobile-appointments-date-bar">
        <button
          type="button"
          className={`mobile-appointments-date-btn ${dateMode === 'today' ? 'is-active' : ''}`}
          onClick={() => handleSelectDateMode('today')}
        >
          Hôm nay
        </button>
        <button
          type="button"
          className={`mobile-appointments-date-btn ${dateMode === 'tomorrow' ? 'is-active' : ''}`}
          onClick={() => handleSelectDateMode('tomorrow')}
        >
          Ngày mai
        </button>
        <div className="mobile-appointments-date-input-wrapper">
          <input
            type="date"
            className="mobile-appointments-date-input"
            value={selectedDate}
            onChange={handleCustomDateChange}
            aria-label="Chọn ngày"
          />
        </div>
      </div>

      {/* Status Filter Chips */}
      <div className="mobile-appointments-status-bar">
        {STATUS_FILTERS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`mobile-appointments-status-chip ${statusFilter === tab.value ? 'is-active' : ''}`}
            onClick={() => setStatusFilter(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Appointment Cards */}
      <main className="mobile-appointments-list-body">
        {isLoading ? (
          <div className="mobile-appointments-empty">
            <p className="mobile-appointments-empty-text">Đang tải lịch hẹn...</p>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="mobile-appointments-empty">
            <div className="mobile-appointments-empty-icon">
              <i className="ph ph-calendar-blank" />
            </div>
            <p className="mobile-appointments-empty-text">Không có lịch hẹn nào</p>
            <p className="mobile-appointments-empty-subtext">
              Chưa có lịch hẹn cho ngày đã chọn hoặc bộ lọc này.
            </p>
          </div>
        ) : (
          filteredAppointments.map((apt) => {
            const timeLabel = `${formatTime(apt.startsAt)} - ${formatTime(apt.endsAt)}`;
            const statusClass = `status-${apt.status || 'confirmed'}`;
            const statusLabel = STATUS_LABELS[apt.status] || apt.status;

            return (
              <article key={apt.id} className="mobile-appointment-card-item">
                <div className="mobile-appointment-card-top">
                  <span className="mobile-appointment-time-badge">
                    <i className="ph ph-clock" />
                    {timeLabel}
                  </span>
                  <span className={`mobile-appointment-status-pill ${statusClass}`}>
                    {statusLabel}
                  </span>
                </div>

                <div className="mobile-appointment-card-middle">
                  <div className="mobile-appointment-cust-name">
                    <span>{apt.customer?.name || 'Khách vãng lai'}</span>
                  </div>

                  <div className="mobile-appointment-service-name">
                    <i className="ph ph-sparkle" />
                    <span>{apt.service?.name || 'Dịch vụ chưa chọn'}</span>
                  </div>

                  {apt.staff?.name && (
                    <div className="mobile-appointment-staff-assigned">
                      <i className="ph ph-user" />
                      <span>KTV: {apt.staff.name}</span>
                    </div>
                  )}
                </div>

                <div className="mobile-appointment-card-bottom">
                  {apt.customer?.phone && (
                    <a
                      href={`tel:${apt.customer.phone}`}
                      className="mobile-appointment-call-btn"
                      aria-label={`Gọi cho ${apt.customer.name}`}
                    >
                      <i className="ph ph-phone-call" />
                      Gọi điện
                    </a>
                  )}
                </div>
              </article>
            );
          })
        )}
      </main>

      {/* Floating Action Button for Creating New Appointment */}
      <Link to="/m/appointments/new" className="mobile-appointments-fab" aria-label="Đặt lịch">
        <i className="ph ph-plus" />
        <span>Đặt lịch</span>
      </Link>
    </div>
  );
}
