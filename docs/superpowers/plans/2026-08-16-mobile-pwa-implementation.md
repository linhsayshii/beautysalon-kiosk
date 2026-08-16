# Mobile PWA & Real-time POS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng giao diện điện thoại PWA độc lập (`/m/*`) chuẩn touch-first, đồng bộ tên store động từ `.env`, tích hợp WebSocket real-time cho POS/đơn hàng, và giao diện Mobile POS đúng theo ảnh mẫu thực tế.

**Architecture:** Tách bạch không gian điều hướng `/m/*` với `MobileAppLayout` (TopBar + Bottom Navigation Bar 4-5 tabs theo role); Backend tích hợp WebSocket server (`ws`) gắn trực tiếp trên HTTP server phân luồng theo `branchId`; Dynamic PWA Manifest & Service worker cache-first cho assets tĩnh; UI POS dạng danh sách thẻ nhóm (Grouped List), icon dịch vụ, thời lượng, giá tiền rõ nét và bottom sheet giỏ hàng trượt.

**Tech Stack:** React 19, TypeScript, React Router 7, TanStack Query v5, Phosphor Icons, Node.js WebSocket (`ws`), CSS Safe-Area & PWA Manifest.

**Spec:** `docs/superpowers/specs/2026-08-16-mobile-pwa-design.md`

## Global Constraints
- Node >= 20, Express 5.1.0, React 19.1.1, Vite 7.1.3.
- STORE_NAME lấy động từ `STORE_NAME` trong `.env` (qua `/api/v1/meta`).
- Giữ nguyên và bảo đảm 100% 50 tests hiện tại của frontend và toàn bộ tests của backend tiếp tục pass.
- Đảm bảo safe-area CSS cho iPhone Notch, Dynamic Island và Android navigation bar.

---

### Task 1: Backend WebSocket Server & POS Realtime Broadcast

**Files:**
- Modify: `backend/package.json`
- Create: `backend/src/lib/ws.js`
- Modify: `backend/src/server.js:1-31`
- Modify: `backend/src/modules/pos/pos.service.js:140-220`
- Modify: `backend/src/modules/orders/orders.service.js:80-140`
- Test: `backend/src/lib/ws.test.js`

**Interfaces:**
- Consumes: `readSessionCookie` & `accountFromToken` from `backend/src/modules/auth/auth.service.js`
- Produces: `initWebSocketServer(httpServer)` and `broadcastToBranch(branchId, event, data)`

- [ ] **Step 1: Install `ws` dependency in backend and write test for WebSocket broadcast**

Install `ws` dependency:
```bash
cd backend && npm install ws
```

Create test `backend/src/lib/ws.test.js`:
```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { WebSocket } from 'ws';
import { initWebSocketServer, broadcastToBranch } from './ws.js';

test('WebSocket server connects and broadcasts events by branch', async (t) => {
  const server = createServer();
  const wss = initWebSocketServer(server);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  // Mock a client joining branch 1
  const client = new WebSocket(`ws://127.0.0.1:${port}?branchId=1`);
  const received = [];

  await new Promise((resolve) => client.on('open', resolve));
  client.on('message', (msg) => received.push(JSON.parse(msg.toString())));

  // Broadcast event to branch 1
  broadcastToBranch(1, 'pos:order_created', { orderId: 99, total: 250000 });
  // Broadcast event to branch 2 (should not receive)
  broadcastToBranch(2, 'pos:order_created', { orderId: 100, total: 500000 });

  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(received.length, 1);
  assert.equal(received[0].event, 'pos:order_created');
  assert.equal(received[0].data.orderId, 99);

  client.close();
  wss.close();
  server.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test src/lib/ws.test.js`
Expected: FAIL (Cannot find module './ws.js')

- [ ] **Step 3: Implement `backend/src/lib/ws.js`**

```javascript
import { WebSocketServer, WebSocket } from 'ws';
import { parse as parseUrl } from 'node:url';
import { accountFromToken } from '../modules/auth/auth.service.js';

let wssInstance = null;

