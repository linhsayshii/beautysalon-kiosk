import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPosAppointments, updatePosAppointment } from '@/features/pos/pos.api';
import { getStaff } from '@/features/staff/staff.api';
import { MobileDetailSheet, MobileSearchBar } from '@/features/mobile-common';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import type { ApiRecord } from '@/types/api';
import './mobile-appointments.css';

interface AppointmentData {
  id: number;
  startsAt: string;
  endsAt: string;
  status: string;
  note?: string;
  paid?: boolean;
  code?: string;
  customer?: { id: number | null; name: string; phone?: string; code?: string } | null;
  staff?: { id: number | null; name?: string | null } | null;
  service?: { id: number | null; name?: string | null; salePrice?: number } | null;
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

const APPOINTMENT_STATUSES = ['pending', 'confirmed', 'waiting', 'in_service', 'completed', 'cancelled', 'no_show'] as const;

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

function formatDayHeader(dateStr: string): string {
  try {
    const d = new Date(`${dateStr}T00:00:00`);
    const today = new Date();
    const todayStr = toIsoDate(today);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = toIsoDate(yesterday);

    const dayMonth = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (dateStr === todayStr) return `HÔM NAY, ${dayMonth}`;
    if (dateStr === yesterdayStr) return `HÔM QUA, ${dayMonth}`;
    return `NGÀY ${dayMonth}`;
  } catch {
    return dateStr;
  }
}

export function MobileAppointmentsListView() {
  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState<string>(() => toIsoDate(today));
  const [activeTab, setActiveTab] = useState<'list' | 'timeline' | 'staff_grid'>('list');
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [selectedApt, setSelectedApt] = useState<AppointmentData | null>(null);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const { data: appointmentsResponse, isLoading } = useQuery({
    queryKey: ['pos-appointments', selectedDate, selectedDate],
    queryFn: () => getPosAppointments(selectedDate, selectedDate),
  });

  const { data: staffResponse } = useQuery({
    queryKey: ['staff-list'],
    queryFn: () => getStaff({}),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => updatePosAppointment(id, { status }),
    onSuccess: (response) => {
      const updated = response.data as unknown as AppointmentData;
      setSelectedApt((current) => current && current.id === updated.id
        ? { ...current, status: updated.status }
        : current);
      queryClient.invalidateQueries({ queryKey: ['pos-appointments'] });
      notify('Đã cập nhật lịch hẹn', `Trạng thái: ${STATUS_LABELS[updated.status] || updated.status}.`);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Vui lòng thử lại.';
      notify('Không thể cập nhật trạng thái', message);
    },
  });

  const handleStatusChange = (status: string) => {
    if (!selectedApt || status === selectedApt.status || statusMutation.isPending) return;
    const needsConfirmation = status === 'completed' || status === 'cancelled';
    if (needsConfirmation && !window.confirm(
      status === 'completed' ? 'Xác nhận hoàn tất lịch hẹn này?' : 'Xác nhận hủy lịch hẹn này?'
    )) return;

    setIsStatusMenuOpen(false);
    statusMutation.mutate({ id: selectedApt.id, status });
  };

  const staffList = (staffResponse?.data ?? []) as ApiRecord[];
  const appointments = useMemo(() => {
    return (appointmentsResponse?.data || []) as AppointmentData[];
  }, [appointmentsResponse]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      if (staffFilter !== 'all' && Number(a.staff?.id) !== Number(staffFilter)) {
        return false;
      }
      if (search.trim()) {
        const query = search.toLowerCase();
        const custName = (a.customer?.name || '').toLowerCase();
        const custPhone = (a.customer?.phone || '').toLowerCase();
        const srvName = (a.service?.name || '').toLowerCase();
        const stfName = (a.staff?.name || '').toLowerCase();
        return (
          custName.includes(query) ||
          custPhone.includes(query) ||
          srvName.includes(query) ||
          stfName.includes(query)
        );
      }
      return true;
    });
  }, [appointments, staffFilter, search]);

  return (
    <div className="mobile-appointments-view">
      {/* Sticky Top Cluster */}
      <div className="mobile-appointments-sticky-header-cluster">
        {/* 1. Header Toolbar */}
        <div className="mobile-appointments-top-header">
          <h1 className="mobile-appointments-main-title">Lịch dịch vụ</h1>
          <div className="mobile-appointments-nav-actions">
            <button
              type="button"
              className={`mobile-appointments-search-trigger ${isSearchVisible ? 'is-active' : ''}`}
              onClick={() => setIsSearchVisible((prev) => !prev)}
              aria-label="Tìm kiếm"
            >
              <i className="ph ph-magnifying-glass" />
            </button>
          </div>
        </div>

        {/* Inline Search Bar */}
        {isSearchVisible && (
          <div className="mobile-appointments-search-box">
            <MobileSearchBar
              value={search}
              placeholder="Tìm khách hàng, số điện thoại, thợ..."
              onChange={setSearch}
            />
          </div>
        )}

        {/* 2. Filter Chips Strip */}
        <div className="mobile-appointments-filter-strip">
          {/* Date Selector Chip */}
          <div className="mobile-appointments-chip-select-wrap">
            <input
              type="date"
              className="mobile-appointments-date-hidden-input"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              aria-label="Chọn ngày"
            />
            <button type="button" className={`mobile-appointments-filter-chip ${selectedDate ? 'is-active' : ''}`}>
              <span>{selectedDate ? selectedDate.split('-').reverse().slice(0, 2).join('/') : 'Tất cả ngày'}</span>
              <i className="ph ph-caret-down" />
            </button>
          </div>

          {/* Staff Filter Dropdown Chip */}
          <div className="mobile-appointments-chip-select-wrap">
            <select
              className="mobile-appointments-staff-select"
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              aria-label="Chọn nhân viên"
            >
              <option value="all">Tất cả nhân viên</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <div className={`mobile-appointments-filter-chip ${staffFilter !== 'all' ? 'is-active' : ''}`}>
              <span>
                {staffFilter === 'all'
                  ? 'Tất cả nhân viên'
                  : staffList.find((s) => Number(s.id) === Number(staffFilter))?.name || 'Nhân viên'}
              </span>
              <i className="ph ph-caret-down" />
            </div>
          </div>
        </div>

        {/* 3. Underline Tab Navigation */}
        <div className="mobile-appointments-tabs-nav" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'list'}
            className={`mobile-appointments-tab-item ${activeTab === 'list' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('list')}
          >
            Danh sách
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'timeline'}
            className={`mobile-appointments-tab-item ${activeTab === 'timeline' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('timeline')}
          >
            Lưới thời gian
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'staff_grid'}
            className={`mobile-appointments-tab-item ${activeTab === 'staff_grid' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('staff_grid')}
          >
            Lưới nhân viên
          </button>
        </div>
      </div>

      {/* 4. Grouped Cards Container */}
      <div className="mobile-appointments-content-body">
        <div className="mobile-appointments-section-header">
          {formatDayHeader(selectedDate)} ({filteredAppointments.length})
        </div>

        {isLoading ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b' }}>
            Đang tải dữ liệu lịch hẹn...
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="mobile-appointments-empty-box">
            <div className="mobile-appointments-empty-circle">
              <i className="ph ph-calendar-blank" />
            </div>
            <p className="mobile-appointments-empty-msg">Chưa có lịch hẹn nào</p>
            <span className="mobile-appointments-empty-hint">
              Chạm nút + để tạo lịch dịch vụ mới
            </span>
          </div>
        ) : (
          <div className="mobile-appointments-cards-list">
            {filteredAppointments.map((apt) => {
              const timeLabel = `${formatTime(apt.startsAt)} - ${formatTime(apt.endsAt)}`;
              const statusLabel = STATUS_LABELS[apt.status] || apt.status;
              const isCompleted = apt.status === 'completed';

              return (
                <div
                  key={apt.id}
                  className="mobile-appointment-white-card"
                  onClick={() => setSelectedApt(apt)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedApt(apt); } }}
                >
                  {/* Top Row: Customer Name + Time Badge */}
                  <div className="mobile-apt-card-top-row">
                    <div className="mobile-apt-customer-block">
                      <span className="mobile-apt-customer-name">
                        {apt.customer?.name || 'Khách vãng lai'}
                      </span>
                      {apt.customer?.phone && (
                        <a
                          href={`tel:${apt.customer.phone}`}
                          className="mobile-apt-phone-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {apt.customer.phone}
                        </a>
                      )}
                    </div>

                    <div className="mobile-apt-time-capsule">
                      {timeLabel}
                    </div>
                  </div>

                  {/* Middle Row: Service Name & Staff */}
                  <div className="mobile-apt-card-details">
                    <div className="mobile-apt-service-text">
                      {apt.service?.name || 'Chưa chọn dịch vụ'}
                    </div>
                    {apt.staff?.name && (
                      <div className="mobile-apt-staff-text">
                        bởi {apt.staff.name}
                      </div>
                    )}
                  </div>

                  {/* Bottom Row: Status Dot & Payment State */}
                  <div className="mobile-apt-card-footer">
                    <div className="mobile-apt-status-indicator">
                      <span className={`mobile-apt-status-dot is-${apt.status}`} />
                      <span>{statusLabel}</span>
                    </div>

                    <div className="mobile-apt-payment-state">
                      {apt.paid || isCompleted ? 'Đã thanh toán' : 'Chưa thanh toán'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Floating Action Button (FAB) */}
      <Link
        to="/m/appointments/new"
        className="mobile-inventory-fab-btn"
        aria-label="Tạo lịch hẹn mới"
        title="Đặt lịch"
      >
        <i className="ph ph-plus" />
      </Link>

      {/* 6. Inset Detail View Bottom Sheet (Screenshot 3 style) */}
      <MobileDetailSheet
        isOpen={selectedApt !== null}
        title="Chi tiết lịch dịch vụ"
        onClose={() => {
          setIsStatusMenuOpen(false);
          setSelectedApt(null);
        }}
      >
        {selectedApt && (
          <div className="mobile-apt-detail-wrapper">
            {/* Top Code & Status Header Card */}
            <div className="mobile-apt-detail-card">
              <div className="mobile-apt-detail-code-row">
                <h2 className="mobile-apt-detail-code">
                  {selectedApt.code || `B00${selectedApt.id || '7979'}`}
                </h2>
                <div className="mobile-apt-status-control">
                  <button
                    type="button"
                    className="mobile-apt-status-dropdown-btn"
                    aria-haspopup="menu"
                    aria-expanded={isStatusMenuOpen}
                    aria-label="Đổi trạng thái lịch hẹn"
                    disabled={statusMutation.isPending}
                    onClick={() => setIsStatusMenuOpen((open) => !open)}
                  >
                    <span>{statusMutation.isPending ? 'Đang lưu…' : STATUS_LABELS[selectedApt.status] || selectedApt.status}</span>
                    <i className={`ph ph-caret-down ${isStatusMenuOpen ? 'is-open' : ''}`} />
                  </button>
                  {isStatusMenuOpen && (
                    <div className="mobile-apt-status-menu" role="menu" aria-label="Chọn trạng thái lịch hẹn">
                      {APPOINTMENT_STATUSES.map((status) => (
                        <button
                          key={status}
                          type="button"
                          role="menuitem"
                          className={status === selectedApt.status ? 'is-current' : ''}
                          disabled={status === selectedApt.status || statusMutation.isPending}
                          onClick={() => handleStatusChange(status)}
                        >
                          <span className={`mobile-apt-status-dot is-${status}`} />
                          {STATUS_LABELS[status]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Customer Avatar & Package hint */}
              <div className="mobile-apt-detail-cust-row">
                <div className="mobile-apt-detail-avatar">
                  <i className="ph-fill ph-user" />
                </div>
                <div className="mobile-apt-detail-cust-info">
                  <span className="mobile-apt-detail-cust-name">
                    {selectedApt.customer?.name || 'Khách vãng lai'}
                  </span>
                  <span className="mobile-apt-detail-cust-sub">
                    Còn buổi dịch vụ, liệu trình <i className="ph ph-caret-down" />
                  </span>
                </div>
              </div>

              {/* Start Time info */}
              <div className="mobile-apt-detail-time-row">
                <div className="mobile-apt-detail-time-icon">
                  <i className="ph ph-calendar" />
                </div>
                <div className="mobile-apt-detail-time-text">
                  Bắt đầu làm {formatTime(selectedApt.startsAt)} - {formatDayHeader(selectedDate)}
                </div>
              </div>
            </div>

            {/* Thêm hình ảnh action card */}
            <div className="mobile-apt-detail-card" style={{ padding: '14px 16px' }}>
              <button type="button" className="mobile-detail-blue-action">
                + Thêm hình ảnh
              </button>
            </div>

            {/* LỊCH DỊCH VỤ, SẢN PHẨM card */}
            <div className="mobile-apt-detail-card">
              <span className="mobile-apt-service-card-title">LỊCH DỊCH VỤ, SẢN PHẨM</span>
              <div className="mobile-apt-service-item-name">
                {selectedApt.service?.name || 'Gội đầu mang dầu (45\')'} x1
              </div>
              <div className="mobile-apt-service-item-sub">
                Trừ gói Combo 20 buổi gội đầu (Tặng 5 buổi gội)
              </div>
              <div className="mobile-apt-service-time-range">
                {formatTime(selectedApt.startsAt)} - {formatTime(selectedApt.endsAt)}, {selectedDate.split('-').reverse().slice(0, 2).join('/')}
              </div>
              {selectedApt.staff?.name && (
                <div className="mobile-apt-staff-pill">
                  {selectedApt.staff.name}
                </div>
              )}
            </div>

            {/* Channel, Branch & Invoice info card */}
            <div className="mobile-apt-detail-card">
              <div className="mobile-apt-grid-info">
                <div className="mobile-apt-grid-cell">
                  <span className="mobile-apt-grid-lbl">Kênh bán</span>
                  <span className="mobile-apt-grid-val">Khách đến trực tiếp</span>
                </div>

                <div className="mobile-apt-grid-cell">
                  <span className="mobile-apt-grid-lbl">Chi nhánh</span>
                  <span className="mobile-apt-grid-val">Chi nhánh trung tâm</span>
                </div>

                <div className="mobile-apt-grid-cell">
                  <span className="mobile-apt-grid-lbl">Thông tin thanh toán</span>
                  <span className="mobile-apt-grid-val">
                    {selectedApt.paid || selectedApt.status === 'completed' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                  </span>
                </div>

                <div className="mobile-apt-grid-cell">
                  <span className="mobile-apt-grid-lbl">Mã hóa đơn</span>
                  <span className="mobile-apt-grid-val">
                    {`HD00${selectedApt.id + 1000 || '7176'}`}
                  </span>
                </div>
              </div>

            </div>
          </div>
        )}
      </MobileDetailSheet>
    </div>
  );
}
