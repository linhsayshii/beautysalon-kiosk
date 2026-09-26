import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPosAppointments, updatePosAppointment, prepareAppointmentCheckout } from '@/features/pos/pos.api';
import { getStaff } from '@/features/staff/staff.api';
import { useAuth } from '@/features/auth/AuthProvider';
import { MobileDetailSheet, MobileSearchBar } from '@/features/mobile-common';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { useComingSoon } from '@/components/ui/Toast/useComingSoon';
import { Select } from '@/components/ui/Select/Select';
import { DatePickerField } from '@/components/ui/DateTimePicker';
import { DEFAULT_BRANCH_TIME_ZONE, formatBranchTime, formatDayHeader, localDateTimeFromInstant } from '@/lib/date';
import type { ApiRecord } from '@/types/api';
import { MobilePageHeader } from '@/components/ui/MobilePageHeader/MobilePageHeader';
import { LoadingState } from '@/components/data-display/DataState';

interface AppointmentData {
  id: number;
  invoiceId?: number | null;
  invoiceCode?: string | null;
  invoiceStatus?: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
  note?: string;
  paid?: boolean;
  paymentStatus?: string;
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

export function MobileAppointmentsListView() {
  const navigate = useNavigate();
  const { account } = useAuth();
  const branchName = account?.branchName ?? 'Chi nhánh trung tâm';
  const timeZone = account?.branchTimezone ?? DEFAULT_BRANCH_TIME_ZONE;
  const today = useMemo(() => localDateTimeFromInstant(new Date(), timeZone).slice(0, 10), [timeZone]);
  const [selectedDate, setSelectedDate] = useState<string>(() => today);
  useEffect(() => {
    if (selectedDate !== today) {
      setSelectedDate(today);
    }
  }, [today]); // eslint-disable-line react-hooks/exhaustive-deps
  const [activeTab, setActiveTab] = useState<'list' | 'timeline' | 'staff_grid'>('list');
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [selectedApt, setSelectedApt] = useState<AppointmentData | null>(null);
  const { notify } = useToast();
  const comingSoon = useComingSoon();
  const queryClient = useQueryClient();

  const { data: appointmentsResponse, isLoading } = useQuery({
    queryKey: ['pos-appointments', selectedDate],
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

  const checkoutMutation = useMutation({
    mutationFn: prepareAppointmentCheckout,
    onSuccess: (response, appointmentId) => {
      queryClient.invalidateQueries({ queryKey: ['pos-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['pos-payment-requests'] });
      queryClient.invalidateQueries({ queryKey: ['pos-invoice'] });
      navigate(`/m/pos?invoice=${response.data.invoiceId}&appointment=${appointmentId}&checkout=1`);
    },
    onError: (error) => notify('Không thể mở thanh toán', error instanceof Error ? error.message : 'Vui lòng thử lại.'),
  });
  const renderActions = (apt: AppointmentData) => <div className="mobile-apt-actions" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
    {apt.invoiceStatus === 'draft' && apt.paymentStatus !== 'paid' && apt.paymentStatus !== 'partial' && <Link to={`/m/appointments/${apt.id}/edit`}>Chỉnh sửa lịch</Link>}
    {apt.invoiceStatus && apt.invoiceStatus !== 'draft'
      ? <Link className="primary" to={`/m/orders?invoice=${apt.invoiceId}`}>Xem hóa đơn</Link>
      : <button className="primary" disabled={checkoutMutation.isPending} onClick={() => checkoutMutation.mutate(apt.id)}>{checkoutMutation.isPending && checkoutMutation.variables === apt.id ? 'Đang mở…' : 'Thanh toán'}</button>}
  </div>;

  const handleStatusChange = (status: string) => {
    if (!selectedApt || status === selectedApt.status || statusMutation.isPending) return;
    const needsConfirmation = status === 'completed' || status === 'cancelled';
    if (needsConfirmation && !window.confirm(
      status === 'completed' ? 'Xác nhận hoàn tất lịch hẹn này?' : 'Xác nhận hủy lịch hẹn này?'
    )) return;

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
      <MobilePageHeader
        title="Lịch dịch vụ"
        actions={(
          <button
            type="button"
            className={`btn btn-ghost btn-icon m-header-action${isSearchVisible ? ' is-active' : ''}`}
            onClick={() => setIsSearchVisible((prev) => !prev)}
            aria-label="Tìm kiếm"
          >
            <i className="ph ph-magnifying-glass" />
          </button>
        )}
      >
        {isSearchVisible && (
          <MobileSearchBar
            value={search}
            placeholder="Tìm khách hàng, số điện thoại, thợ..."
            onChange={setSearch}
          />
        )}

        <div className="m-chip-strip">
          <div className="mobile-appointments-chip-select-wrap">
            <DatePickerField
              className={`mobile-appointments-filter-chip ${selectedDate ? 'is-active' : ''}`}
              value={selectedDate}
              onChange={setSelectedDate}
              timeZone={timeZone}
              aria-label="Chọn ngày"
              placeholder="Tất cả ngày"
            />
          </div>

          <div className="mobile-appointments-chip-select-wrap">
            <Select
              triggerClassName={staffFilter !== 'all' ? 'is-active' : ''}
              variant="pill"
              value={staffFilter}
              onChange={setStaffFilter}
              aria-label="Chọn nhân viên"
              options={[{ value: 'all', label: 'Tất cả nhân viên' }, ...staffList.map((staff) => ({ value: String(staff.id), label: staff.name }))]}
            />
          </div>
        </div>

        <div className="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'list'}
            className={`tab${activeTab === 'list' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('list')}
          >
            Danh sách
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'timeline'}
            className={`tab${activeTab === 'timeline' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('timeline')}
          >
            Lưới thời gian
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'staff_grid'}
            className={`tab${activeTab === 'staff_grid' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('staff_grid')}
          >
            Lưới nhân viên
          </button>
        </div>
      </MobilePageHeader>

      {/* 4. Grouped Cards Container */}
      <div className="mobile-appointments-content-body">
        <div className="mobile-appointments-section-header">
          {formatDayHeader(selectedDate, today)} ({filteredAppointments.length})
        </div>

        {isLoading ? (
          <LoadingState compact label="Đang tải dữ liệu lịch hẹn..." />
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
              const timeLabel = `${formatBranchTime(apt.startsAt, timeZone)} - ${formatBranchTime(apt.endsAt, timeZone)}`;
              const statusLabel = STATUS_LABELS[apt.status] || apt.status;


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
                      {apt.paymentStatus === 'paid' ? 'Đã thanh toán' : apt.paymentStatus === 'partial' ? 'Thanh toán một phần' : 'Chưa thanh toán'}
                    </div>
                  </div>
                  {renderActions(apt)}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Floating Action Button (FAB) */}
      <Link
        to="/m/appointments/new"
        className="m-fab"
        aria-label="Tạo lịch hẹn mới"
        title="Đặt lịch"
      >
        <i className="ph ph-plus" />
      </Link>

      {/* 6. Inset Detail View Bottom Sheet (Screenshot 3 style) */}
      <MobileDetailSheet
        isOpen={selectedApt !== null}
        title="Chi tiết lịch dịch vụ"
        footerActions={selectedApt ? renderActions(selectedApt) : undefined}
        onClose={() => {
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
                  <Select
                    value={selectedApt.status}
                    options={APPOINTMENT_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] }))}
                    onChange={handleStatusChange}
                    aria-label="Đổi trạng thái lịch hẹn"
                    disabled={statusMutation.isPending}
                    align="right"
                    size="sm"
                    triggerClassName="mobile-apt-status-dropdown-btn"
                    renderOption={(option) => <><span className={`mobile-apt-status-dot is-${option.value}`} />{option.label}</>}
                  />
                </div>
              </div>

              {/* Customer Avatar & Package hint */}
              <div className="mobile-apt-detail-cust-row">
                <div className="mobile-apt-detail-avatar">
                  <i className="ph ph-user" />
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
                  Bắt đầu làm {formatBranchTime(selectedApt.startsAt, timeZone)} - {formatDayHeader(selectedApt.startsAt.slice(0, 10), today)}
                </div>
              </div>
            </div>

            {/* Thêm hình ảnh action card */}
            <div className="mobile-apt-detail-card is-compact">
              <button type="button" className="mobile-detail-blue-action" onClick={comingSoon}>
                + Thêm hình ảnh
              </button>
            </div>

            {/* LỊCH DỊCH VỤ, SẢN PHẨM card */}
            <div className="mobile-apt-detail-card">
              <span className="mobile-apt-service-card-title">LỊCH DỊCH VỤ, SẢN PHẨM</span>
              <div className="mobile-apt-service-item-name">
                {selectedApt.service?.name || 'Gội đầu mang dầu (45\')'} x1
              </div>

              <div className="mobile-apt-service-time-range">
                {formatBranchTime(selectedApt.startsAt, timeZone)} - {formatBranchTime(selectedApt.endsAt, timeZone)}, {selectedApt.startsAt.split('T')[0].split('-').reverse().slice(0, 2).join('/')}
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
                  <span className="mobile-apt-grid-val">{branchName}</span>
                </div>

                <div className="mobile-apt-grid-cell">
                  <span className="mobile-apt-grid-lbl">Thông tin thanh toán</span>
                  <span className="mobile-apt-grid-val">
                    {selectedApt.paymentStatus === 'paid' ? 'Đã thanh toán' : selectedApt.paymentStatus === 'partial' ? 'Thanh toán một phần' : 'Chưa thanh toán'}
                  </span>
                </div>

                <div className="mobile-apt-grid-cell">
                  <span className="mobile-apt-grid-lbl">Mã hóa đơn</span>
                  <span className="mobile-apt-grid-val">
                    {selectedApt.invoiceCode || 'Chưa có hóa đơn'}
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