export function initWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ noServer: true });
  wssInstance = wss;

  httpServer.on('upgrade', async (request, socket, head) => {
    try {
      const { query } = parseUrl(request.url, true);
      // Support cookie auth or query token/branchId for flexible connection
      const cookieHeader = request.headers.cookie || '';
      const match = cookieHeader.match(/annachill_session=([^;]+)/);
      const token = match ? match[1] : null;
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

  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30_000);

  wss.on('close', () => clearInterval(heartbeatInterval));

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
```

- [ ] **Step 4: Attach WebSocket server in `backend/src/server.js` and hook into POS checkout**

Modify `backend/src/server.js`:
```javascript
import { createApp } from './app.js';
import { assertProductionDatabaseSafety, closeDatabase, runMigrations } from './db.js';
import { config } from './config.js';
import { initWebSocketServer } from './lib/ws.js';

await runMigrations();

if (config.nodeEnv === 'production') await assertProductionDatabaseSafety();

const app = createApp();
const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`[api] listening on port ${config.port} (${config.nodeEnv})`);
});
initWebSocketServer(server);
```

In `backend/src/modules/pos/pos.service.js` (inside `checkoutPosInvoice` right before return):
```javascript
broadcastToBranch(account.branchId, 'pos:order_created', {
  orderId: receipt.id,
  code: receipt.code,
  total: receipt.total,
  customerName: receipt.customer.name,
  issuedAt: receipt.issuedAt,
});
```

- [ ] **Step 5: Run tests and verify PASS**

Run: `cd backend && node --test`
Expected: PASS all tests.

- [ ] **Step 6: Commit backend WebSocket feature**

```bash
git add backend/package.json backend/package-lock.json backend/src/lib/ws.js backend/src/lib/ws.test.js backend/src/server.js backend/src/modules/pos/pos.service.js
git commit -m "feat(backend): add branch-isolated websocket server and pos realtime broadcast"
```

---

### Task 2: PWA WebManifest, Service Worker & Store Name Dynamic Sync

**Files:**
- Create: `frontend/public/manifest.webmanifest`
- Create: `frontend/public/sw.js`
- Create: `frontend/public/icons/icon-192.svg`
- Create: `frontend/public/icons/icon-512.svg`
- Create: `frontend/src/pwa/register-sw.ts`
- Create: `frontend/src/pwa/device-detect.ts`
- Modify: `frontend/index.html`
- Modify: `frontend/src/main.tsx`
- Test: `frontend/src/pwa/device-detect.test.ts`

**Interfaces:**
- Produces: `isMobileDevice()`, `getPreferredUiMode()`, `setPreferredUiMode(mode)`
- Produces: `registerServiceWorker()`, `syncManifestTitle(storeName)`

- [ ] **Step 1: Write test for device-detect & UI mode preference**

Create `frontend/src/pwa/device-detect.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isMobileDevice, getPreferredUiMode, setPreferredUiMode } from './device-detect';

