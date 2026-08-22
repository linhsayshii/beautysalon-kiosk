import { useState, useMemo, useEffect, useCallback } from 'react';
import type { RefObject } from 'react';
import { useMobileDialog } from './useMobileDialog';
import './mobile-common.css';

export interface MobileTimePickerSheetProps {
  isOpen: boolean;
  value?: Date | string | null;
  onClose: () => void;
  onSelectTime: (date: Date) => void;
  title?: string;
}

const MORNING_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30'
];

const AFTERNOON_SLOTS = [
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00', '18:30'
];

const EVENING_SLOTS = [
  '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'
];

const WEEKDAY_NAMES = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

function padZero(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatDateDisplay(d: Date) {
  return `${padZero(d.getDate())}/${padZero(d.getMonth() + 1)}`;
}

function formatFullDateDisplay(d: Date) {
  const weekday = WEEKDAY_NAMES[d.getDay()];
  return `${weekday}, ${padZero(d.getDate())}/${padZero(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function MobileTimePickerSheet({
  isOpen,
  value,
  onClose,
  onSelectTime,
  title = 'Chọn thời gian',
}: MobileTimePickerSheetProps) {
  const initialDate = useMemo(() => {
    if (!value) return new Date();
    const d = new Date(value);
    return isNaN(d.getTime()) ? new Date() : d;
  }, [value]);

  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>(() => {
    return `${padZero(initialDate.getHours())}:${padZero(initialDate.getMinutes())}`;
  });
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const { dialogRef, titleId } = useMobileDialog({ isOpen, onClose });
  const closeCustomModal = useCallback(() => setIsCustomModalOpen(false), []);
  const { dialogRef: customDialogRef, titleId: customTitleId } = useMobileDialog({
    isOpen: isOpen && isCustomModalOpen,
    onClose: closeCustomModal,
  });

  // Custom modal temp state
  const [tempHour, setTempHour] = useState<number>(initialDate.getHours());
  const [tempMinute, setTempMinute] = useState<number>(initialDate.getMinutes());
  const [tempDateOffset, setTempDateOffset] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      const d = value ? new Date(value) : new Date();
      const validDate = isNaN(d.getTime()) ? new Date() : d;
      setSelectedDate(validDate);
      setSelectedTimeSlot(`${padZero(validDate.getHours())}:${padZero(validDate.getMinutes())}`);
      setTempHour(validDate.getHours());
      setTempMinute(validDate.getMinutes());
    }
  }, [isOpen, value]);

  // Generate 14 days starting from base date
  const dateStrip = useMemo(() => {
    const days: { date: Date; weekday: string; label: string; offset: number }[] = [];
    const base = new Date();
    base.setHours(0, 0, 0, 0);

    for (let i = 0; i < 14; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const isToday = i === 0;
      days.push({
        date: d,
        weekday: isToday ? 'Hôm nay' : WEEKDAY_NAMES[d.getDay()],
        label: formatDateDisplay(d),
        offset: i,
      });
    }
    return days;
  }, []);

  if (!isOpen) return null;

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const handleSelectSlot = (slot: string) => {
    setSelectedTimeSlot(slot);
    const [h, m] = slot.split(':').map(Number);
    const updated = new Date(selectedDate);
    updated.setHours(h, m, 0, 0);
    setSelectedDate(updated);
  };

  const handleConfirm = () => {
    const [h, m] = selectedTimeSlot.split(':').map(Number);
    const finalDate = new Date(selectedDate);
    finalDate.setHours(h, m, 0, 0);
    onSelectTime(finalDate);
    onClose();
  };

  const handleOpenCustomModal = () => {
    setTempHour(selectedDate.getHours());
    setTempMinute(selectedDate.getMinutes());
    // Find current date offset
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cur = new Date(selectedDate);
    cur.setHours(0, 0, 0, 0);
    const diffTime = cur.getTime() - today.getTime();
    const diffDays = Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));
    setTempDateOffset(diffDays < 14 ? diffDays : 0);
    setIsCustomModalOpen(true);
  };

  const handleApplyCustomModal = () => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    base.setDate(base.getDate() + tempDateOffset);
    base.setHours(tempHour, tempMinute, 0, 0);

    setSelectedDate(base);
    setSelectedTimeSlot(`${padZero(tempHour)}:${padZero(tempMinute)}`);
    setIsCustomModalOpen(false);
  };

  return (
    <div
      className="mobile-bottom-sheet-backdrop"
      style={{ zIndex: 90 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={dialogRef as RefObject<HTMLDivElement>} className="mobile-time-picker-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        {/* Header */}
        <header className="mobile-time-picker-header">
          <button
            type="button"
            className="mobile-time-picker-back-btn"
            onClick={onClose}
            aria-label="Quay lại"
          >
            <i className="ph ph-caret-left" />
          </button>
          <h2 id={titleId} className="mobile-time-picker-title">{title}</h2>
          <span className="mobile-time-picker-header-spacer" aria-hidden="true" />
        </header>

        {/* 14-Day Horizontal Date Strip */}
        <div className="mobile-date-strip-container">
          <div className="mobile-date-strip">
            {dateStrip.map((item) => {
              const active = isSameDay(item.date, selectedDate);
              return (
                <button
                  key={item.offset}
                  type="button"
                  className={`mobile-date-pill ${active ? 'is-active' : ''}`}
                  onClick={() => {
                    const updated = new Date(item.date);
                    const [h, m] = selectedTimeSlot.split(':').map(Number);
                    updated.setHours(h, m, 0, 0);
                    setSelectedDate(updated);
                  }}
                >
                  <span className="mobile-date-pill-weekday">{item.weekday}</span>
                  <span className="mobile-date-pill-day">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Specific Date Time Trigger Box */}
        <div className="mobile-custom-time-trigger-section">
          <button
            type="button"
            className="mobile-custom-time-trigger-box"
            onClick={handleOpenCustomModal}
          >
            <div className="mobile-custom-time-left">
              <i className="ph ph-calendar-blank" />
              <div className="mobile-custom-time-text">
                <span className="mobile-custom-time-label">Chọn ngày giờ cụ thể</span>
                <span className="mobile-custom-time-sub">
                  {formatFullDateDisplay(selectedDate)} - {selectedTimeSlot}
                </span>
              </div>
            </div>
            <i className="ph ph-caret-right" />
          </button>
        </div>

        {/* Shift Sections Content */}
        <div className="mobile-time-slots-body">
          {/* Sáng: 08:00 - 13:00 */}
          <section className="mobile-shift-section">
            <div className="mobile-shift-header">
              <span className="mobile-shift-icon">☀️</span>
              <span className="mobile-shift-name">Ca sáng</span>
              <span className="mobile-shift-hours">08:00 - 13:00</span>
            </div>
            <div className="mobile-slot-grid">
              {MORNING_SLOTS.map((slot) => {
                const isSelected = selectedTimeSlot === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    className={`mobile-slot-btn ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => handleSelectSlot(slot)}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Chiều: 14:00 - 18:00 */}
          <section className="mobile-shift-section">
            <div className="mobile-shift-header">
              <span className="mobile-shift-icon">🌤️</span>
              <span className="mobile-shift-name">Ca chiều</span>
              <span className="mobile-shift-hours">14:00 - 18:00</span>
            </div>
            <div className="mobile-slot-grid">
              {AFTERNOON_SLOTS.map((slot) => {
                const isSelected = selectedTimeSlot === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    className={`mobile-slot-btn ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => handleSelectSlot(slot)}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Tối: 19:00 - 22:00 */}
          <section className="mobile-shift-section">
            <div className="mobile-shift-header">
              <span className="mobile-shift-icon">🌙</span>
              <span className="mobile-shift-name">Ca tối</span>
              <span className="mobile-shift-hours">19:00 - 22:00</span>
            </div>
            <div className="mobile-slot-grid">
              {EVENING_SLOTS.map((slot) => {
                const isSelected = selectedTimeSlot === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    className={`mobile-slot-btn ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => handleSelectSlot(slot)}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Fixed Bottom Action Button */}
        <footer className="mobile-time-picker-footer">
          <div className="mobile-time-picker-summary">
            <span className="mobile-time-picker-summary-label">Đã chọn:</span>
            <span className="mobile-time-picker-summary-val">
              {selectedTimeSlot} • {formatDateDisplay(selectedDate)}
            </span>
          </div>
          <button
            type="button"
            className="mobile-time-picker-confirm-btn"
            onClick={handleConfirm}
          >
            Tiếp tục
          </button>
        </footer>
      </div>

      {/* Exact Time Roller Modal */}
      {isCustomModalOpen && (
        <div
          className="mobile-time-wheel-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCustomModalOpen(false);
          }}
        >
          <div ref={customDialogRef as RefObject<HTMLDivElement>} className="mobile-time-wheel-dialog" role="dialog" aria-modal="true" aria-labelledby={customTitleId} tabIndex={-1}>
            <div className="mobile-time-wheel-header">
              <h3 id={customTitleId}>Chọn ngày giờ chi tiết</h3>
              <button
                type="button"
                className="mobile-time-wheel-close"
                onClick={() => setIsCustomModalOpen(false)}
                aria-label="Đóng"
              >
                <i className="ph ph-x" />
              </button>
            </div>

            <div className="mobile-time-wheel-content">
              {/* Date selection */}
              <div className="mobile-wheel-group">
                <label htmlFor="custom-wheel-date" className="mobile-wheel-label">
                  Ngày
                </label>
                <select
                  id="custom-wheel-date"
                  className="mobile-wheel-select"
                  value={tempDateOffset}
                  onChange={(e) => setTempDateOffset(Number(e.target.value))}
                >
                  {dateStrip.map((item) => (
                    <option key={item.offset} value={item.offset}>
                      {item.weekday} - {item.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Time Selection Columns */}
              <div className="mobile-wheel-time-row">
                <div className="mobile-wheel-group">
                  <label htmlFor="custom-wheel-hour" className="mobile-wheel-label">
                    Giờ
                  </label>
                  <select
                    id="custom-wheel-hour"
                    className="mobile-wheel-select"
                    value={tempHour}
                    onChange={(e) => setTempHour(Number(e.target.value))}
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>
                        {padZero(i)} giờ
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mobile-wheel-separator">:</div>

                <div className="mobile-wheel-group">
                  <label htmlFor="custom-wheel-minute" className="mobile-wheel-label">
                    Phút
                  </label>
                  <select
                    id="custom-wheel-minute"
                    className="mobile-wheel-select"
                    value={tempMinute}
                    onChange={(e) => setTempMinute(Number(e.target.value))}
                  >
                    {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                      <option key={m} value={m}>
                        {padZero(m)} phút
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="mobile-time-wheel-footer">
              <button
                type="button"
                className="mobile-wheel-cancel-btn"
                onClick={() => setIsCustomModalOpen(false)}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="mobile-wheel-apply-btn"
                onClick={handleApplyCustomModal}
              >
                Áp dụng giờ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
