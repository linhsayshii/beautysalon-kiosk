import { parseIsoDate } from '@/lib/date';

/** "Tuần 4 - Th. 9 2026" for the week starting on the given Monday (week number within its month). */
export function scheduleWeekLabel(mondayIso: string): string {
  const date = parseIsoDate(mondayIso);
  if (!date) return mondayIso;
  return `Tuần ${Math.ceil(date.day / 7)} - Th. ${date.month} ${date.year}`;
}
