import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type PropsWithChildren, useEffect } from 'react';
import { DrawerProvider } from '@/components/ui/Drawer/DrawerProvider';
import { ToastProvider } from '@/components/ui/Toast/ToastProvider';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { syncStoreNameWithTitleAndManifest } from '@/pwa/register-sw';
import { useMetadata } from '@/services/metadata';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

function StoreTitleSync() {
  const { data: metadata } = useMetadata();
  const storeName = metadata?.data?.system?.storeName;

  useEffect(() => {
    if (storeName) {
      syncStoreNameWithTitleAndManifest(storeName);
    }
  }, [storeName]);

  return null;
}

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <StoreTitleSync />
      <AuthProvider>
        <ToastProvider>
          <DrawerProvider>{children}</DrawerProvider>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

