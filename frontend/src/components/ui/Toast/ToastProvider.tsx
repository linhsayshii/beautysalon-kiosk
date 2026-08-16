import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';

interface ToastMessage { title: string; message: string }
interface ToastContextValue { notify: (title: string, message: string) => void }

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timer = useRef<number | null>(null);
  const close = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    setToast(null);
  }, []);
  const notify = useCallback((title: string, message: string) => {
    if (timer.current) window.clearTimeout(timer.current);
    setToast({ title, message });
    timer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);
  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={`toast ${toast ? 'is-visible' : ''}`} role="status" aria-live="polite" aria-atomic="true">
        <span className="toast-icon"><i className="ph ph-info" aria-hidden="true" /></span>
        <span><strong>{toast?.title ?? 'Thông báo'}</strong><small>{toast?.message ?? ''}</small></span>
        <button type="button" aria-label="Đóng thông báo" onClick={close}><i className="ph ph-x" aria-hidden="true" /></button>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
