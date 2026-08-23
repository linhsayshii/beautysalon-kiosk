import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { createPosSocketConnection } from '@/services/websocket';

interface WebSocketContextValue {
  isConnected: boolean;
  subscribe: <T = unknown>(
    pattern: string | string[],
    callback: (event: string, data: T) => void
  ) => () => void;
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

  useEffect(() => {
    const connection = createPosSocketConnection((event, data) => {
      subscribersRef.current.forEach((callbacks, pattern) => {
        if (matchPattern(pattern, event)) {
          callbacks.forEach(cb => cb(event, data));
        }
      });
    });

    // Connection status tracked via the factory
    const checkInterval = setInterval(() => {
      setIsConnected(connection.isConnected());
    }, 1000);

    return () => {
      connection.disconnect();
      clearInterval(checkInterval);
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

  return (
    <WebSocketContext.Provider value={{ isConnected, subscribe }}>
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
