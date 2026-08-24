export interface WsEventPayload<T = unknown> {
  version?: number;
  event: string;
  data: T;
  timestamp?: string;
}

export function createPosSocketConnection(
  onEvent: (event: string, data: unknown) => void,
  onConnectionChange: (isConnected: boolean) => void = () => {},
) {
  let ws: WebSocket | null = null;
  let connected = false;
  let reconnectTimer: any = null;
  let shouldReconnect = true;

  const setConnected = (next: boolean) => {
    if (connected === next) return;
    connected = next;
    onConnectionChange(connected);
  };

  const clearReconnectTimer = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const scheduleReconnect = (delay = 3000) => {
    clearReconnectTimer();
    if (shouldReconnect) reconnectTimer = setTimeout(connect, delay);
  };

  function connect() {
    if (typeof window === 'undefined') return;
    clearReconnectTimer();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/v1/ws`;

    try {
      const socket = new WebSocket(wsUrl);
      ws = socket;
      socket.onopen = () => {
        if (ws !== socket) return;
        setConnected(true);
      };
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as WsEventPayload;
          if (payload && payload.event) {
            onEvent(payload.event, payload.data);
          }
        } catch {
          /* ignore malformed message */
        }
      };
      socket.onclose = () => {
        if (ws !== socket) return;
        setConnected(false);
        scheduleReconnect();
      };
      socket.onerror = () => {
        socket.close();
      };
    } catch {
      setConnected(false);
      scheduleReconnect(5000);
    }
  }

  connect();

  return {
    isConnected: () => connected,
    disconnect: () => {
      shouldReconnect = false;
      clearReconnectTimer();
      const socket = ws;
      ws = null;
      setConnected(false);
      socket?.close();
    },
    reconnect: () => {
      shouldReconnect = true;
      clearReconnectTimer();
      const socket = ws;
      ws = null;
      setConnected(false);
      socket?.close();
      connect();
    },
  };
}
