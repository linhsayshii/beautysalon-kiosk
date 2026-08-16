import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../../config.js';
import { pool } from '../../db.js';
import { HttpError } from '../../lib/http.js';

const slotFor = (time = Date.now()) => Math.floor(time / (config.auth.qrLifetimeSeconds * 1000));
const signatureFor = (branchId, slot) => createHmac('sha256', config.auth.qrSecret)
  .update(`${branchId}.${slot}`).digest('base64url').slice(0, 32);

export function createQrChallenge(branchId) {
  const slot = slotFor();
  const expiresAt = new Date((slot + 1) * config.auth.qrLifetimeSeconds * 1000);
  return {
    token: `annachill:attendance:${branchId}:${slot}:${signatureFor(branchId, slot)}`,
    expiresAt,
    refreshSeconds: config.auth.qrLifetimeSeconds,
  };
}

function verifyQrChallenge(token, branchId) {
  const [namespace, kind, branchValue, slotValue, signature] = String(token ?? '').split(':');
  const slot = Number(slotValue);
  if (namespace !== 'annachill' || kind !== 'attendance' || Number(branchValue) !== branchId || !Number.isSafeInteger(slot)) {
    throw new HttpError(400, 'INVALID_QR', 'Mã QR không hợp lệ');
  }
  if (slot !== slotFor()) throw new HttpError(410, 'QR_EXPIRED', 'Mã QR đã hết hạn, hãy quét mã mới');
  const expected = Buffer.from(signatureFor(branchId, slot));
  const actual = Buffer.from(signature ?? '');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new HttpError(400, 'INVALID_QR', 'Mã QR không hợp lệ');
  }
}

function distanceMeters(latitude1, longitude1, latitude2, longitude2) {
  const radians = (value) => value * Math.PI / 180;
  const deltaLatitude = radians(latitude2 - latitude1);
  const deltaLongitude = radians(longitude2 - longitude1);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(radians(latitude1)) * Math.cos(radians(latitude2)) * Math.sin(deltaLongitude / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function getBranchAttendanceLocation(branchId) {
  const result = await pool.query(
    `SELECT id, name, latitude, longitude, attendance_radius_m FROM branches WHERE id = $1`, [branchId],
  );
  const row = result.rows[0];
  if (!row) throw new HttpError(404, 'BRANCH_NOT_FOUND', 'Không tìm thấy chi nhánh');
  return {
    id: Number(row.id), name: row.name,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    radiusMeters: Number(row.attendance_radius_m),
  };
}

export async function updateBranchAttendanceLocation({ branchId, latitude, longitude, radiusMeters }) {
  const result = await pool.query(
    `UPDATE branches SET latitude = $2, longitude = $3, attendance_radius_m = $4 WHERE id = $1
     RETURNING id, name, latitude, longitude, attendance_radius_m`,
    [branchId, latitude, longitude, radiusMeters],
  );
  const row = result.rows[0];
  return { id: Number(row.id), name: row.name, latitude: Number(row.latitude), longitude: Number(row.longitude), radiusMeters: Number(row.attendance_radius_m) };
}

export async function getMyAttendance({ branchId, staffId }) {
  if (!staffId) throw new HttpError(400, 'STAFF_NOT_LINKED', 'Tài khoản chưa liên kết với hồ sơ nhân viên');
  const result = await pool.query(
    `SELECT ar.id, ar.work_date, ar.check_in, ar.check_out, ar.worked_minutes, ar.late_minutes, ar.status
     FROM attendance_records ar
     WHERE ar.branch_id = $1 AND ar.staff_id = $2
       AND ar.work_date = (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`,
    [branchId, staffId],
  );
  const row = result.rows[0];
  return row ? {
    id: Number(row.id), workDate: row.work_date, checkIn: row.check_in, checkOut: row.check_out,
    workedMinutes: Number(row.worked_minutes), lateMinutes: Number(row.late_minutes), status: row.status,
  } : null;
}

export async function recordAttendance({ branchId, staffId, token, latitude, longitude, accuracy }) {
  if (!staffId) throw new HttpError(400, 'STAFF_NOT_LINKED', 'Tài khoản chưa liên kết với hồ sơ nhân viên');
  verifyQrChallenge(token, branchId);
  const branch = await getBranchAttendanceLocation(branchId);
  if (branch.latitude === null || branch.longitude === null) throw new HttpError(409, 'BRANCH_LOCATION_MISSING', 'Quản lý chưa thiết lập vị trí chi nhánh');
  const distance = distanceMeters(latitude, longitude, branch.latitude, branch.longitude);
  const allowedDistance = branch.radiusMeters + Math.min(Math.max(accuracy, 0), 30);
  if (distance > allowedDistance) {
    throw new HttpError(403, 'OUTSIDE_BRANCH', `Bạn đang cách chi nhánh ${Math.round(distance)}m, ngoài bán kính chấm công ${branch.radiusMeters}m`, {
      distanceMeters: Math.round(distance), radiusMeters: branch.radiusMeters,
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query(
      `SELECT * FROM attendance_records
       WHERE branch_id = $1 AND staff_id = $2
         AND work_date = (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
       FOR UPDATE`,
      [branchId, staffId],
    );
    const existing = current.rows[0];
    let action;
    if (!existing) {
      const schedule = await client.query(
        `SELECT starts_at, EXTRACT(EPOCH FROM (ends_at - starts_at)) / 60 AS scheduled_minutes
         FROM staff_schedules
         WHERE branch_id = $1 AND staff_id = $2
           AND shift_date = (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
           AND status IN ('scheduled', 'confirmed') ORDER BY starts_at LIMIT 1`,
        [branchId, staffId],
      );
      const shift = schedule.rows[0];
      const lateMinutes = shift ? Math.max(0, Math.floor((Date.now() - new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())}T${shift.starts_at}+07:00`).getTime()) / 60000)) : 0;
      await client.query(
        `INSERT INTO attendance_records (
           branch_id, staff_id, work_date, check_in, scheduled_minutes, late_minutes, status,
           check_in_latitude, check_in_longitude
         ) VALUES ($1, $2, (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, NOW(), $3, $4, 'working', $5, $6)`,
        [branchId, staffId, Number(shift?.scheduled_minutes ?? 0), lateMinutes, latitude, longitude],
      );
      action = 'check_in';
    } else if (!existing.check_out) {
      await client.query(
        `UPDATE attendance_records SET check_out = NOW(),
           worked_minutes = GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - check_in)) / 60)),
           status = CASE WHEN late_minutes > 0 THEN 'late' ELSE 'present' END,
           check_out_latitude = $2, check_out_longitude = $3
         WHERE id = $1`,
        [existing.id, latitude, longitude],
      );
      action = 'check_out';
    } else {
      throw new HttpError(409, 'ATTENDANCE_COMPLETED', 'Bạn đã hoàn tất chấm công hôm nay');
    }
    await client.query('COMMIT');
    return { action, distanceMeters: Math.round(distance), attendance: await getMyAttendance({ branchId, staffId }) };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
