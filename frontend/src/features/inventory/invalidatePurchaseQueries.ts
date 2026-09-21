import type { QueryClient } from '@tanstack/react-query';

export function invalidatePurchaseQueries(client: QueryClient) {
  return Promise.all([
    'purchase-orders', 'mobile-purchase-orders', 'products', 'mobile-products',
    'inventory-item', 'purchase-catalog', 'pos-catalog',
  ].map(key => client.invalidateQueries({ queryKey: [key] })));
}
