import { describe, expect, it } from 'vitest';
import { scheduleWeekLabel } from './week-label';

describe('scheduleWeekLabel', () => {
  it('numbers the week inside its month, as the week picker shows it', () => {
    expect(scheduleWeekLabel('2026-09-28')).toBe('Tuần 4 - Th. 9 2026');
    expect(scheduleWeekLabel('2026-09-07')).toBe('Tuần 1 - Th. 9 2026');
    expect(scheduleWeekLabel('2026-10-05')).toBe('Tuần 1 - Th. 10 2026');
  });
});
