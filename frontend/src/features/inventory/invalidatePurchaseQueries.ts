import { inventoryQueryKeys } from './invalidateInventoryQueries';
import type { QueryClient } from '@tanstack/react-query';

export function invalidatePurchaseQueries(client: QueryClient) {
  return Promise.all([
    ...inventoryQueryKeys, 'purchase-orders', 'mobile-purchase-orders', 'purchase-order', 'mobile-purchase-order-detail',
    'cashbook', 'mobile-cashbook', 'cashbook-summary', 'profit-report', 'dashboard',
  ].map(key => client.invalidateQueries({ queryKey: [key] })));
}
