export function toIsoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const todayIso = () => toIsoDate(new Date());

export function monthStartIso() {
  const now = new Date();
  return toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
}

export function weekStartIso() {
  const now = new Date();
  now.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return toIsoDate(now);
}

export const COMMON_DATE_PRESETS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'today', label: 'Hôm nay' },
  { value: 'yesterday', label: 'Hôm qua' },
  { value: '7days', label: '7 ngày qua' },
  { value: 'this_month', label: 'Tháng này' },
] as const;

export function formatDayHeader(dateStr: string): string {
  try {
    const d = new Date(`${dateStr}T00:00:00`);
    if (isNaN(d.getTime())) return dateStr;
    const today = new Date();
    const todayStr = toIsoDate(today);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = toIsoDate(yesterday);

    const dayMonth = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (dateStr === todayStr) return `HÔM NAY, ${dayMonth}`;
    if (dateStr === yesterdayStr) return `HÔM QUA, ${dayMonth}`;
    return `NGÀY ${dayMonth}`;
  } catch {
    return dateStr;
  }
}
