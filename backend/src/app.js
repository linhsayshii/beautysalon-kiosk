import express from 'express';
import { randomUUID } from 'node:crypto';
import { checkDatabase } from './db.js';
import { config } from './config.js';
import { asyncRoute, HttpError } from './lib/http.js';
import { createRateLimiter, requireJsonBody, requireTrustedOrigin, securityHeaders } from './lib/security.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import customerRoutes from './modules/customers/customers.routes.js';
import orderRoutes from './modules/orders/orders.routes.js';
import staffRoutes, { staffSelfRoutes } from './modules/staff/staff.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import { domainOptions } from './domain-options.js';
import authRoutes from './modules/auth/auth.routes.js';
import { requireAuth } from './modules/auth/auth.middleware.js';
import { permissions, requirePermissions } from './modules/auth/auth.permissions.js';
import attendanceRoutes from './modules/attendance/attendance.routes.js';
import posRoutes from './modules/pos/pos.routes.js';
import branchRoutes from './modules/branches/branches.routes.js';

export function requestIdentity(request, response, next) {
  request.id = randomUUID();
  response.setHeader('X-Request-Id', request.id);
  next();
}

export function apiErrorHandler(error, request, response, next) {
  if (response.headersSent) return next(error);
  const malformedJson = error?.type === 'entity.parse.failed';
  const payloadTooLarge = error?.type === 'entity.too.large';
  const status = malformedJson ? 400 : payloadTooLarge ? 413 : (Number.isInteger(error.status) ? error.status : 500);
  const code = malformedJson
    ? 'MALFORMED_JSON'
    : payloadTooLarge
      ? 'PAYLOAD_TOO_LARGE'
      : status >= 500 ? 'INTERNAL_SERVER_ERROR' : (error.code ?? 'REQUEST_FAILED');
  const message = malformedJson
    ? 'Nội dung JSON không hợp lệ'
    : payloadTooLarge
      ? 'Dữ liệu gửi lên vượt quá giới hạn 1 MB'
      : status >= 500 ? 'Lỗi máy chủ nội bộ, vui lòng thử lại sau' : error.message;

  if (status >= 500) console.error(`[request:${request.id ?? 'unknown'}]`, error);

  return response.status(status).json({
    error: {
      status,
      code,
      message,
      requestId: request.id,
      ...(error.details ? { details: error.details } : {}),
    },
  });
}

export function createApp() {
  const app = express();

  app.set('trust proxy', config.http.trustProxyHops);
  app.disable('x-powered-by');
  app.use('/api/v1', requestIdentity);
  app.use('/api/v1', securityHeaders);
  app.use('/api/v1', requireTrustedOrigin(config.http.trustedOrigins));
  app.use('/api/v1', createRateLimiter({ windowMs: 60_000, max: config.http.apiRateLimit }));
  // Staff avatars are uploaded as base64 data URLs; 3 MB accepts the UI's 2 MB file limit.
  app.use(express.json({ limit: '3mb' }));
  app.use('/api/v1', requireJsonBody);

  app.get('/api/v1/health', (request, response) => {
    response.json({ status: 'ok', service: 'annachill-api' });
  });

  app.get('/api/v1/ready', asyncRoute(async (request, response) => {
    const databaseReady = await checkDatabase();
    response.status(databaseReady ? 200 : 503).json({
      status: databaseReady ? 'ready' : 'not_ready',
      database: databaseReady ? 'connected' : 'disconnected',
    });
  }));

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1', requireAuth);

  app.get('/api/v1/meta', (request, response) => {
    response.json({
      data: {
        ...domainOptions,
        system: {
          storeName: config.store.name,
          adminName: config.store.adminName,
          vietqr: {
            bankBin: config.vietqr.bankBin,
            accountNumber: config.vietqr.accountNumber,
            accountName: config.vietqr.accountName,
          },
        },
      },
    });
  });

  app.use('/api/v1/attendance', attendanceRoutes);
  app.use('/api/v1/branches', branchRoutes);
  app.use('/api/v1/pos', requirePermissions(permissions.usePos), posRoutes);
  app.use('/api/v1/dashboard', requirePermissions(permissions.readDashboard), dashboardRoutes);
  app.use('/api/v1/orders', requirePermissions(permissions.readOrders), orderRoutes);
  app.use('/api/v1/customers', requirePermissions(permissions.manageCustomers), customerRoutes);
  app.use('/api/v1/staff/me', staffSelfRoutes);
  app.use('/api/v1/staff', requirePermissions(permissions.manageStaff), staffRoutes);
  app.use('/api/v1/inventory', requirePermissions(permissions.manageInventory), inventoryRoutes);

  app.use((request, response, next) => {
    next(new HttpError(404, 'ROUTE_NOT_FOUND', 'Đường dẫn API không tồn tại'));
  });

  app.use(apiErrorHandler);

  return app;
}
