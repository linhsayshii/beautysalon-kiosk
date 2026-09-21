import { useQuery } from '@tanstack/react-query';
import { getProducts } from './inventory.api';

export function usePurchaseProductSearch(search: string) {
  const keyword = search.trim();
  return useQuery({
    queryKey: ['purchase-catalog', keyword],
    queryFn: ({ signal }) => getProducts({ type: 'product', status: 'active', search: keyword, page: 1, pageSize: 8 }, { signal }),
    enabled: keyword.length > 0,
  });
}
