import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDate } from '@/lib/format';
import { DetailFacts, DetailHead, InlineDetail, ValueStrip } from '@/components/data-display/InlineDetail';
import { addCalendarDays } from '@/lib/date';
import type { ApiRecord } from '@/types/api';
import { calculateAttendanceForShift, formatAttendanceTime } from '../attendance-calculation';
import { getSchedule, getAttendance } from '../staff.api';

export interface StaffAttendanceDetailProps {
  staff: ApiRecord;
  currentMonday: string; // ISO date string of Monday of the week (YYYY-MM-DD)
  workShifts?: Array<{ name: string; startsAt: string; endsAt: string }>;
}

type DetailTab = 'timekeeping' | 'summary' | 'shifts';

const weekdayNames = ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật'];

const salaryDescriptions: Record<string, string> = {
  monthly: 'Theo ngày công chuẩn',
  hourly: 'Theo giờ làm việc',
  shift: 'Theo ca làm việc',
};

function formatMinutesToHoursMinutes(minutes: number) {
  if (!minutes || minutes <= 0) return '0 phút';
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours > 0 && remainingMinutes > 0) {
    return `${hours}h ${remainingMinutes}p`;
  }
  if (hours > 0) {
    return `${hours} giờ`;
  }
  return `${remainingMinutes} phút`;
}

function formatMinutesToHoursMinutesFull(minutes: number) {
  if (!minutes || minutes <= 0) return '0 phút';
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours > 0 && remainingMinutes > 0) {
    return `${hours} giờ ${remainingMinutes} phút`;
  }
  if (hours > 0) {
    return `${hours} giờ`;
  }
  return `${remainingMinutes} phút`;
}

