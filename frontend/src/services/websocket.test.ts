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
