import { describe, it, expect, vi } from 'vitest';
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
    const conn = createPosSocketConnection(onEvent);

    mockWs.onopen();
    expect(conn.isConnected()).toBe(true);

    mockWs.onmessage({ data: JSON.stringify({ event: 'pos:order_created', data: { orderId: 10 } }) });
    expect(onEvent).toHaveBeenCalledWith('pos:order_created', { orderId: 10 });

    conn.disconnect();
    expect(mockWs.close).toHaveBeenCalled();
  });

  it('reports connection changes and reconnects with a fresh socket', () => {
    const sockets: Array<Record<string, any>> = [];
    vi.stubGlobal('WebSocket', vi.fn().mockImplementation(() => {
      const socket = { onopen: null, onmessage: null, onerror: null, onclose: null, close: vi.fn() };
      sockets.push(socket);
      return socket;
    }));
    const onConnectionChange = vi.fn();
    const conn = createPosSocketConnection(vi.fn(), onConnectionChange);

    sockets[0].onopen();
    expect(conn.isConnected()).toBe(true);
    expect(onConnectionChange).toHaveBeenLastCalledWith(true);

    conn.reconnect();
    expect(sockets[0].close).toHaveBeenCalled();
    expect(sockets).toHaveLength(2);
    sockets[0].onclose();
    expect(sockets).toHaveLength(2);

    sockets[1].onopen();
    conn.disconnect();
    expect(onConnectionChange).toHaveBeenLastCalledWith(false);
  });
});
