import { QueryClient } from '@tanstack/react-query';
import { expect, it } from 'vitest';
import { invalidatePurchaseQueries } from './invalidatePurchaseQueries';
it('marks cached purchase lists and stock-dependent catalogs stale', async () => {
  const client = new QueryClient();
  const keys = [['purchase-orders', { page: 2 }], ['mobile-purchase-orders', 1], ['products'], ['mobile-products'], ['purchase-catalog', 'SP101'], ['pos-catalog'], ['inventory-item', 'product', 101]];
  keys.forEach(key => client.setQueryData(key, { old: true }));
  await invalidatePurchaseQueries(client);
  keys.forEach(key => expect(client.getQueryState(key)?.isInvalidated).toBe(true));
});
