import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MobileSearchBar,
  MobileDetailSheet,
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const [currentMonday, setCurrentMonday] = useState(weekStartIso());
  const [selectedDateIso, setSelectedDateIso] = useState(todayIso());
  const [viewMode, setViewMode] = useState<'by-staff' | 'by-shift'>('by-staff');
  const [search, setSearch] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);

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
    return matched || null;
  };

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

    assignMutation.mutate({
      staffId: Number(assigningStaff.id),
      shiftDate: selectedDateIso,
      startsAt: targetShift.startsAt,
      endsAt: targetShift.endsAt,
      shiftName: targetShift.name,
    });
  };

  const assignedCount = useMemo(() => {
    return filteredStaff.filter((s) => Boolean(getStaffDayShift(s))).length;
  }, [filteredStaff, selectedDateIso, rawAssignments]);

  return (
    <div className="mobile-staff-view">
      {/* 1. Header Top Navigation */}
      <div className="mobile-staff-top-nav">
        <div className="mobile-staff-nav-left">
          <button
            type="button"
            className="mobile-staff-back-icon"
            onClick={() => navigate('/m/more')}
            aria-label="Quay lại"
          >
            <i className="ph ph-caret-left" />
          </button>
          <h1 className="mobile-staff-nav-title">Lịch làm việc</h1>
        </div>

        <div className="mobile-staff-nav-actions">
          <button
            type="button"
            className="mobile-staff-nav-btn"
            onClick={() => setIsSearchVisible((prev) => !prev)}
            aria-label="Tìm kiếm"
          >
            <i className="ph ph-magnifying-glass" />
          </button>
          <button
            type="button"
            className="mobile-staff-nav-btn"
            onClick={() => {
              if (staffList.length > 0) handleOpenAssign(staffList[0]);
            }}
            aria-label="Phân ca nhanh"
            title="Phân ca nhanh"
          >
            <i className="ph ph-calendar-plus" />
          </button>
        </div>
      </div>

      {/* Inline Search Bar */}
      {isSearchVisible && (
        <div className="mobile-staff-search-bar-wrap">
          <MobileSearchBar
            value={search}
            onChange={setSearch}
            placeholder="Tìm nhân viên theo tên, mã..."
          />
        </div>
      )}

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

      {/* Filter & View Switcher Strip */}
      <div className="mobile-staff-filter-strip">
        <button
          type="button"
          className={`mobile-filter-chip ${viewMode === 'by-staff' ? 'is-active' : ''}`}
          onClick={() => setViewMode('by-staff')}
          role="tab"
          aria-selected={viewMode === 'by-staff'}
        >
          <i className="ph ph-user" />
          <span>Theo nhân viên</span>
        </button>

        <button
          type="button"
          className={`mobile-filter-chip ${viewMode === 'by-shift' ? 'is-active' : ''}`}
          onClick={() => setViewMode('by-shift')}
          role="tab"
          aria-selected={viewMode === 'by-shift'}
        >
          <i className="ph ph-clock" />
          <span>Theo ca làm</span>
        </button>
      </div>

      {/* Summary Bar */}
      <div className="mobile-staff-summary-sort-bar">
        <span className="mobile-sort-select-chip">
          <span>{selectedDayInfo.fullLabel}</span>
        </span>
        <span className="mobile-summary-text">
          {assignedCount}/{filteredStaff.length} nhân viên đã xếp ca
        </span>
      </div>

      {/* Content by Staff */}
      {viewMode === 'by-staff' && (
        <div className="mobile-grouped-list-container">
          {staffQuery.isLoading ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: '#64748b' }}>
              Đang tải danh sách nhân viên...
            </div>
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
                              <span
                                className={`mobile-shift-badge ${getShiftThemeClass(
                                  shift.shiftName
                                )}`}
                              >
                                {shift.shiftName}
                              </span>
                              <span style={{ fontSize: 11.5, color: '#64748b' }}>
                                {shift.startsAt} - {shift.endsAt}
                              </span>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="mobile-shift-assign-btn"
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
                    <div style={{ padding: '16px 14px', fontSize: 13, color: '#94a3b8' }}>
                      Chưa có nhân viên nào trong ca này.
                    </div>
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
                            className="mobile-shift-assign-btn"
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

      {/* Floating Action Button (FAB) */}
      <button
        type="button"
        className="mobile-staff-fab"
        onClick={() => {
          if (staffList.length > 0) handleOpenAssign(staffList[0]);
        }}
        aria-label="Thêm ca làm việc"
      >
        <i className="ph ph-plus" />
      </button>

      {/* Assign Shift Inset Sheet */}
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
                      ? '2px solid #0062eb'
                      : '1px solid #e2e8f0',
                  background:
                    selectedShiftName === shift.name ? '#eff6ff' : '#ffffff',
                  cursor: 'pointer',
                  minHeight: 44,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <strong style={{ fontSize: 14, color: '#0f172a' }}>{shift.name}</strong>
                  <span style={{ fontSize: 12, color: '#64748b' }}>
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
