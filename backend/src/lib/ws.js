import { WebSocketServer, WebSocket } from 'ws';
import { accountFromToken, readSessionCookie } from '../modules/auth/auth.service.js';
import { config } from '../config.js';

let wssInstance = null;
let heartbeatInterval = null;

// This is intentionally a small, transport-level contract. Domain services
// publish one of these events only after their database transaction commits;
// clients then revalidate the affected API queries instead of trusting a
// partial WebSocket snapshot.
export const REALTIME_EVENT_VERSION = 1;
export const realtimeEvents = Object.freeze({
  appointmentCreated: 'appointment:created',
  appointmentUpdated: 'appointment:updated',
  invoiceCreated: 'invoice:created',
  invoiceUpdated: 'invoice:updated',
  invoicePaid: 'invoice:paid',
  customerPackageCreated: 'customer-package:created',
  customerPackageUpdated: 'customer-package:updated',
  customerAccountCardCreated: 'customer-account-card:created',
  customerAccountCardUpdated: 'customer-account-card:updated',
  notificationCreated: 'notification:created',
  cashbookUpdated: 'cashbook:updated',
  inventoryUpdated: 'inventory:updated',
});

function rejectUpgrade(socket, statusCode, message) {
  socket.write(`HTTP/1.1 ${statusCode} ${message}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

export async function authorizeWebSocketUpgrade(request, {
  authenticate = accountFromToken,
  trustedOrigins = config.http.trustedOrigins,
} = {}) {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname !== '/api/v1/ws') return { statusCode: 404, message: 'Not Found' };

  const origin = request.headers.origin;
  if (!origin || !trustedOrigins.includes(origin)) return { statusCode: 403, message: 'Forbidden' };

  const account = await authenticate(readSessionCookie(request));
  if (!account) return { statusCode: 401, message: 'Unauthorized' };
  return { account };
}

export function initWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ noServer: true });
  wssInstance = wss;

  httpServer.on('upgrade', async (request, socket, head) => {
    try {
      const authorization = await authorizeWebSocketUpgrade(request);
      if (!authorization.account) {
        rejectUpgrade(socket, authorization.statusCode, authorization.message);
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.branchId = authorization.account.branchId;
        ws.accountId = authorization.account.id;
        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });
        wss.emit('connection', ws, request);
      });
    } catch {
      rejectUpgrade(socket, 401, 'Unauthorized');
    }
  });

  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        if (typeof ws.terminate === 'function') ws.terminate();
        return;
      }
      ws.isAlive = false;
      if (typeof ws.ping === 'function') ws.ping();
    });
  }, 30_000);
  if (heartbeatInterval.unref) heartbeatInterval.unref();

  wss.on('close', () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  });

  return wss;
}

export function broadcastToBranch(branchId, event, data) {
  if (!wssInstance) return;
  const payload = JSON.stringify({
    version: REALTIME_EVENT_VERSION,
    event,
    data,
    timestamp: new Date().toISOString(),
  });
  wssInstance.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && (!branchId || client.branchId === Number(branchId))) {
      client.send(payload);
    }
  });
}

/**
 * Authentication and branch changes revoke the old live channel immediately.
 * A still-open WebSocket must never outlive the session/branch that authorised
 * it, including in another browser tab.
 */
export function closeWebSocketsForAccount(accountId) {
  if (!wssInstance) return;
  wssInstance.clients.forEach((client) => {
    if (client.accountId === Number(accountId) && typeof client.close === 'function') {
      client.close(4001, 'Session refreshed');
    }
  });
}
