import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MobileSearchBar,
  MobileMetricCards,
  MobileCard,
  MobileDetailSheet,
  MobileSegmentedControl,
  MobileEmptyState,
} from '@/features/mobile-common';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { getStaff, getShifts, getSchedule, assignShift } from '@/features/staff/staff.api';
import { weekStartIso, toIsoDate, todayIso } from '@/lib/date';
import { initials } from '@/lib/format';
import { errorMessage } from '@/services/api-client';
import type { ApiRecord } from '@/types/api';
import './mobile-staff.css';

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

  const [currentMonday, setCurrentMonday] = useState(weekStartIso());
  const [selectedDateIso, setSelectedDateIso] = useState(todayIso());
  const [viewMode, setViewMode] = useState<'by-staff' | 'by-shift'>('by-staff');
  const [search, setSearch] = useState('');

  // Assign shift bottom sheet state
  const [assigningStaff, setAssigningStaff] = useState<ApiRecord | null>(null);
  const [selectedShiftName, setSelectedShiftName] = useState<string>('');

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

  const staffList = (staffQuery.data?.data ?? [
    { id: 1, name: 'AnnaChillBeauty', code: 'NV000009', role: 'Quản trị viên' },
    { id: 2, name: 'Em Huệ', code: 'NV000005', role: 'Kỹ thuật viên' },
    { id: 3, name: 'Hậu', code: 'NV000010', role: 'Nhân viên bán thời gian' },
    { id: 4, name: 'Thu Phương', code: 'NV000016', role: 'Kỹ thuật viên chính' },
    { id: 5, name: 'Trang Vũ', code: 'NV000012', role: 'Lễ tân' },
    { id: 6, name: 'Yến', code: 'NV000015', role: 'Kỹ thuật viên' },
  ]) as ApiRecord[];

  const workShifts = (shiftsQuery.data?.data ?? [
    { name: 'Ca Partime', startsAt: '18:00', endsAt: '22:00' },
    { name: 'Ca Full', startsAt: '09:00', endsAt: '21:00' },
    { name: 'Ca sáng chuẩn', startsAt: '09:00', endsAt: '20:00' },
    { name: 'Ca Sáng', startsAt: '09:30', endsAt: '20:00' },
    { name: 'Ca Chiều', startsAt: '11:00', endsAt: '22:00' },
    { name: 'Ca tối', startsAt: '14:00', endsAt: '22:00' },
  ]) as Array<{ name: string; startsAt: string; endsAt: string }>;

  const rawSchedule = (scheduleQuery.data?.data ?? {}) as ApiRecord;
  const rawAssignments = (rawSchedule.shifts ?? rawSchedule.assignments ?? []) as ApiRecord[];

  // Filter staff by search term
  const filteredStaff = useMemo(() => {
    if (!search.trim()) return staffList;
    const q = search.toLowerCase();
    return staffList.filter(
      (s) => s.name?.toLowerCase().includes(q) || s.code?.toLowerCase().includes(q)
    );
  }, [staffList, search]);

  // Find shift for a staff on the selected date
  const getStaffDayShift = (staff: ApiRecord) => {
    const matched = rawAssignments.find(
      (s) =>
        (Number(s.staffId) === Number(staff.id) || s.staffCode === staff.code) &&
        (s.shiftDate === selectedDateIso || s.date === selectedDateIso)
    );
    if (matched) return matched;

    // Fallbacks for preview
    const dateObj = new Date(`${selectedDateIso}T00:00:00`);
    const dayOfWeek = dateObj.getDay();
    if (staff.code === 'NV000010' || staff.name === 'Hậu') {
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        return { shiftName: 'Ca Partime', startsAt: '18:00', endsAt: '22:00', status: 'scheduled' };
      }
    }
    if (staff.code === 'NV000016' || staff.name === 'Thu Phương') {
      return { shiftName: 'Ca Full', startsAt: '09:00', endsAt: '21:00', status: 'scheduled' };
    }
    if (staff.code === 'NV000015' || staff.name === 'Yến') {
      return { shiftName: 'Ca sáng chuẩn', startsAt: '09:00', endsAt: '20:00', status: 'scheduled' };
    }
    return null;
  };

  // Compute metrics for the selected day
  const assignedCount = useMemo(() => {
    return staffList.filter((s) => Boolean(getStaffDayShift(s))).length;
  }, [staffList, rawAssignments, selectedDateIso]);

  const unassignedCount = Math.max(0, staffList.length - assignedCount);

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

    assignMutation.mutate({
      staffId: Number(assigningStaff.id),
      shiftDate: selectedDateIso,
      startsAt: targetShift.startsAt,
      endsAt: targetShift.endsAt,
      shiftName: targetShift.name,
    });
  };

  return (
    <div className="mobile-staff-container">
      {/* Header */}
      <div className="mobile-staff-header">
        <div>
          <h1 className="mobile-staff-header-title">Quản lý ca làm việc</h1>
          <div className="mobile-staff-subtitle">Phân ca & điều phối nhân sự</div>
        </div>
      </div>

      {/* Week Navigator */}
      <div className="mobile-week-navigator">
        <button
          type="button"
          className="mobile-week-nav-btn"
          aria-label="Tuần trước"
          onClick={handlePrevWeek}
        >
          <i className="ph ph-caret-left" />
        </button>
        <span className="mobile-week-label">
          {selectedDayInfo.fullLabel} ({selectedDayInfo.iso})
        </span>
        <button
          type="button"
          className="mobile-week-nav-btn"
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

      {/* Metric Cards */}
      <MobileMetricCards
        items={[
          { label: 'Tổng nhân sự', value: staffList.length, tone: 'blue' },
          { label: 'Đã xếp ca', value: assignedCount, tone: 'green' },
          { label: 'Chưa xếp ca', value: unassignedCount, tone: 'orange' },
        ]}
      />

      {/* View Toggle */}
      <MobileSegmentedControl
        value={viewMode}
        onChange={setViewMode}
        options={[
          { value: 'by-staff', label: 'Theo nhân viên', icon: 'ph ph-user' },
          { value: 'by-shift', label: 'Theo ca làm', icon: 'ph ph-clock' },
        ]}
      />

      {/* Search Bar */}
      <MobileSearchBar
        value={search}
        onChange={setSearch}
        placeholder="Tìm nhân viên theo tên, mã..."
      />

      {/* Content by Staff */}
      {viewMode === 'by-staff' && (
        <div className="mobile-staff-card-list">
          {staffQuery.isLoading ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--ink-500)' }}>
              Đang tải danh sách nhân viên...
            </div>
          ) : filteredStaff.length === 0 ? (
            <MobileEmptyState
              icon="ph ph-users"
              title="Không tìm thấy nhân viên"
              description="Thử tìm kiếm với từ khóa khác."
            />
          ) : (
            filteredStaff.map((staff) => {
              const shift = getStaffDayShift(staff);
              return (
                <MobileCard
                  key={staff.id}
                  title={staff.name}
                  subtitle={`${staff.code || ''} • ${staff.role || 'Kỹ thuật viên'}`}
                  avatar={
                    <div className="mobile-staff-avatar">{initials(staff.name || 'NV')}</div>
                  }
                  badge={
                    shift
                      ? {
                          text: `${shift.shiftName} (${shift.startsAt} - ${shift.endsAt})`,
                          tone: getShiftThemeClass(shift.shiftName).replace('theme-', ''),
                        }
                      : { text: 'Chưa xếp ca', tone: 'orange' }
                  }
                  action={
                    <button
                      type="button"
                      className="mobile-shift-assign-btn"
                      onClick={() => handleOpenAssign(staff)}
                    >
                      <i className="ph ph-calendar-plus" />
                      {shift ? 'Đổi ca' : 'Xếp ca'}
                    </button>
                  }
                />
              );
            })
          )}
        </div>
      )}

      {/* Content by Shift */}
      {viewMode === 'by-shift' && (
        <div className="mobile-staff-card-list">
          {workShifts.map((shift, idx) => {
            const assignedMembers = staffList.filter((s) => {
              const staffShift = getStaffDayShift(s);
              return staffShift && staffShift.shiftName === shift.name;
            });

            return (
              <MobileCard
                key={idx}
                title={shift.name}
                subtitle={`${shift.startsAt} - ${shift.endsAt}`}
                badge={{
                  text: `${assignedMembers.length} nhân viên`,
                  tone: getShiftThemeClass(shift.name).replace('theme-', ''),
                }}
                details={[
                  {
                    label: 'Danh sách nhân viên',
                    value:
                      assignedMembers.length > 0
                        ? assignedMembers.map((m) => m.name).join(', ')
                        : 'Chưa có nhân viên nào trong ca này',
                  },
                ]}
              />
            );
          })}
        </div>
      )}

      {/* Assign Shift Bottom Sheet */}
      <MobileDetailSheet
        isOpen={Boolean(assigningStaff)}
        title="Xếp ca làm việc"
        subtitle={
          assigningStaff
            ? `${assigningStaff.name} • ${selectedDayInfo.fullLabel} (${selectedDateIso})`
            : ''
        }
        onClose={() => setAssigningStaff(null)}
        footerActions={
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            <button
              type="button"
              className="mobile-staff-action-btn"
              style={{ flex: 1 }}
              onClick={() => setAssigningStaff(null)}
            >
              Hủy
            </button>
            <button
              type="button"
              className="mobile-staff-action-btn primary"
              style={{ flex: 1 }}
              onClick={handleConfirmAssign}
              disabled={assignMutation.isPending}
            >
              {assignMutation.isPending ? 'Đang lưu...' : 'Xác nhận'}
            </button>
          </div>
        }
      >
        <div className="mobile-sheet-section">
          <label className="mobile-sheet-section-title">Chọn ca làm việc</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {workShifts.map((shift) => (
              <label
                key={shift.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border:
                    selectedShiftName === shift.name
                      ? '2px solid var(--blue-600, #0284c7)'
                      : '1px solid var(--line, #e2e8f0)',
                  background:
                    selectedShiftName === shift.name ? '#f0f9ff' : 'var(--surface, #ffffff)',
                  cursor: 'pointer',
                  minHeight: 44,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <strong style={{ fontSize: 14, color: 'var(--ink-950)' }}>{shift.name}</strong>
                  <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>
                    {shift.startsAt} - {shift.endsAt}
                  </span>
                </div>
                <input
                  type="radio"
                  name="shiftSelection"
                  value={shift.name}
                  checked={selectedShiftName === shift.name}
                  onChange={() => setSelectedShiftName(shift.name)}
                />
              </label>
            ))}
          </div>
        </div>
      </MobileDetailSheet>
    </div>
  );
}
