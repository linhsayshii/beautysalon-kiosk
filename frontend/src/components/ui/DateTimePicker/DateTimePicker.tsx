import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode, RefObject } from 'react';
import { Select } from '@/components/ui/Select/Select';
import { BottomSheet } from '@/components/ui/Sheet/BottomSheet';
import { FloatingLayer } from '@/components/ui/FloatingLayer/FloatingLayer';
import {
  addCalendarDays,
  formatDateOnly,
  formatIsoDate,
  localDateTimeFromInstant,
  parseIsoDate,
  parseLocalDateTime,
} from '@/lib/date';

/*
 * One calendar for every date control: a popover anchored to its trigger.
 * - DatePickerField: one day, optional "Hôm nay / Hôm qua / Hôm kia" shortcuts.
 * - DateRangePickerField: two months plus period presets (KiotViet style).
 * - DateTimePickerField / TimePickerField: calendar and/or hour:minute row.
 * - DateTimePickerModal: the same body in a bottom sheet for flows without a trigger.
 */

const MONTH_NAMES = [
  'Tháng Một', 'Tháng Hai', 'Tháng Ba', 'Tháng Tư', 'Tháng Năm', 'Tháng Sáu',
  'Tháng Bảy', 'Tháng Tám', 'Tháng Chín', 'Tháng Mười', 'Tháng Mười Một', 'Tháng Mười Hai',
];
const WEEKDAYS = ['Th 2', 'Th 3', 'Th 4', 'Th 5', 'Th 6', 'Th 7', 'CN'];
const HOURS = Array.from({ length: 24 }, (_, value) => ({ value, label: pad(value) }));
const MINUTES = Array.from({ length: 60 }, (_, value) => ({ value, label: pad(value) }));

type MonthView = { year: number; month: number };
type Range = { from: string; to: string };
type Preset = { label: string; range: Range };

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function viewOf(date: string): MonthView {
  const parts = parseIsoDate(date)!;
  return { year: parts.year, month: parts.month };
}

function shiftView(view: MonthView, offset: number): MonthView {
  const value = new Date(Date.UTC(view.year, view.month - 1 + offset, 1));
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1 };
}

function monthIndex(view: MonthView) {
  return view.year * 12 + view.month;
}

function firstOfMonth(view: MonthView) {
  return formatIsoDate({ ...view, day: 1 });
}

function lastOfMonth(view: MonthView) {
  return addCalendarDays(firstOfMonth(shiftView(view, 1)), -1);
}

function shiftDateByMonths(date: string, offset: number) {
  const parts = parseIsoDate(date)!;
  const target = shiftView(parts, offset);
  const last = parseIsoDate(lastOfMonth(target))!.day;
  return formatIsoDate({ ...target, day: Math.min(parts.day, last) });
}

function branchNow(timeZone?: string) {
  return localDateTimeFromInstant(new Date(), timeZone);
}

function isNarrowViewport() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches;
}

function outOfBounds(date: string, min?: string, max?: string) {
  return Boolean((min && date < min) || (max && date > max));
}

/** Shortcuts for a single day; filters never look further back than this. */
function dayPresets(today: string): Preset[] {
  return [
    { label: 'Hôm nay', range: { from: today, to: today } },
    { label: 'Hôm qua', range: { from: addCalendarDays(today, -1), to: addCalendarDays(today, -1) } },
    { label: 'Hôm kia', range: { from: addCalendarDays(today, -2), to: addCalendarDays(today, -2) } },
  ];
}

/** Current periods end today (nothing is recorded in the future); past periods are complete. */
export function rangePresets(today: string): Preset[] {
  const month = viewOf(today);
  const quarterStart = { year: month.year, month: month.month - ((month.month - 1) % 3) };
  const previousQuarter = shiftView(quarterStart, -3);
  const previousMonth = shiftView(month, -1);
  return [
    ...dayPresets(today).slice(0, 2),
    { label: '7 ngày qua', range: { from: addCalendarDays(today, -6), to: today } },
    { label: 'Tháng này', range: { from: firstOfMonth(month), to: today } },
    { label: 'Tháng trước', range: { from: firstOfMonth(previousMonth), to: lastOfMonth(previousMonth) } },
    { label: 'Quý này', range: { from: firstOfMonth(quarterStart), to: today } },
    { label: 'Quý trước', range: { from: firstOfMonth(previousQuarter), to: lastOfMonth(shiftView(previousQuarter, 2)) } },
    { label: 'Năm nay', range: { from: `${month.year}-01-01`, to: today } },
    { label: 'Năm trước', range: { from: `${month.year - 1}-01-01`, to: `${month.year - 1}-12-31` } },
  ];
}

