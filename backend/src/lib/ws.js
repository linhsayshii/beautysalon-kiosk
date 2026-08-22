import { WebSocketServer, WebSocket } from 'ws';
import { accountFromToken, readSessionCookie } from '../modules/auth/auth.service.js';
import { config } from '../config.js';

let wssInstance = null;
let heartbeatInterval = null;

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
  const payload = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
  wssInstance.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && (!branchId || client.branchId === Number(branchId))) {
      client.send(payload);
    }
  });
}
