import { afterEach, expect, it, vi } from 'vitest';
import * as apiClient from '@/services/api-client';
import { getInventoryCatalog } from './inventory.api';

afterEach(() => vi.restoreAllMocks());

it('loads every catalogue page while preserving the item type and status filters', async () => {
  const request = vi.spyOn(apiClient, 'apiRequest').mockImplementation(async (path) => {
    const page = Number(new URL(String(path), 'http://localhost').searchParams.get('page'));
    return { data: [{ itemId: page, code: `SP${page}` }], meta: { pagination: { page, totalPages: 3 } } };
  });
  await expect(getInventoryCatalog({ type: 'service', status: 'active' })).resolves.toMatchObject({
    data: [{ itemId: 1 }, { itemId: 2 }, { itemId: 3 }],
  });
  expect(request).toHaveBeenCalledTimes(3);
  for (const [path] of request.mock.calls) {
    const params = new URL(String(path), 'http://localhost').searchParams;
    expect(params.get('type')).toBe('service');
    expect(params.get('status')).toBe('active');
  }
});

it('rejects an incomplete catalogue instead of presenting partial choices as complete', async () => {
  vi.spyOn(apiClient, 'apiRequest')
    .mockResolvedValueOnce({ data: [{ itemId: 1 }], meta: { pagination: { totalPages: 2 } } })
    .mockRejectedValueOnce(new Error('Mất kết nối'));
  await expect(getInventoryCatalog({ status: 'active' })).rejects.toThrow('Mất kết nối');
});
