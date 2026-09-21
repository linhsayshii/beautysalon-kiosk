import { afterEach, expect, it, vi } from 'vitest';
import * as api from './staff.api';
import { getScheduleRange } from './schedule-range';
afterEach(() => vi.restoreAllMocks());
it('loads every week and excludes days after the attendance cutoff', async () => {
  const spy = vi.spyOn(api, 'getSchedule').mockImplementation(async start => ({ data: { schedules: [
    { id: Number(start.slice(-2)), shiftDate: start, staffId: 1 },
    { id: 99, shiftDate: '2026-09-21', staffId: 1 },
  ] } }));
  const result = await getScheduleRange('2026-09-01', '2026-09-15');
  expect(spy.mock.calls.map(call => call[0])).toEqual(['2026-09-01', '2026-09-08', '2026-09-15']);
  expect(result.data.schedules.map(shift => shift.id)).toEqual([1, 8, 15]);
});
it('does not present partial schedules when one week fails', async () => {
  vi.spyOn(api, 'getSchedule').mockImplementation(async start => {
    if (start === '2026-09-08') throw new Error('Schedule unavailable');
    return { data: { schedules: [] } };
  });
  await expect(getScheduleRange('2026-09-01', '2026-09-15')).rejects.toThrow('Schedule unavailable');
});
