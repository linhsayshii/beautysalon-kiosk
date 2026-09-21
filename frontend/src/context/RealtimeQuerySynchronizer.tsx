import { useEffect } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useWebSocket } from '@/hooks/useWebSocket';

const appointmentEvents = new Set([
  'appointment:created',
  'appointment:updated',
]);

const invoiceEvents = new Set([
  'invoice:created',
  'invoice:updated',
  'invoice:paid',
]);

const customerValueEvents = new Set([
  'customer-package:created',
  'customer-package:updated',
  'customer-account-card:created',
  'customer-account-card:updated',
]);

const notificationEvents = new Set(['notification:created']);

const appointmentQueryKeys = [
  ['appointment-editor'],
  ['pos-appointments'],
  ['my-work-items'],
  ['pos-invoice'],
  ['pos-payment-requests'],
  ['orders'],
  ['mobile-orders'],
  ['order'],
  ['mobile-order-detail'],
  ['dashboard'],
] as const;

const invoiceQueryKeys = [
  ['customer-debt'],
  ['customer-activity'],
  ['mobile-customer-activity'],
  ['pos-customer-search'],
  ...appointmentQueryKeys,
  ['pos-catalog'],
  ['pos-customers'],
  ['customers'],
  ['mobile-customers'],
  ['customer'],
  ['mobile-customer-detail'],
  ['staff-commissions'],
  ['admin-mobile-commissions'],
] as const;

const customerValueQueryKeys = [
  ['customer-cards'],
  ['customer-card'],
  ['mobile-customer-cards'],
  ['mobile-customer-card-detail'],
  ['pos-customer-service-packages'],
  ['pos-customer-available-packages'],
  ['pos-catalog'],
  ['pos-customers'],
  ['customers'],
  ['mobile-customers'],
  ['customer'],
  ['mobile-customer-detail'],
] as const;

function invalidate(queryClient: QueryClient, keys: readonly (readonly unknown[])[]) {
  const invalidated = new Set<string>();
  keys.forEach((queryKey) => {
    const identifier = JSON.stringify(queryKey);
    if (invalidated.has(identifier)) return;
    invalidated.add(identifier);
    void queryClient.invalidateQueries({ queryKey });
  });
}

/**
 * Maps the versioned backend event contract to existing React Query caches.
 * Receiving a duplicate event only causes a safe revalidation of authorised
 * HTTP data, keeping the WebSocket transport out of the source-of-truth path.
 */
export function synchronizeRealtimeEvent(queryClient: QueryClient, event: string) {
  if (appointmentEvents.has(event)) {
    invalidate(queryClient, appointmentQueryKeys);
    return;
  }
  if (invoiceEvents.has(event)) {
    invalidate(queryClient, invoiceQueryKeys);
    return;
  }
  if (customerValueEvents.has(event)) {
    invalidate(queryClient, customerValueQueryKeys);
    return;
  }
  if (notificationEvents.has(event)) {
    invalidate(queryClient, [['notifications']]);
  }
}

export function resynchronizeRealtimeQueries(queryClient: QueryClient) {
  invalidate(queryClient, [...appointmentQueryKeys, ...invoiceQueryKeys, ...customerValueQueryKeys, ['notifications']]);
}

/**
 * One listener covers desktop and mobile. A successful reconnect also
 * revalidates current queries, healing events missed while offline.
 */
export function RealtimeQuerySynchronizer() {
  const queryClient = useQueryClient();
  const { isConnected, subscribe } = useWebSocket();

  useEffect(() => subscribe('*', (event) => {
    synchronizeRealtimeEvent(queryClient, event);
  }), [queryClient, subscribe]);

  useEffect(() => {
    if (isConnected) resynchronizeRealtimeQueries(queryClient);
  }, [isConnected, queryClient]);

  return null;
}
