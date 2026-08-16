import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { DrawerProvider } from '@/components/ui/Drawer/DrawerProvider';
import { ToastProvider } from '@/components/ui/Toast/ToastProvider';
import { AuthProvider } from '@/features/auth/AuthProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <DrawerProvider>{children}</DrawerProvider>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
