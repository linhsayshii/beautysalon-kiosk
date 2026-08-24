import { useEffect, useId, useMemo, useState } from 'react';
import type { KeyboardEvent, ReactNode, RefObject } from 'react';
import { Select } from '@/components/ui/Select/Select';
import { MobileDialogPortal } from '@/features/mobile-common/MobileDialogPortal';
import { useMobileDialog } from '@/features/mobile-common/useMobileDialog';
import {
  formatDateOnly,
  formatIsoDate,
  localDateTimeFromInstant,
  parseIsoDate,
  parseLocalDateTime,
  todayIso,
  type DateParts,
} from '@/lib/date';
import './date-time-picker.css';

const MONTHS = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
];
const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

interface PickerDialogProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

function PickerDialog({ isOpen, title, onClose, children }: PickerDialogProps) {
  const { dialogRef, titleId } = useMobileDialog({ isOpen, onClose });

  if (!isOpen) return null;

  return (
    <MobileDialogPortal>
      <div
        className="date-time-picker-backdrop"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <section
          ref={dialogRef as RefObject<HTMLElement>}
          className="date-time-picker-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
        >
          <header className="date-time-picker-header">
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="date-time-picker-close" onClick={onClose} aria-label="Đóng bộ chọn">
              <i className="ph ph-x" aria-hidden="true" />
            </button>
          </header>
          {children}
        </section>
      </div>
    </MobileDialogPortal>
  );
}

function calendarDate(year: number, month: number, day: number): DateParts {
  const value = new Date(Date.UTC(year, month, day));
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() };
}

function monthStartWeekday(year: number, month: number) {
  const weekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return weekday === 0 ? 6 : weekday - 1;
}

function moveMonth(year: number, month: number, offset: number) {
  const value = new Date(Date.UTC(year, month - 1 + offset, 1));
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1 };
}

