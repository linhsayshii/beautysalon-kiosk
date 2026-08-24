import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '@/hooks/useWebSocket';
import { LoadingState } from '@/components/data-display/DataState';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { Select } from '@/components/ui/Select/Select';
import { DatePickerField } from '@/components/ui/DateTimePicker';
import { errorMessage } from '@/services/api-client';
import { todayIso, toIsoDate, weekStartIso } from '@/lib/date';
import { formatMoney } from '@/lib/format';
import type { ApiRecord } from '@/types/api';
import { WeekPicker } from './WeekPicker';
import { AddShiftModal, ShiftFormValues } from './AddShiftModal';
import { AssignStaffModal } from './AssignStaffModal';
import { AssignShiftForStaffModal } from './AssignShiftForStaffModal';
import { ScheduleBadge } from '@/components/ScheduleBadge';
import { ApplyWeeksModal } from '@/components/ApplyWeeksModal';
import { DeleteScheduleModal } from '@/components/DeleteScheduleModal';
import { getStaff, getShifts, createShift, getSchedule, assignShift, getWorkScheduleSettings, updateWorkScheduleSettings } from '../staff.api';
import { calculateStaffShiftSalary } from '../salary-calc';
import './AttendanceTimekeeping.css';

const weekdayLabels = ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật'];

// Map shift name to CSS color theme class
function getShiftThemeClass(shiftName: string): string {
  const lower = shiftName.toLowerCase();
  if (lower.includes('partime') || lower.includes('part-time')) return 'theme-orange';
  if (lower.includes('full')) return 'theme-pink';
  if (lower.includes('sáng chuẩn') || lower.includes('chuẩn') || lower.includes('sáng')) return 'theme-green';
  if (lower.includes('chiều') || lower.includes('tối')) return 'theme-purple';
  return 'theme-blue';
}

