import { Router } from 'express';
import { asyncRoute, HttpError } from '../../lib/http.js';
import { permissions, requirePermissions } from '../auth/auth.permissions.js';
import { createQrChallenge, getBranchAttendanceLocation, getMyAttendance, recordAttendance, updateBranchAttendanceLocation } from './attendance.service.js';

const router = Router();
const coordinate = (value, field, min, max) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new HttpError(400, 'INVALID_LOCATION', `${field} không hợp lệ`);
  return number;
};

router.get('/challenge', requirePermissions(permissions.manageAttendance), (request, response) => {
  response.json({ data: createQrChallenge(request.account.branchId) });
});

router.get('/location', requirePermissions(permissions.manageAttendance), asyncRoute(async (request, response) => {
  response.json({ data: await getBranchAttendanceLocation(request.account.branchId) });
}));

router.put('/location', requirePermissions(permissions.manageAttendance), asyncRoute(async (request, response) => {
  const radiusMeters = Number(request.body.radiusMeters);
  if (!Number.isInteger(radiusMeters) || radiusMeters < 10 || radiusMeters > 1000) throw new HttpError(400, 'INVALID_RADIUS', 'Bán kính phải từ 10 đến 1000 mét');
  const data = await updateBranchAttendanceLocation({
    branchId: request.account.branchId,
    latitude: coordinate(request.body.latitude, 'Vĩ độ', -90, 90),
    longitude: coordinate(request.body.longitude, 'Kinh độ', -180, 180),
    radiusMeters,
  });
  response.json({ data });
}));

router.get('/me', requirePermissions(permissions.useOwnAttendance), asyncRoute(async (request, response) => {
  response.json({ data: await getMyAttendance({ branchId: request.account.branchId, staffId: request.account.staffId }) });
}));

router.post('/scan', requirePermissions(permissions.useOwnAttendance), asyncRoute(async (request, response) => {
  const accuracy = Number(request.body.accuracy ?? 0);
  if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 5000) throw new HttpError(400, 'INVALID_LOCATION', 'Độ chính xác GPS không hợp lệ');
  const data = await recordAttendance({
    branchId: request.account.branchId, staffId: request.account.staffId,
    token: request.body.token,
    latitude: coordinate(request.body.latitude, 'Vĩ độ', -90, 90),
    longitude: coordinate(request.body.longitude, 'Kinh độ', -180, 180), accuracy,
  });
  response.json({ data });
}));

export default router;
