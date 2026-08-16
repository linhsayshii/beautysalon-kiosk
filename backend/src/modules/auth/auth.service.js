import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { pool } from '../../db.js';
import { config } from '../../config.js';
import { HttpError } from '../../lib/http.js';

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = 'annachill_session';
const DUMMY_PASSWORD_HASH = 'scrypt$yAZRAcM0GLD7RH71SoOZCg$Bv1E8mUQXtuTdQFgQd3fAXiVCTA8d0o9CUpqQ2EksKNqbkRy3CvzPv2w8Ag0ngDEmtiLulcXZIwqdb2XZjOzpg';

const tokenHash = (token) => createHash('sha256').update(token).digest('hex');

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64url')}$${Buffer.from(derived).toString('base64url')}`;
}

async function verifyPassword(password, encoded) {
  const [scheme, saltValue, hashValue] = String(encoded).split('$');
  if (scheme !== 'scrypt' || !saltValue || !hashValue) return false;
  const expected = Buffer.from(hashValue, 'base64url');
  const actual = Buffer.from(await scrypt(password, Buffer.from(saltValue, 'base64url'), expected.length));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function mapAccount(row) {
  return {
    id: Number(row.id),
    branchId: Number(row.branch_id),
    staffId: row.staff_id === null ? null : Number(row.staff_id),
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    active: row.active,
    branchName: row.branch_name,
    staffCode: row.staff_code ?? null,
    phone: row.phone ?? '',
    email: row.email ?? '',
  };
}

export async function login(username, password) {
  const result = await pool.query(
    `SELECT ua.*, b.name AS branch_name, b.active AS branch_active, s.code AS staff_code
     FROM user_accounts ua
     JOIN branches b ON b.id = ua.branch_id
     LEFT JOIN staff s ON s.id = ua.staff_id
     WHERE LOWER(ua.username) = LOWER($1)`,
    [username],
  );
  const row = result.rows[0];
  if (!row) {
    console.warn(`[auth] login failed: user '${username}' not found in database`);
    await verifyPassword(password, DUMMY_PASSWORD_HASH);
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Tên đăng nhập hoặc mật khẩu không đúng');
  }
  if (!row.active || !row.branch_active) {
    console.warn(`[auth] login failed: user '${username}' or branch is inactive`);
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Tên đăng nhập hoặc mật khẩu không đúng');
  }
  const passwordValid = await verifyPassword(password, row.password_hash);
  if (!passwordValid) {
    console.warn(`[auth] login failed: invalid password for user '${username}'`);
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Tên đăng nhập hoặc mật khẩu không đúng');
  }
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + config.auth.sessionHours * 60 * 60 * 1000);
  await pool.query('DELETE FROM auth_sessions WHERE expires_at <= NOW()');
  await pool.query(
    `INSERT INTO auth_sessions (account_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [row.id, tokenHash(token), expiresAt],
  );
  await pool.query(
    `DELETE FROM auth_sessions WHERE id IN (
       SELECT id FROM auth_sessions WHERE account_id = $1 ORDER BY created_at DESC OFFSET 10
     )`,
    [row.id],
  );
  await pool.query('UPDATE user_accounts SET last_login_at = NOW() WHERE id = $1', [row.id]);
  return { account: mapAccount(row), token, expiresAt };
}

export async function accountFromToken(token) {
  if (!token) return null;
  const result = await pool.query(
    `SELECT ua.*, b.name AS branch_name, b.active AS branch_active, s.code AS staff_code
     FROM auth_sessions ses
     JOIN user_accounts ua ON ua.id = ses.account_id
     JOIN branches b ON b.id = ua.branch_id
     LEFT JOIN staff s ON s.id = ua.staff_id
     WHERE ses.token_hash = $1 AND ses.expires_at > NOW() AND ua.active AND b.active`,
    [tokenHash(token)],
  );
  return result.rows[0] ? mapAccount(result.rows[0]) : null;
}

export async function logout(token) {
  if (token) await pool.query('DELETE FROM auth_sessions WHERE token_hash = $1', [tokenHash(token)]);
}

export function readSessionCookie(request) {
  const raw = request.headers.cookie ?? '';
  const pair = raw.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (!pair) return '';
  try {
    return decodeURIComponent(pair.slice(SESSION_COOKIE.length + 1));
  } catch {
    return '';
  }
}

export function sessionCookie(token, expiresAt) {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}; Expires=${expiresAt.toUTCString()}; Priority=High${config.auth.cookieSecure ? '; Secure' : ''}`;
}

export function clearedSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${config.auth.cookieSecure ? '; Secure' : ''}`;
}

export async function listAccounts(branchId) {
  const result = await pool.query(
    `SELECT ua.id, ua.branch_id, ua.staff_id, ua.username, ua.display_name, ua.role, ua.active,
            ua.last_login_at, ua.created_at, s.code AS staff_code, s.name AS staff_name
     FROM user_accounts ua LEFT JOIN staff s ON s.id = ua.staff_id
     WHERE ua.branch_id = $1 ORDER BY ua.active DESC, ua.role, ua.display_name`,
    [branchId],
  );
  return result.rows.map((row) => ({
    id: Number(row.id), branchId: Number(row.branch_id), staffId: row.staff_id ? Number(row.staff_id) : null,
    username: row.username, displayName: row.display_name, role: row.role, active: row.active,
    lastLoginAt: row.last_login_at, createdAt: row.created_at, staffCode: row.staff_code, staffName: row.staff_name,
  }));
}

export async function createAccount({ branchId, staffId, username, password, displayName, role }) {
  try {
    if (staffId) {
      const staff = await pool.query('SELECT id FROM staff WHERE id = $1 AND branch_id = $2 AND active', [staffId, branchId]);
      if (!staff.rows[0]) throw new HttpError(400, 'INVALID_STAFF', 'Nhân viên không tồn tại trong chi nhánh hiện tại');
    }
    const passwordHash = await hashPassword(password);
    const result = await pool.query(
      `INSERT INTO user_accounts (branch_id, staff_id, username, password_hash, display_name, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, branch_id, staff_id, username, display_name, role, active, created_at`,
      [branchId, staffId, username, passwordHash, displayName, role],
    );
    return { ...result.rows[0], id: Number(result.rows[0].id), branchId: Number(result.rows[0].branch_id) };
  } catch (error) {
    if (error.code === '23505') throw new HttpError(409, 'ACCOUNT_EXISTS', 'Tên đăng nhập hoặc nhân viên đã có tài khoản');
    if (error.code === '23503') throw new HttpError(400, 'INVALID_STAFF', 'Nhân viên không tồn tại');
    throw error;
  }
}

export async function updateAccount({ id, branchId, active, role, password }) {
  const passwordHash = password ? await hashPassword(password) : null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const accounts = await client.query(
      'SELECT id, role, active, staff_id FROM user_accounts WHERE branch_id = $1 FOR UPDATE',
      [branchId],
    );
    const current = accounts.rows.find((account) => Number(account.id) === id);
    if (!current) throw new HttpError(404, 'ACCOUNT_NOT_FOUND', 'Không tìm thấy tài khoản');
    if (role === 'staff' && current.staff_id === null) {
      throw new HttpError(400, 'STAFF_REQUIRED', 'Tài khoản nhân viên phải liên kết với hồ sơ nhân viên');
    }
    const removesManager = current.role === 'manager' && current.active
      && (active === false || (role !== null && role !== 'manager'));
    const activeManagerCount = accounts.rows.filter((account) => account.role === 'manager' && account.active).length;
    if (removesManager && activeManagerCount <= 1) {
      throw new HttpError(409, 'LAST_MANAGER_REQUIRED', 'Chi nhánh cần ít nhất một tài khoản quản lý đang hoạt động');
    }
    const result = await client.query(
      `UPDATE user_accounts
       SET active = COALESCE($3, active), role = COALESCE($4, role),
           password_hash = COALESCE($5, password_hash), updated_at = NOW()
       WHERE id = $1 AND branch_id = $2
       RETURNING id, username, display_name, role, active, staff_id`,
      [id, branchId, active, role, passwordHash],
    );
    if (active === false || password || role !== null) {
      await client.query('DELETE FROM auth_sessions WHERE account_id = $1', [id]);
    }
    await client.query('COMMIT');
    const row = result.rows[0];
    return { ...row, id: Number(row.id), staffId: row.staff_id ? Number(row.staff_id) : null };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateOwnProfile({ accountId, username, displayName, phone, email }) {
  try {
    const result = await pool.query(
      `UPDATE user_accounts SET username = $2, display_name = $3, phone = $4, email = $5, updated_at = NOW()
       WHERE id = $1 RETURNING id`,
      [accountId, username, displayName, phone || null, email || null],
    );
    if (!result.rows[0]) throw new HttpError(404, 'ACCOUNT_NOT_FOUND', 'Không tìm thấy tài khoản');
  } catch (error) {
    if (error.code === '23505') throw new HttpError(409, 'USERNAME_EXISTS', 'Tên đăng nhập đã được sử dụng');
    throw error;
  }
}

export async function changeOwnPassword({ accountId, currentPassword, newPassword, currentToken }) {
  const result = await pool.query('SELECT password_hash FROM user_accounts WHERE id = $1', [accountId]);
  if (!result.rows[0] || !(await verifyPassword(currentPassword, result.rows[0].password_hash))) {
    throw new HttpError(400, 'CURRENT_PASSWORD_INVALID', 'Mật khẩu hiện tại không đúng');
  }
  const passwordHash = await hashPassword(newPassword);
  await pool.query('UPDATE user_accounts SET password_hash = $2, updated_at = NOW() WHERE id = $1', [accountId, passwordHash]);
  await pool.query('DELETE FROM auth_sessions WHERE account_id = $1 AND token_hash <> $2', [accountId, tokenHash(currentToken)]);
}

export async function switchOwnBranch({ accountId, branchId }) {
  const branch = await pool.query('SELECT id FROM branches WHERE id = $1 AND active', [branchId]);
  if (!branch.rows[0]) throw new HttpError(404, 'BRANCH_NOT_FOUND', 'Chi nhánh không tồn tại hoặc đã ngừng hoạt động');
  await pool.query(
    `UPDATE user_accounts SET branch_id = $2,
       staff_id = CASE WHEN staff_id IN (SELECT id FROM staff WHERE branch_id = $2) THEN staff_id ELSE NULL END,
       updated_at = NOW() WHERE id = $1`,
    [accountId, branchId],
  );
}