export function StaffScheduleView() {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { subscribe } = useWebSocket();
  const [currentMonday, setCurrentMonday] = useState(weekStartIso());
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'by-staff' | 'by-shift'>('by-staff');
  const [workDaysPerMonth, setWorkDaysPerMonth] = useState<number>(26);
  const [isSettingDaysOpen, setIsSettingDaysOpen] = useState(false);

  // Work week days settings (T2 -> CN)
  const [activeWorkDays, setActiveWorkDays] = useState<string[]>([
    'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN',
  ]);

  // Holidays list
  const [holidaysList, setHolidaysList] = useState<Array<{ id: number; name: string; fromDate: string; toDate: string; daysCount: number }>>([
    { id: 1, name: 'Tết Dương lịch', fromDate: '01/01/2026', toDate: '01/01/2026', daysCount: 1 },
    { id: 2, name: 'Tết Nguyên Đán', fromDate: '16/02/2026', toDate: '20/02/2026', daysCount: 5 },
    { id: 3, name: 'Giỗ tổ Hùng Vương', fromDate: '26/04/2026', toDate: '26/04/2026', daysCount: 1 },
    { id: 4, name: 'Ngày Giải phóng miền Nam', fromDate: '30/04/2026', toDate: '30/04/2026', daysCount: 1 },
    { id: 5, name: 'Ngày Quốc tế Lao động', fromDate: '01/05/2026', toDate: '01/05/2026', daysCount: 1 },
    { id: 6, name: 'Ngày Quốc khánh', fromDate: '02/09/2026', toDate: '02/09/2026', daysCount: 1 },
  ]);

  // New Holiday modal state
  const [isAddHolidayOpen, setIsAddHolidayOpen] = useState(false);
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayFrom, setNewHolidayFrom] = useState('');
  const [newHolidayTo, setNewHolidayTo] = useState('');

  // Modals state
  const [isAddShiftOpen, setIsAddShiftOpen] = useState(false);
  const [assignModalData, setAssignModalData] = useState<{
    isOpen: boolean;
    shiftName: string;
    startsAt: string;
    endsAt: string;
    shiftDate: string;
    assignedStaffIds: number[];
  }>({
    isOpen: false,
    shiftName: '',
    startsAt: '',
    endsAt: '',
    shiftDate: '',
    assignedStaffIds: [],
  });

  const [assignForStaffData, setAssignForStaffData] = useState<{
    isOpen: boolean;
    staff: ApiRecord | null;
    shiftDate: string;
    dayLabel: string;
    currentShiftName?: string;
  }>({
    isOpen: false,
    staff: null,
    shiftDate: '',
    dayLabel: '',
  });

  // Recurring schedule modal states
  const [applyWeeksModal, setApplyWeeksModal] = useState<{
    isOpen: boolean;
    scheduleData: any;
  }>({ isOpen: false, scheduleData: null });

  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    schedule: any;
  }>({ isOpen: false, schedule: null });

  // Calculate 7 dates of the week
  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(`${currentMonday}T00:00:00`);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [currentMonday]);

  const startDateIso = toIsoDate(weekDates[0]);

  // Queries
  const staffQuery = useQuery({
    queryKey: ['staff-list'],
    queryFn: () => getStaff({}),
  });

  const shiftsQuery = useQuery({
    queryKey: ['work-shifts'],
    queryFn: () => getShifts(),
  });

  const scheduleQuery = useQuery({
    queryKey: ['staff-schedule', startDateIso],
    queryFn: () => getSchedule(startDateIso),
  });
  const workSettingsQuery = useQuery({ queryKey: ['work-schedule-settings'], queryFn: getWorkScheduleSettings });

  // Mutations
  const addShiftMutation = useMutation({
    mutationFn: (newShift: ShiftFormValues) => createShift(newShift),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-shifts'] });
      notify('Đã tạo ca làm việc', 'Ca làm việc mới đã được lưu vào hệ thống.');
    },
    onError: (cause) => notify('Không thể thêm ca làm việc', errorMessage(cause, 'Vui lòng thử lại')),
  });

  const assignShiftMutation = useMutation({
    mutationFn: (data: { staffId: number; shiftDate: string; startsAt: string; endsAt: string; shiftName: string; applyToWeeks?: number }) =>
      assignShift(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-schedule'] });
      setAssignModalData((prev) => ({ ...prev, isOpen: false }));
      setAssignForStaffData((prev) => ({ ...prev, isOpen: false }));
      notify('Đã cập nhật lịch', 'Lịch làm việc của nhân viên đã được cập nhật.');
    },
    onError: (cause) => notify('Không thể phân ca', errorMessage(cause, 'Vui lòng thử lại')),
  });
  const workSettingsMutation = useMutation({
    mutationFn: updateWorkScheduleSettings,
    onSuccess: (payload) => {
      setActiveWorkDays(payload.data.activeWorkDays as string[]);
      setHolidaysList((payload.data.holidays ?? []) as Array<{ id: number; name: string; fromDate: string; toDate: string; daysCount: number }>);
      queryClient.invalidateQueries({ queryKey: ['work-schedule-settings'] });
      notify('Đã lưu thiết lập', 'Ngày làm việc và các kỳ nghỉ đã được lưu vào hệ thống.');
      setIsSettingDaysOpen(false);
    },
    onError: (cause) => notify('Không thể lưu thiết lập', errorMessage(cause, 'Vui lòng thử lại')),
  });

  useEffect(() => {
    const settings = workSettingsQuery.data?.data;
    if (!settings) return;
    setActiveWorkDays(settings.activeWorkDays);
    setHolidaysList((settings.holidays ?? []) as Array<{ id: number; name: string; fromDate: string; toDate: string; daysCount: number }>);
  }, [workSettingsQuery.data]);

  // WebSocket subscription for real-time schedule updates
  useEffect(() => {
    const unsub = subscribe('staff:schedule_changed', () => {
      queryClient.invalidateQueries({ queryKey: ['staff-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['work-shifts'] });
    });
    return unsub;
  }, [subscribe, queryClient]);

  const staffList = (staffQuery.data?.data ?? []) as ApiRecord[];

  const workShifts = (shiftsQuery.data?.data ?? scheduleQuery.data?.data?.shifts ?? []) as Array<{
    name: string;
    startsAt: string;
    endsAt: string;
    color?: string;
  }>;

  // The schedule API returns its assignments in `schedules` and uses `shiftDate`.
  // Normalize the legacy aliases too, so existing cached payloads continue to render.
  const schedules = useMemo<ApiRecord[]>(
    () => {
      const rawSchedules = (scheduleQuery.data?.data?.schedules ?? scheduleQuery.data?.data?.shifts ?? []) as ApiRecord[];
      return rawSchedules.map((schedule) => ({
        ...schedule,
        date: schedule.shiftDate ?? schedule.date,
      }));
    },
    [scheduleQuery.data],
  );
  const isLoading = staffQuery.isLoading || shiftsQuery.isLoading || scheduleQuery.isLoading;

  // Filter staff by search term
  const filteredStaffList = useMemo(() => {
    if (!searchTerm.trim()) return staffList;
    const term = searchTerm.toLowerCase();
    return staffList.filter(
      (s) => s.name.toLowerCase().includes(term) || s.code.toLowerCase().includes(term)
    );
  }, [staffList, searchTerm]);

  // Generate or lookup shift for a staff on a date (with attendance info)
  const getStaffDateShift = (staff: ApiRecord, date: Date) => {
    const dateStr = toIsoDate(date);

    const matched = schedules.find((s) => Number(s.staffId) === Number(staff.id) && s.date === dateStr);
    if (matched) {
      return {
        id: matched.id,
        shiftName: matched.shiftName,
        startsAt: matched.startsAt,
        endsAt: matched.endsAt,
        status: matched.status,
        // Thông tin chấm công - phải có cả check-in VÀ check-out mới tính là hoàn thành
        hasAttendance: matched.hasAttendance ?? false,
        hasCheckIn: matched.hasCheckIn ?? false,
        hasCheckOut: matched.hasCheckOut ?? false,
        checkIn: matched.checkIn ?? null,
        checkOut: matched.checkOut ?? null,
        lateMinutes: matched.lateMinutes ?? 0,
        earlyMinutes: matched.earlyMinutes ?? 0,
      };
    }

    return null;
  };

  // Calculate Expected Salary for each staff for the current 7 days
  // Chỉ tính ca CÓ ĐỦ check-in VÀ check-out
  const staffSalaryData = useMemo(() => {
    const results: Record<number, { expectedSalary: number | null; totalShifts: number; attendedShifts: number; salaryType: string }> = {};

    filteredStaffList.forEach((staff) => {
      const setting = {
        salaryType: staff.salaryType,
        baseSalary: staff.baseSalary,
        hourlyRate: staff.hourlyRate,
      };

      // Lấy tất cả ca được xếp lịch trong tuần
      const allShifts = weekDates
        .map((d) => getStaffDateShift(staff, d))
        .filter((s): s is NonNullable<typeof s> => s !== null);

      // Chỉ đếm ca CÓ ĐỦ check-in VÀ check-out
      const attendedShifts = allShifts
        .filter((s) => s.hasCheckIn && s.hasCheckOut)
        .map((s) => ({ shiftName: s.shiftName, startsAt: s.startsAt, endsAt: s.endsAt }));

      const calc = calculateStaffShiftSalary(setting, attendedShifts, workDaysPerMonth);

      results[staff.id] = {
        expectedSalary: calc.expectedSalary,
        totalShifts: allShifts.length,
        attendedShifts: attendedShifts.length,
        salaryType: calc.salaryType,
      };
    });

    return results;
  }, [filteredStaffList, weekDates, workDaysPerMonth, schedules]);

  // Grand Total of Expected Salary for the entire salon this week
  const grandTotalExpectedSalary = useMemo(() => {
    let sum = 0;
    Object.values(staffSalaryData).forEach((item) => {
      if (item.expectedSalary !== null) {
        sum += item.expectedSalary;
      }
    });
    return sum;
  }, [staffSalaryData]);

  // Open modal to assign shift to staff for a specific day
  const handleOpenAssignForStaff = (staff: ApiRecord, date: Date, currentShiftName?: string) => {
    const dayOfWeek = (date.getDay() + 6) % 7;
    setAssignForStaffData({
      isOpen: true,
      staff,
      shiftDate: toIsoDate(date),
      dayLabel: weekdayLabels[dayOfWeek],
      currentShiftName,
    });
  };

  // Recurring schedule handlers
  const handleAssignShift = (data: Parameters<typeof assignShift>[0]) => {
    assignShiftMutation.mutate(data);
  };

  const handleDeleteSchedule = async (scheduleId: number, deleteFuture: boolean) => {
    try {
      const response = await fetch(`/api/v1/staff/schedule/${scheduleId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteAllRecurring: deleteFuture })
      });

      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['staff-schedule'] });
        notify('Đã xóa lịch', 'Lịch làm việc đã được xóa.');
      }
    } catch (error) {
      console.error('Failed to delete schedule:', error);
      notify('Lỗi', 'Không thể xóa lịch. Vui lòng thử lại.');
    }
  };

  // Get week label for display
  const getWeekLabel = (dateStr: string): string => {
    const date = new Date(dateStr);
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return String(Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7));
  };

  // Get current week label for ApplyWeeksModal
  const currentWeekLabel = getWeekLabel(startDateIso);

  // Shift Matrix getSlotData for 'by-shift' mode
  const getShiftSlotData = (shift: { name: string; startsAt: string; endsAt: string }, date: Date) => {
    const dateStr = toIsoDate(date);
    const matchedSchedules = schedules.filter(
      (s) => s.date === dateStr && (s.shiftName === shift.name || (s.startsAt === shift.startsAt && s.endsAt === shift.endsAt))
    );

    if (matchedSchedules.length > 0) {
      return matchedSchedules.map((sc) => {
        const staff = staffList.find((st) => st.id === sc.staffId) || { name: 'Nhân viên', code: `NV${sc.staffId}` };
        return {
          id: sc.id,
          staffId: sc.staffId,
          staffName: staff.name,
          staffCode: staff.code,
          status: sc.status === 'leave' ? 'leave' : 'ontime',
          detailText: sc.status === 'leave' ? 'Nghỉ phép' : `${sc.startsAt} - ${sc.endsAt}`,
        };
      });
    }

    return [];
  };

  return (
    <main className="attendance-page">
      <div className="attendance-container">
        {/* =================================================================== */}
        {/* TOPBAR TOOLBAR                                                      */}
        {/* =================================================================== */}
        <div className="attendance-toolbar-card">
          <div className="attendance-toolbar-left">
            <h1 className="attendance-title">Lịch làm việc</h1>

            {/* Search Input */}
            <div className="attendance-search-box">
              <i className="ph ph-magnifying-glass" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm kiếm nhân viên"
                className="attendance-search-input"
              />
              <i className="ph ph-caret-down" />
            </div>

            {/* WeekPicker Component */}
            <WeekPicker currentMonday={currentMonday} onChange={setCurrentMonday} />

            {/* Quick button to jump to This Week */}
            <button
              type="button"
              onClick={() => setCurrentMonday(weekStartIso())}
              className="week-btn-choose"
              style={{ fontWeight: currentMonday === weekStartIso() ? 700 : 500 }}
            >
              Tuần này
            </button>
          </div>

          {/* Right Action Buttons */}
          <div className="attendance-toolbar-right">
            {/* View Mode Selector: Xem theo nhân viên / Xem theo ca */}
            <div className="attendance-select-wrap">
              <Select<'by-staff' | 'by-shift'>
                value={viewMode}
                onChange={setViewMode}
                triggerClassName="attendance-select"
                triggerStyle={{ fontWeight: 600, color: '#0284c7' }}
                size="sm"
                options={[{ value: 'by-staff', label: '👤 Xem theo nhân viên' }, { value: 'by-shift', label: '📅 Xem theo ca' }]}
              />
            </div>

            {/* Thêm ca làm việc nhanh */}
            <button
              type="button"
              onClick={() => setIsAddShiftOpen(true)}
              className="attendance-action-btn"
            >
              <i className="ph ph-plus-circle primary-icon" />
              <span>Thêm ca làm</span>
            </button>

            {/* Import Button */}
            <button
              type="button"
              onClick={() => notify('Tính năng Import', 'Bạn có thể tải lên file excel mẫu lịch làm việc.')}
              className="attendance-action-btn"
            >
              <i className="ph ph-file-arrow-up" style={{ color: '#475569', fontSize: 16 }} />
              <span>Import</span>
            </button>

            {/* Xuất file */}
            <button
              type="button"
              onClick={() => notify('Đang xuất file', 'Đang tạo bảng tính Excel lịch làm việc...')}
              className="attendance-action-btn"
            >
              <i className="ph ph-export" style={{ color: '#475569', fontSize: 16 }} />
              <span>Xuất file</span>
            </button>

            {/* Cài đặt ngày công trong tháng */}
            <button
              type="button"
              onClick={() => setIsSettingDaysOpen(true)}
              className="attendance-action-btn icon-only"
              title="Thiết lập ngày công chuẩn trong tháng"
            >
              <i className="ph ph-gear" style={{ fontSize: 18 }} />
            </button>
          </div>
        </div>

        {/* =================================================================== */}
        {/* MAIN CONTENT AREA                                                   */}
        {/* =================================================================== */}
        {isLoading ? (
          <div className="attendance-table-card" style={{ padding: 48 }}>
            <LoadingState />
          </div>
        ) : viewMode === 'by-staff' ? (
          /* =================================================================== */
          /* CHẾ ĐỘ 1: XEM THEO NHÂN VIÊN (CHUẨN KIOTVIET)                       */
          /* =================================================================== */
          <div className="attendance-table-card">
            <div className="attendance-table-wrap">
              <table className="staff-schedule-table">
                {/* Table Header */}
                <thead>
                  <tr className="schedule-header-row">
                    {/* Cột 1: Nhân viên */}
                    <th className="col-staff-header">Nhân viên</th>

                    {/* 7 Cột Thứ trong tuần (Được chia đều chính xác 1fr) */}
                    {weekDates.map((date, idx) => {
                      const iso = toIsoDate(date);
                      const isToday = iso === todayIso();
                      const dayNumber = date.getDate();
                      return (
                        <th key={iso} className={`col-day-header ${isToday ? 'is-today-col' : ''}`}>
                          <div className="day-header-content">
                            <span className={`day-title ${isToday ? 'is-today-text' : ''}`}>
                              {weekdayLabels[idx]}
                            </span>
                            {isToday ? (
                              <span className="day-number is-today-badge">{dayNumber}</span>
                            ) : (
                              <span className="day-number">
                                {dayNumber < 10 ? `0${dayNumber}` : dayNumber}
                              </span>
                            )}
                          </div>
                        </th>
                      );
                    })}

                    {/* Cột cuối: Lương dự kiến */}
                    <th className="col-salary-header">
                      <div className="salary-header-top">
                        <span>Lương dự kiến</span>
                        <i
                          className="ph ph-info"
                          title="Lương dự kiến = Lương ca làm việc của nhân viên trong tuần (chưa bao gồm hoa hồng / phụ cấp / thưởng phạt)"
                        />
                      </div>
                      <div className="salary-header-total">
                        {formatMoney(grandTotalExpectedSalary)}
                      </div>
                    </th>
                  </tr>
                </thead>

                {/* Table Body */}
                <tbody>
                  {filteredStaffList.map((staff) => {
                    const salData = staffSalaryData[staff.id] || {
                      expectedSalary: null,
                      totalShifts: 0,
                      salaryType: 'none',
                    };

                    return (
                      <tr key={staff.id} className="staff-schedule-row">
                        {/* Cột 1: Thông tin nhân viên */}
                        <td className="cell-staff-info">
                          <div className="staff-name-bold">{staff.name}</div>
                          <div className="staff-code-sub">{staff.code}</div>
                        </td>

                        {/* 7 Cột Ngày làm việc trong tuần */}
                        {weekDates.map((date, dIdx) => {
                          const shiftData = getStaffDateShift(staff, date);
                          const scheduleItem = schedules.find(
                            (s) => Number(s.staffId) === Number(staff.id) && s.date === toIsoDate(date)
                          );
                          const isRecurring = Boolean(scheduleItem?.weekGroupId);

                          return (
                            <td
                              key={dIdx}
                              className="cell-day-slot"
                              onClick={() =>
                                handleOpenAssignForStaff(staff, date, shiftData?.shiftName)
                              }
                            >
                              {shiftData ? (
                                <div
                                  className={`staff-pill-card ${getShiftThemeClass(
                                    shiftData.shiftName
                                  )}`}
                                  title={`${shiftData.shiftName} (${shiftData.startsAt} - ${shiftData.endsAt})${shiftData.checkIn ? ` | Vào: ${shiftData.checkIn}` : ''}${shiftData.checkOut ? ` | Ra: ${shiftData.checkOut}` : ''}${shiftData.lateMinutes > 0 ? ` | Muộn: ${shiftData.lateMinutes}p` : ''}${shiftData.earlyMinutes > 0 ? ` | Sớm: ${shiftData.earlyMinutes}p` : ''}`}
                                >
                                  {isRecurring && <ScheduleBadge />}
                                  <div className="shift-content">
                                    <span>{shiftData.shiftName}</span>
                                    {shiftData.hasCheckIn && shiftData.hasCheckOut ? (
                                      <i className="ph ph-check-circle" style={{ color: '#22c55e', marginLeft: 4 }} title="Đã chấm công đủ" />
                                    ) : shiftData.hasCheckIn ? (
                                      <i className="ph ph-clock" style={{ color: '#f59e0b', marginLeft: 4 }} title="Đã chấm vào, chưa chấm ra" />
                                    ) : shiftData.hasAttendance ? (
                                      <i className="ph ph-warning-circle" style={{ color: '#ef4444', marginLeft: 4 }} title="Chưa chấm vào" />
                                    ) : null}
                                  </div>
                                </div>
                              ) : (
                                <div className="cell-empty-hover">
                                  <span className="btn-add-schedule-text">+ Thêm lịch</span>
                                </div>
                              )}
                            </td>
                          );
                        })}

                        {/* Cột cuối: Lương dự kiến của nhân viên */}
                        <td className="cell-salary-value">
                          {salData.expectedSalary !== null ? (
                            <div className="salary-calc-box">
                              <div className="salary-amount">
                                {formatMoney(salData.expectedSalary)}
                              </div>
                              <div className="salary-shifts-count">
                                {salData.attendedShifts}/{salData.totalShifts} ca đã chấm
                              </div>
                            </div>
                          ) : salData.totalShifts > 0 ? (
                            <div className="salary-calc-box">
                              <div className="salary-amount" style={{ color: '#94a3b8' }}>
                                0đ
                              </div>
                              <div className="salary-shifts-count" style={{ color: '#ef4444' }}>
                                {salData.attendedShifts}/{salData.totalShifts} ca đã chấm
                              </div>
                            </div>
                          ) : (
                            <div className="salary-unconfigured">Chưa thiết lập lương</div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Legend Bar (Chú thích màu các ca) */}
            <div className="schedule-legend-bar">
              {workShifts.map((shift) => (
                <div className="legend-item" key={`${shift.name}-${shift.startsAt}`}>
                  <span className={`legend-chip ${getShiftThemeClass(shift.name).replace('theme-', 'chip-')}`}>
                    {shift.name}
                  </span>
                  <span>{shift.startsAt} - {shift.endsAt}</span>
                </div>
              ))}
              <div className="legend-item" style={{ marginLeft: 'auto', color: '#64748b', fontSize: 12 }}>
                <span>Ngày công chuẩn trong tháng: <strong>{workDaysPerMonth} ngày</strong></span>
              </div>
            </div>
          </div>
        ) : (
          /* =================================================================== */
          /* CHẾ ĐỘ 2: XEM THEO CA (LƯỚI CA X THỨ)                                */
          /* =================================================================== */
          <div className="attendance-table-card">
            <div className="attendance-table-wrap">
              <table className="attendance-matrix-table">
                <thead>
                  <tr>
                    <th className="shift-col-header">
                      <div className="shift-col-header-inner">
                        <span>Ca làm việc</span>
                        <button
                          type="button"
                          onClick={() => setIsAddShiftOpen(true)}
                          className="btn-add-shift-plus"
                          title="Thêm ca làm việc mới"
                        >
                          <i className="ph ph-plus" />
                        </button>
                      </div>
                    </th>
                    {weekDates.map((date, idx) => {
                      const iso = toIsoDate(date);
                      const isToday = iso === todayIso();
                      const dayNumber = date.getDate();
                      return (
                        <th key={iso}>
                          <div className="day-col-header-inner">
                            <span className={`day-col-title ${isToday ? 'is-today' : ''}`}>
                              {weekdayLabels[idx]}
                            </span>
                            {isToday ? (
                              <span className="day-badge-num is-today-circle">{dayNumber}</span>
                            ) : (
                              <span className="day-badge-num">
                                {dayNumber < 10 ? `0${dayNumber}` : dayNumber}
                              </span>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {workShifts.map((shift, sIdx) => (
                    <tr key={sIdx}>
                      <td className="shift-info-cell">
                        <div className="shift-name-text">{shift.name}</div>
                        <div className="shift-time-text">
                          {shift.startsAt} - {shift.endsAt}
                        </div>
                      </td>
                      {weekDates.map((date, dIdx) => {
                        const cellData = getShiftSlotData(shift, date);
                        const assignedIds = cellData.map((c) => Number(c.staffId)).filter(Boolean);

                        return (
                          <td key={dIdx} className="day-slot-cell">
                            {cellData.length === 0 ? (
                              <div
                                onClick={() => {
                                  setAssignModalData({
                                    isOpen: true,
                                    shiftName: shift.name,
                                    startsAt: shift.startsAt,
                                    endsAt: shift.endsAt,
                                    shiftDate: toIsoDate(date),
                                    assignedStaffIds: assignedIds,
                                  });
                                }}
                                className="empty-slot-btn"
                                title="Click để xếp nhân viên"
                              >
                                <span>Chọn để xếp nhân viên làm việc cho ca.</span>
                              </div>
                            ) : (
                              <div className="slot-staff-list">
                                {cellData.map((item) => (
                                  <div
                                    key={item.id}
                                    className={`staff-shift-card status-${item.status}`}
                                  >
                                    <div className="card-staff-name">{item.staffName}</div>
                                    <div className="card-staff-detail">{item.detailText}</div>
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAssignModalData({
                                      isOpen: true,
                                      shiftName: shift.name,
                                      startsAt: shift.startsAt,
                                      endsAt: shift.endsAt,
                                      shiftDate: toIsoDate(date),
                                      assignedStaffIds: assignedIds,
                                    });
                                  }}
                                  className="btn-slot-add-more"
                                >
                                  <i className="ph ph-plus-circle" />
                                  <span>Xếp thêm</span>
                                </button>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal Thêm ca làm việc mới */}
      <AddShiftModal
        isOpen={isAddShiftOpen}
        onClose={() => setIsAddShiftOpen(false)}
        onSubmit={(newShift) => addShiftMutation.mutate(newShift)}
      />

      {/* Modal Xếp nhân viên vào ca (Dành cho view theo Ca) */}
      <AssignStaffModal
        isOpen={assignModalData.isOpen}
        onClose={() => setAssignModalData((prev) => ({ ...prev, isOpen: false }))}
        shiftName={assignModalData.shiftName}
        startsAt={assignModalData.startsAt}
        endsAt={assignModalData.endsAt}
        shiftDate={assignModalData.shiftDate}
        staffList={staffList}
        assignedStaffIds={assignModalData.assignedStaffIds}
        onAssign={(staffId) =>
          assignShiftMutation.mutate({
            staffId,
            shiftDate: assignModalData.shiftDate,
            startsAt: assignModalData.startsAt,
            endsAt: assignModalData.endsAt,
            shiftName: assignModalData.shiftName,
            applyToWeeks: 1,
          })
        }
      />

      {/* Modal Xếp ca cho 1 nhân viên (Dành cho view theo Nhân viên) */}
      <AssignShiftForStaffModal
        isOpen={assignForStaffData.isOpen}
        onClose={() => setAssignForStaffData((prev) => ({ ...prev, isOpen: false }))}
        staff={assignForStaffData.staff}
        shiftDate={assignForStaffData.shiftDate}
        dayLabel={assignForStaffData.dayLabel}
        workShifts={workShifts}
        currentShiftName={assignForStaffData.currentShiftName}
        onAssign={(shift) => {
          if (!assignForStaffData.staff) return;
          // Close staff modal, open ApplyWeeksModal to ask how many weeks
          setAssignForStaffData((prev) => ({ ...prev, isOpen: false }));
          setApplyWeeksModal({
            isOpen: true,
            scheduleData: {
              staffId: assignForStaffData.staff.id,
              shiftDate: assignForStaffData.shiftDate,
              startsAt: shift.startsAt,
              endsAt: shift.endsAt,
              shiftName: shift.name,
            },
          });
        }}
        onRemove={() => {
          // Find existing schedule for this staff + date, open delete modal
          if (!assignForStaffData.staff) return;
          const existingSchedule = schedules.find(
            (s) => Number(s.staffId) === Number(assignForStaffData.staff!.id)
              && s.date === assignForStaffData.shiftDate
          );
          if (existingSchedule) {
            setAssignForStaffData((prev) => ({ ...prev, isOpen: false }));
            setDeleteModal({ isOpen: true, schedule: existingSchedule });
          }
        }}
      />

      {/* Modal Thiết lập Ngày làm việc & Ngày lễ, tết (Chuẩn KiotViet) */}
      {isSettingDaysOpen && (
        <div className="modal-overlay" onClick={() => setIsSettingDaysOpen(false)}>
          <div
            className="modal-dialog work-settings-modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Thiết lập ngày làm & ngày nghỉ</h3>
                <p className="modal-subtitle">Cài đặt 1 lần để hệ thống tự động suy ra số ngày công chuẩn theo từng tháng</p>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingDaysOpen(false)}
                className="modal-close-btn"
              >
                <i className="ph ph-x" />
              </button>
            </div>

            <div className="work-settings-modal-body">
              {/* Phần 1: Ngày làm việc trong tuần của chi nhánh */}
              <div className="work-settings-section">
                <div className="work-settings-section-header">
                  <div>
                    <h4 className="work-settings-section-title">Ngày làm việc</h4>
                    <p className="work-settings-section-sub">Thiết lập các ngày salon mở cửa hoạt động trong tuần</p>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#0284c7' }}>
                    {activeWorkDays.join(', ')} ({activeWorkDays.length} ngày/tuần)
                  </span>
                </div>
                <div className="work-days-checkboxes">
                  {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => {
                    const isChecked = activeWorkDays.includes(day);
                    return (
                      <label
                        key={day}
                        className={`weekday-check-label ${isChecked ? 'is-checked' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setActiveWorkDays([...activeWorkDays, day]);
                            } else {
                              if (activeWorkDays.length > 1) {
                                setActiveWorkDays(activeWorkDays.filter((d) => d !== day));
                              }
                            }
                          }}
                        />
                        <span>{day === 'CN' ? 'Chủ nhật' : `Thứ ${day.slice(1)}`}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Phần 2: Ngày lễ, tết */}
              <div className="work-settings-section">
                <div className="work-settings-section-header">
                  <div>
                    <h4 className="work-settings-section-title">Ngày lễ, tết</h4>
                    <p className="work-settings-section-sub">Thiết lập các ngày lễ, tết được nghỉ hưởng nguyên lương</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddHolidayOpen(true)}
                    className="btn-add-holiday"
                  >
                    <i className="ph ph-plus" />
                    <span>Thêm kỳ lễ tết</span>
                  </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="holidays-table">
                    <thead>
                      <tr>
                        <th style={{ width: 50, textAlign: 'center' }}>STT</th>
                        <th>Tên kỳ lễ tết</th>
                        <th>Từ ngày</th>
                        <th>Đến hết ngày</th>
                        <th style={{ textAlign: 'center' }}>Số ngày</th>
                        <th style={{ width: 80, textAlign: 'center' }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {holidaysList.map((holiday, idx) => (
                        <tr key={holiday.id}>
                          <td style={{ textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                          <td style={{ fontWeight: 600 }}>{holiday.name}</td>
                          <td>{holiday.fromDate}</td>
                          <td>{holiday.toDate}</td>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{holiday.daysCount}</td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                              <button
                                type="button"
                                className="btn-icon-action danger"
                                title="Xóa kỳ nghỉ này"
                                onClick={() => {
                                  setHolidaysList(holidaysList.filter((h) => h.id !== holiday.id));
                                  notify('Đã xóa kỳ nghỉ', `Đã xóa ${holiday.name}`);
                                }}
                              >
                                <i className="ph ph-trash" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setIsSettingDaysOpen(false)}
                className="btn-secondary"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  // Auto compute workDays based on active days (e.g. 7 days/week ≈ 30/31 days/mo, 6 days ≈ 26 days/mo)
                  const estimatedDays = Math.round((activeWorkDays.length / 7) * 30);
                  setWorkDaysPerMonth(estimatedDays);
                  workSettingsMutation.mutate({ activeWorkDays, holidays: holidaysList });
                }}
                className="btn-primary"
                disabled={workSettingsMutation.isPending}
              >
                {workSettingsMutation.isPending ? 'Đang lưu...' : 'Lưu cài đặt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Thêm kỳ lễ tết con */}
      {isAddHolidayOpen && (
        <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={() => setIsAddHolidayOpen(false)}>
          <div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 420 }}
          >
            <div className="modal-header">
              <h3 className="modal-title">Thêm kỳ lễ, tết</h3>
              <button
                type="button"
                onClick={() => setIsAddHolidayOpen(false)}
                className="modal-close-btn"
              >
                <i className="ph ph-x" />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group-row">
                <label className="form-label-col" style={{ width: 100 }}>
                  Tên kỳ lễ:
                </label>
                <div className="form-control-col">
                  <input
                    type="text"
                    placeholder="VD: Ngày Nhà giáo VN"
                    value={newHolidayName}
                    onChange={(e) => setNewHolidayName(e.target.value)}
                    className="form-input-text"
                  />
                </div>
              </div>
              <div className="form-group-row">
                <label className="form-label-col" style={{ width: 100 }}>
                  Từ ngày:
                </label>
                <div className="form-control-col">
                  <DatePickerField
                    value={newHolidayFrom}
                    onChange={setNewHolidayFrom}
                    className="form-input-text"
                  />
                </div>
              </div>
              <div className="form-group-row">
                <label className="form-label-col" style={{ width: 100 }}>
                  Đến ngày:
                </label>
                <div className="form-control-col">
                  <DatePickerField
                    value={newHolidayTo}
                    onChange={setNewHolidayTo}
                    className="form-input-text"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setIsAddHolidayOpen(false)}
                className="btn-secondary"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!newHolidayName.trim()) {
                    notify('Thiếu thông tin', 'Vui lòng nhập tên kỳ lễ tết');
                    return;
                  }
                  const newId = Date.now();
                  setHolidaysList([
                    ...holidaysList,
                    {
                      id: newId,
                      name: newHolidayName.trim(),
                      fromDate: newHolidayFrom || '20/11/2026',
                      toDate: newHolidayTo || newHolidayFrom || '20/11/2026',
                      daysCount: 1,
                    },
                  ]);
                  setNewHolidayName('');
                  setNewHolidayFrom('');
                  setNewHolidayTo('');
                  setIsAddHolidayOpen(false);
                  notify('Đã thêm kỳ lễ', 'Kỳ nghỉ lễ mới đã được thêm vào danh sách.');
                }}
                className="btn-primary"
              >
                Thêm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recurring Schedule Modals */}
      <ApplyWeeksModal
        isOpen={applyWeeksModal.isOpen}
        onClose={() => setApplyWeeksModal({ isOpen: false, scheduleData: null })}
        onConfirm={(options) => {
          handleAssignShift({
            ...applyWeeksModal.scheduleData,
            applyToWeeks: options.weeks,
            skipLeaves: options.skipLeaves,
            skipHolidays: options.skipHolidays
          });
        }}
        currentWeekLabel={currentWeekLabel}
      />

      <DeleteScheduleModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, schedule: null })}
        onConfirm={(deleteAllRecurring) => {
          if (deleteModal.schedule) {
            handleDeleteSchedule(deleteModal.schedule.id, deleteAllRecurring);
          }
        }}
        weekLabel={deleteModal.schedule?.date ? getWeekLabel(deleteModal.schedule.date) : ''}
        isRecurring={Boolean(deleteModal.schedule?.weekGroupId)}
      />
    </main>
  );
}