describe('device-detect utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('handles preference storage correctly', () => {
    expect(getPreferredUiMode()).toBeNull();
    setPreferredUiMode('mobile');
    expect(getPreferredUiMode()).toBe('mobile');
    setPreferredUiMode('desktop');
    expect(getPreferredUiMode()).toBe('desktop');
  });

  it('detects standalone mode or narrow viewport', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query) => ({
      matches: query === '(display-mode: standalone)',
      media: query,
    })));
    expect(isMobileDevice()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test src/pwa/device-detect.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `frontend/src/pwa/device-detect.ts`**

```typescript
const STORAGE_KEY = 'annachill-ui-mode';

export type UiMode = 'mobile' | 'desktop';

export function getPreferredUiMode(): UiMode | null {
  const val = localStorage.getItem(STORAGE_KEY);
  return val === 'mobile' || val === 'desktop' ? val : null;
}

export function setPreferredUiMode(mode: UiMode): void {
  localStorage.setItem(STORAGE_KEY, mode);
}

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const isStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches ?? false;
  const isTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isNarrowScreen = window.innerWidth <= 768;
  return isStandalone || (isTouchScreen && isNarrowScreen);
}

export function shouldRedirectToMobile(currentPath: string): boolean {
  if (currentPath.startsWith('/m') || currentPath === '/login') return false;
  const pref = getPreferredUiMode();
  if (pref === 'desktop') return false;
  if (pref === 'mobile') return true;
  return isMobileDevice();
}
```

- [ ] **Step 4: Implement Service Worker & Manifest**

Create `frontend/public/sw.js`:
```javascript
const CACHE_NAME = 'annachill-pwa-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Never cache API requests or WebSocket
  if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Stale while revalidate
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
            }
          })
          .catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request).catch(() => caches.match('/index.html'));
    })
  );
});
```

Create `frontend/public/manifest.webmanifest`:
```json
{
  "name": "AnnaChill Beauty",
  "short_name": "AnnaChill",
  "description": "Quản trị Salon & Spa AnnaChill Beauty",
  "start_url": "/m/dashboard",
  "display": "standalone",
  "background_color": "#f4f6f9",
  "theme_color": "#0062eb",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-192.svg",
      "sizes": "192x192",
      "type": "image/svg+xml",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512.svg",
      "sizes": "512x512",
      "type": "image/svg+xml",
      "purpose": "any maskable"
    }
  ]
}
```

Create `frontend/public/icons/icon-192.svg` & `frontend/public/icons/icon-512.svg` (chứa logo AnnaChill gradient xanh đẹp mắt).

Create `frontend/src/pwa/register-sw.ts`:
```typescript
export function registerServiceWorker() {
  if ('serviceWorker' in navigator && process.env.NODE_ENV !== 'test') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[PWA] Service worker registration failed:', err);
      });
    });
  }
}

export function syncStoreNameWithTitleAndManifest(storeName?: string) {
  if (!storeName) return;
  document.title = `${storeName} - Salon & Spa`;
}
```

- [ ] **Step 5: Run tests and verify PASS**

Run: `cd frontend && npm test src/pwa/device-detect.test.ts`
Expected: PASS

- [ ] **Step 6: Commit PWA foundation**

```bash
git add frontend/public/ frontend/src/pwa/ frontend/index.html frontend/src/main.tsx
git commit -m "feat(pwa): add service worker, dynamic manifest sync and device detection"
```

---

### Task 3: WebSocket React Hook & Real-time POS Client

**Files:**
- Create: `frontend/src/services/websocket.ts`
- Create: `frontend/src/services/usePosSocket.ts`
- Test: `frontend/src/services/websocket.test.ts`

**Interfaces:**
- Produces: `usePosSocket({ onOrderCreated, onAppointmentUpdated })` hook
- Triggers auto query-invalidation for orders, appointments, and dashboard.

- [ ] **Step 1: Write tests for WebSocket hook**

Create `frontend/src/services/websocket.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPosSocketConnection } from './websocket';

describe('createPosSocketConnection', () => {
  it('creates a socket instance and handles event parsing', () => {
    const mockWs = {
      onopen: null as any,
      onmessage: null as any,
      onerror: null as any,
      onclose: null as any,
      send: vi.fn(),
      close: vi.fn(),
    };
    vi.stubGlobal('WebSocket', vi.fn().mockImplementation(() => mockWs));

    const onEvent = vi.fn();
    const conn = createPosSocketConnection(1, onEvent);

    mockWs.onopen();
    expect(conn.isConnected()).toBe(true);

    mockWs.onmessage({ data: JSON.stringify({ event: 'pos:order_created', data: { orderId: 10 } }) });
    expect(onEvent).toHaveBeenCalledWith('pos:order_created', { orderId: 10 });

    conn.disconnect();
    expect(mockWs.close).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test src/services/websocket.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `frontend/src/services/websocket.ts` & `frontend/src/services/usePosSocket.ts`**

Create `frontend/src/services/websocket.ts`:
```typescript
export interface WsEventPayload<T = unknown> {
  event: string;
  data: T;
  timestamp: string;
}

export function createPosSocketConnection(
  branchId: number,
  onEvent: (event: string, data: any) => void
) {
  let ws: WebSocket | null = null;
  let connected = false;
  let reconnectTimer: any = null;
  let shouldReconnect = true;

  function connect() {
    if (typeof window === 'undefined') return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/v1/ws?branchId=${branchId}`;

    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        connected = true;
      };
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as WsEventPayload;
          onEvent(payload.event, payload.data);
        } catch { /* ignore malformed message */ }
      };
      ws.onclose = () => {
        connected = false;
        if (shouldReconnect) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };
      ws.onerror = () => {
        ws?.close();
      };
    } catch {
      if (shouldReconnect) reconnectTimer = setTimeout(connect, 5000);
    }
  }

  connect();

  return {
    isConnected: () => connected,
    disconnect: () => {
      shouldReconnect = false;
      clearTimeout(reconnectTimer);
      ws?.close();
    },
  };
}
```

Create `frontend/src/services/usePosSocket.ts`:
```typescript
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { createPosSocketConnection } from './websocket';

export function usePosSocket() {
  const { account } = useAuth();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    if (!account?.branchId) return;

    const connection = createPosSocketConnection(account.branchId, (event, data) => {
      if (event === 'pos:order_created') {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-charts'] });
        notify(`Hóa đơn mới #${data.code || data.orderId}: ${data.total?.toLocaleString('vi-VN')} đ`, 'info');
      } else if (event === 'pos:appointment_updated') {
        queryClient.invalidateQueries({ queryKey: ['pos-appointments'] });
      }
    });

    setIsOnline(true);
    return () => {
      connection.disconnect();
      setIsOnline(false);
    };
  }, [account?.branchId, queryClient, notify]);

  return { isOnline };
}
```

- [ ] **Step 4: Run tests and verify PASS**

Run: `cd frontend && npm test src/services/websocket.test.ts`
Expected: PASS

- [ ] **Step 5: Commit WebSocket client service**

```bash
git add frontend/src/services/websocket.ts frontend/src/services/websocket.test.ts frontend/src/services/usePosSocket.ts
git commit -m "feat(frontend): add pos websocket connection and query invalidation hook"
```

---

### Task 4: Mobile Shell Layout & Bottom Navigation (`MobileAppLayout`)

**Files:**
- Create: `frontend/src/styles/mobile.css`
- Create: `frontend/src/layouts/MobileAppLayout/MobileAppLayout.tsx`
- Create: `frontend/src/layouts/MobileAppLayout/MobileTopBar.tsx`
- Create: `frontend/src/layouts/MobileAppLayout/MobileBottomNav.tsx`
- Modify: `frontend/src/styles/index.css`
- Test: `frontend/src/layouts/MobileAppLayout/MobileBottomNav.test.tsx`

**Interfaces:**
- Produces: `MobileAppLayout` with Role-based Tab switching:
  - Manager: Dashboard, POS, Orders, Staff, Account
  - Cashier: POS, Orders, Customers, Account
  - Staff: Attendance, Schedule, Salary, Account

- [ ] **Step 1: Write test for Mobile Bottom Navigation**

Create `frontend/src/layouts/MobileAppLayout/MobileBottomNav.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { MobileBottomNav } from './MobileBottomNav';
import * as auth from '@/features/auth/AuthProvider';

