import { Router } from 'express';
import { asyncRoute, parsePagination, parsePositiveInteger } from '../../lib/http.js';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from './notifications.service.js';

const router = Router();

router.get('/', asyncRoute(async (request, response) => {
  const result = await listNotifications({
    branchId: request.account.branchId,
    accountId: request.account.id,
    role: request.account.role,
    ...parsePagination(request.query),
  });
  response.json({ data: result.rows, meta: { pagination: result.pagination, unreadCount: result.unreadCount } });
}));

router.post('/read-all', asyncRoute(async (request, response) => {
  await markAllNotificationsRead({ branchId: request.account.branchId, accountId: request.account.id, role: request.account.role });
  response.json({ data: { success: true } });
}));

router.post('/:id/read', asyncRoute(async (request, response) => {
  await markNotificationRead({
    branchId: request.account.branchId,
    accountId: request.account.id,
    role: request.account.role,
    notificationId: parsePositiveInteger(request.params.id, 'id'),
  });
  response.json({ data: { success: true } });
}));

export default router;
