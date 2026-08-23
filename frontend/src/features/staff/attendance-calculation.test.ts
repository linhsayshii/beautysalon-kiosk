import { describe, expect, it } from 'vitest';
import { calculateAttendanceForShift, formatAttendanceTime } from './attendance-calculation';

const shift = { date: '2026-08-17', startsAt: '09:00', endsAt: '20:00' };
const completed = (checkIn: string, checkOut: string) => ({ checkIn, checkOut });

describe('attendance calculation', () => {
  it('formats stored UTC timestamps in Vietnam time', () => {
    expect(formatAttendanceTime('2026-08-17T01:28:00.000Z')).toBe('08:28');
  });

  it('marks a shift without a backend record as unclocked', () => {
    expect(calculateAttendanceForShift(shift)).toMatchObject({
      status: 'unclocked', detailText: '-- --', subText: 'Chưa chấm công',
    });
  });

  it('derives late arrival and after-shift overtime from actual times', () => {
    expect(calculateAttendanceForShift({ ...shift, attendance: completed('2026-08-17T04:01:00.000Z', '2026-08-17T14:01:00.000Z') })).toMatchObject({
      status: 'late', detailText: '11:01 - 21:01', subText: 'Đi muộn 1h 51p, Làm thêm SC 1h 1p',
    });
  });

  it('keeps an on-time shift blue while showing before/after-shift overtime', () => {
    expect(calculateAttendanceForShift({ ...shift, attendance: completed('2026-08-17T01:57:00.000Z', '2026-08-17T13:06:00.000Z') })).toMatchObject({
      status: 'ontime', detailText: '08:57 - 20:06', subText: 'Làm thêm TC 3p, Làm thêm SC 6p',
    });
  });

  it('marks an incomplete record red after its shift ends', () => {
    expect(calculateAttendanceForShift({
      ...shift, attendance: { checkIn: '2026-08-17T02:00:00.000Z' }, now: new Date('2026-08-18T00:00:00.000Z'),
    })).toMatchObject({ status: 'missing', detailText: '09:00 --', subText: 'Chưa chấm ra' });
  });
});
