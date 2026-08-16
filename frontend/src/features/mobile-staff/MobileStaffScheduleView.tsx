import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSchedule } from '@/features/staff/staff.api';
import { weekStartIso, toIsoDate, todayIso } from '@/lib/date';
import { useAuth } from '@/features/auth/AuthProvider';
import type { ApiRecord } from '@/types/api';
import './mobile-staff.css';

const weekdayShorts = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export function MobileStaffScheduleView() {
  const { account } = useAuth();
  const selectedMonday = weekStartIso();
  const [selectedDateIso, setSelectedDateIso] = useState(todayIso());

  const { data: scheduleData, isLoading } = useQuery({
    queryKey: ['mobile-staff-schedule', selectedMonday],
    queryFn: () => getSchedule(selectedMonday),
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
  const assignments = (rawSchedule.assignments ?? []) as ApiRecord[];

  // Filter assignments for the selected day (and current staff if not manager)
  const currentStaffId = account?.staffId;
  const dayAssignments = useMemo(() => {
    return assignments.filter((item) => {
      const matchDate = item.shiftDate === selectedDateIso;
      if (!matchDate) return false;
      if (account?.role === 'staff' || account?.role === 'cashier') {
        return Number(item.staffId) === Number(currentStaffId);
      }
      return true;
    });
  }, [assignments, selectedDateIso, account, currentStaffId]);

  return (
    <div className="mobile-staff-container">
      <div className="mobile-staff-header">
        <h1>Lịch làm việc của tôi</h1>
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

      {/* Shifts on selected day */}
      <div className="schedule-cards-list">
        <h2 style={{ fontSize: 14, fontWeight: 700, margin: '8px 0 4px', color: '#0f172a' }}>
          Ca làm ngày {selectedDateIso}
        </h2>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b' }}>Đang tải lịch làm...</div>
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