describe('MobileBottomNav Component', () => {
  it('renders correct navigation tabs for manager role', () => {
    vi.spyOn(auth, 'useAuth').mockReturnValue({
      account: { id: 1, role: 'manager', displayName: 'Admin', branchId: 1, branchName: 'CN1', staffId: null, staffCode: null, phone: '', email: '', username: 'admin' },
      loading: false, login: vi.fn(), logout: vi.fn(), updateLocalAccount: vi.fn(), switchBranch: vi.fn(),
    });

    render(<MemoryRouter><MobileBottomNav /></MemoryRouter>);
    expect(screen.getByText('Tổng quan')).toBeInTheDocument();
    expect(screen.getByText('Bán hàng')).toBeInTheDocument();
    expect(screen.getByText('Đơn hàng')).toBeInTheDocument();
    expect(screen.getByText('Nhân sự')).toBeInTheDocument();
    expect(screen.getByText('Cài đặt')).toBeInTheDocument();
  });

  it('renders correct navigation tabs for staff role', () => {
    vi.spyOn(auth, 'useAuth').mockReturnValue({
      account: { id: 2, role: 'staff', displayName: 'Thợ', branchId: 1, branchName: 'CN1', staffId: 10, staffCode: 'NV01', phone: '', email: '', username: 'staff1' },
      loading: false, login: vi.fn(), logout: vi.fn(), updateLocalAccount: vi.fn(), switchBranch: vi.fn(),
    });

    render(<MemoryRouter><MobileBottomNav /></MemoryRouter>);
    expect(screen.getByText('Chấm công')).toBeInTheDocument();
    expect(screen.getByText('Lịch làm')).toBeInTheDocument();
    expect(screen.getByText('Lương')).toBeInTheDocument();
    expect(screen.getByText('Tài khoản')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test src/layouts/MobileAppLayout/MobileBottomNav.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `mobile.css` and Mobile Shell Layout**

Create `frontend/src/styles/mobile.css` with responsive mobile tokens, safe area padding, sticky top bar, bottom sheet animations, and touch-optimized buttons.

Create `frontend/src/layouts/MobileAppLayout/MobileTopBar.tsx`:
```tsx
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useMetadata } from '@/services/metadata';
import { usePosSocket } from '@/services/usePosSocket';

export function MobileTopBar() {
  const { account } = useAuth();
  const { data: meta } = useMetadata();
  const { isOnline } = usePosSocket();
  const storeName = meta?.data?.system?.storeName || 'AnnaChill';

  return (
    <header className="mobile-topbar">
      <Link to="/m" className="mobile-brand">
        <span className="brand-mark"><span /><span /></span>
        <span className="mobile-store-title">{storeName}</span>
      </Link>
      <div className="mobile-top-right">
        <span className={`mobile-status-dot ${isOnline ? 'online' : 'offline'}`} title={isOnline ? 'Realtime Online' : 'Offline'} />
        <span className="mobile-branch-tag">{account?.branchName || 'Chi nhánh'}</span>
        <Link to="/m/account" className="mobile-avatar-pill">
          {account?.displayName?.charAt(0).toUpperCase()}
        </Link>
      </div>
    </header>
  );
}
```

Create `frontend/src/layouts/MobileAppLayout/MobileBottomNav.tsx`:
```tsx
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';

export function MobileBottomNav() {
  const { account } = useAuth();
  const role = account?.role;

  if (role === 'staff') {
    return (
      <nav className="mobile-bottom-nav">
        <NavLink to="/m/attendance" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
          <i className="ph ph-qr-code" /><span>Chấm công</span>
        </NavLink>
        <NavLink to="/m/schedule" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
          <i className="ph ph-calendar-check" /><span>Lịch làm</span>
        </NavLink>
        <NavLink to="/m/salary" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
          <i className="ph ph-wallet" /><span>Lương</span>
        </NavLink>
        <NavLink to="/m/account" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
          <i className="ph ph-user-circle" /><span>Tài khoản</span>
        </NavLink>
      </nav>
    );
  }

  if (role === 'cashier') {
    return (
      <nav className="mobile-bottom-nav">
        <NavLink to="/m/pos" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
          <i className="ph ph-shopping-cart" /><span>Bán hàng</span>
        </NavLink>
        <NavLink to="/m/orders" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
          <i className="ph ph-receipt" /><span>Đơn hàng</span>
        </NavLink>
        <NavLink to="/m/customers" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
          <i className="ph ph-users" /><span>Khách hàng</span>
        </NavLink>
        <NavLink to="/m/account" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
          <i className="ph ph-gear" /><span>Tài khoản</span>
        </NavLink>
      </nav>
    );
  }

  // Manager
  return (
    <nav className="mobile-bottom-nav">
      <NavLink to="/m/dashboard" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
        <i className="ph ph-squares-four" /><span>Tổng quan</span>
      </NavLink>
      <NavLink to="/m/pos" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
        <i className="ph ph-shopping-cart" /><span>Bán hàng</span>
      </NavLink>
      <NavLink to="/m/orders" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
        <i className="ph ph-receipt" /><span>Đơn hàng</span>
      </NavLink>
      <NavLink to="/m/staff" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
        <i className="ph ph-users-three" /><span>Nhân sự</span>
      </NavLink>
      <NavLink to="/m/account" className={({ isActive }) => `mobile-nav-item ${isActive ? 'is-active' : ''}`}>
        <i className="ph ph-gear" /><span>Cài đặt</span>
      </NavLink>
    </nav>
  );
}
```

Create `frontend/src/layouts/MobileAppLayout/MobileAppLayout.tsx`:
```tsx
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { AuthLoading } from '@/features/auth/LoginView';
import { MobileTopBar } from './MobileTopBar';
import { MobileBottomNav } from './MobileBottomNav';
import '@/styles/mobile.css';

export function MobileAppLayout() {
  const { account, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AuthLoading />;
  if (!account) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return (
    <div className="mobile-app-shell">
      <MobileTopBar />
      <main className="mobile-main-content">
        <Outlet />
      </main>
      <MobileBottomNav />
    </div>
  );
}
```

- [ ] **Step 4: Run tests and verify PASS**

Run: `cd frontend && npm test src/layouts/MobileAppLayout/MobileBottomNav.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit Mobile Shell layout**

```bash
git add frontend/src/layouts/MobileAppLayout/ frontend/src/styles/mobile.css frontend/src/styles/index.css
git commit -m "feat(frontend): implement mobile app shell layout with topbar and role-based bottom nav"
```

---

### Task 5: Mobile POS Screen (Theo chuẩn thiết kế thực tế)

**Files:**
- Create: `frontend/src/features/mobile-pos/MobilePosView.tsx`
- Create: `frontend/src/features/mobile-pos/MobileCartBottomSheet.tsx`
- Create: `frontend/src/features/mobile-pos/mobile-pos.css`
- Create: `frontend/src/pages/pos/MobilePosPage.tsx`
- Test: `frontend/src/features/mobile-pos/MobilePosView.test.tsx`

**Interfaces:**
- Consumes: `getPosCatalog`, `getPosStaff`, `searchPosCustomers`, `checkoutPosInvoice` from `@/features/pos/pos.api`
- Implements:
  - Header tìm kiếm `"Tìm hàng hóa"`, nút clear, nút sort/view.
  - Category tabs cuộn ngang (*Tất cả, Dịch vụ, Gói DV, Thẻ TK, Sản phẩm*).
  - Sub-category filter *"Tất cả nhóm hàng ▼"*.
  - Grouped Card Item List với icon phân loại, thời lượng/mô tả và giá bán rõ nét.
  - Sticky Cart Bar & Bottom Sheet Checkout hoàn tất thanh toán.

- [ ] **Step 1: Write test for Mobile POS view**

Create `frontend/src/features/mobile-pos/MobilePosView.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MobilePosView } from './MobilePosView';
import * as posApi from '@/features/pos/pos.api';
import * as auth from '@/features/auth/AuthProvider';

describe('MobilePosView Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(auth, 'useAuth').mockReturnValue({
      account: { id: 1, role: 'manager', displayName: 'Manager', branchId: 1, branchName: 'CN1', staffId: null, staffCode: null, phone: '', email: '', username: 'admin' },
      loading: false, login: vi.fn(), logout: vi.fn(), updateLocalAccount: vi.fn(), switchBranch: vi.fn(),
    });
    vi.spyOn(posApi, 'getPosCatalog').mockResolvedValue({
      data: [
        { itemId: 1, itemType: 'package', code: 'RF01', name: 'RF Needle Skinlip 1 buổi', category: 'gói dịch vụ', unit: 'buổi', salePrice: 2500000, stockQuantity: null },
        { itemId: 2, itemType: 'service', code: 'GOI01', name: 'Gội đầu 60k', category: 'dầu gội', unit: 'lần', salePrice: 60000, stockQuantity: null },
      ],
    });
    vi.spyOn(posApi, 'getPosStaff').mockResolvedValue({ data: [] });
  });

  it('renders search bar, category tabs, and grouped item cards correctly', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MobilePosView />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByPlaceholderText('Tìm hàng hóa')).toBeInTheDocument();
    expect(screen.getByText('Tất cả')).toBeInTheDocument();
    expect(screen.getByText('Dịch vụ')).toBeInTheDocument();
    expect(screen.getByText('Gói DV')).toBeInTheDocument();
    expect(screen.getByText('Thẻ TK')).toBeInTheDocument();
    expect(screen.getByText('Sản phẩm')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('RF Needle Skinlip 1 buổi')).toBeInTheDocument();
      expect(screen.getByText('2,500,000')).toBeInTheDocument();
      expect(screen.getByText('Gội đầu 60k')).toBeInTheDocument();
      expect(screen.getByText('60,000')).toBeInTheDocument();
    });
  });

  it('adds item to cart and opens bottom sheet checkout on cart bar click', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MobilePosView />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => screen.getByText('Gội đầu 60k'));
    fireEvent.click(screen.getByText('Gội đầu 60k'));

    expect(screen.getByText(/1 món/i)).toBeInTheDocument();
    expect(screen.getByText(/60,000/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Xem giỏ hàng/i));
    expect(screen.getByText('Chi tiết giỏ hàng & Thanh toán')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test src/features/mobile-pos/MobilePosView.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement Mobile POS View & Cart Bottom Sheet**

Create `frontend/src/features/mobile-pos/mobile-pos.css`:
CSS styles implementing the exact design from the user's reference image (Header with rounded search input, horizontal categories with active blue underline, grouped headers in subtle gray, clean white rounded cards with icons on the left, bold title and description, right-aligned formatted currency, and floating bottom cart bar).

Create `frontend/src/features/mobile-pos/MobileCartBottomSheet.tsx`:
Modal bottom sheet with touch gestures, customer search, technician selector, payment method selector (Cash / VietQR / Bank Transfer), discount input, and checkout action.

Create `frontend/src/features/mobile-pos/MobilePosView.tsx`:
Main component rendering the search bar, category filter pills, group categories dropdown, grouped items list, and bottom cart bar.

Create `frontend/src/pages/pos/MobilePosPage.tsx`.

- [ ] **Step 4: Run tests and verify PASS**

Run: `cd frontend && npm test src/features/mobile-pos/MobilePosView.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit Mobile POS screen**

```bash
git add frontend/src/features/mobile-pos/ frontend/src/pages/pos/MobilePosPage.tsx
git commit -m "feat(mobile): add mobile pos screen matching reference ui with grouped item list and bottom cart sheet"
```

---

### Task 6: Mobile Attendance, Dashboard, Orders, Staff & Account Screens

**Files:**
- Create: `frontend/src/features/mobile-dashboard/MobileDashboardView.tsx`
- Create: `frontend/src/features/mobile-orders/MobileOrdersView.tsx`
- Create: `frontend/src/features/mobile-staff/MobileStaffManagementView.tsx`
- Create: `frontend/src/features/mobile-staff/MobileStaffScheduleView.tsx`
- Create: `frontend/src/features/mobile-staff/MobileStaffSalaryView.tsx`
- Create: `frontend/src/features/mobile-account/MobileAccountView.tsx`
- Create corresponding pages in `frontend/src/pages/`
- Test: `frontend/src/features/mobile-dashboard/MobileDashboardView.test.tsx`

**Interfaces:**
- Connects existing TanStack Query APIs (`getDashboardStats`, `getOrders`, `getStaff`, `getMyAttendance`, `getSchedule`, `getPayroll`) to touch-optimized card views.

- [ ] **Step 1: Write test for Mobile Dashboard view**

Create `frontend/src/features/mobile-dashboard/MobileDashboardView.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MobileDashboardView } from './MobileDashboardView';
import * as dashApi from '@/features/dashboard/dashboard.api';

