import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { createPosSocketConnection } from './websocket';

export function usePosSocket() {
  const { account } = useAuth();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    if (!account?.branchId) return;

    const connection = createPosSocketConnection((event, data) => {
      if (event === 'pos:order_created') {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-charts'] });
        const orderLabel = data?.code || (data?.orderId ? `#${data.orderId}` : 'mới');
        const totalText = typeof data?.total === 'number' ? `: ${data.total.toLocaleString('vi-VN')} đ` : '';
        notify('Đơn hàng mới', `Hóa đơn ${orderLabel}${totalText}`);
      } else if (event === 'pos:appointment_updated') {
        queryClient.invalidateQueries({ queryKey: ['pos-appointments'] });
      }
    });

    setIsOnline(true);
    return () => {
      connection.disconnect();
      setIsOnline(false);
    };
  }, [account?.branchId, queryClient, notify]);

  return { isOnline };
}
