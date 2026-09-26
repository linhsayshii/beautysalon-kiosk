import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '@/hooks/useWebSocket';
import {
  MobileSearchBar,
  MobileDetailSheet,
  MobileEmptyState,
} from '@/features/mobile-common';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { getStaff, getShifts, getSchedule, assignShift, deleteStaffSchedule } from '@/features/staff/staff.api';
import { weekStartIso, toIsoDate, todayIso, formatDateOnly } from '@/lib/date';
import { initials } from '@/lib/format';
import { errorMessage } from '@/services/api-client';
import type { ApiRecord } from '@/types/api';
import { ApplyWeeksModal } from '@/components/ApplyWeeksModal';
import { ScheduleBadge } from '@/components/ScheduleBadge';
import { DeleteScheduleModal } from '@/components/DeleteScheduleModal';
import { MobilePageHeader } from '@/components/ui/MobilePageHeader/MobilePageHeader';
import { LoadingState } from '@/components/data-display/DataState';

const weekdayShorts = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const weekdayFullLabels = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

function getShiftThemeClass(shiftName: string): string {
  const lower = shiftName.toLowerCase();
  if (lower.includes('partime') || lower.includes('part-time')) return 'theme-orange';
  if (lower.includes('full')) return 'theme-purple';
  if (lower.includes('chuẩn') || lower.includes('sáng')) return 'theme-green';
  return 'theme-blue';
}