export function StaffAttendanceDetail({ staff, currentMonday }: StaffAttendanceDetailProps) {
  const [tab, setTab] = useState<DetailTab>('timekeeping');

  // Compute 7 dates of the week
  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addCalendarDays(currentMonday, i));
  }, [currentMonday]);

  const startDateIso = weekDates[0];
  const endDateIso = weekDates[6];

  // Queries for schedule and attendance
  const scheduleQuery = useQuery({
    queryKey: ['staff-schedule', startDateIso],
    queryFn: () => getSchedule(startDateIso),
  });

  const attendanceQuery = useQuery({
    queryKey: ['staff-attendance', startDateIso, endDateIso],
    queryFn: () => getAttendance(startDateIso, endDateIso),
  });

  const schedules = useMemo<ApiRecord[]>(() => {
    const rawSchedules = (scheduleQuery.data?.data?.schedules ?? []) as ApiRecord[];
    return rawSchedules.map((schedule) => ({
      ...schedule,
      date: schedule.shiftDate ?? schedule.date,
    }));
  }, [scheduleQuery.data]);
  const attendanceRecords = (attendanceQuery.data?.data ?? []) as ApiRecord[];

  // Filter staff specific schedules and attendance
  const staffSchedules = useMemo(() => {
    return schedules.filter((s) => Number(s.staffId) === Number(staff.id));
  }, [schedules, staff.id]);

  const staffAttendance = useMemo(() => {
    return attendanceRecords.filter((a) => Number(a.staff?.id ?? a.staffId) === Number(staff.id));
  }, [attendanceRecords, staff.id]);

  // 7-day attendance grid calculation
  const daysData = useMemo(() => {
    return weekDates.map((dateStr) => {
      const schedule = staffSchedules.find((s) => s.date === dateStr);
      const att = staffAttendance.find(
        (a) => (a.workDate ? String(a.workDate).slice(0, 10) : '') === dateStr
      );

      if (!schedule) {
        return {
          dateStr,
          weekday: weekdayNames[weekDates.indexOf(dateStr)],
          shiftName: 'Chưa xếp ca',
          checkIn: att?.checkIn ? formatAttendanceTime(att.checkIn) : '--',
          checkOut: att?.checkOut ? formatAttendanceTime(att.checkOut) : '--',
          lateMinutes: 0,
          earlyMinutes: 0,
          otMinutes: 0,
          workedMinutes: Number(att?.workedMinutes ?? 0),
          status: 'leave',
          statusText: 'Không có lịch',
        };
      }

      const calculation = calculateAttendanceForShift({
        date: dateStr,
        startsAt: String(schedule.startsAt),
        endsAt: String(schedule.endsAt),
        scheduleStatus: String(schedule.status),
        attendance: att,
      });
      const [checkIn = '--', checkOut = '--'] = calculation.detailText.includes(' - ')
        ? calculation.detailText.split(' - ')
        : calculation.detailText.split(' ');
      const statusText = calculation.subText || (calculation.status === 'ontime' ? 'Đúng giờ' : 'Nghỉ phép');

      return {
        dateStr,
        weekday: weekdayNames[weekDates.indexOf(dateStr)],
        shiftName: `${schedule.shiftName} (${schedule.startsAt} - ${schedule.endsAt})`,
        checkIn,
        checkOut,
        lateMinutes: calculation.lateMinutes,
        earlyMinutes: calculation.earlyMinutes,
        otMinutes: calculation.beforeShiftMinutes + calculation.afterShiftMinutes,
        workedMinutes: Number(att?.workedMinutes ?? 0),
        status: calculation.status,
        statusText,
      };
    });
  }, [weekDates, staffSchedules, staffAttendance]);

  // Aggregate stats for Layer 4
  const stats = useMemo(() => {
    // Dynamic calculate from daysData
    let workedDays = 0;
    let workedMinutes = 0;
    let lateCount = 0;
    let lateMinutes = 0;
    let earlyCount = 0;
    let earlyMinutes = 0;
    let otCount = 0;
    let otMinutes = 0;
    let leaveDays = 0;

    daysData.forEach((d) => {
      if (d.checkIn !== '--' || d.checkOut !== '--') {
        workedDays++;
      }
      workedMinutes += d.workedMinutes;
      if (d.lateMinutes > 0) {
        lateCount++;
        lateMinutes += d.lateMinutes;
      }
      if (d.earlyMinutes > 0) {
        earlyCount++;
        earlyMinutes += d.earlyMinutes;
      }
      if (d.otMinutes > 0) {
        otCount++;
        otMinutes += d.otMinutes;
      }
      if (d.status === 'leave') {
        leaveDays++;
      }
    });

    const workedHours = Math.floor(workedMinutes / 60);

    return {
      workedDays,
      workedHoursText: workedDays > 0 ? `${workedDays} ngày / ${workedHours} giờ` : '0 ngày / 0 giờ',
      lateCount,
      lateText: lateCount > 0 ? `${lateCount} lần / ${formatMinutesToHoursMinutes(lateMinutes)}` : '0 lần',
      earlyCount,
      earlyText: earlyCount > 0 ? `${earlyCount} lần / ${formatMinutesToHoursMinutes(earlyMinutes)}` : '0 lần',
      otCount,
      otText: otCount > 0 ? `${otCount} lần / ${formatMinutesToHoursMinutes(otMinutes)}` : '0 lần',
      leaveDays,
      leaveText: `${leaveDays} ngày`,
      totalWorkedMinutes: workedMinutes,
      totalLateMinutes: lateMinutes,
      totalEarlyMinutes: earlyMinutes,
      totalOtMinutes: otMinutes,
    };
  }, [daysData]);

  const tabsList: { value: DetailTab; label: string }[] = [
    { value: 'timekeeping', label: 'Bảng chấm công tuần' },
    { value: 'summary', label: 'Tổng hợp công & Tăng ca' },
    { value: 'shifts', label: 'Lịch ca được xếp' },
  ];

  const salaryTypeText =
    salaryDescriptions[String(staff.salaryType)] ??
    (staff.role?.includes('Kỹ thuật') || staff.role?.includes('Chính') ? 'Theo giờ làm việc' : 'Theo ngày công chuẩn');

  return (
    <InlineDetail className="staff-attendance-detail" label={`Chi tiết chấm công ${staff.name}`} tabs={tabsList} tab={tab} onTabChange={setTab}>
      <DetailHead
        icon="ph-calendar-check"
        title={staff.name}
        tags={<span className="badge badge-info">{staff.role || 'Nhân viên'}</span>}
        meta={<>Mã nhân viên: <strong>{staff.code}</strong>{staff.department && ` • ${staff.department}`}</>}
        aside={<><div><strong>{staff.branchName || 'Chi nhánh trung tâm'}</strong></div><div>Tuần: {formatDate(startDateIso)} - {formatDate(endDateIso)}</div></>}
      />

      <ValueStrip
        items={[
          { label: 'Ngày đi làm', value: stats.workedHoursText, tone: 'primary' },
          { label: 'Đi muộn / Về sớm', value: stats.lateText, tone: stats.lateCount > 0 ? 'danger' : 'violet' },
          { label: 'Tăng ca (OT)', value: stats.otText, tone: 'success' },
          { label: 'Nghỉ làm / Vắng', value: stats.leaveText, tone: 'muted' },
        ]}
      />

      {tab === 'timekeeping' && (
        <div className="table-scroll">
          <table className="detail-table">
            <thead>
              <tr>
                <th>Ngày / Thứ</th>
                <th>Ca làm việc</th>
                <th className="is-center">Giờ vào</th>
                <th className="is-center">Giờ ra</th>
                <th className="is-center">Đi muộn</th>
                <th className="is-center">Về sớm</th>
                <th className="is-center">Tăng ca</th>
                <th className="is-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {daysData.map((row) => (
                <tr key={row.dateStr}>
                  <td>
                    <span className="cell-main">{row.weekday}</span>
                    <span className="cell-sub">{formatDate(row.dateStr)}</span>
                  </td>
                  <td className={row.shiftName.includes('Nghỉ') ? 'text-faint' : 'text-primary'}>{row.shiftName}</td>
                  <td className="is-center text-strong">{row.checkIn}</td>
                  <td className="is-center text-strong">{row.checkOut}</td>
                  <td className={row.lateMinutes > 0 ? 'is-center text-strong text-danger' : 'is-center text-faint'}>
                    {row.lateMinutes > 0 ? formatMinutesToHoursMinutes(row.lateMinutes) : '—'}
                  </td>
                  <td className={row.earlyMinutes > 0 ? 'is-center text-danger' : 'is-center text-faint'}>
                    {row.earlyMinutes > 0 ? formatMinutesToHoursMinutes(row.earlyMinutes) : '—'}
                  </td>
                  <td className={row.otMinutes > 0 ? 'is-center text-strong text-success' : 'is-center text-faint'}>
                    {row.otMinutes > 0 ? formatMinutesToHoursMinutes(row.otMinutes) : '—'}
                  </td>
                  <td className="is-center">
                    <span className={`status-badge ${row.status === 'ontime' ? 'active' : row.status === 'late' ? 'draft' : row.status === 'missing' ? 'cancelled' : 'completed'}`}>
                      {row.statusText}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'summary' && (
        <DetailFacts
          items={[
            { label: 'Tổng ngày công thực tế', value: `${stats.workedDays} ngày`, tone: 'primary' },
            { label: 'Tổng giờ làm việc', value: formatMinutesToHoursMinutesFull(stats.totalWorkedMinutes) },
            {
              label: 'Tổng thời gian muộn',
              value: stats.totalLateMinutes > 0 ? formatMinutesToHoursMinutesFull(stats.totalLateMinutes) : '0 phút',
              tone: stats.totalLateMinutes > 0 ? 'danger' : undefined,
            },
            {
              label: 'Tổng thời gian về sớm',
              value: stats.totalEarlyMinutes > 0 ? formatMinutesToHoursMinutesFull(stats.totalEarlyMinutes) : '0 phút',
              tone: stats.totalEarlyMinutes > 0 ? 'violet' : undefined,
            },
            { label: 'Tổng giờ tăng ca', value: formatMinutesToHoursMinutesFull(stats.totalOtMinutes), tone: 'success' },
            { label: 'Loại lương áp dụng', value: salaryTypeText },
            { label: 'Kỳ tính công', value: `${formatDate(startDateIso)} - ${formatDate(endDateIso)}` },
            { label: 'Số ca được phân', value: `${staffSchedules.length} ca` },
            { label: 'Trạng thái tuần', value: 'Đã đồng bộ máy chấm công', tone: 'success' },
            {
              label: 'Ghi chú',
              value: staff.note || 'Dữ liệu chấm công được đồng bộ tự động từ máy chấm công vân tay & nhận diện khuôn mặt.',
              span: 'full',
              variant: 'note',
            },
          ]}
        />
      )}

      {tab === 'shifts' && (
        <div className="table-scroll">
          <table className="detail-table">
            <thead>
              <tr>
                <th>Ngày / Thứ</th>
                <th>Tên ca làm việc</th>
                <th>Khung giờ</th>
                <th>Chi nhánh</th>
                <th className="is-center">Trạng thái ca</th>
                <th className="is-center">Chấm công</th>
              </tr>
            </thead>
            <tbody>
              {daysData.map((row) => {
                const att = staffAttendance.find(
                  (a) => (a.workDate ? String(a.workDate).slice(0, 10) : '') === row.dateStr
                );
                const isFullyClocked = att?.checkIn && att?.checkOut;
                const isPartiallyClocked = att?.checkIn || att?.checkOut;
                const schedule = staffSchedules.find((s) => s.date === row.dateStr);
                const isOff = row.shiftName.includes('Nghỉ');

                return (
                  <tr key={row.dateStr}>
                    <td>
                      <span className="cell-main">{row.weekday}</span>
                      <span className="cell-sub">{formatDate(row.dateStr)}</span>
                    </td>
                    <td className="is-code">{row.shiftName}</td>
                    <td className="text-muted">
                      {schedule?.startsAt && schedule?.endsAt
                        ? `${schedule.startsAt} - ${schedule.endsAt}`
                        : row.shiftName.includes('09:') ? '09:00 - 20:00' : row.shiftName.includes('Full') ? '09:00 - 21:00' : '09:00 - 19:00'}
                    </td>
                    <td className="text-muted">{staff.branchName || 'Chi nhánh trung tâm'}</td>
                    <td className="is-center">
                      <span className={`status-badge ${isOff ? 'cancelled' : 'active'}`}>{isOff ? 'Nghỉ' : 'Đã xếp ca'}</span>
                    </td>
                    <td className="is-center">
                      {isFullyClocked ? (
                        <span className="text-strong text-success">Đã chấm</span>
                      ) : isPartiallyClocked ? (
                        <span className="text-strong text-warning">Chưa ra</span>
                      ) : (
                        <span className="text-faint">{schedule ? 'Chưa chấm' : '—'}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </InlineDetail>
  );
}
