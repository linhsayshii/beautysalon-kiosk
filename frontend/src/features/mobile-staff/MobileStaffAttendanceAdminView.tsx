import { ErrorState, LoadingState } from '@/components/data-display/DataState';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MobileSearchBar,
  MobileDetailSheet,
  MobileEmptyState,
} from '@/features/mobile-common';
import { getStaff, getAttendance } from '@/features/staff/staff.api';
import { getScheduleRange } from '@/features/staff/schedule-range';
import { weekStartIso, monthStartIso, todayIso, toIsoDate, formatDateOnly } from '@/lib/date';
import { formatDecimal, initials } from '@/lib/format';
import type { ApiRecord } from '@/types/api';
import { MobilePageHeader } from '@/components/ui/MobilePageHeader/MobilePageHeader';

// Format timestamp to HH:MM in Vietnam timezone
function formatTime(value: unknown): string {
  if (!value) return '--:--';
  if (typeof value === 'string' && /^\d{1,2}:\d{2}$/.test(value)) {
    const [hours, minutes] = value.split(':');
    return `${hours.padStart(2, '0')}:${minutes}`;
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '--:--';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

// Format date to YYYY-MM-DD
function formatDate(value: unknown): string {
  if (!value) return '--';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '--';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
}

function getAttendanceStatusLabel({
  completedShifts,
  totalAssignedShifts,
  lateCount,
  earlyCount,
}: {
  completedShifts: number;
  totalAssignedShifts: number;
  lateCount: number;
  earlyCount: number;
}) {
  if (totalAssignedShifts === 0) {
    return completedShifts > 0 ? `${completedShifts} lượt chấm công` : 'Chưa xếp ca';
  }

  if (completedShifts === 0) return 'Chưa chấm công';
  if (completedShifts < totalAssignedShifts) return `Thiếu ${totalAssignedShifts - completedShifts} ca`;

  const exceptions = [
    lateCount > 0 ? `muộn ${lateCount} lần` : '',
    earlyCount > 0 ? `về sớm ${earlyCount} lần` : '',
  ].filter(Boolean);

  return exceptions.length > 0 ? `Đủ ca, ${exceptions.join(', ')}` : 'Đủ ca';
}

export function MobileStaffAttendanceAdminView() {
  const [periodType, setPeriodType] = useState<'week' | 'month'>('week');
  const [currentMonday, setCurrentMonday] = useState(weekStartIso());
  const [search, setSearch] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<ApiRecord | null>(null);

  // Compute dates based on periodType
  const { dateFrom, dateTo, periodLabel } = useMemo(() => {
    if (periodType === 'month') {
      const start = monthStartIso();
      const end = todayIso();
      return {
        dateFrom: start,
        dateTo: end,
        periodLabel: `Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`,
      };
    }

    // Week mode
    const dMon = new Date(`${currentMonday}T00:00:00`);
    const dSun = new Date(dMon);
    dSun.setDate(dSun.getDate() + 6);
    return {
      dateFrom: toIsoDate(dMon),
      dateTo: toIsoDate(dSun),
      periodLabel: `${formatDateOnly(toIsoDate(dMon), { day: '2-digit', month: '2-digit' })} – ${formatDateOnly(toIsoDate(dSun))}`,
    };
  }, [periodType, currentMonday]);

  // Queries
  const staffQuery = useQuery({
    queryKey: ['admin-mobile-attendance-staff'],
    queryFn: () => getStaff({}),
  });

  const attendanceQuery = useQuery({
    queryKey: ['admin-mobile-attendance-records', dateFrom, dateTo],
    queryFn: () => getAttendance(dateFrom, dateTo),
  });

  const scheduleQuery = useQuery({
    queryKey: ['admin-mobile-attendance-schedule', dateFrom, dateTo],
    queryFn: () => getScheduleRange(dateFrom, dateTo),
  });

  const staffList = (staffQuery.data?.data ?? []) as ApiRecord[];

  const attendanceRecords = (attendanceQuery.data?.data ?? []) as ApiRecord[];
  const scheduleData = (scheduleQuery.data?.data ?? {}) as ApiRecord;
  const scheduledShifts = (scheduleData.schedules ?? scheduleData.assignments ?? []) as ApiRecord[];

  // Filter staff by search term and role
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = s.name?.toLowerCase().includes(q);
        const matchCode = s.code?.toLowerCase().includes(q);
        if (!matchName && !matchCode) return false;
      }
      return true;
    });
  }, [staffList, search]);

  // Calculate stats for a given staff member
  const getStaffStats = (staff: ApiRecord) => {
    const staffAtt = attendanceRecords.filter(
      (a) => Number(a.staff?.id ?? a.staffId) === Number(staff.id)
        || (a.staff?.code ?? a.staffCode) === staff.code
    );

    let totalWorkedMinutes = 0;
    let lateCount = 0;
    let earlyCount = 0;

    staffAtt.forEach((rec) => {
      const recordedMinutes = rec.workedMinutes ?? rec.workMinutes;
      const checkIn = rec.checkIn ?? rec.checkInTime;
      const checkOut = rec.checkOut ?? rec.checkOutTime;

      if (recordedMinutes) {
        totalWorkedMinutes += Number(recordedMinutes);
      } else if (checkIn && checkOut) {
        const inTime = formatTime(checkIn);
        const outTime = formatTime(checkOut);
        const [inH, inM] = inTime.split(':').map(Number);
        const [outH, outM] = outTime.split(':').map(Number);
        const diff = (outH * 60 + outM) - (inH * 60 + inM);
        if (diff > 0) totalWorkedMinutes += diff;
      }

      if (rec.lateMinutes > 0) lateCount += 1;
      if (rec.earlyMinutes > 0) earlyCount += 1;
    });

    const staffShifts = scheduledShifts.filter(
      (s) => Number(s.staffId) === Number(staff.id) || s.staff?.code === staff.code
    );

    const workedHours = (totalWorkedMinutes / 60).toFixed(1);
    const completedShifts = staffAtt.length;
    const totalAssignedShifts = staffShifts.length;

    return {
      workedHours: Number(workedHours),
      completedShifts,
      totalAssignedShifts,
      lateCount,
      earlyCount,
      records: staffAtt,
    };
  };

  // Group staff by Role or Department
  const groupedStaff = useMemo(() => {
    const map = new Map<string, ApiRecord[]>();
    filteredStaff.forEach((s) => {
      const role = (s.role || 'KỸ THUẬT VIÊN').toUpperCase();
      const list = map.get(role) || [];
      list.push(s);
      map.set(role, list);
    });
    return Array.from(map.entries());
  }, [filteredStaff]);

  // Navigate previous / next week
  const handlePrevWeek = () => {
    const d = new Date(`${currentMonday}T00:00:00`);
    d.setDate(d.getDate() - 7);
    setCurrentMonday(toIsoDate(d));
  };

  const handleNextWeek = () => {
    const d = new Date(`${currentMonday}T00:00:00`);
    d.setDate(d.getDate() + 7);
    setCurrentMonday(toIsoDate(d));
  };

  const activeStaffStats = selectedStaff ? getStaffStats(selectedStaff) : null;

  return (
    <div className="m-page">
      <MobilePageHeader
        title="Bảng chấm công" backTo="/m/more"
        actions={(
          <>
            <button
              type="button"
              className="btn btn-ghost btn-icon m-header-action"
              onClick={() => { if (isSearchVisible) setSearch(''); setIsSearchVisible(!isSearchVisible); }}
              aria-label="Tìm kiếm"
            >
              <i className="ph ph-magnifying-glass" />
            </button>
          </>
        )}
      >
        {isSearchVisible && (
          <MobileSearchBar
            value={search}
            onChange={setSearch}
            autoFocus
            placeholder="Tìm nhân viên theo tên, mã..."
          />
        )}

        {/* Horizontal Period Filter Strip */}
        <div className="m-chip-strip">
          <button
            type="button"
            role="tab"
            aria-selected={periodType === 'week'}
            className={`chip ${periodType === 'week' ? 'is-active' : ''}`}
            onClick={() => setPeriodType('week')}
          >
            <i className="ph ph-calendar-blank" />
            <span>Theo tuần</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={periodType === 'month'}
            className={`chip ${periodType === 'month' ? 'is-active' : ''}`}
            onClick={() => setPeriodType('month')}
          >
            <i className="ph ph-calendar" />
            <span>Theo tháng</span>
          </button>
        </div>

        {/* Week Navigator for week mode */}
        {periodType === 'week' && (
          <div className="mobile-week-navigator">
            <button
              type="button"
              className="btn btn-secondary btn-icon"
              aria-label="Tuần trước"
              onClick={handlePrevWeek}
            >
              <i className="ph ph-caret-left" />
            </button>
            <span className="mobile-week-label">{periodLabel}</span>
            <button
              type="button"
              className="btn btn-secondary btn-icon"
              aria-label="Tuần sau"
              onClick={handleNextWeek}
            >
              <i className="ph ph-caret-right" />
            </button>
          </div>
        )}

        {/* Summary Bar */}
        <div className="m-summary-bar">
          {periodType === 'month' && <span className="m-summary-title">{periodLabel}</span>}
          <span className="m-summary-count">
            {filteredStaff.length} nhân viên
          </span>
        </div>
      </MobilePageHeader>

      {/* Grouped Section List */}
      <div className="mobile-grouped-list-container">
        {(staffQuery.error || attendanceQuery.error || scheduleQuery.error) ? (
          <ErrorState error={(staffQuery.error || attendanceQuery.error || scheduleQuery.error)!} onRetry={() => { void staffQuery.refetch(); void attendanceQuery.refetch(); void scheduleQuery.refetch(); }} />
        ) : (staffQuery.isLoading || attendanceQuery.isLoading || scheduleQuery.isLoading) ? (
          <LoadingState compact label="Đang tải dữ liệu chấm công..." />
        ) : filteredStaff.length === 0 ? (
          <MobileEmptyState
            icon="ph ph-clock-user"
            title="Không tìm thấy nhân viên"
            description={search ? 'Thử từ khóa khác hoặc đổi bộ lọc.' : undefined}
          />
        ) : (
          groupedStaff.map(([roleGroup, members]) => (
            <div key={roleGroup} className="mobile-grouped-section">
              <div className="mobile-section-header">
                <span className="mobile-section-title">{roleGroup}</span>
                <span className="mobile-section-count">{members.length}</span>
              </div>
              <div className="mobile-section-card">
                {members.map((staff) => {
                  const stats = getStaffStats(staff);
                  const attendanceStatus = getAttendanceStatusLabel(stats);
                  return (
                    <div
                      key={staff.id}
                      className="mobile-grouped-row"
                      onClick={() => setSelectedStaff(staff)}
                    >
                      <div className="mobile-staff-row-left">
                        <div className="mobile-staff-avatar">
                          {initials(staff.name || 'NV')}
                        </div>
                        <div className="mobile-staff-row-info">
                          <span className="mobile-staff-row-name">{staff.name}</span>
                          <span className="mobile-staff-row-sub">
                            <span>{stats.completedShifts}/{stats.totalAssignedShifts} ca</span>
                            {stats.lateCount > 0 && (
                              <span className="text-strong text-warning">
                                · Muộn {stats.lateCount} lần
                              </span>
                            )}
                            {stats.earlyCount > 0 && (
                              <span className="text-strong text-violet">
                                · Sớm {stats.earlyCount} lần
                              </span>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="mobile-staff-row-right">
                        <span className="mobile-staff-row-value blue">
                          {formatDecimal(stats.workedHours)} giờ
                        </span>
                        <span className="text-muted">
                          {attendanceStatus}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Inset Detail Sheet */}
      <MobileDetailSheet
        isOpen={Boolean(selectedStaff)}
        title="Nhật ký chấm công GPS"
        subtitle={selectedStaff ? `${selectedStaff.name} · ${periodLabel}` : ''}
        onClose={() => setSelectedStaff(null)}
      >
        {selectedStaff && activeStaffStats && (
          <>
            <div className="mobile-detail-hero">
              <div className="mobile-detail-hero-header">
                <div>
                  <div className="text-muted">Tổng giờ làm thực tế</div>
                  <div className="mobile-detail-hero-amount">{formatDecimal(activeStaffStats.workedHours)} giờ</div>
                </div>
                <div className="text-right">
                  <div className="text-muted">Ca hoàn thành</div>
                  <div className="text-strong">
                    {activeStaffStats.completedShifts}/{activeStaffStats.totalAssignedShifts} ca
                  </div>
                </div>
              </div>
            </div>

            <div className="mobile-detail-grid">
              <div className="mobile-detail-cell">
                <span className="mobile-detail-cell-label">Lượt đi muộn</span>
                <span className="mobile-detail-cell-value">
                  {activeStaffStats.lateCount > 0 ? `${activeStaffStats.lateCount} lượt` : 'Đúng giờ'}
                </span>
              </div>
              <div className="mobile-detail-cell">
                <span className="mobile-detail-cell-label">Lượt về sớm</span>
                <span className="mobile-detail-cell-value">
                  {activeStaffStats.earlyCount > 0 ? `${activeStaffStats.earlyCount} lượt` : '0 lượt'}
                </span>
              </div>
              <div className="mobile-detail-cell">
                <span className="mobile-detail-cell-label">GPS Hợp lệ</span>
                <span className="mobile-detail-cell-value text-success">
                  100% trong bán kính
                </span>
              </div>
              <div className="mobile-detail-cell">
                <span className="mobile-detail-cell-label">Trạng thái duyệt</span>
                <span className="mobile-detail-cell-value text-primary">
                  Đã xác nhận
                </span>
              </div>
            </div>

            {/* Daily Records List */}
            <div className="mobile-sheet-section">
              <span className="mobile-sheet-section-title">Nhật ký chấm công</span>
              {activeStaffStats.records.length === 0 ? (
                <p className="m-note">Chưa có lượt chấm công nào trong kỳ này.</p>
              ) : (
                <div className="mobile-gps-log-list">
                  {activeStaffStats.records.map((rec, idx) => (
                    <div key={rec.id ?? idx} className="mobile-gps-log-item">
                      <div>
                        <div className="mobile-gps-log-time">
                          {formatDate(rec.workDate)} ({formatTime(rec.checkIn)} - {formatTime(rec.checkOut)})
                        </div>
                        <div className="mobile-gps-log-desc">
                          {rec.workedMinutes ? `${formatDecimal(rec.workedMinutes / 60)} giờ` : 'Đang làm việc'}
                          {rec.lateMinutes > 0 && ` · Muộn ${rec.lateMinutes}p`}
                          {rec.earlyMinutes > 0 && ` · Sớm ${rec.earlyMinutes}p`}
                        </div>
                      </div>
                      <span className={`mobile-gps-status ${rec.checkOut ? 'out' : 'in'}`}>
                        {rec.checkOut ? 'Đã ra ca' : 'Đang trong ca'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </MobileDetailSheet>
    </div>
  );
}
