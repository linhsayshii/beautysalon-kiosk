/**
 * Salary calculation utilities for AnnaChill Beauty Staff
 *
 * Rules:
 * 1. "Theo ngày công chuẩn" (`monthly`):
 *    Salary per shift/day = baseSalary / workDaysPerMonth
 *    Expected shift salary = Salary per shift * attended/scheduled shifts count
 *
 * 2. "Theo giờ làm việc" (`hourly`):
 *    Expected shift salary = sum(shiftHours) * hourlyRate
 */

export interface ShiftTimeSlot {
  startsAt: string;
  endsAt: string;
}

export interface StaffSalarySetting {
  salaryType?: string;
  baseSalary?: number | null;
  hourlyRate?: number | null;
}

export interface SalaryCalculationResult {
  expectedSalary: number | null;
  totalShifts: number;
  totalHours: number;
  salaryType: 'monthly' | 'hourly' | 'none';
}

/**
 * Calculates duration in hours between startsAt ('HH:MM') and endsAt ('HH:MM').
 * Supports normal shifts and overnight shifts crossing midnight.
 */
export function calculateShiftHours(startsAt: string, endsAt: string): number {
  if (!startsAt || !endsAt) return 8;
  const [startH, startM] = startsAt.split(':').map(Number);
  const [endH, endM] = endsAt.split(':').map(Number);
  if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return 8;

  let duration = endH + endM / 60 - (startH + startM / 60);
  if (duration < 0) duration += 24; // overnight shift
  return duration > 0 ? duration : 8;
}

/**
 * Calculates the expected shift salary for a staff member based on scheduled shifts.
 */
export function calculateStaffShiftSalary(
  setting: StaffSalarySetting,
  shifts: ShiftTimeSlot[],
  workDaysPerMonth: number = 26
): SalaryCalculationResult {
  const totalShifts = shifts.length;

  let totalHours = 0;
  shifts.forEach((s) => {
    totalHours += calculateShiftHours(s.startsAt, s.endsAt);
  });

  const salaryType = setting.salaryType;

  // If no salary type or neither baseSalary nor hourlyRate is configured
  if (
    !salaryType ||
    salaryType === 'none' ||
    (setting.baseSalary == null && setting.hourlyRate == null) ||
    (setting.baseSalary === 0 && setting.hourlyRate === 0)
  ) {
    return {
      expectedSalary: null,
      totalShifts,
      totalHours,
      salaryType: 'none',
    };
  }

  // Type 1: Lương theo ngày công chuẩn (monthly)
  if (salaryType === 'monthly' || salaryType === 'day') {
    const baseSalary = Number(setting.baseSalary) || 0;
    if (baseSalary <= 0) {
      return { expectedSalary: null, totalShifts, totalHours, salaryType: 'none' };
    }
    const standardDays = workDaysPerMonth > 0 ? workDaysPerMonth : 26;
    const salaryPerShift = baseSalary / standardDays;
    const expectedSalary = Math.round(salaryPerShift * totalShifts);

    return {
      expectedSalary,
      totalShifts,
      totalHours,
      salaryType: 'monthly',
    };
  }

  // Type 2: Lương theo giờ làm việc (hourly)
  if (salaryType === 'hourly') {
    const hourlyRate = Number(setting.hourlyRate) || 0;
    if (hourlyRate <= 0) {
      return { expectedSalary: null, totalShifts, totalHours, salaryType: 'none' };
    }
    const expectedSalary = Math.round(totalHours * hourlyRate);

    return {
      expectedSalary,
      totalShifts,
      totalHours,
      salaryType: 'hourly',
    };
  }

  return {
    expectedSalary: null,
    totalShifts,
    totalHours,
    salaryType: 'none',
  };
}

const WEEKDAY_BY_LABEL: Record<string, number> = { CN: 0, T2: 1, T3: 2, T4: 3, T5: 4, T6: 5, T7: 6 };

/**
 * Standard work days in a month from the branch's saved working weekdays
 * (labels T2…CN). Mirrors payroll on the server so projections match payslips.
 */
export function standardWorkDaysInMonth(year: number, month: number, activeWorkDays: string[]): number {
  const weekdays = new Set(activeWorkDays.map((label) => WEEKDAY_BY_LABEL[label]).filter((day) => day !== undefined));
  if (weekdays.size === 0) [0, 1, 2, 3, 4, 5, 6].forEach((day) => weekdays.add(day));
  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;
  for (let day = 1; day <= daysInMonth; day += 1) {
    if (weekdays.has(new Date(year, month - 1, day).getDay())) count += 1;
  }
  return count;
}
