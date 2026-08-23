import type { ApiRecord } from '@/types/api';
import { ATTENDANCE_GRACE_MINUTES } from '@/config';

export type AttendanceVisualStatus = 'ontime' | 'late' | 'missing' | 'unclocked' | 'leave';

export interface AttendanceCalculation {
  status: AttendanceVisualStatus;
  detailText: string;
  subText: string;
  lateMinutes: number;
  earlyMinutes: number;
  beforeShiftMinutes: number;
  afterShiftMinutes: number;
}

const TIME_ZONE = 'Asia/Ho_Chi_Minh';
// Grace period matches backend config (config.payroll.graceMinutes)
const GRACE_MINUTES = ATTENDANCE_GRACE_MINUTES;

const formatMinutes = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours && remainder) return `${hours}h ${remainder}p`;
  return hours ? `${hours}h` : `${remainder}p`;
};

const timeToMinutes = (value: string) => {
  const [hours = '0', minutes = '0'] = value.split(':');
  return Number(hours) * 60 + Number(minutes);
};

/** Format a timestamptz in the salon's operating timezone instead of slicing UTC. */
export function formatAttendanceTime(value: unknown) {
  if (!value) return '--';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '--';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

function shiftHasEnded(date: string, startsAt: string, endsAt: string, now: Date) {
  const startsAtMinutes = timeToMinutes(startsAt);
  const endsAtMinutes = timeToMinutes(endsAt);
  const end = new Date(`${date}T${endsAt}:00+07:00`);
  if (endsAtMinutes <= startsAtMinutes) end.setUTCDate(end.getUTCDate() + 1);
  return now.getTime() >= end.getTime();
}

/**
 * Derives the visual attendance result for one assigned shift. The source of
 * truth is the actual check-in/check-out time compared to that shift.
 */
export function calculateAttendanceForShift({
  date,
  startsAt,
  endsAt,
  scheduleStatus,
  attendance,
  now = new Date(),
}: {
  date: string;
  startsAt: string;
  endsAt: string;
  scheduleStatus?: string;
  attendance?: ApiRecord;
  now?: Date;
}): AttendanceCalculation {
  if (scheduleStatus === 'leave') {
    return { status: 'leave', detailText: 'Nghỉ phép', subText: '', lateMinutes: 0, earlyMinutes: 0, beforeShiftMinutes: 0, afterShiftMinutes: 0 };
  }

  if (!attendance) {
    return { status: 'unclocked', detailText: '-- --', subText: 'Chưa chấm công', lateMinutes: 0, earlyMinutes: 0, beforeShiftMinutes: 0, afterShiftMinutes: 0 };
  }

  const checkIn = formatAttendanceTime(attendance.checkIn);
  const checkOut = formatAttendanceTime(attendance.checkOut);
  const hasCheckIn = checkIn !== '--';
  const hasCheckOut = checkOut !== '--';
  const startsAtMinutes = timeToMinutes(startsAt);
  const endsAtMinutes = timeToMinutes(endsAt);
  const checkInMinutes = hasCheckIn ? timeToMinutes(checkIn) : 0;
  const checkOutMinutes = hasCheckOut ? timeToMinutes(checkOut) : 0;
  const lateMinutes = hasCheckIn ? Math.max(0, checkInMinutes - startsAtMinutes - GRACE_MINUTES) : 0;
  const earlyMinutes = hasCheckOut ? Math.max(0, endsAtMinutes - checkOutMinutes - GRACE_MINUTES) : 0;
  const beforeShiftMinutes = hasCheckIn ? Math.max(0, startsAtMinutes - checkInMinutes) : 0;
  const afterShiftMinutes = hasCheckOut ? Math.max(0, checkOutMinutes - endsAtMinutes) : 0;
  const details = [
    lateMinutes > 0 ? `Đi muộn ${formatMinutes(lateMinutes)}` : '',
    earlyMinutes > 0 ? `Về sớm ${formatMinutes(earlyMinutes)}` : '',
    beforeShiftMinutes > 0 ? `Làm thêm TC ${formatMinutes(beforeShiftMinutes)}` : '',
    afterShiftMinutes > 0 ? `Làm thêm SC ${formatMinutes(afterShiftMinutes)}` : '',
  ].filter(Boolean);

  if (!hasCheckIn || !hasCheckOut) {
    const hasEnded = shiftHasEnded(date, startsAt, endsAt, now);
    if (hasEnded || !hasCheckIn) {
      return {
        status: 'missing',
        detailText: `${checkIn} ${checkOut}`,
        subText: hasCheckIn ? 'Chưa chấm ra' : 'Chưa chấm vào',
        lateMinutes, earlyMinutes, beforeShiftMinutes, afterShiftMinutes,
      };
    }

    return {
      status: lateMinutes > 0 ? 'late' : 'ontime',
      detailText: `${checkIn} --`,
      subText: details.join(', '),
      lateMinutes, earlyMinutes, beforeShiftMinutes, afterShiftMinutes,
    };
  }

  return {
    status: lateMinutes > 0 || earlyMinutes > 0 ? 'late' : 'ontime',
    detailText: `${checkIn} - ${checkOut}`,
    subText: details.join(', '),
    lateMinutes, earlyMinutes, beforeShiftMinutes, afterShiftMinutes,
  };
}