function CalendarGrid({
  selected,
  min,
  max,
  viewYear,
  viewMonth,
  onViewChange,
  onSelect,
  today = todayIso(),
}: {
  selected: string;
  min?: string;
  max?: string;
  viewYear: number;
  viewMonth: number;
  onViewChange: (next: { year: number; month: number }) => void;
  onSelect: (date: string) => void;
  today?: string;
}) {
  const cells = useMemo(() => {
    const start = calendarDate(viewYear, viewMonth - 1, 1 - monthStartWeekday(viewYear, viewMonth));
    return Array.from({ length: 42 }, (_, index) => calendarDate(start.year, start.month - 1, start.day + index));
  }, [viewMonth, viewYear]);
  const minYear = Number(min?.slice(0, 4) ?? viewYear - 120);
  const maxYear = Number(max?.slice(0, 4) ?? viewYear + 20);
  const selectedParts = parseIsoDate(selected);
  const yearOptions = useMemo(() => {
    const valueYear = selectedParts?.year ?? viewYear;
    const start = Math.min(minYear, valueYear, viewYear - 120);
    const end = Math.max(maxYear, valueYear, viewYear + 20);
    return Array.from({ length: end - start + 1 }, (_, index) => ({ value: start + index, label: String(start + index) })).reverse();
  }, [maxYear, minYear, selectedParts?.year, viewYear]);

  const selectDate = (parts: DateParts) => {
    const value = formatIsoDate(parts);
    if ((min && value < min) || (max && value > max)) return;
    onSelect(value);
    if (parts.year !== viewYear || parts.month !== viewMonth) {
      onViewChange({ year: parts.year, month: parts.month });
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const base = selectedParts ?? { year: viewYear, month: viewMonth, day: 1 };
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (event.key in offsets) {
      event.preventDefault();
      selectDate(calendarDate(base.year, base.month - 1, base.day + offsets[event.key]));
    } else if (event.key === 'Home') {
      event.preventDefault();
      selectDate(calendarDate(base.year, base.month - 1, base.day - ((new Date(Date.UTC(base.year, base.month - 1, base.day)).getUTCDay() + 6) % 7)));
    } else if (event.key === 'End') {
      event.preventDefault();
      selectDate(calendarDate(base.year, base.month - 1, base.day + (6 - ((new Date(Date.UTC(base.year, base.month - 1, base.day)).getUTCDay() + 6) % 7))));
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      const offset = event.key === 'PageUp' ? -1 : 1;
      const moved = calendarDate(base.year, base.month - 1 + offset, base.day);
      selectDate(moved);
    }
  };

  const previousMonth = moveMonth(viewYear, viewMonth, -1);
  const nextMonth = moveMonth(viewYear, viewMonth, 1);
  return (
    <div className="date-time-picker-calendar">
      <div className="date-time-picker-calendar-nav">
        <button type="button" className="date-time-picker-nav-button" onClick={() => onViewChange(previousMonth)} aria-label="Tháng trước">
          <i className="ph ph-caret-left" aria-hidden="true" />
        </button>
        <div className="date-time-picker-period-controls">
          <Select<number>
            aria-label="Chọn tháng"
            value={viewMonth}
            onChange={(month) => onViewChange({ year: viewYear, month })}
            size="sm"
            triggerClassName="date-time-picker-period-select"
            options={MONTHS.map((label, index) => ({ value: index + 1, label }))}
          />
          <Select<number>
            aria-label="Chọn năm"
            value={viewYear}
            onChange={(year) => onViewChange({ year, month: viewMonth })}
            size="sm"
            triggerClassName="date-time-picker-year-select"
            options={yearOptions}
          />
        </div>
        <button type="button" className="date-time-picker-nav-button" onClick={() => onViewChange(nextMonth)} aria-label="Tháng sau">
          <i className="ph ph-caret-right" aria-hidden="true" />
        </button>
      </div>

      <div className="date-time-picker-weekdays" aria-hidden="true">
        {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
      </div>
      <div className="date-time-picker-days" onKeyDown={onKeyDown} role="grid" aria-label={`${MONTHS[viewMonth - 1]} năm ${viewYear}`}>
        {cells.map((cell) => {
          const date = formatIsoDate(cell);
          const isOutsideMonth = cell.month !== viewMonth;
          const isSelected = selected === date;
          const isDisabled = Boolean((min && date < min) || (max && date > max));
          return (
            <button
              type="button"
              key={date}
              className={`date-time-picker-day${isOutsideMonth ? ' is-outside' : ''}${isSelected ? ' is-selected' : ''}${date === today ? ' is-today' : ''}`}
              onClick={() => selectDate(cell)}
              disabled={isDisabled}
              role="gridcell"
              aria-selected={isSelected}
              aria-current={date === today ? 'date' : undefined}
              aria-label={formatDateOnly(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PickerFooter({ onCancel, onApply, onToday, onClear, applyLabel = 'Áp dụng' }: {
  onCancel: () => void;
  onApply: () => void;
  onToday: () => void;
  onClear?: () => void;
  applyLabel?: string;
}) {
  return (
    <footer className="date-time-picker-footer">
      <div className="date-time-picker-secondary-actions">
        {onClear && <button type="button" className="date-time-picker-text-button is-danger" onClick={onClear}>Xóa</button>}
        <button type="button" className="date-time-picker-text-button" onClick={onToday}>Hôm nay</button>
      </div>
      <div className="date-time-picker-primary-actions">
        <button type="button" className="date-time-picker-cancel-button" onClick={onCancel}>Hủy</button>
        <button type="button" className="date-time-picker-apply-button" onClick={onApply}>{applyLabel}</button>
      </div>
    </footer>
  );
}

function TimeControls({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const [hourValue, minuteValue] = value.split(':').map((part) => Number(part));
  const hour = Number.isInteger(hourValue) && hourValue >= 0 && hourValue <= 23 ? hourValue : 0;
  const minute = Number.isInteger(minuteValue) && minuteValue >= 0 && minuteValue <= 59 ? minuteValue : 0;
  const setHour = (next: number) => onChange(`${String(next).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  const setMinute = (next: number) => onChange(`${String(hour).padStart(2, '0')}:${String(next).padStart(2, '0')}`);
  const hours = Array.from({ length: 24 }, (_, index) => ({ value: index, label: `${String(index).padStart(2, '0')} giờ` }));
  const minutes = Array.from({ length: 60 }, (_, index) => ({ value: index, label: `${String(index).padStart(2, '0')} phút` }));

  return (
    <div className="date-time-picker-time-controls">
      <div className="date-time-picker-time-preview" aria-live="polite">{`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`}</div>
      <div className="date-time-picker-time-selects">
        <div>
          <label htmlFor="date-time-picker-hour">Giờ</label>
          <Select<number>
            id="date-time-picker-hour"
            value={hour}
            onChange={setHour}
            options={hours}
            fullWidth
            triggerClassName="date-time-picker-time-select"
          />
        </div>
        <div>
          <label htmlFor="date-time-picker-minute">Phút</label>
          <Select<number>
            id="date-time-picker-minute"
            value={minute}
            onChange={setMinute}
            options={minutes}
            fullWidth
            triggerClassName="date-time-picker-time-select"
          />
        </div>
      </div>
    </div>
  );
}

interface BaseFieldProps {
  id?: string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  title?: string;
  /** IANA timezone used for the "Hôm nay" shortcut. */
  timeZone?: string;
  'aria-label'?: string;
}

export function DatePickerField({
  value,
  onChange,
  min,
  max,
  allowClear = true,
  id,
  className = '',
  disabled = false,
  placeholder = 'Chọn ngày',
  title = 'Chọn ngày',
  timeZone,
  'aria-label': ariaLabel,
}: BaseFieldProps & {
  value?: string | null;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  allowClear?: boolean;
}) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const [isOpen, setIsOpen] = useState(false);
  const normalizedValue = value && parseIsoDate(value) ? value : '';
  const currentDate = timeZone ? localDateTimeFromInstant(new Date(), timeZone).slice(0, 10) : todayIso();
  const [draft, setDraft] = useState(normalizedValue);
  const initialParts = parseIsoDate(normalizedValue || currentDate)!;
  const [view, setView] = useState({ year: initialParts.year, month: initialParts.month });

  useEffect(() => {
    if (!isOpen) return;
    const next = normalizedValue || currentDate;
    const parts = parseIsoDate(next)!;
    setDraft(normalizedValue);
    setView({ year: parts.year, month: parts.month });
  }, [currentDate, isOpen, normalizedValue]);

  const close = () => setIsOpen(false);
  const selectToday = () => {
    const next = currentDate;
    setDraft(next);
    const parts = parseIsoDate(next)!;
    setView({ year: parts.year, month: parts.month });
  };
  return (
    <>
      <button
        id={fieldId}
        type="button"
        className={`app-date-time-trigger ${className}`}
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        aria-label={ariaLabel ?? title}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <i className="ph ph-calendar-blank" aria-hidden="true" />
        <span className={normalizedValue ? '' : 'is-placeholder'}>{normalizedValue ? formatDateOnly(normalizedValue) : placeholder}</span>
        <i className="ph ph-caret-down" aria-hidden="true" />
      </button>
      <PickerDialog isOpen={isOpen} title={title} onClose={close}>
        <CalendarGrid selected={draft} min={min} max={max} viewYear={view.year} viewMonth={view.month} onViewChange={setView} onSelect={setDraft} today={currentDate} />
        <PickerFooter
          onCancel={close}
          onToday={selectToday}
          onClear={allowClear ? () => { onChange(''); close(); } : undefined}
          onApply={() => { onChange(draft); close(); }}
        />
      </PickerDialog>
    </>
  );
}

export function TimePickerField({
  value,
  onChange,
  id,
  className = '',
  disabled = false,
  placeholder = 'Chọn giờ',
  title = 'Chọn giờ',
  timeZone,
  'aria-label': ariaLabel,
}: BaseFieldProps & { value?: string; onChange: (value: string) => void }) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const [isOpen, setIsOpen] = useState(false);
  const validValue = /^\d{2}:\d{2}$/.test(value ?? '') ? value! : '00:00';
  const [draft, setDraft] = useState(validValue);
  useEffect(() => { if (isOpen) setDraft(validValue); }, [isOpen, validValue]);
  const close = () => setIsOpen(false);
  return (
    <>
      <button id={fieldId} type="button" className={`app-date-time-trigger ${className}`} onClick={() => setIsOpen(true)} disabled={disabled} aria-label={ariaLabel ?? title} aria-haspopup="dialog" aria-expanded={isOpen}>
        <i className="ph ph-clock" aria-hidden="true" />
        <span>{value && /^\d{2}:\d{2}$/.test(value) ? value : placeholder}</span>
        <i className="ph ph-caret-down" aria-hidden="true" />
      </button>
      <PickerDialog isOpen={isOpen} title={title} onClose={close}>
        <div className="date-time-picker-dialog-body"><TimeControls value={draft} onChange={setDraft} /></div>
        <PickerFooter onCancel={close} onToday={() => setDraft(localDateTimeFromInstant(new Date(), timeZone).slice(11, 16))} onApply={() => { onChange(draft); close(); }} applyLabel="Xác nhận" />
      </PickerDialog>
    </>
  );
}

export function DateTimePickerField({
  value,
  onChange,
  minDate,
  maxDate,
  id,
  className = '',
  disabled = false,
  placeholder = 'Chọn ngày giờ',
  title = 'Thời gian lịch hẹn',
  timeZone,
  'aria-label': ariaLabel,
}: BaseFieldProps & {
  value?: string;
  onChange: (value: string) => void;
  minDate?: string;
  maxDate?: string;
}) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const [isOpen, setIsOpen] = useState(false);
  const parsed = parseLocalDateTime(value ?? '');
  const currentDateTime = localDateTimeFromInstant(new Date(), timeZone);
  const currentDate = currentDateTime.slice(0, 10);
  const fallback = parseLocalDateTime(`${currentDate}T08:00`)!;
  const [draftDate, setDraftDate] = useState(parsed ? formatIsoDate(parsed) : formatIsoDate(fallback));
  const [draftTime, setDraftTime] = useState(parsed ? `${String(parsed.hour).padStart(2, '0')}:${String(parsed.minute).padStart(2, '0')}` : '08:00');
  const [view, setView] = useState({ year: (parsed ?? fallback).year, month: (parsed ?? fallback).month });

  useEffect(() => {
    if (!isOpen) return;
    const next = parseLocalDateTime(value ?? '') ?? fallback;
    setDraftDate(formatIsoDate(next));
    setDraftTime(`${String(next.hour).padStart(2, '0')}:${String(next.minute).padStart(2, '0')}`);
    setView({ year: next.year, month: next.month });
  }, [currentDate, isOpen, value]);

  const close = () => setIsOpen(false);
  const displayValue = parsed ? `${formatDateOnly(formatIsoDate(parsed), { day: '2-digit', month: '2-digit', year: 'numeric' })} · ${String(parsed.hour).padStart(2, '0')}:${String(parsed.minute).padStart(2, '0')}` : placeholder;
  return (
    <>
      <button id={fieldId} type="button" className={`app-date-time-trigger ${className}`} onClick={() => setIsOpen(true)} disabled={disabled} aria-label={ariaLabel ?? title} aria-haspopup="dialog" aria-expanded={isOpen}>
        <i className="ph ph-calendar-clock" aria-hidden="true" />
        <span className={parsed ? '' : 'is-placeholder'}>{displayValue}</span>
        <i className="ph ph-caret-down" aria-hidden="true" />
      </button>
      <PickerDialog isOpen={isOpen} title={title} onClose={close}>
        <CalendarGrid selected={draftDate} min={minDate} max={maxDate} viewYear={view.year} viewMonth={view.month} onViewChange={setView} onSelect={setDraftDate} today={currentDate} />
        <div className="date-time-picker-dialog-body"><TimeControls value={draftTime} onChange={setDraftTime} /></div>
        <PickerFooter
          onCancel={close}
          onToday={() => {
            const date = currentDate;
            setDraftDate(date);
            setDraftTime(currentDateTime.slice(11, 16));
            const parts = parseIsoDate(date)!;
            setView({ year: parts.year, month: parts.month });
          }}
          onApply={() => { onChange(`${draftDate}T${draftTime}`); close(); }}
          applyLabel="Xác nhận"
        />
      </PickerDialog>
    </>
  );
}

/** A controlled dialog variant for sheets and flows whose trigger lives elsewhere. */
export function DateTimePickerModal({
  isOpen,
  value,
  onClose,
  onApply,
  minDate,
  maxDate,
  title = 'Chọn ngày giờ',
  timeZone,
}: {
  isOpen: boolean;
  value?: string;
  onClose: () => void;
  onApply: (value: string) => void;
  minDate?: string;
  maxDate?: string;
  title?: string;
  timeZone?: string;
}) {
  const parsed = parseLocalDateTime(value ?? '');
  const currentDateTime = localDateTimeFromInstant(new Date(), timeZone);
  const currentDate = currentDateTime.slice(0, 10);
  const fallback = parseLocalDateTime(`${currentDate}T08:00`)!;
  const [draftDate, setDraftDate] = useState(parsed ? formatIsoDate(parsed) : formatIsoDate(fallback));
  const [draftTime, setDraftTime] = useState(parsed ? `${String(parsed.hour).padStart(2, '0')}:${String(parsed.minute).padStart(2, '0')}` : '08:00');
  const [view, setView] = useState({ year: (parsed ?? fallback).year, month: (parsed ?? fallback).month });

  useEffect(() => {
    if (!isOpen) return;
    const next = parseLocalDateTime(value ?? '') ?? fallback;
    setDraftDate(formatIsoDate(next));
    setDraftTime(`${String(next.hour).padStart(2, '0')}:${String(next.minute).padStart(2, '0')}`);
    setView({ year: next.year, month: next.month });
  }, [currentDate, isOpen, value]);

  return (
    <PickerDialog isOpen={isOpen} title={title} onClose={onClose}>
      <CalendarGrid selected={draftDate} min={minDate} max={maxDate} viewYear={view.year} viewMonth={view.month} onViewChange={setView} onSelect={setDraftDate} today={currentDate} />
      <div className="date-time-picker-dialog-body"><TimeControls value={draftTime} onChange={setDraftTime} /></div>
      <PickerFooter
        onCancel={onClose}
        onToday={() => {
          const date = currentDate;
          setDraftDate(date);
          setDraftTime(currentDateTime.slice(11, 16));
          const parts = parseIsoDate(date)!;
          setView({ year: parts.year, month: parts.month });
        }}
        onApply={() => { onApply(`${draftDate}T${draftTime}`); onClose(); }}
        applyLabel="Xác nhận"
      />
    </PickerDialog>
  );
}
