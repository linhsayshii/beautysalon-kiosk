export interface WsEventPayload<T = unknown> {
  event: string;
  data: T;
  timestamp?: string;
}

export function createPosSocketConnection(
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
    const wsUrl = `${protocol}//${host}/api/v1/ws`;

    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        connected = true;
      };
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as WsEventPayload;
          if (payload && payload.event) {
            onEvent(payload.event, payload.data);
          }
        } catch {
          /* ignore malformed message */
        }
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
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    },
  };
}
