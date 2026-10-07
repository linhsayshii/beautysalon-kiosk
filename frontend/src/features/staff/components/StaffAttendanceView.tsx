import { useState, useMemo, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ErrorState, LoadingState } from '@/components/data-display/DataState';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { PageHeader } from '@/components/ui/PageHeader/PageHeader';
import { Select } from '@/components/ui/Select/Select';
import { errorMessage } from '@/services/api-client';
import { todayIso, toIsoDate, weekStartIso } from '@/lib/date';
import type { ApiRecord } from '@/types/api';
import { calculateAttendanceForShift } from '../attendance-calculation';
import { WeekPicker } from './WeekPicker';
import { AddShiftModal, ShiftFormValues } from './AddShiftModal';
import { AssignStaffModal } from './AssignStaffModal';
import { StaffAttendanceDetail } from './StaffAttendanceDetail';
import {
  getStaff,
  getShifts,
  createShift,
  getSchedule,
  getAttendance,
  assignShift,
} from '../staff.api';

const weekdayLabels = ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật'];

export function StaffAttendanceView() {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [currentMonday, setCurrentMonday] = useState(weekStartIso());
  const [viewMode, setViewMode] = useState<'by-shift' | 'by-staff'>('by-shift');
  const [searchTerm, setSearchTerm] = useState('');
  const [timeUnit, setTimeUnit] = useState<'week' | 'month'>('week');
  const [expandedStaffId, setExpandedStaffId] = useState<number | null>(null);

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

  // Calculate 7 dates of the week
  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(`${currentMonday}T00:00:00`);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [currentMonday]);

  const startDateIso = toIsoDate(weekDates[0]);
  const endDateIso = toIsoDate(weekDates[6]);

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

  const attendanceQuery = useQuery({
    queryKey: ['staff-attendance', startDateIso, endDateIso],
    queryFn: () => getAttendance(startDateIso, endDateIso),
  });

  // Mutations
  const addShiftMutation = useMutation({
    mutationFn: (newShift: ShiftFormValues) => createShift(newShift),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-shifts'] });
    },
    onError: (cause) => notify('Không thể thêm ca làm việc', errorMessage(cause, 'Vui lòng thử lại')),
  });

  const assignShiftMutation = useMutation({
    mutationFn: (data: { staffId: number; shiftDate: string; startsAt: string; endsAt: string; shiftName: string; applyToWeeks?: number }) =>
      assignShift(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-schedule'] });
      setAssignModalData((prev) => ({ ...prev, isOpen: false }));
    },
    onError: (cause) => notify('Không thể phân ca', errorMessage(cause, 'Vui lòng thử lại')),
  });

  const staffList = (staffQuery.data?.data ?? []) as ApiRecord[];
  const workShifts = (shiftsQuery.data?.data ?? []) as Array<{ name: string; startsAt: string; endsAt: string }>;

  // `getSchedule` returns the definitions in `shifts` and the staff assignments
  // in `schedules`. Keep the latter as the single source for the attendance grid.
  const schedules = useMemo<ApiRecord[]>(() => {
    const rawSchedules = (scheduleQuery.data?.data?.schedules ?? []) as ApiRecord[];
    return rawSchedules.map((schedule) => ({
      ...schedule,
      date: schedule.shiftDate ?? schedule.date,
    }));
  }, [scheduleQuery.data]);
  const attendanceRecords = (attendanceQuery.data?.data ?? []) as ApiRecord[];

  const isLoading = staffQuery.isLoading || shiftsQuery.isLoading || scheduleQuery.isLoading || attendanceQuery.isLoading;
  const queryError = staffQuery.error || shiftsQuery.error || scheduleQuery.error || attendanceQuery.error;

  // Filter staff by search term
  const filteredStaffList = useMemo(() => {
    if (!searchTerm.trim()) return staffList;
    const term = searchTerm.toLowerCase();
    return staffList.filter(
      (s) => s.name.toLowerCase().includes(term) || s.code.toLowerCase().includes(term)
    );
  }, [staffList, searchTerm]);

  // Attendance is derived only from the shifts assigned in the work schedule.
  const getSlotData = (shift: { name: string; startsAt: string; endsAt: string }, date: Date) => {
    const dateStr = toIsoDate(date);
    const matchedSchedules = schedules.filter(
      (s) => s.date === dateStr && (s.shiftName === shift.name || (s.startsAt === shift.startsAt && s.endsAt === shift.endsAt))
    );

    if (matchedSchedules.length > 0) {
      return matchedSchedules.map((sc) => {
        const staff = staffList.find((st) => st.id === sc.staffId) || { name: 'Nhân viên', code: `NV${sc.staffId}` };
        const att = attendanceRecords.find(
          (ar) => ar.staff?.id === sc.staffId && ar.workDate?.slice(0, 10) === dateStr
        );

        const { status, detailText, subText } = calculateAttendanceForShift({
          date: dateStr,
          startsAt: String(sc.startsAt),
          endsAt: String(sc.endsAt),
          scheduleStatus: String(sc.status),
          attendance: att,
        });

        return {
          id: sc.id,
          staffId: sc.staffId,
          staffName: staff.name,
          staffCode: staff.code,
          status,
          detailText,
          subText,
        };
      });
    }

    return [];
  };

  const handleOpenAssign = (shift: { name: string; startsAt: string; endsAt: string }, date: Date, assignedIds: number[]) => {
    setAssignModalData({
      isOpen: true,
      shiftName: shift.name,
      startsAt: shift.startsAt,
      endsAt: shift.endsAt,
      shiftDate: toIsoDate(date),
      assignedStaffIds: assignedIds,
    });
  };

  return (
    <main className="page">
      <div className="page-stack">
        <PageHeader
          title="Bảng chấm công"
          subtitle="Theo dõi giờ vào, giờ ra của nhân viên theo từng ca."
                  />

        <div className="attendance-toolbar-card">
          <div className="attendance-toolbar-left">
            <label className="search-control attendance-search">
              <i className="ph ph-magnifying-glass" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm kiếm nhân viên"
                aria-label="Tìm kiếm nhân viên"
              />
            </label>

            <Select<'week' | 'month'>
              value={timeUnit}
              onChange={setTimeUnit}
              aria-label="Kỳ xem"
              options={[{ value: 'week', label: 'Theo tuần' }, { value: 'month', label: 'Theo tháng' }]}
            />

            <WeekPicker currentMonday={currentMonday} onChange={setCurrentMonday} />
          </div>

          <div className="attendance-toolbar-right">
            <Select<'by-shift' | 'by-staff'>
              value={viewMode}
              onChange={setViewMode}
              aria-label="Chế độ xem"
              options={[{ value: 'by-shift', label: 'Xem theo ca' }, { value: 'by-staff', label: 'Xem theo nhân viên' }]}
            />
          </div>
        </div>

        {/* Main Content Area */}
        {queryError ? (
          <div className="attendance-table-card">
            <ErrorState error={queryError} onRetry={() => { staffQuery.refetch(); shiftsQuery.refetch(); scheduleQuery.refetch(); attendanceQuery.refetch(); }} />
          </div>
        ) : isLoading ? (
          <div className="attendance-table-card">
            <LoadingState />
          </div>
        ) : viewMode === 'by-shift' ? (
          /* =================================================================== */
          /* CHẾ ĐỘ 1: XEM THEO CA (LƯỚI CA X THỨ)                                */
          /* =================================================================== */
          <div className="attendance-table-card">
            <div className="attendance-table-wrap">
              <table className="attendance-matrix-table">
                {/* Table Header */}
                <thead>
                  <tr>
                    {/* Cột Ca làm việc + nút '+' */}
                    <th className="shift-col-header">
                      <div className="shift-col-header-inner">
                        <span>Ca làm việc</span>
                        <button
                          type="button"
                          onClick={() => setIsAddShiftOpen(true)}
                          className="schedule-add-shift"
                          title="Thêm ca làm việc mới"
                        >
                          <i className="ph ph-plus" />
                        </button>
                      </div>
                    </th>

                    {/* 7 Cột Thứ trong tuần */}
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
                              <span className="day-badge-num is-today-circle">
                                {dayNumber}
                              </span>
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

                {/* Table Body */}
                <tbody>
                  {workShifts.map((shift, sIdx) => (
                    <tr key={sIdx}>
                      {/* Tên ca & Giờ */}
                      <td className="shift-info-cell">
                        <div className="shift-name-text">{shift.name}</div>
                        <div className="shift-time-text">
                          {shift.startsAt} - {shift.endsAt}
                        </div>
                      </td>

                      {/* 7 Ngày trong tuần */}
                      {weekDates.map((date, dIdx) => {
                        const cellData = getSlotData(shift, date);
                        const assignedIds = cellData.map((c) => Number(c.staffId)).filter(Boolean);

                        return (
                          <td key={dIdx} className="day-slot-cell">
                            {cellData.length === 0 ? (
                              <div
                                onClick={() => handleOpenAssign(shift, date, assignedIds)}
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
                                    {item.detailText && (
                                      <div className="card-staff-detail">{item.detailText}</div>
                                    )}
                                    {item.subText && (
                                      <div className="card-staff-sub">{item.subText}</div>
                                    )}
                                  </div>
                                ))}

                                {/* Nút thêm nhanh nhân viên vào ca */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenAssign(shift, date, assignedIds)}
                                  className="schedule-slot-add"
                                >
                                  <i className="ph ph-plus-circle" />
                                  <span>Thêm</span>
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

            {/* Bottom Legend Bar (Chú thích 5 màu KiotViet) */}
            <div className="attendance-legend-bar">
              <div className="legend-item">
                <span className="legend-dot dot-ontime" />
                <span>Đúng giờ</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot dot-late" />
                <span>Đi muộn / Về sớm</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot dot-missing" />
                <span>Chấm công thiếu</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot dot-unclocked" />
                <span>Chưa chấm công</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot dot-leave" />
                <span>Nghỉ làm</span>
              </div>
            </div>
          </div>
        ) : (
          /* =================================================================== */
          /* CHẾ ĐỘ 2: XEM THEO NHÂN VIÊN (BẢNG TỔNG HỢP CÔNG)                    */
          /* =================================================================== */
          <div className="attendance-table-card">
            <div className="attendance-table-wrap">
              <table className="attendance-summary-table">
                <thead>
                  <tr>
                    <th>Nhân viên</th>
                    <th>Loại lương</th>
                    <th>Đi làm</th>
                    <th>Nghỉ làm</th>
                    <th>Đi muộn</th>
                    <th>Về sớm</th>
                    <th>Làm thêm</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaffList.map((staff) => {
                    const isExpanded = expandedStaffId === staff.id;
                    const detailId = `staff-attendance-detail-${staff.id}`;

                    let salaryTypeText = 'Chưa thiết lập';
                    if (staff.salaryType === 'hourly' || staff.role?.includes('Kỹ thuật') || staff.role?.includes('Chính')) {
                      salaryTypeText = 'Theo giờ làm việc';
                    } else if (staff.salaryType === 'monthly') {
                      salaryTypeText = 'Theo ngày công chuẩn';
                    }

                    return (
                      <Fragment key={staff.id}>
                        <tr
                          className={`expandable-data-row ${isExpanded ? 'is-expanded' : ''}`}
                          onClick={() => setExpandedStaffId((current) => (current === staff.id ? null : staff.id))}
                          aria-expanded={isExpanded}
                          aria-controls={detailId}
                        >
                          <td>
                            <div className="summary-staff-name text-primary">{staff.name}</div>
                            <div className="summary-staff-code">{staff.code}</div>
                          </td>
                          <td>{salaryTypeText}</td>
                          <td colSpan={5} className="text-faint">
                            Nhân viên chưa có dữ liệu chấm công
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr id={detailId} className="expandable-detail-row">
                            <td colSpan={7}>
                              <StaffAttendanceDetail
                                staff={staff}
                                currentMonday={currentMonday}
                                workShifts={workShifts}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal Thêm ca làm việc */}
      <AddShiftModal
        isOpen={isAddShiftOpen}
        onClose={() => setIsAddShiftOpen(false)}
        onSubmit={(newShift) => addShiftMutation.mutate(newShift)}
      />

      {/* Modal Xếp nhân viên vào ca */}
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
    </main>
  );
}
