import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { API_UNAUTHORIZED_EVENT, apiRequest } from '@/services/api-client';
import type { AccountRole } from './authorization';

export type { AccountRole } from './authorization';
export interface AuthAccount {
  id: number;
  branchId: number;
  staffId: number | null;
  username: string;
  displayName: string;
  role: AccountRole;
  branchName: string;
  staffCode: string | null;
  phone: string;
  email: string;
}

interface AuthContextValue {
  account: AuthAccount | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<AuthAccount>;
  logout: () => Promise<void>;
  updateLocalAccount: (account: AuthAccount) => void;
  switchBranch: (branchId: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function clearSensitiveBrowserState() {
  window.localStorage.removeItem('annachill-pos-drafts-v1');
  Object.keys(window.sessionStorage)
    .filter((key) => key.startsWith('annachill-pos-drafts-v2:'))
    .forEach((key) => window.sessionStorage.removeItem(key));
}

export { homeForRole } from './authorization';

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [account, setAccount] = useState<AuthAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const clearUnauthorizedSession = () => {
      clearSensitiveBrowserState();
      queryClient.clear();
      setAccount(null);
    };
    window.addEventListener(API_UNAUTHORIZED_EVENT, clearUnauthorizedSession);
    apiRequest<{ data: AuthAccount }>('/auth/me')
      .then((payload) => setAccount(payload.data))
      .catch(clearUnauthorizedSession)
      .finally(() => setLoading(false));
    return () => window.removeEventListener(API_UNAUTHORIZED_EVENT, clearUnauthorizedSession);
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(() => ({
    account,
    loading,
    login: async (username, password) => {
      const payload = await apiRequest<{ data: AuthAccount }>('/auth/login', {
        method: 'POST', body: JSON.stringify({ username, password }),
      });
      queryClient.clear();
      setAccount(payload.data);
      return payload.data;
    },
    logout: async () => {
      try { await apiRequest('/auth/logout', { method: 'POST' }); } finally { clearSensitiveBrowserState(); queryClient.clear(); setAccount(null); }
    },
    updateLocalAccount: setAccount,
    switchBranch: async (branchId) => {
      const payload = await apiRequest<{ data: AuthAccount }>('/auth/me/branch', { method: 'PUT', body: JSON.stringify({ branchId }) });
      queryClient.clear();
      setAccount(payload.data);
    },
  }), [account, loading, queryClient]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