/* ------------------------------------------------------------------ popover */

/**
 * Desktop: a popover under the trigger. Phones: a bottom sheet, so the calendar is never
 * clipped by the keyboard or the screen edge and gets the sheet's safe-area footer.
 */
function PickerPopover({ anchorRef, isOpen, onClose, label, focusDate, sheetFooter, children }: {
  anchorRef: RefObject<HTMLButtonElement | null>;
  isOpen: boolean;
  onClose: () => void;
  label: string;
  /** Day that owns keyboard focus; moving it moves focus while the grid is focused. */
  focusDate?: string;
  /** Footer of the phone sheet, e.g. "Xong" for pickers that apply as you go. */
  sheetFooter?: ReactNode;
  children: ReactNode;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const asSheet = isOpen && isNarrowViewport();

  useEffect(() => {
    if (!isOpen || asSheet) return;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Element;
      if (anchorRef.current?.contains(target) || layerRef.current?.contains(target) || target.closest?.('.app-select-popover')) return;
      onCloseRef.current();
    };
    // Capture phase so the Escape does not also close a surrounding modal.
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('.app-select-popover')) return;
      event.preventDefault();
      event.stopPropagation();
      onCloseRef.current();
      anchorRef.current?.focus();
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown, true);
    const frame = requestAnimationFrame(() => {
      const layer = layerRef.current;
      (layer?.querySelector<HTMLElement>('.date-picker-day[tabindex="0"]') ?? layer?.querySelector<HTMLElement>('button:not(:disabled)'))?.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [anchorRef, asSheet, isOpen]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || !focusDate || !(document.activeElement as Element | null)?.classList.contains('date-picker-day')) return;
    layer.querySelector<HTMLElement>(`.date-picker-day[data-date="${focusDate}"]:not(.is-outside)`)?.focus({ preventScroll: true });
  }, [focusDate]);

  if (!isOpen) return null;
  if (asSheet) {
    return (
      <BottomSheet open onClose={onClose} title={label} nested footer={sheetFooter}>
        <div ref={layerRef} className="date-picker-sheet">{children}</div>
      </BottomSheet>
    );
  }
  return (
    <FloatingLayer anchorRef={anchorRef} layerRef={layerRef} className="date-picker-popover" role="dialog" aria-label={label}>
      {children}
    </FloatingLayer>
  );
}

function PresetList({ presets, active, onPick, min, max, footer }: {
  presets: Preset[];
  active?: Range;
  onPick: (range: Range) => void;
  min?: string;
  max?: string;
  footer?: ReactNode;
}) {
  // Several presets can share a span early in a period (7 ngày qua = Tháng này on the 7th); mark the first.
  const activeIndex = presets.findIndex((preset) => active?.from === preset.range.from && active.to === preset.range.to);
  return (
    <div className="date-picker-presets" role="group" aria-label="Chọn nhanh">
      {presets.map((preset, index) => {
        const isActive = index === activeIndex;
        return (
          <button
            key={preset.label}
            type="button"
            className={`date-picker-preset${isActive ? ' is-active' : ''}`}
            aria-pressed={isActive}
            disabled={outOfBounds(preset.range.from, min, max) || outOfBounds(preset.range.to, min, max)}
            onClick={() => onPick(preset.range)}
          >
            {preset.label}
          </button>
        );
      })}
      {footer}
    </div>
  );
}

/* ----------------------------------------------------------------- calendar */

interface CalendarProps {
  /** First visible month. */
  view: MonthView;
  onViewChange: (view: MonthView) => void;
  months?: 1 | 2;
  today: string;
  focusDate: string;
  onFocusDate: (date: string) => void;
  onPick: (date: string) => void;
  /** Selected span; from === to for a single day. */
  selection?: Range | null;
  onHover?: (date: string | null) => void;
  min?: string;
  max?: string;
  /** Month and year dropdowns, for far-away dates such as a birthday. */
  periodSelects?: boolean;
}

