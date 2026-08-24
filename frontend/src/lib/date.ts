export const DEFAULT_BRANCH_TIME_ZONE = 'Asia/Ho_Chi_Minh';

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

export interface LocalDateTimeParts extends DateParts {
  hour: number;
  minute: number;
}

export function toIsoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isIsoDate(value: unknown): value is string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''))) return false;
  const [year, month, day] = String(value).split('-').map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month - 1
    && candidate.getUTCDate() === day;
}

/** Parses a calendar day without accidentally applying the browser timezone. */
export function parseIsoDate(value: string): DateParts | null {
  if (!isIsoDate(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

export function formatIsoDate(parts: DateParts): string {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

/** Adds days to a date-only value without converting through local time. */
export function addCalendarDays(value: string, days: number): string {
  const date = parseIsoDate(value);
  if (!date) return value;
  const result = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return formatIsoDate({ year: result.getUTCFullYear(), month: result.getUTCMonth() + 1, day: result.getUTCDate() });
}

export function startOfIsoWeek(value: string): string {
  const date = parseIsoDate(value);
  if (!date) return value;
  const weekday = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
  return addCalendarDays(value, -((weekday + 6) % 7));
}

export function parseLocalDateTime(value: string): LocalDateTimeParts | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const date = parseIsoDate(match[1]);
  const hour = Number(match[2]);
  const minute = Number(match[3]);
  if (!date || hour > 23 || minute > 59) return null;
  return { ...date, hour, minute };
}

export function formatLocalDateTime(parts: LocalDateTimeParts): string {
  return `${formatIsoDate(parts)}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

function zonedParts(value: Date, timeZone: string): LocalDateTimeParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value ?? 0);
  return { year: part('year'), month: part('month'), day: part('day'), hour: part('hour'), minute: part('minute') };
}

/** Formats an instant for the operating branch, never for the device timezone. */
export function localDateTimeFromInstant(value: Date | string, timeZone = DEFAULT_BRANCH_TIME_ZONE): string {
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) return '';
  return formatLocalDateTime(zonedParts(instant, timeZone));
}

export function formatBranchTime(value: Date | string, timeZone = DEFAULT_BRANCH_TIME_ZONE): string {
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) return '--:--';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(instant);
}

/**
 * Converts a local calendar value in an IANA timezone to an ISO instant.
 * The two passes resolve ordinary timezone offsets and daylight-saving offsets
 * without using the browser's own timezone.
 */
export function zonedLocalDateTimeToIso(value: string, timeZone = DEFAULT_BRANCH_TIME_ZONE): string | null {
  const local = parseLocalDateTime(value);
  if (!local) return null;
  const desiredUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  let timestamp = desiredUtc;
  for (let pass = 0; pass < 2; pass += 1) {
    const actual = zonedParts(new Date(timestamp), timeZone);
    const actualUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute);
    timestamp += desiredUtc - actualUtc;
  }
  const resolved = zonedParts(new Date(timestamp), timeZone);
  if (formatLocalDateTime(resolved) !== value) return null;
  return new Date(timestamp).toISOString();
}

export function formatDateOnly(value: string, options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' }): string {
  const date = parseIsoDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat('vi-VN', { ...options, timeZone: 'UTC' })
    .format(new Date(Date.UTC(date.year, date.month - 1, date.day)));
}

/** Returns today's calendar day for the operating branch, not the device. */
export const todayIso = (timeZone = DEFAULT_BRANCH_TIME_ZONE) => localDateTimeFromInstant(new Date(), timeZone).slice(0, 10);

export function monthStartIso(timeZone = DEFAULT_BRANCH_TIME_ZONE) {
  const date = parseIsoDate(todayIso(timeZone));
  return date ? formatIsoDate({ ...date, day: 1 }) : '';
}

export function weekStartIso(timeZone = DEFAULT_BRANCH_TIME_ZONE) {
  return startOfIsoWeek(todayIso(timeZone));
}

export const COMMON_DATE_PRESETS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'today', label: 'Hôm nay' },
  { value: 'yesterday', label: 'Hôm qua' },
  { value: '7days', label: '7 ngày qua' },
  { value: 'this_month', label: 'Tháng này' },
] as const;

export function formatDayHeader(dateStr: string, currentDate = todayIso()): string {
  const date = parseIsoDate(dateStr);
  if (!date) return dateStr;
  const todayStr = currentDate;
  const yesterdayStr = addCalendarDays(currentDate, -1);
  const dayMonth = `${String(date.day).padStart(2, '0')}/${String(date.month).padStart(2, '0')}`;
  if (dateStr === todayStr) return `HÔM NAY, ${dayMonth}`;
  if (dateStr === yesterdayStr) return `HÔM QUA, ${dayMonth}`;
  return `NGÀY ${dayMonth}`;
}
