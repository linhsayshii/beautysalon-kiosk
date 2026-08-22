import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMySchedule } from '@/features/staff/staff.api';
import { weekStartIso, toIsoDate, todayIso } from '@/lib/date';
import { useAuth } from '@/features/auth/AuthProvider';
import type { ApiRecord } from '@/types/api';
import './mobile-staff.css';

const weekdayShorts = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export function MobileStaffScheduleView() {
  const { account } = useAuth();
  const [selectedMonday, setSelectedMonday] = useState(weekStartIso());
  const [selectedDateIso, setSelectedDateIso] = useState(todayIso());

  const { data: scheduleData, isLoading, isError, refetch } = useQuery({
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
      {/* Sticky Top Cluster for Schedule */}
      <div className="mobile-schedule-sticky-header">
        <div className="mobile-staff-header">
          <h1>Lịch làm việc của tôi</h1>
          <div className="mobile-schedule-week-actions">
            <button type="button" onClick={() => changeWeek(-1)} aria-label="Tuần trước"><i className="ph ph-caret-left" /></button>
            <button type="button" onClick={() => changeWeek(1)} aria-label="Tuần sau"><i className="ph ph-caret-right" /></button>
          </div>
        </div>

        {/* Week Day Strip */}
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
      </div>

      {/* Shifts on selected day */}
      <div className="schedule-cards-list">
        <h2 style={{ fontSize: 14, fontWeight: 700, margin: '8px 0 4px', color: '#0f172a' }}>
          Ca làm ngày {selectedDateIso}
        </h2>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b' }}>Đang tải lịch làm...</div>
        ) : isError ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#b91c1c' }}>
            Không thể tải lịch làm việc. <button type="button" onClick={() => refetch()}>Thử lại</button>
          </div>
        ) : dayAssignments.length === 0 ? (
          <div style={{
            background: '#ffffff',
            border: '1px dashed #cbd5e1',
            borderRadius: 12,
            padding: '24px 16px',
            textAlign: 'center',
            color: '#94a3b8',
          }}>
            Không có ca làm việc nào trong ngày này.
          </div>
        ) : (
          dayAssignments.map((assign, idx) => (
            <div key={assign.id ?? idx} className={`shift-card ${idx % 2 === 0 ? 'morning' : 'evening'}`}>
              <div>
                <div className="shift-time">{assign.startsAt || '08:30'} - {assign.endsAt || '17:30'}</div>
                <div className="shift-name">{assign.shiftName || 'Ca sáng chuẩn'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: assign.status === 'confirmed' ? '#16a34a' : '#0284c7',
                  background: assign.status === 'confirmed' ? '#dcfce7' : '#e0f2fe',
                  padding: '4px 8px',
                  borderRadius: 10,
                }}>
                  {assign.status === 'confirmed' ? 'Đã duyệt' : 'Phân công'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
