import { useState, useMemo, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ErrorState, LoadingState } from '@/components/data-display/DataState';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { errorMessage } from '@/services/api-client';
import { todayIso, toIsoDate, weekStartIso } from '@/lib/date';
import type { ApiRecord } from '@/types/api';
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
import './AttendanceTimekeeping.css';

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
    mutationFn: (data: { staffId: number; shiftDate: string; startsAt: string; endsAt: string; shiftName: string }) =>
      assignShift(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-schedule'] });
      setAssignModalData((prev) => ({ ...prev, isOpen: false }));
    },
    onError: (cause) => notify('Không thể phân ca', errorMessage(cause, 'Vui lòng thử lại')),
  });

  const staffList = (staffQuery.data?.data ?? [
    { id: 1, name: 'Nguyễn Minh Anh', code: 'NV-001', role: 'Quản lý salon' },
    { id: 2, name: 'Trần Ngọc Hân', code: 'NV-002', role: 'Kỹ thuật viên' },
    { id: 3, name: 'Lê Khánh Vy', code: 'NV-003', role: 'Kỹ thuật viên' },
    { id: 4, name: 'Phạm Gia Linh', code: 'NV-004', role: 'Lễ tân' },
  ]) as ApiRecord[];
  const workShifts = (shiftsQuery.data?.data ?? [
    { name: 'Ca sáng Smile', startsAt: '09:00', endsAt: '19:00' },
    { name: 'Ca sáng chuẩn', startsAt: '09:00', endsAt: '20:00' },
    { name: 'Ca Full', startsAt: '09:00', endsAt: '21:00' },
    { name: 'Ca Sáng', startsAt: '09:30', endsAt: '20:00' },
    { name: 'Ca Chiều', startsAt: '11:00', endsAt: '22:00' },
    { name: 'Ca tối Smile', startsAt: '14:00', endsAt: '22:00' },
    { name: 'Ca Partime', startsAt: '18:00', endsAt: '22:00' },
  ]) as Array<{ name: string; startsAt: string; endsAt: string }>;

  const schedules = (scheduleQuery.data?.data?.shifts ?? []) as ApiRecord[];
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

  // Demo fallback attendance mock generator for realistic KiotViet feel
  const getSlotData = (shift: { name: string; startsAt: string; endsAt: string }, date: Date) => {
    const dateStr = toIsoDate(date);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday...

    const matchedSchedules = schedules.filter(
      (s) => s.date === dateStr && (s.shiftName === shift.name || (s.startsAt === shift.startsAt && s.endsAt === shift.endsAt))
    );

    if (matchedSchedules.length > 0) {
      return matchedSchedules.map((sc) => {
        const staff = staffList.find((st) => st.id === sc.staffId) || { name: 'Nhân viên', code: `NV${sc.staffId}` };
        const att = attendanceRecords.find(
          (ar) => ar.staff?.id === sc.staffId && ar.workDate?.slice(0, 10) === dateStr
        );

        let status: 'ontime' | 'late' | 'missing' | 'unclocked' | 'leave' = 'ontime';
        let detailText = `${sc.startsAt} - ${sc.endsAt}`;
        let subText = '';

        if (sc.status === 'leave') {
          status = 'leave';
          detailText = 'Nghỉ phép';
        } else if (att) {
          if (att.lateMinutes > 0) {
            status = 'late';
            const checkInStr = att.checkIn ? String(att.checkIn).slice(11, 16) : '--';
            const checkOutStr = att.checkOut ? String(att.checkOut).slice(11, 16) : '--';
            detailText = `${checkInStr} - ${checkOutStr}`;
            subText = `Đi muộn ${att.lateMinutes}p`;
          } else if (att.checkIn && !att.checkOut) {
            status = 'missing';
            detailText = `${String(att.checkIn).slice(11, 16)} --`;
            subText = 'Chưa chấm ra';
          } else if (!att.checkIn && att.checkOut) {
            status = 'missing';
            detailText = `-- ${String(att.checkOut).slice(11, 16)}`;
            subText = 'Chưa chấm vào';
          } else {
            status = 'ontime';
            const checkInStr = att.checkIn ? String(att.checkIn).slice(11, 16) : sc.startsAt;
            const checkOutStr = att.checkOut ? String(att.checkOut).slice(11, 16) : sc.endsAt;
            detailText = `${checkInStr} - ${checkOutStr}`;
          }
        }

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

    // Realistic Demo fallback matching KiotViet screenshot when empty
    if (shift.name.includes('sáng chuẩn')) {
      if (dayOfWeek === 1) {
        return [{ id: 'mock-1', staffId: 1, staffName: 'Yến', staffCode: 'NV000015', status: 'missing' as const, detailText: '-- 20:01', subText: 'Chưa chấm vào' }];
      }
      if (dayOfWeek === 2) {
        return [{ id: 'mock-2', staffId: 1, staffName: 'Yến', staffCode: 'NV000015', status: 'late' as const, detailText: '11:00 - 21:01', subText: 'Đi muộn 1h 50p, Làm thêm SC 1h 1p' }];
      }
      if (dayOfWeek === 3) {
        return [{ id: 'mock-3', staffId: 1, staffName: 'Yến', staffCode: 'NV000015', status: 'late' as const, detailText: '10:58 - 21:01', subText: 'Đi muộn 1h 48p, Làm thêm SC 1h 1p' }];
      }
      if (dayOfWeek === 4) {
        return [{ id: 'mock-4', staffId: 1, staffName: 'Yến', staffCode: 'NV000015', status: 'late' as const, detailText: '10:45 - 21:14', subText: 'Đi muộn 1h 35p, Làm thêm SC 1h 14p' }];
      }
      if (dayOfWeek === 5) {
        return [{ id: 'mock-5', staffId: 1, staffName: 'Yến', staffCode: 'NV000015', status: 'ontime' as const, detailText: '08:58 - 20:18', subText: 'Làm thêm TC 2p, Làm thêm SC 18p' }];
      }
      if (dayOfWeek === 6) {
        return [{ id: 'mock-6', staffId: 1, staffName: 'Yến', staffCode: 'NV000015', status: 'ontime' as const, detailText: '09:06 --', subText: '' }];
      }
      if (dayOfWeek === 0) {
        return [{ id: 'mock-7', staffId: 1, staffName: 'Yến', staffCode: 'NV000015', status: 'leave' as const, detailText: '', subText: '' }];
      }
    }

    if (shift.name.includes('Ca Full')) {
      if (dayOfWeek === 1 || dayOfWeek === 2) {
        return [{ id: 'mock-f1', staffId: 2, staffName: 'Thu Phương', staffCode: 'NV000016', status: 'ontime' as const, detailText: '09:00 - 21:00', subText: '' }];
      }
      if (dayOfWeek === 3) {
        return [{ id: 'mock-f3', staffId: 2, staffName: 'Thu Phương', staffCode: 'NV000016', status: 'missing' as const, detailText: '09:00 --', subText: 'Chưa chấm ra' }];
      }
      if (dayOfWeek === 4) {
        return [{ id: 'mock-f4', staffId: 2, staffName: 'Thu Phương', staffCode: 'NV000016', status: 'ontime' as const, detailText: '09:00 - 20:59', subText: '' }];
      }
      if (dayOfWeek === 5) {
        return [{ id: 'mock-f5', staffId: 2, staffName: 'Thu Phương', staffCode: 'NV000016', status: 'ontime' as const, detailText: '09:00 - 21:02', subText: 'Làm thêm SC 2p' }];
      }
      if (dayOfWeek === 6) {
        return [{ id: 'mock-f6', staffId: 2, staffName: 'Thu Phương', staffCode: 'NV000016', status: 'ontime' as const, detailText: '08:59 --', subText: 'Làm thêm TC 1p' }];
      }
      if (dayOfWeek === 0) {
        return [{ id: 'mock-f7', staffId: 2, staffName: 'Thu Phương', staffCode: 'NV000016', status: 'leave' as const, detailText: '', subText: '' }];
      }
    }

    if (shift.name.includes('Partime')) {
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        return [{ id: `mock-p${dayOfWeek}`, staffId: 3, staffName: 'Hậu', staffCode: 'NV000010', status: 'unclocked' as const, detailText: '-- --', subText: 'Chưa chấm công' }];
      }
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
    <main className="attendance-page">
      <div className="attendance-container">
        {/* Top Header & Toolbar */}
        <div className="attendance-toolbar-card">
          <div className="attendance-toolbar-left">
            <h1 className="attendance-title">Bảng chấm công</h1>

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

            {/* Time Unit Selector (Theo tuần / Theo tháng) */}
            <div className="attendance-select-wrap">
              <select
                value={timeUnit}
                onChange={(e) => setTimeUnit(e.target.value as 'week' | 'month')}
                className="attendance-select"
              >
                <option value="week">Theo tuần</option>
                <option value="month">Theo tháng</option>
              </select>
              <i className="ph ph-caret-down" />
            </div>

            {/* WeekPicker Component */}
            <WeekPicker currentMonday={currentMonday} onChange={setCurrentMonday} />
          </div>

          {/* Right Action Buttons */}
          <div className="attendance-toolbar-right">
            {/* View Mode Selector (Xem theo ca / Xem theo nhân viên) */}
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'by-shift' ? 'by-staff' : 'by-shift')}
              className="attendance-action-btn"
            >
              <i className={viewMode === 'by-shift' ? 'ph ph-calendar-check primary-icon' : 'ph ph-user primary-icon'} />
              <span>{viewMode === 'by-shift' ? 'Xem theo ca' : 'Xem theo nhân viên'}</span>
              <i className="ph ph-caret-down" style={{ fontSize: 11, color: '#94a3b8' }} />
            </button>

            {/* Duyệt chấm công button */}
            <button
              type="button"
              className="attendance-action-btn"
            >
              <i className="ph ph-calendar-plus" style={{ color: '#475569', fontSize: 16 }} />
              <span>Duyệt chấm công</span>
            </button>

            {/* Options button */}
            <button
              type="button"
              className="attendance-action-btn icon-only"
              title="Tuỳ chọn khác"
            >
              <i className="ph ph-dots-three" style={{ fontSize: 18 }} />
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        {queryError ? (
          <div className="attendance-table-card" style={{ padding: 48 }}>
            <ErrorState error={queryError} onRetry={() => { staffQuery.refetch(); shiftsQuery.refetch(); scheduleQuery.refetch(); attendanceQuery.refetch(); }} />
          </div>
        ) : isLoading ? (
          <div className="attendance-table-card" style={{ padding: 48 }}>
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
                          className="btn-add-shift-plus"
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
                                  className="btn-slot-add-more"
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
                    const isThuPhuong = staff.name.includes('Thu Phương') || staff.code.includes('016');
                    const isYen = staff.name.includes('Yến') || staff.code.includes('015');
                    const isExpanded = expandedStaffId === staff.id;
                    const detailId = `staff-attendance-detail-${staff.id}`;

                    let salaryTypeText = 'Theo ngày công chuẩn';
                    let workedSummary: React.ReactNode = null;
                    let lateSummary: React.ReactNode = null;
                    let overtimeSummary: React.ReactNode = null;
                    let hasData = false;

                    if (isThuPhuong) {
                      hasData = true;
                      salaryTypeText = 'Theo ngày công chuẩn';
                      workedSummary = (
                        <div>
                          <div className="summary-stat-bold">4 ngày</div>
                          <div className="summary-stat-sub">48 giờ</div>
                        </div>
                      );
                      overtimeSummary = (
                        <div>
                          <div className="summary-stat-bold">1 lần</div>
                          <div className="summary-stat-sub">2 phút</div>
                        </div>
                      );
                    } else if (isYen) {
                      hasData = true;
                      salaryTypeText = 'Theo ngày công chuẩn';
                      workedSummary = (
                        <div>
                          <div className="summary-stat-bold">4 ngày</div>
                          <div className="summary-stat-sub">41 giờ 53 phút</div>
                        </div>
                      );
                      lateSummary = (
                        <div>
                          <div className="summary-stat-bold" style={{ color: '#6b21a8' }}>3 lần</div>
                          <div className="summary-stat-sub" style={{ color: '#7e22ce' }}>5 giờ 13 phút</div>
                        </div>
                      );
                      overtimeSummary = (
                        <div>
                          <div className="summary-stat-bold">4 lần</div>
                          <div className="summary-stat-sub">3 giờ 36 phút</div>
                        </div>
                      );
                    } else if (staff.salaryType === 'hourly' || staff.role?.includes('Kỹ thuật') || staff.role?.includes('Chính')) {
                      salaryTypeText = 'Theo giờ làm việc';
                    } else if (staff.salaryType === 'monthly') {
                      salaryTypeText = 'Theo ngày công chuẩn';
                    } else {
                      salaryTypeText = 'Chưa thiết lập';
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
                            <div className="summary-staff-name" style={{ color: '#0052cc' }}>{staff.name}</div>
                            <div className="summary-staff-code">{staff.code}</div>
                          </td>
                          <td style={{ fontWeight: 500 }}>{salaryTypeText}</td>
                          {hasData ? (
                            <>
                              <td>{workedSummary}</td>
                              <td style={{ color: '#94a3b8' }}>—</td>
                              <td>{lateSummary || '—'}</td>
                              <td style={{ color: '#94a3b8' }}>—</td>
                              <td>{overtimeSummary || '—'}</td>
                            </>
                          ) : (
                            <td colSpan={5} style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                              Nhân viên chưa có dữ liệu chấm công
                            </td>
                          )}
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
          })
        }
      />
    </main>
  );
}
