import type { QueryClient } from '@tanstack/react-query';

export const inventoryQueryKeys = [
  'products', 'mobile-products', 'inventory-item', 'pricebooks', 'mobile-pricebooks',
  'pricebook-detail', 'purchase-catalog', 'goods-create-catalog', 'pos-catalog', 'pos-price-quote',
] as const;

export function invalidateInventoryQueries(client: QueryClient) {
  return Promise.all(inventoryQueryKeys.map(key => client.invalidateQueries({ queryKey: [key] })));
}
