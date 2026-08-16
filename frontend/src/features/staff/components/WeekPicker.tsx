import { useState, useRef, useEffect } from 'react';
import { toIsoDate } from '@/lib/date';
import './AttendanceTimekeeping.css';

interface WeekPickerProps {
  currentMonday: string; // YYYY-MM-DD
  onChange: (mondayIso: string) => void;
}

export function WeekPicker({ currentMonday, onChange }: WeekPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedDate = new Date(`${currentMonday}T00:00:00`);
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear() || 2026);
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth() || 7); // 0-indexed

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Calculate week number in month
  const getWeekNumberInMonth = (mondayDate: Date) => {
    const day = mondayDate.getDate();
    return Math.ceil(day / 7);
  };

  const weekNumber = getWeekNumberInMonth(selectedDate);
  const label = `Tuần ${weekNumber} - Th. ${selectedDate.getMonth() + 1} ${selectedDate.getFullYear()}`;

  // Navigate next / prev week
  const handlePrevWeek = () => {
    const d = new Date(`${currentMonday}T00:00:00`);
    d.setDate(d.getDate() - 7);
    onChange(toIsoDate(d));
  };

  const handleNextWeek = () => {
    const d = new Date(`${currentMonday}T00:00:00`);
    d.setDate(d.getDate() + 7);
    onChange(toIsoDate(d));
  };

  // Calendar matrix calculation
  const calendarDays = () => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const startDay = new Date(firstDayOfMonth);
    const dayOffset = (firstDayOfMonth.getDay() + 6) % 7; // 0 for Monday, 6 for Sunday
    startDay.setDate(startDay.getDate() - dayOffset);

    const days = [];
    const curr = new Date(startDay);
    for (let i = 0; i < 42; i++) {
      days.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }
    return days;
  };

  const days = calendarDays();

  // Helper to check if date belongs to selected week
  const selectedMonDate = new Date(`${currentMonday}T00:00:00`);
  const selectedSunDate = new Date(selectedMonDate);
  selectedSunDate.setDate(selectedSunDate.getDate() + 6);

  const isSelectedWeek = (d: Date) => {
    const time = d.getTime();
    return time >= selectedMonDate.getTime() && time <= selectedSunDate.getTime();
  };

  const isWeekStart = (d: Date) => toIsoDate(d) === toIsoDate(selectedMonDate);
  const isWeekEnd = (d: Date) => toIsoDate(d) === toIsoDate(selectedSunDate);

  const handleSelectDate = (d: Date) => {
    const mon = new Date(d);
    const offset = (mon.getDay() + 6) % 7;
    mon.setDate(mon.getDate() - offset);
    onChange(toIsoDate(mon));
    setIsOpen(false);
  };

  return (
    <div className="week-picker-container" ref={containerRef}>
      {/* Week Navigator */}
      <div className="week-navigator">
        <button
          type="button"
          onClick={handlePrevWeek}
          className="week-nav-btn"
          title="Tuần trước"
        >
          <i className="ph ph-caret-left" />
        </button>

        <div className="week-label-display">
          {label}
        </div>

        <button
          type="button"
          onClick={handleNextWeek}
          className="week-nav-btn"
          title="Tuần sau"
        >
          <i className="ph ph-caret-right" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="week-btn-choose"
      >
        Chọn
      </button>

      {/* Popover Calendar */}
      {isOpen && (
        <div className="week-popover">
          {/* Header with Month / Year and Navigation */}
          <div className="week-popover-header">
            <button
              type="button"
              onClick={() => {
                if (viewMonth === 0) {
                  setViewMonth(11);
                  setViewYear((y) => y - 1);
                } else {
                  setViewMonth((m) => m - 1);
                }
              }}
              className="week-popover-nav"
            >
              <i className="ph ph-caret-left" />
            </button>

            <span className="week-popover-month">
              Thg {viewMonth + 1} {viewYear}
            </span>

            <button
              type="button"
              onClick={() => {
                if (viewMonth === 11) {
                  setViewMonth(0);
                  setViewYear((y) => y + 1);
                } else {
                  setViewMonth((m) => m + 1);
                }
              }}
              className="week-popover-nav"
            >
              <i className="ph ph-caret-right" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="week-popover-weekdays">
            <span>T2</span>
            <span>T3</span>
            <span>T4</span>
            <span>T5</span>
            <span>T6</span>
            <span>T7</span>
            <span className="is-sunday">CN</span>
          </div>

          {/* Days grid */}
          <div className="week-popover-grid">
            {days.map((date, idx) => {
              const inCurrentMonth = date.getMonth() === viewMonth;
              const inWeek = isSelectedWeek(date);
              const isStart = isWeekStart(date);
              const isEnd = isWeekEnd(date);
              const dayNum = date.getDate();

              let slotClass = 'calendar-day-slot';
              let badgeClass = 'calendar-day-badge';

              if (inWeek) {
                slotClass += ' is-in-week';
                if (isStart) slotClass += ' is-week-start';
                if (isEnd) slotClass += ' is-week-end';
              }

              if (isStart || isEnd) {
                badgeClass += ' is-endpoint';
              } else if (inWeek) {
                badgeClass += ' is-mid-week';
              } else if (!inCurrentMonth) {
                badgeClass += ' is-muted';
              }

              return (
                <div
                  key={idx}
                  className={slotClass}
                  onClick={() => handleSelectDate(date)}
                >
                  <span className={badgeClass}>{dayNum}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