export function MobileStaffScheduleAdminView() {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { subscribe } = useWebSocket();

  // Invalidate schedule queries on WebSocket events
  useEffect(() => {
    const unsub = subscribe('staff:schedule_changed', () => {
      queryClient.invalidateQueries({ queryKey: ['admin-mobile-schedule'] });
    });
    return unsub;
  }, [subscribe, queryClient]);

  const [currentMonday, setCurrentMonday] = useState(weekStartIso());
  const [selectedDateIso, setSelectedDateIso] = useState(todayIso());
  const [viewMode, setViewMode] = useState<'by-staff' | 'by-shift'>('by-staff');
  const [search, setSearch] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  // Assign shift bottom sheet state
  const [assigningStaff, setAssigningStaff] = useState<ApiRecord | null>(null);
  const [selectedShiftName, setSelectedShiftName] = useState<string>('');

  // Recurring schedule modal states
  const [applyWeeksModal, setApplyWeeksModal] = useState<{
    isOpen: boolean;
    scheduleData: { staffId: number; shiftDate: string; startsAt: string; endsAt: string; shiftName: string } | null;
  }>({ isOpen: false, scheduleData: null });

  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    schedule: ApiRecord | null;
  }>({ isOpen: false, schedule: null });

  // 7 days of the week
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(`${currentMonday}T00:00:00`);
      d.setDate(d.getDate() + i);
      const iso = toIsoDate(d);
      return {
        name: weekdayShorts[i],
        fullLabel: weekdayFullLabels[i],
        date: d.getDate(),
        iso,
        isToday: iso === todayIso(),
      };
    });
  }, [currentMonday]);

  const selectedDayInfo = weekDays.find((d) => d.iso === selectedDateIso) || weekDays[0];

  // Queries
  const staffQuery = useQuery({
    queryKey: ['admin-mobile-staff-list'],
    queryFn: () => getStaff({}),
  });

  const shiftsQuery = useQuery({
    queryKey: ['admin-mobile-shifts'],
    queryFn: () => getShifts(),
  });

  const scheduleQuery = useQuery({
    queryKey: ['admin-mobile-schedule', currentMonday],
    queryFn: () => getSchedule(currentMonday),
  });

  // Assign mutation
  const assignMutation = useMutation({
    mutationFn: (data: {
      staffId: number;
      shiftDate: string;
      startsAt: string;
      endsAt: string;
      shiftName: string;
      applyToWeeks?: number;
    }) => assignShift(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-mobile-schedule', currentMonday] });
      notify('Đã cập nhật ca', 'Lịch làm việc của nhân viên đã được xếp.');
      setAssigningStaff(null);
    },
    onError: (err) => {
      notify('Lỗi phân ca', errorMessage(err, 'Không thể xếp lịch làm việc'));
    },
  });

  // Delete schedule mutation
  const deleteScheduleMutation = useMutation({
    mutationFn: ({ id, deleteFuture }: { id: number; deleteFuture: boolean }) =>
      deleteStaffSchedule(id, deleteFuture),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-mobile-schedule', currentMonday] });
      notify('Đã xóa', 'Lịch đã được xóa.');
      setDeleteModal({ isOpen: false, schedule: null });
    },
    onError: (err) => {
      notify('Lỗi xóa', errorMessage(err, 'Không thể xóa lịch'));
    },
  });

  const staffList = (staffQuery.data?.data ?? []) as ApiRecord[];

  const workShifts = (shiftsQuery.data?.data ?? [
    { name: 'Ca Partime', startsAt: '18:00', endsAt: '22:00' },
    { name: 'Ca Full', startsAt: '09:00', endsAt: '21:00' },
    { name: 'Ca sáng chuẩn', startsAt: '09:00', endsAt: '20:00' },
    { name: 'Ca Sáng', startsAt: '09:30', endsAt: '20:00' },
    { name: 'Ca Chiều', startsAt: '11:00', endsAt: '22:00' },
    { name: 'Ca tối', startsAt: '14:00', endsAt: '22:00' },
  ]) as Array<{ name: string; startsAt: string; endsAt: string }>;

  const rawSchedule = (scheduleQuery.data?.data ?? {}) as ApiRecord;
  const rawAssignments = (rawSchedule.schedules ?? []) as ApiRecord[];

  // Filter staff by search term
  const filteredStaff = useMemo(() => {
    if (!search.trim()) return staffList;
    const q = search.toLowerCase();
    return staffList.filter(
      (s) => s.name?.toLowerCase().includes(q) || s.code?.toLowerCase().includes(q)
    );
  }, [staffList, search]);

  // Find shift for a staff on the selected date (with attendance info)
  const getStaffDayShift = (staff: ApiRecord) => {
    const matched = rawAssignments.find(
      (s) =>
        (Number(s.staffId) === Number(staff.id) || s.staffCode === staff.code) &&
        (s.shiftDate === selectedDateIso || s.date === selectedDateIso)
    );
    if (matched) {
      return matched as ApiRecord & {
        hasCheckIn: boolean;
        hasCheckOut: boolean;
        checkIn: string | null;
        checkOut: string | null;
      };
    }
    return null;
  };

  // Count attended shifts for summary
  const attendedCount = useMemo(() => {
    return filteredStaff.filter((s) => {
      const shift = getStaffDayShift(s);
      return shift && shift.hasCheckIn && shift.hasCheckOut;
    }).length;
  }, [filteredStaff, selectedDateIso, rawAssignments]);

  // Group staff by Role for by-staff view
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
    const newMon = toIsoDate(d);
    setCurrentMonday(newMon);
    setSelectedDateIso(newMon);
  };

  const handleNextWeek = () => {
    const d = new Date(`${currentMonday}T00:00:00`);
    d.setDate(d.getDate() + 7);
    const newMon = toIsoDate(d);
    setCurrentMonday(newMon);
    setSelectedDateIso(newMon);
  };

  const handleOpenAssign = (staff: ApiRecord) => {
    const existing = getStaffDayShift(staff);
    setSelectedShiftName(existing?.shiftName || workShifts[0]?.name || '');
    setAssigningStaff(staff);
  };

  const handleConfirmAssign = () => {
    if (!assigningStaff) return;
    const targetShift = workShifts.find((s) => s.name === selectedShiftName);
    if (!targetShift) return;

    // Close the sheet, open ApplyWeeksModal
    setAssigningStaff(null);
    setApplyWeeksModal({
      isOpen: true,
      scheduleData: {
        staffId: Number(assigningStaff.id),
        shiftDate: selectedDateIso,
        startsAt: targetShift.startsAt,
        endsAt: targetShift.endsAt,
        shiftName: targetShift.name,
      },
    });
  };

  // Handle delete schedule
  const handleDeleteSchedule = (schedule: ApiRecord) => {
    setDeleteModal({ isOpen: true, schedule });
  };

  const assignedCount = useMemo(() => {
    return filteredStaff.filter((s) => Boolean(getStaffDayShift(s))).length;
  }, [filteredStaff, selectedDateIso, rawAssignments]);

  return (
    <div className="mobile-staff-view">
      <MobilePageHeader
        title="Lịch làm việc" backTo="/m/more"
        actions={(
          <>
            <button
              type="button"
              className="btn btn-ghost btn-icon m-header-action"
              onClick={() => setIsSearchVisible((prev) => !prev)}
              aria-label="Tìm kiếm"
            >
              <i className="ph ph-magnifying-glass" />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-icon m-header-action"
              onClick={() => {
                if (staffList.length > 0) handleOpenAssign(staffList[0]);
              }}
              aria-label="Phân ca nhanh"
              title="Phân ca nhanh"
            >
              <i className="ph ph-calendar-plus" />
            </button>
          </>
        )}
      >
        {isSearchVisible && (
          <MobileSearchBar
            value={search}
            onChange={setSearch}
            placeholder="Tìm nhân viên theo tên, mã..."
          />
        )}

        {/* Week Navigator */}
        <div className="mobile-week-navigator">
          <button
            type="button"
            className="btn btn-secondary btn-icon"
            aria-label="Tuần trước"
            onClick={handlePrevWeek}
          >
            <i className="ph ph-caret-left" />
          </button>
          <span className="mobile-week-label">
            {selectedDayInfo.fullLabel}, {formatDateOnly(selectedDayInfo.iso)}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-icon"
            aria-label="Tuần sau"
            onClick={handleNextWeek}
          >
            <i className="ph ph-caret-right" />
          </button>
        </div>

        {/* Horizontal Week Strip (T2 -> CN) */}
        <div className="mobile-week-strip" role="tablist">
          {weekDays.map((day) => (
            <button
              key={day.iso}
              type="button"
              role="tab"
              aria-selected={day.iso === selectedDateIso}
              className={`mobile-week-day-chip ${day.iso === selectedDateIso ? 'selected' : ''} ${
                day.isToday ? 'today' : ''
              }`}
              onClick={() => setSelectedDateIso(day.iso)}
            >
              <span className="mobile-week-day-name">{day.name}</span>
              <span className="mobile-week-day-num">{day.date}</span>
              {day.isToday && <span className="mobile-week-day-dot" />}
            </button>
          ))}
        </div>

        {/* Filter & View Switcher Strip */}
        <div className="m-chip-strip">
          <button
            type="button"
            className={`chip ${viewMode === 'by-staff' ? 'is-active' : ''}`}
            onClick={() => setViewMode('by-staff')}
            role="tab"
            aria-selected={viewMode === 'by-staff'}
          >
            <i className="ph ph-user" />
            <span>Theo nhân viên</span>
          </button>

          <button
            type="button"
            className={`chip ${viewMode === 'by-shift' ? 'is-active' : ''}`}
            onClick={() => setViewMode('by-shift')}
            role="tab"
            aria-selected={viewMode === 'by-shift'}
          >
            <i className="ph ph-clock" />
            <span>Theo ca làm</span>
          </button>
        </div>

        {/* Summary Bar */}
        <div className="m-summary-bar">
          <span className="m-summary-title">
            <span>{selectedDayInfo.fullLabel}</span>
          </span>
          <span className="m-summary-count">
            {assignedCount}/{filteredStaff.length} xếp • {attendedCount}/{assignedCount} đã chấm
          </span>
        </div>
      </MobilePageHeader>

      {/* Content by Staff */}
      {viewMode === 'by-staff' && (
        <div className="mobile-grouped-list-container">
          {staffQuery.isLoading ? (
            <LoadingState compact label="Đang tải danh sách nhân viên..." />
          ) : filteredStaff.length === 0 ? (
            <MobileEmptyState
              icon="ph ph-users"
              title="Không tìm thấy nhân viên"
              description="Thử tìm kiếm với từ khóa khác."
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
                    const shift = getStaffDayShift(staff);
                    return (
                      <div
                        key={staff.id}
                        className="mobile-grouped-row"
                        onClick={() => handleOpenAssign(staff)}
                      >
                        <div className="mobile-staff-row-left">
                          <div className="mobile-staff-avatar">
                            {initials(staff.name || 'NV')}
                          </div>
                          <div className="mobile-staff-row-info">
                            <span className="mobile-staff-row-name">{staff.name}</span>
                            <span className="mobile-staff-row-sub">
                              <span>{staff.code || ''}</span>
                              {staff.role && <span>• {staff.role}</span>}
                            </span>
                          </div>
                        </div>

                        <div className="mobile-staff-row-right">
                          {shift ? (
                            <>
                              {shift.weekGroupId && <ScheduleBadge />}
                              <span
                                className={`mobile-shift-badge ${getShiftThemeClass(
                                  shift.shiftName
                                )}`}
                              >
                                {shift.shiftName}
                              </span>
                              <span className="text-muted">
                                {shift.startsAt} - {shift.endsAt}
                              </span>
                              {/* Attendance status icon */}
                              {shift.hasCheckIn && shift.hasCheckOut ? (
                                <i className="ph ph-check-circle text-success shift-check-icon" title="Đã chấm công đủ" />
                              ) : shift.hasCheckIn ? (
                                <i className="ph ph-clock text-warning shift-check-icon" title="Đã chấm vào, chưa chấm ra" />
                              ) : (
                                <i className="ph ph-warning-circle text-danger shift-check-icon" title="Chưa chấm công" />
                              )}
                              {/* Delete button */}
                              <button
                                type="button"
                                className="btn btn-ghost btn-icon btn-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteSchedule(shift);
                                }}
                                aria-label="Xóa ca"
                                title="Xóa ca"
                              >
                                <i className="ph ph-trash" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-soft btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenAssign(staff);
                              }}
                            >
                              <i className="ph ph-plus" />
                              Xếp ca
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Content by Shift */}
      {viewMode === 'by-shift' && (
        <div className="mobile-grouped-list-container">
          {workShifts.map((shift, idx) => {
            const assignedMembers = filteredStaff.filter((s) => {
              const staffShift = getStaffDayShift(s);
              return staffShift && staffShift.shiftName === shift.name;
            });

            return (
              <div key={idx} className="mobile-grouped-section">
                <div className="mobile-section-header">
                  <span className="mobile-section-title">
                    {shift.name} ({shift.startsAt} - {shift.endsAt})
                  </span>
                  <span className="mobile-section-count">{assignedMembers.length} người</span>
                </div>
                <div className="mobile-section-card">
                  {assignedMembers.length === 0 ? (
                    <p className="m-note mobile-section-note">Chưa có nhân viên nào trong ca này.</p>
                  ) : (
                    assignedMembers.map((staff) => (
                      <div
                        key={staff.id}
                        className="mobile-grouped-row"
                        onClick={() => handleOpenAssign(staff)}
                      >
                        <div className="mobile-staff-row-left">
                          <div className="mobile-staff-avatar">
                            {initials(staff.name || 'NV')}
                          </div>
                          <div className="mobile-staff-row-info">
                            <span className="mobile-staff-row-name">{staff.name}</span>
                            <span className="mobile-staff-row-sub">{staff.role || 'Kỹ thuật viên'}</span>
                          </div>
                        </div>
                        <div className="mobile-staff-row-right">
                          <button
                            type="button"
                            className="btn btn-soft btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenAssign(staff);
                            }}
                          >
                            Đổi ca
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Assign Shift Inset Sheet */}
      <MobileDetailSheet
        isOpen={Boolean(assigningStaff)}
        title="Xếp ca làm việc"
        subtitle={
          assigningStaff
            ? `${assigningStaff.name} • ${selectedDayInfo.fullLabel}, ${formatDateOnly(selectedDateIso)}`
            : ''
        }
        onClose={() => setAssigningStaff(null)}
        footerActions={
          <div className="mobile-schedule-sheet-actions">
            <button
              type="button"
              className="mobile-staff-action-btn mobile-schedule-sheet-cancel"
              onClick={() => setAssigningStaff(null)}
            >
              Hủy
            </button>
            <button
              type="button"
              className="mobile-staff-action-btn primary mobile-schedule-sheet-confirm"
              onClick={handleConfirmAssign}
              disabled={assignMutation.isPending}
            >
              {assignMutation.isPending ? 'Đang lưu...' : 'Tiếp tục'}
            </button>
          </div>
        }
      >
        <div className="mobile-sheet-section">
          <span className="mobile-sheet-section-title">Chọn ca làm việc</span>
          <div className="mobile-schedule-shift-options" role="radiogroup" aria-label="Chọn ca làm việc">
            {workShifts.map((shift) => (
              <label
                key={shift.name}
                className={`mobile-schedule-shift-option ${selectedShiftName === shift.name ? 'is-selected' : ''}`}
              >
                <span className="mobile-schedule-shift-copy">
                  <strong>{shift.name}</strong>
                  <span>
                    {shift.startsAt} - {shift.endsAt}
                  </span>
                </span>
                <input
                  type="radio"
                  name="shiftSelection"
                  value={shift.name}
                  checked={selectedShiftName === shift.name}
                  onChange={() => setSelectedShiftName(shift.name)}
                  aria-label={`${shift.name}, ${shift.startsAt} đến ${shift.endsAt}`}
                />
              </label>
            ))}
          </div>
        </div>
      </MobileDetailSheet>

      {/* ApplyWeeksModal - ask how many weeks to apply */}
      <ApplyWeeksModal
        isOpen={applyWeeksModal.isOpen}
        onClose={() => setApplyWeeksModal({ isOpen: false, scheduleData: null })}
        onConfirm={(options) => {
          if (applyWeeksModal.scheduleData) {
            assignMutation.mutate({
              ...applyWeeksModal.scheduleData,
              applyToWeeks: options.weeks,
            });
          }
        }}
        currentWeekLabel={selectedDayInfo.fullLabel}
      />

      {/* DeleteScheduleModal */}
      <DeleteScheduleModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, schedule: null })}
        onConfirm={(deleteAllRecurring) => {
          if (deleteModal.schedule) {
            deleteScheduleMutation.mutate({
              id: deleteModal.schedule.id,
              deleteFuture: deleteAllRecurring,
            });
          }
        }}
        weekLabel={deleteModal.schedule?.date || deleteModal.schedule?.shiftDate || ''}
        isRecurring={Boolean(deleteModal.schedule?.weekGroupId)}
      />
    </div>
  );
}
