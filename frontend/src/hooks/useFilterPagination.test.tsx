import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useFilterPagination } from './useFilterPagination';

it('resets the page even when returning to a previously selected filter', () => {
  const { result, rerender } = renderHook(({ filter }) => useFilterPagination([filter]), { initialProps: { filter: 'A' } });
  act(() => result.current[1](2));
  expect(result.current[0]).toBe(2);
  rerender({ filter: 'B' });
  expect(result.current[0]).toBe(1);
  rerender({ filter: 'A' });
  expect(result.current[0]).toBe(1);
});
