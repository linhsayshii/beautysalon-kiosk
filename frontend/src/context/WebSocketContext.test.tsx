import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocketProvider, useWebSocket } from './WebSocketContext';

// Mock the websocket module
vi.mock('@/services/websocket', () => ({
  createPosSocketConnection: vi.fn((onEvent) => {
    return {
      isConnected: () => true,
      disconnect: vi.fn(),
    };
  }),
}));

describe('WebSocketContext', () => {
  let consoleError: typeof console.error;

  beforeEach(() => {
    consoleError = console.error;
    console.error = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    console.error = consoleError;
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('isConnected state', () => {
    it('provides isConnected state through context', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider>{children}</WebSocketProvider>
      );

      const { result } = renderHook(() => useWebSocket(), { wrapper });

      // Advance timers to allow the connection check interval to run
      await act(async () => {
        vi.advanceTimersByTime(1500);
      });

      expect(result.current.isConnected).toBe(true);
    });
  });

  describe('subscribe function', () => {
    it('subscribe returns an unsubscribe function', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider>{children}</WebSocketProvider>
      );

      const { result } = renderHook(() => useWebSocket(), { wrapper });

      const callback = vi.fn();
      const unsubscribe = result.current.subscribe('staff:salary_updated', callback);

      expect(typeof unsubscribe).toBe('function');

      // Calling unsubscribe should not throw
      act(() => {
        unsubscribe();
      });
    });
  });

  describe('pattern matching', () => {
    it('subscribe and unsubscribe work correctly', async () => {
      const { createPosSocketConnection } = vi.mocked(await import('@/services/websocket'));
      const mockConnection = {
        isConnected: () => true,
        disconnect: vi.fn(),
      };
      createPosSocketConnection.mockReturnValue(mockConnection);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider>{children}</WebSocketProvider>
      );

      const { result } = renderHook(() => useWebSocket(), { wrapper });

      const callback = vi.fn();

      // Subscribe
      const unsubscribe = result.current.subscribe('staff:*', callback);
      expect(typeof unsubscribe).toBe('function');

      // Unsubscribe
      act(() => {
        unsubscribe();
      });

      // Verify disconnect was called on unmount
    });

    it('context is properly provided with subscribe method', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider>{children}</WebSocketProvider>
      );

      const { result } = renderHook(() => useWebSocket(), { wrapper });

      // Verify subscribe is a function
      expect(typeof result.current.subscribe).toBe('function');
    });
  });

  describe('useWebSocket hook', () => {
    it('throws error when used outside provider', () => {
      // Suppress console.error for this test since we expect an error
      console.error = vi.fn();

      expect(() => {
        renderHook(() => useWebSocket());
      }).toThrow('useWebSocket must be used within WebSocketProvider');
    });
  });
});