function Calendar({ view, onViewChange, months = 1, today, focusDate, onFocusDate, onPick, selection, onHover, min, max, periodSelects = false }: CalendarProps) {
  const lastView = shiftView(view, months - 1);
  const focusInto = (date: string) => {
    const target = viewOf(date);
    if (monthIndex(target) < monthIndex(view)) onViewChange(target);
    else if (monthIndex(target) > monthIndex(lastView)) onViewChange(shiftView(target, 1 - months));
    onFocusDate(date);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const weekday = (new Date(`${focusDate}T00:00:00Z`).getUTCDay() + 6) % 7;
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addCalendarDays(focusDate, -1),
      ArrowRight: () => addCalendarDays(focusDate, 1),
      ArrowUp: () => addCalendarDays(focusDate, -7),
      ArrowDown: () => addCalendarDays(focusDate, 7),
      Home: () => addCalendarDays(focusDate, -weekday),
      End: () => addCalendarDays(focusDate, 6 - weekday),
      PageUp: () => shiftDateByMonths(focusDate, -1),
      PageDown: () => shiftDateByMonths(focusDate, 1),
    };
    if (!moves[event.key]) return;
    event.preventDefault();
    focusInto(moves[event.key]());
  };

  const from = selection?.from ?? '';
  const to = selection?.to ?? '';
  const yearOptions = periodSelects ? (() => {
    const first = Math.min(Number(min?.slice(0, 4) ?? Number(today.slice(0, 4)) - 100), view.year);
    const last = Math.max(Number(max?.slice(0, 4) ?? Number(today.slice(0, 4)) + 10), view.year);
    return Array.from({ length: last - first + 1 }, (_, index) => ({ value: last - index, label: String(last - index) }));
  })() : [];

  return (
    <div className={`date-picker-months${months === 2 ? ' is-double' : ''}`} onKeyDown={onKeyDown} onMouseLeave={() => onHover?.(null)}>
      {Array.from({ length: months }, (_, offset) => {
        const month = shiftView(view, offset);
        const first = firstOfMonth(month);
        const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
        const daysInMonth = parseIsoDate(lastOfMonth(month))!.day;
        const cells = Array.from({ length: Math.ceil((lead + daysInMonth) / 7) * 7 }, (_, index) => addCalendarDays(first, index - lead));
        const showPrev = offset === 0;
        const showNext = offset === months - 1;
        return (
          <section key={first} className="date-picker-month">
            <header className="date-picker-caption">
              {showPrev ? (
                <button type="button" className="date-picker-nav" onClick={() => onViewChange(shiftView(view, -1))} aria-label="Tháng trước">
                  <i className="ph ph-caret-left" aria-hidden="true" />
                </button>
              ) : <span className="date-picker-nav-spacer" />}
              {periodSelects ? (
                <div className="date-picker-period">
                  <Select<number> aria-label="Chọn tháng" value={month.month} onChange={(next) => onViewChange({ year: month.year, month: next })} size="sm" variant="ghost" options={MONTH_NAMES.map((label, index) => ({ value: index + 1, label }))} />
                  <Select<number> aria-label="Chọn năm" value={month.year} onChange={(year) => onViewChange({ year, month: month.month })} size="sm" variant="ghost" options={yearOptions} />
                </div>
              ) : (
                <h3 className="date-picker-title" aria-live="polite">{`${MONTH_NAMES[month.month - 1]} ${month.year}`}</h3>
              )}
              {showNext ? (
                <button type="button" className="date-picker-nav" onClick={() => onViewChange(shiftView(view, 1))} aria-label="Tháng sau">
                  <i className="ph ph-caret-right" aria-hidden="true" />
                </button>
              ) : <span className="date-picker-nav-spacer" />}
            </header>
            <div className="date-picker-weekdays" aria-hidden="true">
              {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
            </div>
            <div className="date-picker-grid" role="grid" aria-label={`Tháng ${month.month} năm ${month.year}`}>
              {cells.map((date) => {
                const isOutside = date.slice(0, 7) !== first.slice(0, 7);
                const inRange = !isOutside && Boolean(from && to && date >= from && date <= to);
                const isEdge = !isOutside && (date === from || date === to);
                const classes = [
                  'date-picker-day',
                  isOutside && 'is-outside',
                  inRange && from !== to && 'is-in-range',
                  !isOutside && date === from && 'is-range-start',
                  !isOutside && date === to && 'is-range-end',
                  isEdge && 'is-selected',
                  date === today && 'is-today',
                ].filter(Boolean).join(' ');
                return (
                  <button
                    key={`${first}-${date}`}
                    type="button"
                    className={classes}
                    data-date={date}
                    role="gridcell"
                    tabIndex={!isOutside && date === focusDate ? 0 : -1}
                    disabled={outOfBounds(date, min, max)}
                    aria-selected={isEdge || inRange}
                    aria-current={date === today ? 'date' : undefined}
                    aria-label={formatDateOnly(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    onMouseEnter={() => onHover?.(date)}
                    onClick={() => {
                      focusInto(date);
                      onPick(date);
                    }}
                  >
                    {Number(date.slice(8))}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TimeRow({ value, onChange, onNow }: { value: string; onChange: (time: string) => void; onNow?: () => void }) {
  const [hour, minute] = /^\d{2}:\d{2}$/.test(value) ? value.split(':').map(Number) : [0, 0];
  return (
    <div className="date-picker-time">
      <Select<number> aria-label="Giờ" value={hour} onChange={(next) => onChange(`${pad(next)}:${pad(minute)}`)} options={HOURS} size="sm" triggerClassName="date-picker-time-select" />
      <span className="date-picker-time-sep" aria-hidden="true">:</span>
      <Select<number> aria-label="Phút" value={minute} onChange={(next) => onChange(`${pad(hour)}:${pad(next)}`)} options={MINUTES} size="sm" triggerClassName="date-picker-time-select" />
      {onNow && <button type="button" className="btn btn-ghost btn-sm date-picker-now" onClick={onNow}>Bây giờ</button>}
    </div>
  );
}

/* ------------------------------------------------------------------ triggers */

interface BaseFieldProps {
  id?: string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  /** Accessible name of the popover. */
  title?: string;
  /** IANA timezone that decides "today" and "now". Defaults to the branch timezone. */
  timeZone?: string;
  'aria-label'?: string;
}

function Trigger({ triggerRef, id, className = '', disabled, icon, text, isPlaceholder, isOpen, label, onClick }: {
  triggerRef: RefObject<HTMLButtonElement | null>;
  id?: string;
  className?: string;
  disabled?: boolean;
  icon: string;
  text: string;
  isPlaceholder: boolean;
  isOpen: boolean;
  label: string;
  onClick: () => void;
}) {
  const generatedId = useId();
  return (
    <button
      ref={triggerRef}
      id={id ?? generatedId}
      type="button"
      className={`app-date-time-trigger ${className}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
    >
      <i className={`ph ${icon}`} aria-hidden="true" />
      <span className={isPlaceholder ? 'is-placeholder' : ''}>{text}</span>
    </button>
  );
}

export function DatePickerField({
  value,
  onChange,
  min,
  max,
  allowClear = true,
  presets = true,
  id,
  className,
  disabled = false,
  placeholder = 'Chọn ngày',
  title: titleProp,
  timeZone,
  'aria-label': ariaLabel,
}: BaseFieldProps & {
  value?: string | null;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  allowClear?: boolean;
  /** "Hôm nay / Hôm qua / Hôm kia". Off for far-away dates, which get month/year dropdowns instead. */
  presets?: boolean;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const title = titleProp ?? ariaLabel ?? 'Chọn ngày';
  const [isOpen, setIsOpen] = useState(false);
  const selected = value && parseIsoDate(value) ? value : '';
  const today = branchNow(timeZone).slice(0, 10);
  const [view, setView] = useState(viewOf(selected || today));
  const [focusDate, setFocusDate] = useState(selected || today);

  const open = () => {
    const start = selected || today;
    setView(viewOf(start));
    setFocusDate(start);
    setIsOpen((current) => !current);
  };
  const pick = (date: string) => {
    onChange(date);
    setIsOpen(false);
    triggerRef.current?.focus();
  };
  const clear = allowClear && selected
    ? <button type="button" className="date-picker-preset date-picker-clear" onClick={() => pick('')}>Xóa ngày</button>
    : null;

  return (
    <>
      <Trigger triggerRef={triggerRef} id={id} className={className} disabled={disabled} icon="ph-calendar-blank" text={selected ? formatDateOnly(selected) : placeholder} isPlaceholder={!selected} isOpen={isOpen} label={ariaLabel ?? title} onClick={open} />
      <PickerPopover anchorRef={triggerRef} isOpen={isOpen} onClose={() => setIsOpen(false)} label={title} focusDate={focusDate}>
        <div className="date-picker-body">
          {presets && <PresetList presets={dayPresets(today)} active={selected ? { from: selected, to: selected } : undefined} onPick={(range) => pick(range.from)} min={min} max={max} footer={clear} />}
          <Calendar view={view} onViewChange={setView} today={today} focusDate={focusDate} onFocusDate={setFocusDate} onPick={pick} selection={selected ? { from: selected, to: selected } : null} min={min} max={max} periodSelects={!presets} />
        </div>
        {!presets && clear && <footer className="date-picker-footer">{clear}</footer>}
      </PickerPopover>
    </>
  );
}

export function DateRangePickerField({
  from,
  to,
  onChange,
  min,
  max,
  presets = true,
  id,
  className,
  disabled = false,
  placeholder = 'Chọn khoảng ngày',
  title: titleProp,
  timeZone,
  'aria-label': ariaLabel,
}: BaseFieldProps & {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  min?: string;
  max?: string;
  /** Period shortcuts (Hôm nay … Năm trước). Off for ranges that are not report periods. */
  presets?: boolean;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const title = titleProp ?? ariaLabel ?? 'Chọn khoảng thời gian';
  const [isOpen, setIsOpen] = useState(false);
  const today = branchNow(timeZone).slice(0, 10);
  const hasRange = Boolean(parseIsoDate(from) && parseIsoDate(to));
  const [anchor, setAnchor] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [view, setView] = useState(viewOf(hasRange ? from : today));
  const [focusDate, setFocusDate] = useState(hasRange ? from : today);
  const [months, setMonths] = useState<1 | 2>(2);

  const open = () => {
    const start = hasRange ? from : today;
    setMonths(isNarrowViewport() ? 1 : 2);
    setView(viewOf(start));
    setFocusDate(start);
    setAnchor(null);
    setHover(null);
    setIsOpen((current) => !current);
  };
  const commit = (range: Range) => {
    onChange(range.from, range.to);
    setIsOpen(false);
    triggerRef.current?.focus();
  };
  const pick = (date: string) => {
    if (!anchor) {
      setAnchor(date);
      return;
    }
    commit(date < anchor ? { from: date, to: anchor } : { from: anchor, to: date });
  };

  const pending = anchor ? [anchor, hover ?? anchor].sort() : null;
  const selection = pending ? { from: pending[0], to: pending[1] } : hasRange ? { from, to } : null;
  const text = !hasRange ? placeholder
    : from === to ? formatDateOnly(from)
      // Same year: "01/10 - 07/10/2026" fits a 220px filter sidebar.
      : from.slice(0, 4) === to.slice(0, 4) ? `${formatDateOnly(from, { day: '2-digit', month: '2-digit' })} - ${formatDateOnly(to)}`
        : `${formatDateOnly(from)} - ${formatDateOnly(to)}`;

  return (
    <>
      <Trigger triggerRef={triggerRef} id={id} className={className} disabled={disabled} icon="ph-calendar-blank" text={text} isPlaceholder={!hasRange} isOpen={isOpen} label={`${title}: ${text}`} onClick={open} />
      <PickerPopover anchorRef={triggerRef} isOpen={isOpen} onClose={() => setIsOpen(false)} label={title} focusDate={focusDate}>
        <div className="date-picker-body">
          {presets && <PresetList presets={rangePresets(today)} active={hasRange ? { from, to } : undefined} onPick={commit} min={min} max={max} />}
          <Calendar view={view} onViewChange={setView} months={months} today={today} focusDate={focusDate} onFocusDate={setFocusDate} onPick={pick} selection={selection} onHover={anchor ? setHover : undefined} min={min} max={max} />
        </div>
      </PickerPopover>
    </>
  );
}

export function TimePickerField({
  value,
  onChange,
  id,
  className,
  disabled = false,
  placeholder = 'Chọn giờ',
  title: titleProp,
  'aria-label': ariaLabel,
}: BaseFieldProps & { value?: string; onChange: (value: string) => void }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const title = titleProp ?? ariaLabel ?? 'Chọn giờ';
  const [isOpen, setIsOpen] = useState(false);
  const valid = /^\d{2}:\d{2}$/.test(value ?? '');
  return (
    <>
      <Trigger triggerRef={triggerRef} id={id} className={className} disabled={disabled} icon="ph-clock" text={valid ? value! : placeholder} isPlaceholder={!valid} isOpen={isOpen} label={ariaLabel ?? title} onClick={() => setIsOpen((current) => !current)} />
      <PickerPopover anchorRef={triggerRef} isOpen={isOpen} onClose={() => setIsOpen(false)} label={title} sheetFooter={<button type="button" className="btn btn-primary" onClick={() => setIsOpen(false)}>Xong</button>}>
        <TimeRow value={valid ? value! : '00:00'} onChange={onChange} />
      </PickerPopover>
    </>
  );
}

/** Calendar + hour:minute row. Changes apply at once; the value is a branch-local "YYYY-MM-DDTHH:mm". */
export function DateTimePickerField({
  value,
  onChange,
  minDate,
  maxDate,
  id,
  className,
  disabled = false,
  placeholder = 'Chọn ngày giờ',
  title: titleProp,
  timeZone,
  'aria-label': ariaLabel,
}: BaseFieldProps & {
  value?: string;
  onChange: (value: string) => void;
  minDate?: string;
  maxDate?: string;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const title = titleProp ?? ariaLabel ?? 'Chọn ngày giờ';
  const [isOpen, setIsOpen] = useState(false);
  const selected = parseLocalDateTime(value ?? '') ? value! : '';
  const now = branchNow(timeZone);
  const date = (selected || now).slice(0, 10);
  const time = (selected || now).slice(11, 16);
  const [view, setView] = useState(viewOf(date));
  const [focusDate, setFocusDate] = useState(date);

  const open = () => {
    setView(viewOf(date));
    setFocusDate(date);
    setIsOpen((current) => !current);
  };
  const text = selected ? `${time} ${formatDateOnly(date)}` : placeholder;

  return (
    <>
      <Trigger triggerRef={triggerRef} id={id} className={className} disabled={disabled} icon="ph-calendar-dots" text={text} isPlaceholder={!selected} isOpen={isOpen} label={ariaLabel ?? title} onClick={open} />
      <PickerPopover anchorRef={triggerRef} isOpen={isOpen} onClose={() => setIsOpen(false)} label={title} focusDate={focusDate} sheetFooter={<button type="button" className="btn btn-primary" onClick={() => setIsOpen(false)}>Xong</button>}>
        <Calendar view={view} onViewChange={setView} today={now.slice(0, 10)} focusDate={focusDate} onFocusDate={setFocusDate} onPick={(next) => onChange(`${next}T${time}`)} selection={{ from: date, to: date }} min={minDate} max={maxDate} />
        <footer className="date-picker-footer">
          <TimeRow
            value={time}
            onChange={(next) => onChange(`${date}T${next}`)}
            onNow={() => {
              onChange(now);
              setView(viewOf(now.slice(0, 10)));
              setFocusDate(now.slice(0, 10));
            }}
          />
        </footer>
      </PickerPopover>
    </>
  );
}

/** Bottom-sheet variant for flows whose trigger lives elsewhere; applies on "Xác nhận". */
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
  const now = branchNow(timeZone);
  const initial = parseLocalDateTime(value ?? '') ? value! : now;
  const [draft, setDraft] = useState(initial);
  const [view, setView] = useState(viewOf(initial.slice(0, 10)));
  const [focusDate, setFocusDate] = useState(initial.slice(0, 10));

  useEffect(() => {
    if (!isOpen) return;
    setDraft(initial);
    setView(viewOf(initial.slice(0, 10)));
    setFocusDate(initial.slice(0, 10));
    // Reset only when the sheet opens; `initial` changes every minute while it is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, value]);

  const date = draft.slice(0, 10);
  const time = draft.slice(11, 16);
  return (
    <BottomSheet
      open={isOpen}
      onClose={onClose}
      title={title}
      nested
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button>
          <button type="button" className="btn btn-primary" onClick={() => { onApply(draft); onClose(); }}>Xác nhận</button>
        </>
      )}
    >
      <div className="date-picker-sheet">
        <Calendar view={view} onViewChange={setView} today={now.slice(0, 10)} focusDate={focusDate} onFocusDate={setFocusDate} onPick={(next) => setDraft(`${next}T${time}`)} selection={{ from: date, to: date }} min={minDate} max={maxDate} />
        <TimeRow
          value={time}
          onChange={(next) => setDraft(`${date}T${next}`)}
          onNow={() => {
            setDraft(now);
            setView(viewOf(now.slice(0, 10)));
            setFocusDate(now.slice(0, 10));
          }}
        />
      </div>
    </BottomSheet>
  );
}
