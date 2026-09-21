import { getSchedule } from './staff.api';
import type { ApiRecord } from '@/types/api';

/** The schedule endpoint returns seven days; merge only days inside the requested range. */
export async function getScheduleRange(dateFrom: string, dateTo: string) {
  const starts: string[] = [];
  for (const day = new Date(`${dateFrom}T00:00:00Z`); day.toISOString().slice(0, 10) <= dateTo; day.setUTCDate(day.getUTCDate() + 7)) {
    starts.push(day.toISOString().slice(0, 10));
  }
  const weeks = await Promise.all(starts.map(getSchedule));
  const schedules = new Map<number, ApiRecord>();
  for (const week of weeks) {
    for (const shift of week.data.schedules ?? []) {
      if (shift.shiftDate >= dateFrom && shift.shiftDate <= dateTo) schedules.set(shift.id, shift);
    }
  }
  return { data: { schedules: [...schedules.values()] } };
}
