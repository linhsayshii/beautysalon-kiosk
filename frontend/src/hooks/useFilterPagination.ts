import { useState } from 'react';

/** Keep page selection scoped to the exact filter, including the sort order. */
export function useFilterPagination(filters: readonly unknown[]) {
  const key = JSON.stringify(filters);
  const [selection, setSelection] = useState({ key, page: 1 });
  if (selection.key !== key) setSelection({ key, page: 1 });
  const page = selection.key === key ? selection.page : 1;
  return [page, (next: number) => setSelection({ key, page: next })] as const;
}
