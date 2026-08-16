import { WebSocketServer, WebSocket } from 'ws';
import { parse as parseUrl } from 'node:url';
import { accountFromToken } from '../modules/auth/auth.service.js';

let wssInstance = null;
let heartbeatInterval = null;

export function initWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ noServer: true });
  wssInstance = wss;

  httpServer.on('upgrade', async (request, socket, head) => {
    try {
      const { query } = parseUrl(request.url, true);
      // Support cookie auth or query token/branchId for flexible connection
      const cookieHeader = request.headers.cookie || '';
      const match = cookieHeader.match(/annachill_session=([^;]+)/);
      const token = match ? match[1] : (query.token || null);
      let account = token ? await accountFromToken(token) : null;
      const branchId = account ? account.branchId : Number(query.branchId || 1);

      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.branchId = branchId;
        ws.accountId = account?.id ?? null;
        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });
        wss.emit('connection', ws, request);
      });
    } catch (err) {
      socket.destroy();
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
