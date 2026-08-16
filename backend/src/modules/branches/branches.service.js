import { pool } from '../../db.js';
import { HttpError } from '../../lib/http.js';

function mapBranch(row) {
  return {
    id: Number(row.id), code: row.code, name: row.name, address: row.address ?? '',
    phone: row.phone ?? '', email: row.email ?? '', timezone: row.timezone,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    attendanceRadiusMeters: Number(row.attendance_radius_m), active: row.active,
    accountCount: Number(row.account_count ?? 0), staffCount: Number(row.staff_count ?? 0),
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export async function listBranches() {
  const result = await pool.query(
    `SELECT b.*,
       (SELECT COUNT(*) FROM user_accounts ua WHERE ua.branch_id = b.id AND ua.active) AS account_count,
       (SELECT COUNT(*) FROM staff s WHERE s.branch_id = b.id AND s.active) AS staff_count
     FROM branches b ORDER BY b.active DESC, b.name`,
  );
  return result.rows.map(mapBranch);
}

export async function getBranch(id) {
  const result = await pool.query('SELECT * FROM branches WHERE id = $1', [id]);
  if (!result.rows[0]) throw new HttpError(404, 'BRANCH_NOT_FOUND', 'Không tìm thấy chi nhánh');
  return mapBranch(result.rows[0]);
}

export async function createBranch(data) {
  try {
    const result = await pool.query(
      `INSERT INTO branches (
         code, name, address, phone, email, timezone, latitude, longitude, attendance_radius_m
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [data.code, data.name, data.address || null, data.phone || null, data.email || null,
        data.timezone, data.latitude, data.longitude, data.attendanceRadiusMeters],
    );
    return mapBranch(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') throw new HttpError(409, 'BRANCH_CODE_EXISTS', 'Mã chi nhánh đã tồn tại');
    throw error;
  }
}

export async function updateBranch(id, data) {
  try {
    const result = await pool.query(
      `UPDATE branches SET
         code = COALESCE($2, code), name = COALESCE($3, name), address = $4,
         phone = $5, email = $6, timezone = COALESCE($7, timezone),
         latitude = $8, longitude = $9, attendance_radius_m = COALESCE($10, attendance_radius_m),
         active = COALESCE($11, active), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, data.code, data.name, data.address, data.phone, data.email, data.timezone,
        data.latitude, data.longitude, data.attendanceRadiusMeters, data.active],
    );
    if (!result.rows[0]) throw new HttpError(404, 'BRANCH_NOT_FOUND', 'Không tìm thấy chi nhánh');
    return mapBranch(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') throw new HttpError(409, 'BRANCH_CODE_EXISTS', 'Mã chi nhánh đã tồn tại');
    throw error;
  }
}

export async function deactivateBranch(id, currentBranchId) {
  if (id === currentBranchId) throw new HttpError(400, 'CANNOT_DISABLE_CURRENT_BRANCH', 'Hãy chuyển sang chi nhánh khác trước khi ngừng chi nhánh hiện tại');
  const activeManagers = await pool.query(
    `SELECT COUNT(*) AS total FROM user_accounts WHERE branch_id = $1 AND role = 'manager' AND active`, [id],
  );
  if (Number(activeManagers.rows[0].total) > 0) {
    throw new HttpError(409, 'BRANCH_HAS_MANAGERS', 'Hãy chuyển hoặc khóa tài khoản quản lý của chi nhánh trước');
  }
  const result = await pool.query('UPDATE branches SET active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING *', [id]);
  if (!result.rows[0]) throw new HttpError(404, 'BRANCH_NOT_FOUND', 'Không tìm thấy chi nhánh');
  await pool.query('DELETE FROM auth_sessions WHERE account_id IN (SELECT id FROM user_accounts WHERE branch_id = $1)', [id]);
  return mapBranch(result.rows[0]);
}