describe('MobileDashboardView Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(dashApi, 'getDashboardStats').mockResolvedValue({
      data: {
        revenue: 15500000,
        netRevenue: 14200000,
        completedOrders: 12,
        newCustomers: 4,
        occupancyRate: 85,
        dailyTarget: 20000000,
      } as any,
    });
    vi.spyOn(dashApi, 'getDashboardCharts').mockResolvedValue({ data: [] as any });
  });

  it('renders KPI revenue cards and quick metric list', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><MobileDashboardView /></MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Doanh thu hôm nay')).toBeInTheDocument();
      expect(screen.getByText(/15,500,000/i)).toBeInTheDocument();
      expect(screen.getByText('12 đơn')).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test src/features/mobile-dashboard/MobileDashboardView.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement Mobile Views (Dashboard, Orders, Staff, Schedule, Salary, Account)**

Implement:
- `MobileDashboardView.tsx`: Touch-friendly KPI metrics, quick status cards, and top services list.
- `MobileOrdersView.tsx`: Filterable orders list with search, status badges, and expandable order detail sheet.
- `MobileStaffManagementView.tsx`: Quick attendance monitor and staff shifts view for managers.
- `MobileStaffScheduleView.tsx`: Week-by-week shift calendar cards for staff.
- `MobileStaffSalaryView.tsx`: Net salary calculation, commission breakdown, and daily shift hours summary.
- `MobileAccountView.tsx`: User profile, switch branch modal, toggle desktop/mobile interface preference, and logout.

- [ ] **Step 4: Run tests and verify PASS**

Run: `cd frontend && npm test src/features/mobile-dashboard/MobileDashboardView.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit mobile feature views**

```bash
git add frontend/src/features/mobile-dashboard/ frontend/src/features/mobile-orders/ frontend/src/features/mobile-staff/ frontend/src/features/mobile-account/
git commit -m "feat(mobile): add mobile views for dashboard, orders, staff schedule, salary and account"
```

---

### Task 7: Router Integration & Device Auto-Redirect

**Files:**
- Modify: `frontend/src/app/router.tsx`
- Modify: `frontend/src/features/auth/authorization.ts`
- Modify: `frontend/src/features/auth/AuthProvider.tsx`
- Test: `frontend/src/app/router.test.tsx`

**Interfaces:**
- Bổ sung cụm route `/m` vào `router.tsx` với lazy-loaded pages.
- Tự động điều hướng thiết bị di động sang `/m/*` dựa theo role và quyền hạn.

- [ ] **Step 1: Write test for Mobile Routes authorization and routing**

Create `frontend/src/app/router.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { canAccessPath, homeForRole } from '@/features/auth/authorization';

describe('Role Authorization for Mobile Routes', () => {
  it('allows manager to access all mobile routes', () => {
    expect(canAccessPath('manager', '/m/dashboard')).toBe(true);
    expect(canAccessPath('manager', '/m/pos')).toBe(true);
    expect(canAccessPath('manager', '/m/staff')).toBe(true);
  });

  it('restricts staff to mobile attendance, schedule and salary', () => {
    expect(canAccessPath('staff', '/m/attendance')).toBe(true);
    expect(canAccessPath('staff', '/m/schedule')).toBe(true);
    expect(canAccessPath('staff', '/m/salary')).toBe(true);
    expect(canAccessPath('staff', '/m/dashboard')).toBe(false);
    expect(canAccessPath('staff', '/m/pos')).toBe(false);
  });

  it('determines correct home path for role in mobile mode', () => {
    expect(homeForRole('manager', true)).toBe('/m/dashboard');
    expect(homeForRole('cashier', true)).toBe('/m/pos');
    expect(homeForRole('staff', true)).toBe('/m/attendance');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test src/app/router.test.tsx`
Expected: FAIL

- [ ] **Step 3: Update `authorization.ts` and `router.tsx`**

Update `frontend/src/features/auth/authorization.ts` to support mobile path matching and permission checks.
Update `frontend/src/app/router.tsx` with `/m` children and `MobileAppLayout`.

- [ ] **Step 4: Run tests and verify PASS**

Run: `cd frontend && npm test src/app/router.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit router integration**

```bash
git add frontend/src/app/router.tsx frontend/src/features/auth/authorization.ts frontend/src/app/router.test.tsx
git commit -m "feat(routing): integrate /m mobile pwa routes with role permissions and auto-redirect"
```

---

### Task 8: Full Verification, Regression Testing & Build Validation

**Files:**
- Test all backend and frontend suites: `cd backend && node --test` and `cd frontend && npm test`
- Build frontend: `cd frontend && npm run build`

- [ ] **Step 1: Run complete backend tests**

Run: `cd backend && node --test`
Expected: All backend unit & integration tests PASS.

- [ ] **Step 2: Run complete frontend tests**

Run: `cd frontend && npm test`
Expected: All 55+ tests PASS.

- [ ] **Step 3: Run frontend production build check**

Run: `cd frontend && npm run build`
Expected: TypeScript check passes with 0 errors and Vite production bundle generated cleanly in `dist/`.

- [ ] **Step 4: Commit and finalize**

```bash
git add .
git commit -m "chore: complete mobile pwa verification and build validations"
```
