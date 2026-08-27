import { pool } from '../../db.js';
import { HttpError } from '../../lib/http.js';
import { broadcastToBranch, realtimeEvents } from '../../lib/ws.js';

const number = (value) => Number(value ?? 0);

const visibilitySql = `
  n.branch_id = $1
  AND (n.account_id IS NULL OR n.account_id = $2)
  AND (n.role IS NULL OR n.role = $3)
`;

export async function listNotifications({ branchId, accountId, role, page, pageSize, offset }) {
  const result = await pool.query(
    `SELECT n.id, n.type, n.title, n.detail, n.target_path, n.created_at,
            (nr.notification_id IS NOT NULL) AS is_read,
            COUNT(*) OVER() AS filtered_total
     FROM notifications n
     LEFT JOIN notification_reads nr
       ON nr.notification_id = n.id AND nr.account_id = $2
     WHERE ${visibilitySql}
     ORDER BY n.created_at DESC, n.id DESC
     LIMIT $4 OFFSET $5`,
    [branchId, accountId, role, pageSize, offset],
  );
  const unreadResult = await pool.query(
    `SELECT COUNT(*) AS unread_count
     FROM notifications n
     LEFT JOIN notification_reads nr
       ON nr.notification_id = n.id AND nr.account_id = $2
     WHERE ${visibilitySql} AND nr.notification_id IS NULL`,
    [branchId, accountId, role],
  );
  const total = number(result.rows[0]?.filtered_total);
  return {
    rows: result.rows.map((row) => ({
      id: number(row.id), type: row.type, title: row.title, detail: row.detail,
      targetPath: row.target_path || null, createdAt: row.created_at, isRead: row.is_read,
    })),
    unreadCount: number(unreadResult.rows[0]?.unread_count),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

export async function markNotificationRead({ branchId, accountId, role, notificationId }) {
  const visible = await pool.query(
    `SELECT n.id FROM notifications n WHERE ${visibilitySql} AND n.id = $4`,
    [branchId, accountId, role, notificationId],
  );
  if (!visible.rows[0]) throw new HttpError(404, 'NOTIFICATION_NOT_FOUND', 'Không tìm thấy thông báo');
  await pool.query(
    `INSERT INTO notification_reads (notification_id, account_id)
     VALUES ($1, $2) ON CONFLICT (notification_id, account_id) DO NOTHING`,
    [notificationId, accountId],
  );
}

export async function markAllNotificationsRead({ branchId, accountId, role }) {
  await pool.query(
    `INSERT INTO notification_reads (notification_id, account_id)
     SELECT n.id, $2 FROM notifications n
     WHERE ${visibilitySql}
     ON CONFLICT (notification_id, account_id) DO NOTHING`,
    [branchId, accountId, role],
  );
}

export async function publishNotification({ branchId, accountId = null, role = null, type, title, detail, targetPath = null }) {
  try {
    const result = await pool.query(
      `INSERT INTO notifications (branch_id, account_id, role, type, title, detail, target_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [branchId, accountId, role, type, title, detail, targetPath],
    );
    broadcastToBranch(branchId, realtimeEvents.notificationCreated, { notificationId: number(result.rows[0].id) });
  } catch (error) {
    console.error('[notification:publish]', error);
  }
}
