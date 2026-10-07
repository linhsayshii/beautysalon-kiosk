import { pool } from '../../db.js';
import { HttpError, parsePositiveInteger } from '../../lib/http.js';
import { broadcastToBranch, realtimeEvents } from '../../lib/ws.js';
import { assertFundsCover, fundForPaymentMethod, recordCashEntry } from '../cashbook/cashbook.ledger.js';

const number = (value) => Number(value ?? 0);

/**
 * Calculate auto-deduction based on staff's deduction config from staff_profiles.
 * Deduction config example:
 * [
 *   { name: 'Đi muộn', unit: 'Theo số lần', amount: 50000 },
 *   { name: 'Về sớm', unit: 'Theo số phút', amount: 5000 },
 *   { name: 'Vi phạm khác', unit: 'Cố định tháng', amount: 100000 },
 * ]
 */
function calculateAutoDeduction(deductionsConfig, lateMinutes, earlyMinutes, lateDays, earlyDays) {
  if (!deductionsConfig || !Array.isArray(deductionsConfig)) return 0;

  let totalDeduction = 0;
  for (const ded of deductionsConfig) {
    const amount = Number(ded.amount) || 0;
    const name = ded.name?.toLowerCase() || '';

    if (name.includes('muộn')) {
      // Đi muộn
      if (ded.unit === 'Theo số lần') {
        totalDeduction += lateDays * amount;
      } else if (ded.unit === 'Theo số phút') {
        totalDeduction += lateMinutes * amount;
      } else if (ded.unit === 'Cố định tháng') {
        if (lateMinutes > 0) totalDeduction += amount; // Chỉ trừ nếu có đi muộn
      }
    } else if (name.includes('sớm')) {
      // Về sớm
      if (ded.unit === 'Theo số lần') {
        totalDeduction += earlyDays * amount;
      } else if (ded.unit === 'Theo số phút') {
        totalDeduction += earlyMinutes * amount;
      } else if (ded.unit === 'Cố định tháng') {
        if (earlyMinutes > 0) totalDeduction += amount;
      }
    } else {
      // Vi phạm khác - cố định tháng
      if (ded.unit === 'Cố định tháng') {
        totalDeduction += amount;
      }
    }
  }
  return totalDeduction;
}

