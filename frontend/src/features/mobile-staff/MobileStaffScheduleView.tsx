import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '@/hooks/useWebSocket';
import { getMySchedule } from '@/features/staff/staff.api';
import { weekStartIso, toIsoDate, todayIso } from '@/lib/date';
import { useAuth } from '@/features/auth/AuthProvider';
import type { ApiRecord } from '@/types/api';
import { ScheduleBadge } from '@/components/ScheduleBadge';
import { MobileHeaderAction, MobilePageHeader } from '@/components/ui/MobilePageHeader/MobilePageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/DataState';

const weekdayShorts = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export function MobileStaffScheduleView() {
  const { account } = useAuth();
  const [selectedMonday, setSelectedMonday] = useState(weekStartIso());
  const [selectedDateIso, setSelectedDateIso] = useState(todayIso());
  const { subscribe } = useWebSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsub = subscribe('staff:schedule_changed', () => {
      queryClient.invalidateQueries({ queryKey: ['mobile-staff-schedule'] });
    });
    return unsub;
  }, [subscribe, queryClient]);

  const { data: scheduleData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['mobile-staff-schedule', selectedMonday],
    queryFn: () => getMySchedule(selectedMonday),
    enabled: Boolean(account?.staffId),
  });

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(`${selectedMonday}T00:00:00`);
      d.setDate(d.getDate() + i);
      const iso = toIsoDate(d);
      return {
        name: weekdayShorts[i],
        date: d.getDate(),
        iso,
        isToday: iso === todayIso(),
      };
    });
  }, [selectedMonday]);

  const rawSchedule = (scheduleData?.data ?? {}) as ApiRecord;
  const assignments = (rawSchedule.schedules ?? []) as ApiRecord[];

  // The self-service endpoint is already scoped to the current staff account.
  const dayAssignments = useMemo(() => {
    return assignments.filter((item) => item.shiftDate === selectedDateIso);
  }, [assignments, selectedDateIso]);

  const changeWeek = (offset: number) => {
    const date = new Date(`${selectedMonday}T00:00:00`);
    date.setDate(date.getDate() + offset * 7);
    const nextMonday = toIsoDate(date);
    setSelectedMonday(nextMonday);
    setSelectedDateIso(nextMonday);
  };

  return (
    <div className="mobile-staff-container">
      <MobilePageHeader
        title="Lịch làm việc của tôi"
        actions={(
          <>
            <MobileHeaderAction icon="ph ph-caret-left" label="Tuần trước" onClick={() => changeWeek(-1)} />
            <MobileHeaderAction icon="ph ph-caret-right" label="Tuần sau" onClick={() => changeWeek(1)} />
          </>
        )}
      >
        <div className="schedule-week-strip">
          {weekDays.map((day) => (
            <div
              key={day.iso}
              className={`schedule-day-item ${day.iso === selectedDateIso ? 'selected' : ''} ${day.isToday ? 'today' : ''}`}
              onClick={() => setSelectedDateIso(day.iso)}
            >
              <div className="schedule-day-name">{day.name}</div>
              <div className="schedule-day-num">{day.date}</div>
              {day.isToday && <div className="schedule-day-dot" />}
            </div>
          ))}
        </div>
      </MobilePageHeader>

      {/* Shifts on selected day */}
      <div className="schedule-cards-list">
        <h2 className="m-section-title">
          Ca làm ngày {selectedDateIso}
        </h2>

        {isLoading ? (
          <LoadingState compact label="Đang tải lịch làm..." />
        ) : isError ? (
          <ErrorState compact error={error ?? new Error('Không thể tải lịch làm việc.')} onRetry={() => refetch()} />
        ) : dayAssignments.length === 0 ? (
          <EmptyState compact icon="ph ph-calendar-blank" title="Không có ca làm việc nào trong ngày này." message={null} />
        ) : (
          dayAssignments.map((assign, idx) => (
            <div key={assign.id ?? idx} className={`shift-card ${idx % 2 === 0 ? 'morning' : 'evening'}`}>
              <div className="shift-card-main">
                {assign.weekGroupId && <ScheduleBadge />}
                <div>
                  <div className="shift-time">{assign.startsAt || '08:30'} - {assign.endsAt || '17:30'}</div>
                  <div className="shift-name">{assign.shiftName || 'Ca sáng chuẩn'}</div>
                </div>
              </div>
              <span className={assign.status === 'confirmed' ? 'badge badge-success' : 'badge badge-info'}>
                {assign.status === 'confirmed' ? 'Đã duyệt' : 'Phân công'}
              </span>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
