import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { createPosSocketConnection } from '@/services/websocket';

interface WebSocketContextValue {
  isConnected: boolean;
  subscribe: <T = unknown>(
    pattern: string | string[],
    callback: (event: string, data: T) => void
  ) => () => void;
  reconnect: () => void;
  disconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

function matchPattern(pattern: string, event: string): boolean {
  if (pattern === '*') return true;
  if (pattern === event) return true;
  const [pEntity, pAction] = pattern.split(':');
  const [eEntity] = event.split(':');
  if (pAction === '*') return pEntity === eEntity;
  return false;
}

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const subscribersRef = useRef<Map<string, Set<(event: string, data: any) => void>>>(new Map());
  const connectionRef = useRef<ReturnType<typeof createPosSocketConnection> | null>(null);

  useEffect(() => {
    const connection = createPosSocketConnection((event, data) => {
      subscribersRef.current.forEach((callbacks, pattern) => {
        if (matchPattern(pattern, event)) {
          callbacks.forEach(cb => cb(event, data));
        }
      });
    }, setIsConnected);
    connectionRef.current = connection;

    return () => {
      connectionRef.current = null;
      connection.disconnect();
    };
  }, []);

  const subscribe = useCallback(<T,>(
    pattern: string | string[],
    callback: (event: string, data: T) => void
  ) => {
    const patterns = Array.isArray(pattern) ? pattern : [pattern];

    patterns.forEach(p => {
      if (!subscribersRef.current.has(p)) {
        subscribersRef.current.set(p, new Set());
      }
      subscribersRef.current.get(p)!.add(callback as (event: string, data: any) => void);
    });

    return () => {
      patterns.forEach(p => {
        const set = subscribersRef.current.get(p);
        if (set) {
          set.delete(callback as (event: string, data: any) => void);
          if (set.size === 0) subscribersRef.current.delete(p);
        }
      });
    };
  }, []);

  const reconnect = useCallback(() => {
    connectionRef.current?.reconnect();
  }, []);

  const disconnect = useCallback(() => {
    connectionRef.current?.disconnect();
  }, []);

  return (
    <WebSocketContext.Provider value={{ isConnected, subscribe, reconnect, disconnect }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
}