async function saveStaffProfile(client, { branchId, staffId, profile, accountId }) {
  if (profile !== undefined) {
    await client.query(
      `INSERT INTO staff_profiles (staff_id, data, updated_at) VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (staff_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
      [staffId, JSON.stringify(profile)],
    );
  }
  if (accountId === undefined) return;
  await client.query('UPDATE user_accounts SET staff_id = NULL, updated_at = NOW() WHERE branch_id = $1 AND staff_id = $2', [branchId, staffId]);
  if (accountId !== null) {
    const result = await client.query(
      'UPDATE user_accounts SET staff_id = $1, updated_at = NOW() WHERE id = $2 AND branch_id = $3 RETURNING id',
      [staffId, accountId, branchId],
    );
    if (!result.rowCount) throw new HttpError(400, 'ACCOUNT_NOT_FOUND', 'Tài khoản liên kết không thuộc chi nhánh hiện tại');
  }
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * Calculates standard workdays in month based on branch schedule settings
 */
export function getStandardWorkDaysForMonth(year, month, activeWeekdays = [1, 2, 3, 4, 5, 6, 0]) {
  // 1 = Monday, ..., 6 = Saturday, 0 = Sunday
  const daysInMonth = getDaysInMonth(year, month);
  let workDays = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay(); // 0 is Sunday
    if (activeWeekdays.includes(dayOfWeek)) {
      workDays++;
    }
  }
  return workDays > 0 ? workDays : 26;
}

// Work-day settings store Vietnamese weekday labels; Date#getDay() uses 0 = Sunday.
const WEEKDAY_BY_LABEL = { CN: 0, T2: 1, T3: 2, T4: 3, T5: 4, T6: 5, T7: 6 };

export function weekdaysFromLabels(labels) {
  const weekdays = (Array.isArray(labels) ? labels : [])
    .map((label) => WEEKDAY_BY_LABEL[label])
    .filter((weekday) => weekday !== undefined);
  return weekdays.length ? [...new Set(weekdays)] : [1, 2, 3, 4, 5, 6, 0];
}

export async function createStaff({
  branchId, name, role, code: requestedCode, avatarTone, active, salaryType,
  baseSalary, hourlyRate, canSell, canManageInventory, profile, accountId,
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let code = requestedCode;
    if (!code) {
      // Staff codes are unique across branches: serialise generation and follow
      // the existing NV000123 sequence, ignoring hand-typed codes.
      await client.query("SELECT pg_advisory_xact_lock(hashtext('staff-code'))");
      const sequence = await client.query(
        `SELECT COALESCE(MAX(substring(code FROM '^NV(\\d{1,15})$')::bigint), 0) + 1 AS next_number
         FROM staff WHERE code ~ '^NV\\d{1,15}$'`,
      );
      code = `NV${String(sequence.rows[0].next_number).padStart(6, '0')}`;
    }
    const staffResult = await client.query(
      `INSERT INTO staff (branch_id, code, name, role, avatar_tone, active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, code, name, role, avatar_tone, active, created_at`,
      [branchId, code, name, role, avatarTone, active],
    );
    const staff = staffResult.rows[0];
    await client.query(
      `INSERT INTO staff_settings (
         staff_id, salary_type, base_salary, hourly_rate, default_commission_rate,
         can_sell, can_manage_inventory
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [staff.id, salaryType, baseSalary, hourlyRate, 0, canSell, canManageInventory],
    );
    await saveStaffProfile(client, { branchId, staffId: staff.id, profile, accountId });
    await client.query(
      `INSERT INTO activities (branch_id, actor_staff_id, action, object_type, object_code, description)
       VALUES ($1, $2, 'create', 'staff', $3, $4)`,
      [branchId, staff.id, code, `Thêm nhân viên ${name}`],
    );
    await client.query('COMMIT');
    const staffData = {
      id: number(staff.id), code: staff.code, name: staff.name, role: staff.role,
      avatarTone: staff.avatar_tone, active: staff.active, salaryType,
      baseSalary, hourlyRate, canSell, canManageInventory,
      monthRevenue: 0, monthOrders: 0, createdAt: staff.created_at,
    };
    broadcastToBranch(branchId, 'staff:created', { staff: staffData });
    return staffData;
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      throw new HttpError(409, 'DUPLICATE_STAFF_CODE', 'Mã nhân viên đã tồn tại');
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function updateStaff({
  branchId, staffId, name, role, code, avatarTone, active, salaryType,
  baseSalary, hourlyRate, canSell, canManageInventory, profile, accountId,
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const staffResult = await client.query(
      `UPDATE staff
       SET code = $1, name = $2, role = $3, avatar_tone = $4, active = $5
       WHERE id = $6 AND branch_id = $7
       RETURNING id, code, name, role, avatar_tone, active, created_at`,
      [code, name, role, avatarTone, active, staffId, branchId],
    );
    if (!staffResult.rowCount) {
      throw new HttpError(404, 'STAFF_NOT_FOUND', 'Không tìm thấy nhân viên trong chi nhánh hiện tại');
    }
    await client.query(
      `INSERT INTO staff_settings (
         staff_id, salary_type, base_salary, hourly_rate, default_commission_rate,
         can_sell, can_manage_inventory
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (staff_id) DO UPDATE SET
         salary_type = EXCLUDED.salary_type,
         base_salary = EXCLUDED.base_salary,
         hourly_rate = EXCLUDED.hourly_rate,
         default_commission_rate = EXCLUDED.default_commission_rate,
         can_sell = EXCLUDED.can_sell,
         can_manage_inventory = EXCLUDED.can_manage_inventory,
         updated_at = NOW()`,
      [staffId, salaryType, baseSalary, hourlyRate, 0, canSell, canManageInventory],
    );
    await saveStaffProfile(client, { branchId, staffId, profile, accountId });
    await client.query(
      `INSERT INTO activities (branch_id, actor_staff_id, action, object_type, object_code, description)
       VALUES ($1, $2, 'update', 'staff', $3, $4)`,
      [branchId, staffId, code, `Cập nhật nhân viên ${name}`],
    );
    await client.query('COMMIT');
    const staff = staffResult.rows[0];
    const staffData = {
      id: number(staff.id), code: staff.code, name: staff.name, role: staff.role,
      avatarTone: staff.avatar_tone, active: staff.active, salaryType,
      baseSalary, hourlyRate, canSell, canManageInventory,
      createdAt: staff.created_at,
    };
    broadcastToBranch(branchId, 'staff:updated', { staffId, changes: { name, role, code, avatarTone, active, salaryType, baseSalary, hourlyRate, canSell, canManageInventory } });
    return staffData;
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      throw new HttpError(409, 'DUPLICATE_STAFF_CODE', 'Mã nhân viên đã tồn tại');
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function listStaff({ branchId, search, active }) {
  const params = [branchId];
  let query = `
    SELECT
      s.id, s.code, s.name, s.role, s.avatar_tone, s.active, s.created_at,
      ss.salary_type, ss.base_salary, ss.hourly_rate,
      ss.can_sell, ss.can_manage_inventory,
      COALESCE((SELECT sp.data FROM staff_profiles sp WHERE sp.staff_id = s.id), '{}'::jsonb) AS profile,
      (SELECT ua.id FROM user_accounts ua WHERE ua.branch_id = s.branch_id AND ua.staff_id = s.id ORDER BY ua.id LIMIT 1) AS account_id,
      COALESCE(SUM(cr.revenue), 0) AS month_revenue,
      COUNT(DISTINCT cr.invoice_id) AS month_orders
    FROM staff s
    LEFT JOIN staff_settings ss ON ss.staff_id = s.id
    LEFT JOIN commission_records cr
      ON cr.staff_id = s.id
      AND cr.occurred_on >= DATE_TRUNC('month', CURRENT_DATE)::date
      AND cr.occurred_on <= (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date
    WHERE s.branch_id = $1
  `;

  if (active !== null && active !== undefined) {
    params.push(active);
    query += ` AND s.active = $${params.length}`;
  }

  if (search) {
    params.push(`%${search}%`);
    query += ` AND (s.name ILIKE $${params.length} OR s.code ILIKE $${params.length} OR s.role ILIKE $${params.length})`;
  }

  query += `
    GROUP BY s.id, ss.salary_type, ss.base_salary, ss.hourly_rate, ss.can_sell, ss.can_manage_inventory
    ORDER BY s.active DESC, s.name
  `;

  const result = await pool.query(query, params);
  return result.rows.map((row) => ({
    id: number(row.id),
    code: row.code,
    name: row.name,
    role: row.role,
    avatarTone: row.avatar_tone,
    active: row.active,
    salaryType: row.salary_type ?? 'monthly',
    baseSalary: number(row.base_salary),
    hourlyRate: number(row.hourly_rate),
    canSell: row.can_sell ?? true,
    canManageInventory: row.can_manage_inventory ?? false,
    ...(row.profile ?? {}),
    accountId: row.account_id === null ? '' : String(row.account_id),
    monthRevenue: number(row.month_revenue),
    monthOrders: number(row.month_orders),
    createdAt: row.created_at,
  }));
}

export async function listWorkShifts(branchId) {
  const result = await pool.query(
    `SELECT name AS shift_name, TO_CHAR(starts_at, 'HH24:MI') AS starts_at, TO_CHAR(ends_at, 'HH24:MI') AS ends_at
     FROM work_shifts WHERE branch_id = $1
     UNION
     SELECT DISTINCT shift_name, TO_CHAR(starts_at, 'HH24:MI') AS starts_at, TO_CHAR(ends_at, 'HH24:MI') AS ends_at
     FROM staff_schedules WHERE branch_id = $1
     ORDER BY starts_at`,
    [branchId],
  ).catch(() => ({ rows: [] }));

  if (!result.rows.length) {
    return [
      { id: 1, name: 'Ca sáng', startsAt: '08:30', endsAt: '12:30', color: 'green' },
      { id: 2, name: 'Ca chiều', startsAt: '12:30', endsAt: '17:30', color: 'purple' },
      { id: 3, name: 'Ca tối', startsAt: '17:30', endsAt: '21:30', color: 'blue' },
      { id: 4, name: 'Ca Full', startsAt: '08:30', endsAt: '20:30', color: 'pink' },
    ];
  }

  return result.rows.map((row, index) => {
    let color = 'blue';
    const lower = row.shift_name.toLowerCase();
    if (lower.includes('sáng')) color = 'green';
    else if (lower.includes('chiều')) color = 'purple';
    else if (lower.includes('tối')) color = 'blue';
    else if (lower.includes('full')) color = 'pink';
    else if (lower.includes('part')) color = 'orange';

    return {
      id: index + 1,
      name: row.shift_name,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      color,
    };
  });
}

export async function getWorkScheduleSettings(branchId) {
  const result = await pool.query(
    `SELECT active_work_days, holidays FROM branch_work_schedule_settings WHERE branch_id = $1`,
    [branchId],
  );
  const row = result.rows[0];
  return {
    activeWorkDays: Array.isArray(row?.active_work_days) ? row.active_work_days : ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
    holidays: Array.isArray(row?.holidays) ? row.holidays : [],
  };
}

export async function updateWorkScheduleSettings({ branchId, activeWorkDays, holidays }) {
  const result = await pool.query(
    `INSERT INTO branch_work_schedule_settings (branch_id, active_work_days, holidays, updated_at)
     VALUES ($1, $2::jsonb, $3::jsonb, NOW())
     ON CONFLICT (branch_id) DO UPDATE SET active_work_days = EXCLUDED.active_work_days, holidays = EXCLUDED.holidays, updated_at = NOW()
     RETURNING active_work_days, holidays`,
    [branchId, JSON.stringify(activeWorkDays), JSON.stringify(holidays)],
  );
  return { activeWorkDays: result.rows[0].active_work_days, holidays: result.rows[0].holidays };
}

export async function createShift({ branchId, name, startsAt, endsAt, allowCheckInFrom, allowCheckInTo }) {
  const result = await pool.query(
    `INSERT INTO work_shifts (branch_id, name, starts_at, ends_at, allow_check_in_from, allow_check_in_to)
     VALUES ($1, $2, $3::time, $4::time, $5::time, $6::time)
     ON CONFLICT (branch_id, name) DO UPDATE SET
       starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at,
       allow_check_in_from = EXCLUDED.allow_check_in_from, allow_check_in_to = EXCLUDED.allow_check_in_to, updated_at = NOW()
     RETURNING id, name, TO_CHAR(starts_at, 'HH24:MI') AS starts_at, TO_CHAR(ends_at, 'HH24:MI') AS ends_at,
       TO_CHAR(allow_check_in_from, 'HH24:MI') AS allow_check_in_from, TO_CHAR(allow_check_in_to, 'HH24:MI') AS allow_check_in_to`,
    [branchId, name, startsAt, endsAt, allowCheckInFrom, allowCheckInTo],
  );
  const row = result.rows[0];
  return { id: number(row.id), name: row.name, startsAt: row.starts_at, endsAt: row.ends_at, allowCheckInFrom: row.allow_check_in_from, allowCheckInTo: row.allow_check_in_to };
}

export async function getSchedule({ branchId, startDate }) {
  const [shifts, schedules] = await Promise.all([
    listWorkShifts(branchId),
    pool.query(
      `SELECT ss.id, ss.staff_id, TO_CHAR(ss.shift_date, 'YYYY-MM-DD') AS shift_date,
              ss.starts_at, ss.ends_at, ss.shift_name, ss.status, ss.note,
              ss.week_group_id, ss.is_source,
              (SELECT MIN(TO_CHAR(ss2.shift_date, 'YYYY-MM-DD'))
               FROM staff_schedules ss2
               WHERE ss2.week_group_id = ss.week_group_id
                 AND ss2.week_group_id IS NOT NULL) as group_start_date,
              -- Join với attendance để lấy thông tin chấm công
              ar.id AS attendance_id,
              ar.check_in, ar.check_out, ar.status AS attendance_status,
              ar.late_minutes, ar.early_minutes
       FROM staff_schedules ss
       LEFT JOIN attendance_records ar
         ON ar.staff_id = ss.staff_id
         AND ar.work_date = ss.shift_date
       WHERE ss.branch_id = $1 AND ss.shift_date >= $2::date AND ss.shift_date < $2::date + INTERVAL '7 days'
       ORDER BY ss.shift_date, ss.starts_at, ss.staff_id`,
      [branchId, startDate],
    ),
  ]);

  return {
    startDate,
    shifts,
    schedules: schedules.rows.map((row) => ({
      id: number(row.id),
      staffId: number(row.staff_id),
      shiftDate: row.shift_date,
      startsAt: String(row.starts_at).slice(0, 5),
      endsAt: String(row.ends_at).slice(0, 5),
      shiftName: row.shift_name,
      status: row.status,
      note: row.note,
      weekGroupId: row.week_group_id ? number(row.week_group_id) : null,
      isSource: row.is_source ?? null,
      groupStartDate: row.group_start_date ?? null,
      // Thông tin chấm công - đủ check-in VÀ check-out mới tính là hoàn thành
      hasAttendance: row.attendance_id !== null,
      hasCheckIn: row.check_in !== null,
      hasCheckOut: row.check_out !== null,
      checkIn: row.check_in ? String(row.check_in).slice(11, 16) : null,
      checkOut: row.check_out ? String(row.check_out).slice(11, 16) : null,
      attendanceStatus: row.attendance_status ?? null,
      lateMinutes: row.late_minutes ? Number(row.late_minutes) : 0,
      earlyMinutes: row.early_minutes ? Number(row.early_minutes) : 0,
    })),
  };
}

export async function getStaffSchedule({ branchId, staffId, startDate }) {
  const schedule = await getSchedule({ branchId, startDate });
  return {
    ...schedule,
    schedules: schedule.schedules.filter((item) => item.staffId === staffId),
  };
}

export async function getStaffPayrollHistory({ branchId, staffId }) {
  await ensureMonthlyPayrollPeriods(branchId);

  const now = new Date();
  const currentPeriodStartsOn = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const result = await pool.query(
    `SELECT
       pp.id AS period_id, pp.code AS period_code, pp.name AS period_name,
       pp.period_type, pp.starts_on::text AS starts_on_str, pp.ends_on::text AS ends_on_str, pp.status AS period_status,
       pr.id, pr.code, pr.base_salary, pr.overtime_salary, pr.allowance, pr.bonus,
       pr.commission, pr.tour_commission, pr.deduction, pr.total_income, pr.net_salary, pr.paid_amount,
       pr.remaining_amount, pr.work_units, pr.standard_work_days, pr.hourly_rate,
       pr.status, pr.note
     FROM payroll_records pr
     JOIN payroll_periods pp ON pp.id = pr.payroll_period_id
     WHERE pp.branch_id = $1 AND pr.staff_id = $2 AND pp.period_type = 'monthly'
     ORDER BY pp.starts_on DESC, pp.id DESC
     LIMIT 24`,
    [branchId, staffId],
  );

  const records = result.rows.map((row) => ({
    id: number(row.id),
    code: row.code,
    period: {
      id: number(row.period_id),
      code: row.period_code,
      name: row.period_name,
      startsOn: row.starts_on_str,
      endsOn: row.ends_on_str,
      status: row.period_status,
    },
    baseSalary: number(row.base_salary),
    overtimeSalary: number(row.overtime_salary),
    allowance: number(row.allowance),
    bonus: number(row.bonus),
    commission: number(row.commission),
    tourCommission: number(row.tour_commission),
    deduction: number(row.deduction),
    totalIncome: number(row.total_income),
    netSalary: number(row.net_salary),
    paidAmount: number(row.paid_amount),
    remainingAmount: number(row.remaining_amount),
    workUnits: number(row.work_units),
    standardWorkDays: number(row.standard_work_days),
    hourlyRate: number(row.hourly_rate),
    status: row.status,
    note: row.note,
  }));

  return { records, currentPeriodStartsOn };
}

export async function listAttendance({ branchId, dateFrom, dateTo }) {
  const result = await pool.query(
    `SELECT
       ar.id, ar.work_date, ar.check_in, ar.check_out, ar.scheduled_minutes, ar.worked_minutes,
       ar.late_minutes, ar.early_minutes, ar.status, ar.note,
       s.id AS staff_id, s.code AS staff_code, s.name AS staff_name, s.role, s.avatar_tone
     FROM attendance_records ar
     JOIN staff s ON s.id = ar.staff_id
     WHERE ar.branch_id = $1 AND ar.work_date >= $2::date AND ar.work_date <= $3::date
     ORDER BY ar.work_date DESC, s.name`,
    [branchId, dateFrom, dateTo],
  );

  return result.rows.map((row) => ({
    id: number(row.id),
    workDate: row.work_date,
    checkIn: row.check_in,
    checkOut: row.check_out,
    scheduledMinutes: number(row.scheduled_minutes),
    workedMinutes: number(row.worked_minutes),
    lateMinutes: number(row.late_minutes),
    earlyMinutes: number(row.early_minutes),
    status: row.status,
    note: row.note,
    staff: {
      id: number(row.staff_id), code: row.staff_code, name: row.staff_name, role: row.role, avatarTone: row.avatar_tone,
    },
  }));
}

export async function listCommissions({ branchId, dateFrom, dateTo }) {
  const [rowsResult, staffSummaryResult] = await Promise.all([
    pool.query(
      `SELECT
         cr.id, cr.source_name, cr.revenue, cr.rate, cr.amount,
         -- A calendar day, not an instant: as text it cannot shift a day in JSON.
         to_char(cr.occurred_on, 'YYYY-MM-DD') AS occurred_on,
         cr.invoice_id, cr.invoice_item_id,
         COALESCE(cr.commission_type, 'service') AS commission_type,
         s.id AS staff_id, s.code AS staff_code, s.name AS staff_name, s.role, s.avatar_tone,
         i.code AS invoice_code,
         ii.quantity AS item_quantity,
         p.name AS product_name
       FROM commission_records cr
       JOIN staff s ON s.id = cr.staff_id
       LEFT JOIN invoices i ON i.id = cr.invoice_id
       LEFT JOIN invoice_items ii ON ii.id = cr.invoice_item_id
       LEFT JOIN products p ON p.id = ii.product_id
       WHERE cr.branch_id = $1 AND cr.occurred_on >= $2::date AND cr.occurred_on <= $3::date
       ORDER BY cr.occurred_on DESC, cr.id DESC LIMIT 100`,
      [branchId, dateFrom, dateTo],
    ),
    pool.query(
      `SELECT
         s.id, s.code, s.name, s.role, s.avatar_tone,
         COALESCE(SUM(cr.revenue), 0) AS total_revenue,
         COALESCE(SUM(cr.amount), 0) AS total_amount,
         COALESCE(SUM(cr.revenue) FILTER (WHERE COALESCE(cr.commission_type, 'service') = 'service'), 0) AS service_revenue,
         COALESCE(SUM(cr.amount) FILTER (WHERE COALESCE(cr.commission_type, 'service') = 'service'), 0) AS service_amount,
         COALESCE(SUM(cr.revenue) FILTER (WHERE cr.commission_type = 'consulting'), 0) AS consulting_revenue,
         COALESCE(SUM(cr.amount) FILTER (WHERE cr.commission_type = 'consulting'), 0) AS consulting_amount,
         COALESCE(SUM(cr.revenue) FILTER (WHERE cr.commission_type = 'tour'), 0) AS tour_revenue,
         COALESCE(SUM(cr.amount) FILTER (WHERE cr.commission_type = 'tour'), 0) AS tour_amount,
         COUNT(cr.id) AS transaction_count
       FROM staff s
       LEFT JOIN commission_records cr ON cr.staff_id = s.id AND cr.occurred_on >= $2::date AND cr.occurred_on <= $3::date
       WHERE s.branch_id = $1 AND s.active = TRUE
       GROUP BY s.id ORDER BY total_amount DESC, s.name`,
      [branchId, dateFrom, dateTo],
    ),
  ]);

  return {
    rows: rowsResult.rows.map((row) => ({
      id: number(row.id),
      staff: { id: number(row.staff_id), code: row.staff_code, name: row.staff_name, role: row.role, avatarTone: row.avatar_tone },
      invoiceCode: row.invoice_code,
      invoiceItemId: number(row.invoice_item_id) || null,
      itemQuantity: parseInt(row.item_quantity) || 1,
      productName: row.product_name,
      sourceName: row.source_name,
      commissionType: row.commission_type,
      revenue: number(row.revenue),
      rate: number(row.rate),
      amount: number(row.amount),
      occurredOn: row.occurred_on,
    })),
    staffSummary: staffSummaryResult.rows.map((row) => ({
      staff: { id: number(row.id), code: row.code, name: row.name, role: row.role, avatarTone: row.avatar_tone },
      totalRevenue: number(row.total_revenue),
      totalAmount: number(row.total_amount),
      serviceRevenue: number(row.service_revenue),
      serviceAmount: number(row.service_amount),
      consultingRevenue: number(row.consulting_revenue),
      consultingAmount: number(row.consulting_amount),
      tourRevenue: number(row.tour_revenue),
      tourAmount: number(row.tour_amount),
      transactionCount: number(row.transaction_count),
    })),
  };
}

// ============================================================================
// PAYROLL CORE ENGINE & AUTO CALCULATION
// ============================================================================

/**
 * Ensures monthly payroll periods are initialized from earlier months up to the CURRENT MONTH ONLY.
 * Never creates periods for future months.
 */
export async function ensureMonthlyPayrollPeriods(branchId) {
  const client = await pool.connect();
  // One branch at a time: two tabs opening payroll at the start of a month
  // must not both insert the same period.
  await client.query('SELECT pg_advisory_lock(hashtext($1), $2::int)', ['payroll-periods', branchId]);
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12

    // Look back up to 6 past months + current month (total 7 months max)
    const targetMonths = [];
    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date(currentYear, currentMonth - 1 - offset, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      targetMonths.push({ year: y, month: m });
    }

    for (const { year, month } of targetMonths) {
      const startsOn = `${year}-${String(month).padStart(2, '0')}-01`;
      const daysInM = getDaysInMonth(year, month);
      const endsOn = `${year}-${String(month).padStart(2, '0')}-${String(daysInM).padStart(2, '0')}`;
      const monthCode = `BL${String(year)}${String(month).padStart(2, '0')}`;
      const name = `Bảng lương tháng ${String(month).padStart(2, '0')}/${year}`;

      const existing = await client.query(
        'SELECT id, status FROM payroll_periods WHERE branch_id = $1 AND (code = $2 OR code = $3 OR (starts_on = $4 AND ends_on = $5))',
        [branchId, monthCode, `${monthCode}-${branchId}`, startsOn, endsOn],
      );

      await client.query('BEGIN');
      try {
        if (!existing.rowCount) {
          // Period codes are unique across branches; a second branch gets its id as a suffix.
          const taken = await client.query('SELECT 1 FROM payroll_periods WHERE code = $1', [monthCode]);
          const code = taken.rowCount ? `${monthCode}-${branchId}` : monthCode;
          const insertRes = await client.query(
            `INSERT INTO payroll_periods (
               branch_id, code, name, period_type, starts_on, ends_on, status,
               creator_type, creator_name, updated_data_at
             ) VALUES ($1, $2, $3, 'monthly', $4, $5, 'draft', 'auto', 'Auto', NOW())
             RETURNING id`,
            [branchId, code, name, startsOn, endsOn],
          );
          await calculatePeriodPayrollInternal(client, branchId, insertRes.rows[0].id, startsOn, endsOn, year, month, { keepAdjusted: true });
        } else if (existing.rows[0].status === 'draft' && year === currentYear && month === currentMonth) {
          // The current month's draft follows attendance and sales, except
          // for rows a manager has adjusted by hand.
          await calculatePeriodPayrollInternal(client, branchId, existing.rows[0].id, startsOn, endsOn, year, month, { keepAdjusted: true });
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(hashtext($1), $2::int)', ['payroll-periods', branchId]).catch(() => {});
    client.release();
  }
}

/**
 * Recomputes the attendance- and sales-driven amounts of a draft period:
 * base salary, commission, tour commission and the automatic deduction.
 * Overtime, allowance and bonus are entered by hand and always kept.
 * `keepAdjusted` skips rows a manager edited (automatic refresh); an explicit
 * "Tải lại dữ liệu" recomputes them too and clears the mark.
 */
async function calculatePeriodPayrollInternal(client, branchId, periodId, startsOn, endsOn, year, month, { keepAdjusted = false } = {}) {
  // 1. Standard workdays in the month come from the branch's working weekdays.
  // Holidays stay in the count: they are paid days off.
  const settingsRes = await client.query(
    'SELECT active_work_days FROM branch_work_schedule_settings WHERE branch_id = $1',
    [branchId],
  );
  const standardWorkDays = getStandardWorkDaysForMonth(year, month, weekdaysFromLabels(settingsRes.rows[0]?.active_work_days));

  // 2. Fetch all active staff with settings
  const staffListRes = await client.query(
    `SELECT
       s.id, s.code, s.name, s.role, s.avatar_tone,
       ss.salary_type, ss.base_salary, ss.hourly_rate
     FROM staff s
     LEFT JOIN staff_settings ss ON ss.staff_id = s.id
     WHERE s.branch_id = $1 AND s.active = TRUE
     ORDER BY s.id`,
    [branchId],
  );

  // 3. Fetch attendance records (only completed with check-in AND check-out)
  // WORK UNITS = actual attendance with check-out, not just scheduled shifts
  const attendanceWorkRes = await client.query(
    `SELECT
       ar.staff_id,
       COUNT(ar.id) AS completed_shifts,
       COALESCE(SUM(ar.worked_minutes), 0) AS total_worked_minutes
     FROM attendance_records ar
     WHERE ar.branch_id = $1
       AND ar.work_date >= $2::date
       AND ar.work_date <= $3::date
       AND ar.check_in IS NOT NULL
       AND ar.check_out IS NOT NULL
     GROUP BY ar.staff_id`,
    [branchId, startsOn, endsOn],
  );

  // Map staff completed work (from actual attendance)
  const staffWorkMap = new Map();
  for (const row of attendanceWorkRes.rows) {
    const sId = number(row.staff_id);
    const completedShifts = number(row.completed_shifts);
    const totalMinutes = number(row.total_worked_minutes);
    const hours = totalMinutes / 60;
    staffWorkMap.set(sId, {
      shifts: completedShifts,
      hours: Math.round(hours * 10) / 10,
    });
  }

  // 4. Fetch commissions per staff in period. Tour commission is paid in its
  // own payroll column; every other commission type goes to `commission`.
  const commissionsRes = await client.query(
    `SELECT
       staff_id,
       COALESCE(SUM(amount) FILTER (WHERE commission_type IS DISTINCT FROM 'tour'), 0) AS total_commission,
       COALESCE(SUM(amount) FILTER (WHERE commission_type = 'tour'), 0) AS total_tour_commission
     FROM commission_records
     WHERE branch_id = $1 AND occurred_on >= $2::date AND occurred_on <= $3::date
     GROUP BY staff_id`,
    [branchId, startsOn, endsOn],
  );
  const staffCommissionMap = new Map();
  const staffTourCommissionMap = new Map();
  for (const row of commissionsRes.rows) {
    staffCommissionMap.set(number(row.staff_id), number(row.total_commission));
    staffTourCommissionMap.set(number(row.staff_id), number(row.total_tour_commission));
  }

  // 4.5. Fetch late/early minutes AND count from completed attendance records (for deduction)
  const attendanceRes = await client.query(
    `SELECT
       staff_id,
       COALESCE(SUM(late_minutes), 0) AS total_late_minutes,
       COALESCE(SUM(early_minutes), 0) AS total_early_minutes,
       COUNT(CASE WHEN late_minutes > 0 THEN 1 END) AS late_days,
       COUNT(CASE WHEN early_minutes > 0 THEN 1 END) AS early_days
     FROM attendance_records
     WHERE branch_id = $1
       AND work_date >= $2::date
       AND work_date <= $3::date
       AND check_in IS NOT NULL
       AND check_out IS NOT NULL
     GROUP BY staff_id`,
    [branchId, startsOn, endsOn],
  );
  const staffAttendanceMap = new Map();
  for (const row of attendanceRes.rows) {
    staffAttendanceMap.set(number(row.staff_id), {
      lateMinutes: number(row.total_late_minutes),
      earlyMinutes: number(row.total_early_minutes),
      lateDays: number(row.late_days),
      earlyDays: number(row.early_days),
    });
  }

  // 4.6. Fetch deductions config from staff_profiles
  const staffProfilesRes = await client.query(
    `SELECT staff_id, data
     FROM staff_profiles
     WHERE staff_id IN (SELECT id FROM staff WHERE branch_id = $1 AND active = TRUE)`,
    [branchId],
  );
  const staffDeductionsMap = new Map();
  for (const row of staffProfilesRes.rows) {
    const data = row.data || {};
    // The "Áp dụng giảm trừ" switch keeps the rows but turns them off.
    const deductions = data.enableDeduction === false ? [] : data.deductions || [];
    staffDeductionsMap.set(number(row.staff_id), deductions);
  }

  // 5. Existing records to preserve manual adjustments (allowance, bonus, deduction, paid_amount)
  const existingRecordsRes = await client.query(
    'SELECT * FROM payroll_records WHERE payroll_period_id = $1',
    [periodId],
  );
  const existingRecordMap = new Map();
  for (const rec of existingRecordsRes.rows) {
    existingRecordMap.set(number(rec.staff_id), rec);
  }

  for (const staff of staffListRes.rows) {
    const sId = number(staff.id);
    const salaryType = staff.salary_type || 'monthly';
    const baseSalaryConfig = number(staff.base_salary);
    const hourlyRate = number(staff.hourly_rate);
    const workInfo = staffWorkMap.get(sId) || { shifts: 0, hours: 0 };
    const commission = staffCommissionMap.get(sId) || 0;
    const tourCommission = staffTourCommissionMap.get(sId) || 0;
    const existing = existingRecordMap.get(sId);
    if (existing && (existing.status !== 'draft' || (keepAdjusted && existing.adjusted_at))) continue;

    let baseSalary = 0;
    let workUnits = 0;

    if (salaryType === 'monthly' || salaryType === 'day') {
      workUnits = workInfo.shifts;
      const salaryPerDay = baseSalaryConfig / (standardWorkDays > 0 ? standardWorkDays : 26);
      baseSalary = Math.round(salaryPerDay * workUnits);
    } else if (salaryType === 'hourly') {
      workUnits = Math.round(workInfo.hours * 10) / 10;
      baseSalary = Math.round(workUnits * hourlyRate);
    }

    const overtimeSalary = existing ? number(existing.overtime_salary) : 0;
    const allowance = existing ? number(existing.allowance) : 0;
    const bonus = existing ? number(existing.bonus) : 0;

    // Auto-calculate deduction based on staff's deduction config from staff_profiles
    const attendanceInfo = staffAttendanceMap.get(sId) || { lateMinutes: 0, earlyMinutes: 0, lateDays: 0, earlyDays: 0 };
    const deductionsConfig = staffDeductionsMap.get(sId) || [];
    const autoDeduction = calculateAutoDeduction(
      deductionsConfig,
      attendanceInfo.lateMinutes,
      attendanceInfo.earlyMinutes,
      attendanceInfo.lateDays,
      attendanceInfo.earlyDays,
    );

    const deduction = autoDeduction;
    const paidAmount = existing ? number(existing.paid_amount) : 0;

    const totalIncome = baseSalary + overtimeSalary + commission + tourCommission + allowance + bonus;
    const netSalary = Math.max(0, totalIncome - deduction);
    const remainingAmount = Math.max(0, netSalary - paidAmount);
    const code = existing?.code || `PL${String(periodId).padStart(4, '0')}${String(sId).padStart(3, '0')}`;

    await client.query(
      `INSERT INTO payroll_records (
         payroll_period_id, staff_id, code, base_salary, overtime_salary,
         allowance, bonus, commission, deduction, total_income, net_salary,
         paid_amount, remaining_amount, work_units, standard_work_days, hourly_rate, status, tour_commission
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'draft', $17)
       ON CONFLICT (payroll_period_id, staff_id) DO UPDATE SET
         code = EXCLUDED.code,
         base_salary = EXCLUDED.base_salary,
         commission = EXCLUDED.commission,
         tour_commission = EXCLUDED.tour_commission,
         deduction = EXCLUDED.deduction,
         adjusted_at = NULL,
         total_income = EXCLUDED.total_income,
         net_salary = EXCLUDED.net_salary,
         remaining_amount = EXCLUDED.remaining_amount,
         work_units = EXCLUDED.work_units,
         standard_work_days = EXCLUDED.standard_work_days,
         hourly_rate = EXCLUDED.hourly_rate`,
      [
        periodId, sId, code, baseSalary, overtimeSalary,
        allowance, bonus, commission, deduction, totalIncome, netSalary,
        paidAmount, remainingAmount, workUnits, standardWorkDays, hourlyRate, tourCommission,
      ],
    );
  }

  await client.query(
    'UPDATE payroll_periods SET updated_data_at = NOW(), updated_at = NOW() WHERE id = $1',
    [periodId],
  );
}

export async function listPayrollPeriods({ branchId, search, status, periodType }) {
  await ensureMonthlyPayrollPeriods(branchId);

  const params = [branchId];
  let query = `
    SELECT
      pp.id, pp.code, pp.name, pp.period_type, pp.starts_on, pp.ends_on, pp.status,
      pp.creator_type, pp.creator_name, pp.approved_by_name, pp.approved_at, pp.updated_data_at, pp.note,
      pp.created_at,
      COUNT(pr.id) AS total_staff_count,
      COALESCE(SUM(pr.net_salary), 0) AS total_net_salary,
      COALESCE(SUM(pr.paid_amount), 0) AS total_paid_amount,
      COALESCE(SUM(pr.remaining_amount), 0) AS total_remaining_amount,
      COALESCE(SUM(pr.commission), 0) AS total_commission,
      COALESCE(SUM(pr.tour_commission), 0) AS total_tour_commission
    FROM payroll_periods pp
    LEFT JOIN payroll_records pr ON pr.payroll_period_id = pp.id
    WHERE pp.branch_id = $1
  `;

  if (status) {
    const statuses = Array.isArray(status) ? status : [status];
    if (statuses.length > 0) {
      params.push(statuses);
      query += ` AND pp.status = ANY($${params.length})`;
    }
  }

  if (periodType) {
    params.push(periodType);
    query += ` AND pp.period_type = $${params.length}`;
  }

  if (search) {
    params.push(`%${search}%`);
    query += ` AND (pp.name ILIKE $${params.length} OR pp.code ILIKE $${params.length})`;
  }

  query += `
    GROUP BY pp.id
    ORDER BY pp.starts_on DESC, pp.id DESC
  `;

  const result = await pool.query(query, params);
  const rows = result.rows.map((row) => ({
    id: number(row.id),
    code: row.code,
    name: row.name,
    periodType: row.period_type,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    status: row.status,
    creatorType: row.creator_type,
    creatorName: row.creator_name || 'Auto',
    approvedByName: row.approved_by_name,
    approvedAt: row.approved_at,
    updatedDataAt: row.updated_data_at,
    note: row.note,
    createdAt: row.created_at,
    totalStaffCount: number(row.total_staff_count),
    totalNetSalary: number(row.total_net_salary),
    totalPaidAmount: number(row.total_paid_amount),
    totalRemainingAmount: number(row.total_remaining_amount),
    totalCommission: number(row.total_commission),
    totalTourCommission: number(row.total_tour_commission),
  }));

  const grandSummary = rows.reduce((acc, row) => ({
    totalNetSalary: acc.totalNetSalary + row.totalNetSalary,
    totalPaidAmount: acc.totalPaidAmount + row.totalPaidAmount,
    totalRemainingAmount: acc.totalRemainingAmount + row.totalRemainingAmount,
    totalCommission: acc.totalCommission + row.totalCommission,
    totalTourCommission: acc.totalTourCommission + row.totalTourCommission,
  }), { totalNetSalary: 0, totalPaidAmount: 0, totalRemainingAmount: 0, totalCommission: 0, totalTourCommission: 0 });

  return {
    rows,
    summary: grandSummary,
  };
}

export async function getPayrollPeriodDetail({ branchId, periodId }) {
  const periodResult = await pool.query(
    `SELECT
       pp.id, pp.code, pp.name, pp.period_type, pp.starts_on, pp.ends_on, pp.status,
       pp.creator_type, pp.creator_name, pp.approved_by_name, pp.approved_at, pp.updated_data_at, pp.note,
       pp.created_at
     FROM payroll_periods pp
     WHERE pp.id = $1 AND pp.branch_id = $2`,
    [periodId, branchId],
  );

  if (!periodResult.rowCount) {
    throw new HttpError(404, 'PAYROLL_NOT_FOUND', 'Không tìm thấy bảng lương');
  }

  const period = periodResult.rows[0];

  const [recordsResult, paymentsResult] = await Promise.all([
    pool.query(
      `SELECT
         pr.id, pr.code, pr.base_salary, pr.overtime_salary, pr.allowance, pr.bonus,
         pr.commission, pr.tour_commission, pr.deduction, pr.total_income, pr.net_salary, pr.paid_amount,
         pr.remaining_amount, pr.work_units, pr.standard_work_days, pr.hourly_rate,
         pr.status, pr.note,
         s.id AS staff_id, s.code AS staff_code, s.name AS staff_name, s.role, s.avatar_tone,
         ss.salary_type
       FROM payroll_records pr
       JOIN staff s ON s.id = pr.staff_id
       LEFT JOIN staff_settings ss ON ss.staff_id = s.id
       WHERE pr.payroll_period_id = $1
       ORDER BY s.name`,
      [periodId],
    ),
    pool.query(
      `SELECT
         pay.id, pay.amount, pay.payment_method, pay.paid_at, pay.note,
         s.id AS staff_id, s.code AS staff_code, s.name AS staff_name,
         actor.name AS actor_name
       FROM payroll_payments pay
       JOIN staff s ON s.id = pay.staff_id
       LEFT JOIN staff actor ON actor.id = pay.actor_staff_id
       WHERE pay.payroll_period_id = $1 AND pay.branch_id = $2
       ORDER BY pay.paid_at DESC`,
      [periodId, branchId],
    ),
  ]);

  const records = recordsResult.rows.map((row) => ({
    id: number(row.id),
    code: row.code,
    staff: {
      id: number(row.staff_id),
      code: row.staff_code,
      name: row.staff_name,
      role: row.role,
      avatarTone: row.avatar_tone,
      salaryType: row.salary_type || 'monthly',
    },
    baseSalary: number(row.base_salary),
    overtimeSalary: number(row.overtime_salary),
    allowance: number(row.allowance),
    bonus: number(row.bonus),
    commission: number(row.commission),
    tourCommission: number(row.tour_commission),
    deduction: number(row.deduction),
    totalIncome: number(row.total_income),
    netSalary: number(row.net_salary),
    paidAmount: number(row.paid_amount),
    remainingAmount: number(row.remaining_amount),
    workUnits: number(row.work_units),
    standardWorkDays: number(row.standard_work_days),
    hourlyRate: number(row.hourly_rate),
    status: row.status,
    note: row.note,
  }));

  const summary = records.reduce((acc, rec) => ({
    totalStaff: acc.totalStaff + 1,
    totalBaseSalary: acc.totalBaseSalary + rec.baseSalary,
    totalOvertimeSalary: acc.totalOvertimeSalary + rec.overtimeSalary,
    totalAllowance: acc.totalAllowance + rec.allowance,
    totalBonus: acc.totalBonus + rec.bonus,
    totalCommission: acc.totalCommission + rec.commission,
    totalTourCommission: acc.totalTourCommission + rec.tourCommission,
    totalDeduction: acc.totalDeduction + rec.deduction,
    totalIncome: acc.totalIncome + rec.totalIncome,
    totalNetSalary: acc.totalNetSalary + rec.netSalary,
    totalPaidAmount: acc.totalPaidAmount + rec.paidAmount,
    totalRemainingAmount: acc.totalRemainingAmount + rec.remainingAmount,
  }), {
    totalStaff: 0,
    totalBaseSalary: 0,
    totalOvertimeSalary: 0,
    totalAllowance: 0,
    totalBonus: 0,
    totalCommission: 0,
    totalTourCommission: 0,
    totalDeduction: 0,
    totalIncome: 0,
    totalNetSalary: 0,
    totalPaidAmount: 0,
    totalRemainingAmount: 0,
  });

  return {
    period: {
      id: number(period.id),
      code: period.code,
      name: period.name,
      periodType: period.period_type,
      startsOn: period.starts_on,
      endsOn: period.ends_on,
      status: period.status,
      creatorType: period.creator_type,
      creatorName: period.creator_name || 'Auto',
      approvedByName: period.approved_by_name,
      approvedAt: period.approved_at,
      updatedDataAt: period.updated_data_at,
      note: period.note,
      createdAt: period.created_at,
    },
    records,
    payments: paymentsResult.rows.map((row) => ({
      id: number(row.id),
      amount: number(row.amount),
      paymentMethod: row.payment_method,
      paidAt: row.paid_at,
      note: row.note,
      staff: { id: number(row.staff_id), code: row.staff_code, name: row.staff_name },
      actorName: row.actor_name,
    })),
    summary,
  };
}

export async function recalculatePayrollPeriod({ branchId, periodId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const periodRes = await client.query(
      'SELECT id, starts_on, ends_on, status FROM payroll_periods WHERE id = $1 AND branch_id = $2 FOR UPDATE',
      [periodId, branchId],
    );
    if (!periodRes.rowCount) throw new HttpError(404, 'PAYROLL_NOT_FOUND', 'Không tìm thấy bảng lương');
    const period = periodRes.rows[0];
    if (period.status !== 'draft') {
      throw new HttpError(400, 'PAYROLL_ALREADY_APPROVED', 'Chỉ tính lại được bảng lương đang tạm tính');
    }

    const d = new Date(period.starts_on);
    await calculatePeriodPayrollInternal(client, branchId, period.id, period.starts_on, period.ends_on, d.getFullYear(), d.getMonth() + 1);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return getPayrollPeriodDetail({ branchId, periodId });
}

export async function updatePayrollRecords({ branchId, periodId, records, note }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const periodRes = await client.query(
      'SELECT id, status FROM payroll_periods WHERE id = $1 AND branch_id = $2',
      [periodId, branchId],
    );
    if (!periodRes.rowCount) throw new HttpError(404, 'PAYROLL_NOT_FOUND', 'Không tìm thấy bảng lương');
    if (periodRes.rows[0].status !== 'draft') {
      throw new HttpError(400, 'PAYROLL_ALREADY_APPROVED', 'Bảng lương đã chốt, không thể chỉnh sửa');
    }

    if (note !== undefined) {
      await client.query('UPDATE payroll_periods SET note = $1, updated_at = NOW() WHERE id = $2', [note, periodId]);
    }

    if (Array.isArray(records)) {
      for (const rec of records) {
        const rId = parsePositiveInteger(rec.id, 'recordId');
        const recNote = rec.note ? String(rec.note).slice(0, 250) : null;

        // Fetch current record
        const curRes = await client.query(
          `SELECT base_salary, overtime_salary, allowance, bonus, commission, tour_commission, deduction, paid_amount, note
           FROM payroll_records WHERE id = $1 AND payroll_period_id = $2 FOR UPDATE`,
          [rId, periodId],
        );
        if (curRes.rowCount) {
          const cur = curRes.rows[0];
          const baseSalary = rec.baseSalary === undefined ? number(cur.base_salary) : number(rec.baseSalary);
          const overtimeSalary = rec.overtimeSalary === undefined ? number(cur.overtime_salary) : number(rec.overtimeSalary);
          const allowance = rec.allowance === undefined ? number(cur.allowance) : number(rec.allowance);
          const bonus = rec.bonus === undefined ? number(cur.bonus) : number(rec.bonus);
          const commission = rec.commission === undefined ? number(cur.commission) : number(rec.commission);
          const tourCommission = rec.tourCommission === undefined ? number(cur.tour_commission) : number(rec.tourCommission);
          const deduction = rec.deduction === undefined ? number(cur.deduction) : number(rec.deduction);
          if ([baseSalary, overtimeSalary, allowance, bonus, commission, tourCommission, deduction].some((value) => value < 0)) {
            throw new HttpError(400, 'INVALID_PAYROLL_AMOUNT', 'Các khoản lương không được âm');
          }
          const paidAmount = number(cur.paid_amount);
          // Hand-edited automatic amounts stop the automatic refresh for this row.
          const adjusted = baseSalary !== number(cur.base_salary) || commission !== number(cur.commission)
            || tourCommission !== number(cur.tour_commission) || deduction !== number(cur.deduction);
          const totalIncome = baseSalary + overtimeSalary + commission + tourCommission + allowance + bonus;
          const netSalary = Math.max(0, totalIncome - deduction);
          const remainingAmount = Math.max(0, netSalary - paidAmount);

          await client.query(
            `UPDATE payroll_records
             SET base_salary = $1, overtime_salary = $2, allowance = $3, bonus = $4, commission = $5, deduction = $6,
                 total_income = $7, net_salary = $8, remaining_amount = $9, note = $10, tour_commission = $13,
                 adjusted_at = CASE WHEN $14 THEN NOW() ELSE adjusted_at END
             WHERE id = $11 AND payroll_period_id = $12`,
            [baseSalary, overtimeSalary, allowance, bonus, commission, deduction, totalIncome, netSalary, remainingAmount, rec.note === undefined ? cur.note : recNote, rId, periodId, tourCommission, adjusted],
          );
        }
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return getPayrollPeriodDetail({ branchId, periodId });
}

export async function approvePayrollPeriod({ branchId, periodId, staffId, staffName }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE payroll_periods
       SET status = 'approved', approved_by_id = $1, approved_by_name = $2, approved_at = NOW(), updated_at = NOW()
       WHERE id = $3 AND branch_id = $4 AND status = 'draft'
       RETURNING id`,
      [staffId, staffName || 'Quản lý', periodId, branchId],
    );
    if (!result.rowCount) {
      const exists = await client.query('SELECT 1 FROM payroll_periods WHERE id = $1 AND branch_id = $2', [periodId, branchId]);
      if (!exists.rowCount) throw new HttpError(404, 'PAYROLL_NOT_FOUND', 'Không tìm thấy bảng lương');
      throw new HttpError(409, 'PAYROLL_NOT_DRAFT', 'Bảng lương đã chốt hoặc đã hủy');
    }
    await client.query(`UPDATE payroll_records SET status = 'approved' WHERE payroll_period_id = $1 AND status = 'draft'`, [periodId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  broadcastToBranch(branchId, 'payroll:approved', { periodId });
  return getPayrollPeriodDetail({ branchId, periodId });
}

export async function cancelPayrollPeriod({ branchId, periodId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const period = await client.query('SELECT status FROM payroll_periods WHERE id = $1 AND branch_id = $2 FOR UPDATE', [periodId, branchId]);
    if (!period.rowCount) throw new HttpError(404, 'PAYROLL_NOT_FOUND', 'Không tìm thấy bảng lương');
    // Salary already paid sits in the cashbook; cancelling would orphan those vouchers.
    const paid = await client.query('SELECT COALESCE(SUM(paid_amount), 0) AS paid FROM payroll_records WHERE payroll_period_id = $1', [periodId]);
    if (number(paid.rows[0].paid) > 0) throw new HttpError(409, 'PAYROLL_HAS_PAYMENTS', 'Bảng lương đã có khoản chi, không thể hủy');
    await client.query(`UPDATE payroll_periods SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [periodId]);
    await client.query(`UPDATE payroll_records SET status = 'cancelled' WHERE payroll_period_id = $1`, [periodId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return { id: periodId, status: 'cancelled' };
}

export async function createPayrollPayment({ branchId, periodId, staffId, amount, paymentMethod = 'transfer', note, actorStaffId, actorAccountId }) {
  const client = await pool.connect();
  let cashEntry = null;
  let paymentId;
  try {
    await client.query('BEGIN');
    const recordRes = await client.query(
      `SELECT pr.id, pr.net_salary, pr.paid_amount, pp.status AS period_status, pp.name AS period_name
       FROM payroll_records pr
       JOIN payroll_periods pp ON pp.id = pr.payroll_period_id
       WHERE pr.payroll_period_id = $1 AND pr.staff_id = $2 AND pp.branch_id = $3
       FOR UPDATE OF pr`,
      [periodId, staffId, branchId],
    );
    if (!recordRes.rowCount) throw new HttpError(404, 'RECORD_NOT_FOUND', 'Không tìm thấy phiếu lương nhân viên');

    const rec = recordRes.rows[0];
    if (rec.period_status !== 'approved') {
      throw new HttpError(409, 'PAYROLL_NOT_APPROVED', 'Chốt bảng lương trước khi thanh toán');
    }
    const recId = rec.id;
    const currentPaid = number(rec.paid_amount);
    const netSalary = number(rec.net_salary);
    const remaining = Math.max(0, netSalary - currentPaid);
    if (amount > remaining) {
      throw new HttpError(400, 'PAYMENT_EXCEEDS_REMAINING', `Số tiền vượt số còn phải trả (${remaining.toLocaleString('vi-VN')}đ)`);
    }
    await assertFundsCover(client, branchId, { [fundForPaymentMethod(paymentMethod)]: -amount });
    const newPaid = currentPaid + amount;
    const newRemaining = Math.max(0, netSalary - newPaid);
    const status = newRemaining === 0 ? 'paid' : 'approved';

    const paymentRes = await client.query(
      `INSERT INTO payroll_payments (branch_id, payroll_period_id, payroll_record_id, staff_id, amount, payment_method, note, actor_staff_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [branchId, periodId, recId, staffId, amount, paymentMethod, note, actorStaffId],
    );
    paymentId = paymentRes.rows[0].id;

    await client.query(
      `UPDATE payroll_records
       SET paid_amount = $1, remaining_amount = $2, status = $3
       WHERE id = $4`,
      [newPaid, newRemaining, status, recId],
    );

    const staffRes = await client.query('SELECT name FROM staff WHERE id = $1 AND branch_id = $2', [staffId, branchId]);
    cashEntry = await recordCashEntry(client, {
      branchId,
      type: 'expense',
      categoryKey: 'salary',
      amount,
      paymentMethod,
      sourceType: 'payroll_payment',
      sourceId: paymentId,
      counterpartyType: 'staff',
      counterpartyId: staffId,
      counterpartyName: staffRes.rows[0]?.name ?? null,
      note: note || `Chi lương ${rec.period_name}`,
      createdBy: actorAccountId ?? null,
    });

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  broadcastToBranch(branchId, 'payroll:paid', { paymentId, staffId });
  if (cashEntry) broadcastToBranch(branchId, realtimeEvents.cashbookUpdated, { voucherId: cashEntry.id, action: 'created' });
  return getPayrollPeriodDetail({ branchId, periodId });
}

/**
 * Add whole weeks to a calendar date without converting it to a local/UTC
 * timestamp. Schedules use DATE columns, so a date-only calculation is
 * required here. Converting a Vietnam midnight to ISO used to turn Saturday
 * into Friday before the copy was inserted.
 */
export function addWeeksToIsoDate(date, weeks) {
  const [year, month, day] = String(date).split('-').map(Number);
  const result = new Date(Date.UTC(year, month - 1, day));
  result.setUTCDate(result.getUTCDate() + (weeks * 7));

  return [
    result.getUTCFullYear(),
    String(result.getUTCMonth() + 1).padStart(2, '0'),
    String(result.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * Assign shift with support for recurring schedule across multiple weeks
 * @param {Object} params - Shift assignment parameters
 * @param {number} params.branchId - Branch ID
 * @param {number} params.staffId - Staff ID
 * @param {string} params.shiftDate - Shift date (YYYY-MM-DD)
 * @param {string} params.startsAt - Start time (HH:MM)
 * @param {string} params.endsAt - End time (HH:MM)
 * @param {string} [params.shiftName='Ca làm việc'] - Shift name
 * @param {string} [params.note] - Optional note
 * @param {number} [params.applyToWeeks=1] - Number of weeks to apply (1 = single week only)
 * @returns {Object} { id, groupId, affectedWeeks }
 */
export async function assignShift({ branchId, staffId, shiftDate, startsAt, endsAt, shiftName = 'Ca làm việc', note, applyToWeeks = 1 }) {
  // Validate inputs
  if (!branchId || !staffId || !shiftDate || !startsAt || !endsAt) {
    throw Object.assign(new Error('Missing required fields'), { status: 400 });
  }

  // Generate group ID if applyToWeeks > 1
  const groupId = applyToWeeks > 1 ? generateGroupId() : null;
  const isSource = applyToWeeks > 1;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert main schedule
    const result = await client.query(`
      INSERT INTO staff_schedules
        (branch_id, staff_id, shift_date, starts_at, ends_at, shift_name, note, week_group_id, is_source)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (staff_id, shift_date, starts_at)
      DO UPDATE SET
        ends_at = EXCLUDED.ends_at,
        shift_name = EXCLUDED.shift_name,
        note = EXCLUDED.note,
        week_group_id = COALESCE(staff_schedules.week_group_id, EXCLUDED.week_group_id),
        is_source = COALESCE(staff_schedules.is_source, EXCLUDED.is_source)
      RETURNING id
    `, [branchId, staffId, shiftDate, startsAt, endsAt, shiftName, note, groupId, isSource]);

    const insertedId = result.rows[0].id;

    // If applyToWeeks > 1, copy the just-created schedule to subsequent weeks
    if (applyToWeeks > 1) {
      // Get the just-created schedule
      const sourceSchedule = {
        staff_id: staffId,
        shift_date: shiftDate,
        starts_at: startsAt,
        ends_at: endsAt,
        shift_name: shiftName,
        note: note || null,
      };

      // Copy to subsequent weeks
      for (let weekOffset = 1; weekOffset < applyToWeeks; weekOffset++) {
        // Keep the exact weekday by doing date-only arithmetic. Do not use
        // Date#toISOString here: its UTC conversion shifts dates west of UTC.
        const targetDateStr = addWeeksToIsoDate(shiftDate, weekOffset);

        // Skip leave days
        if (await isLeaveDay(staffId, targetDateStr, client)) continue;

        // Skip holidays
        if (await isHoliday(targetDateStr, client)) continue;

        // Copy schedule
        await copyScheduleToWeek(sourceSchedule, targetDateStr, groupId, branchId, client);
      }
    }

    await client.query('COMMIT');

    const scheduleResult = {
      id: insertedId,
      groupId,
      affectedWeeks: applyToWeeks
    };
    broadcastToBranch(branchId, 'staff:schedule_changed', {
      scheduleId: insertedId,
      staffId,
      action: 'assigned',
    });
    return scheduleResult;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ============================================================================
// RECURRING SCHEDULE HELPERS
// ============================================================================

/**
 * Generate unique group ID for recurring schedules
 * Uses timestamp + random for uniqueness
 */
export function generateGroupId() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return timestamp * 1000 + random;
}

/**
 * Get all schedules for a staff in a specific week
 */
export async function getSchedulesByWeek(staffId, weekStart, client = pool) {
  const result = await client.query(`
    SELECT id, staff_id, shift_date, starts_at, ends_at, shift_name,
           status, note, week_group_id, is_source
    FROM staff_schedules
    WHERE staff_id = $1
      AND shift_date >= $2::date
      AND shift_date < $2::date + INTERVAL '7 days'
    ORDER BY shift_date, starts_at
  `, [staffId, weekStart]);
  return result.rows;
}

/**
 * Copy a single schedule to target date with group ID
 */
export async function copyScheduleToWeek(schedule, targetDate, groupId, branchId, client = pool) {
  const result = await client.query(`
    INSERT INTO staff_schedules
      (branch_id, staff_id, shift_date, starts_at, ends_at, shift_name, status, note, week_group_id, is_source)
    VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', $7, $8, false)
    ON CONFLICT (staff_id, shift_date, starts_at) DO NOTHING
    RETURNING id
  `, [
    branchId,
    schedule.staff_id,
    targetDate,
    schedule.starts_at,
    schedule.ends_at,
    schedule.shift_name,
    schedule.note || null,
    groupId
  ]);
  return result.rows[0]?.id;
}

/**
 * Check if a date is a leave day for staff
 */
export async function isLeaveDay(staffId, date, client = pool) {
  const result = await client.query(`
    SELECT EXISTS(
      SELECT 1 FROM staff_schedules
      WHERE staff_id = $1
        AND shift_date = $2::date
        AND status = 'leave'
    ) as is_leave
  `, [staffId, date]);
  return result.rows[0]?.is_leave || false;
}

/**
 * Check if a date is a holiday
 */
export async function isHoliday(date, client = pool) {
  const result = await client.query(`
    SELECT EXISTS(
      SELECT 1 FROM branch_work_schedule_settings
      WHERE holidays @> $1::jsonb
    ) as is_holiday
  `, [JSON.stringify(date)]);
  return result.rows[0]?.is_holiday || false;
}

// ============================================================================
// RECURRING SCHEDULE UPDATE/DELETE WITH PROPAGATE
// ============================================================================

/**
 * Delete a schedule or its entire recurring group.
 * @param {number} branchId - Branch ID for authorization
 * @param {number} scheduleId - Schedule ID to delete
 * @param {boolean} deleteAllRecurring - If true, delete every schedule in the recurring group
 * @returns {Object} { deleted: true }
 */
export async function deleteSchedule(branchId, scheduleId, deleteAllRecurring = false) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get current schedule
    const currentResult = await client.query(`
      SELECT id, week_group_id, is_source, shift_date, branch_id, staff_id
      FROM staff_schedules WHERE id = $1
    `, [scheduleId]);

    if (currentResult.rows.length === 0) {
      throw Object.assign(new Error('Schedule not found'), { status: 404 });
    }

    const schedule = currentResult.rows[0];
    const { week_group_id, branch_id: scheduleBranchId } = schedule;

    // Validate branch authorization
    if (Number(scheduleBranchId) !== Number(branchId)) {
      throw Object.assign(new Error('Schedule not found'), { status: 404 });
    }

    if (deleteAllRecurring && week_group_id) {
      // Any occurrence, including the source, can remove the whole series.
      await client.query(`
        DELETE FROM staff_schedules
        WHERE week_group_id = $1
      `, [week_group_id]);
    } else {
      // Delete only this schedule
      await client.query(`DELETE FROM staff_schedules WHERE id = $1`, [scheduleId]);
    }

    await client.query('COMMIT');
    broadcastToBranch(branchId, 'staff:schedule_changed', {
      scheduleId,
      action: 'deleted',
    });
    return { deleted: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
