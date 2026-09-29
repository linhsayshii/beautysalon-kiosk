import { afterEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/services/api-client';
import { findPosItemsByBarcode } from './pos.api';

describe('findPosItemsByBarcode', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns only items whose barcode or code matches exactly', async () => {
    const request = vi.spyOn(apiClient, 'apiRequest').mockResolvedValue({
      data: [
        { itemType: 'product', itemId: 2, code: 'SP000002', barcode: '89312345678901', name: 'Toner mini' },
        { itemType: 'product', itemId: 1, code: 'SP000001', barcode: '8931234567890', name: 'Toner' },
      ],
      meta: {},
    });

    await expect(findPosItemsByBarcode(' 8931234567890 ', 7)).resolves.toMatchObject([{ itemId: 1 }]);
    expect(request).toHaveBeenCalledWith('/pos/catalog?search=8931234567890&type=&page=1&pageSize=100&customerId=7');
    await expect(findPosItemsByBarcode('sp000002')).resolves.toMatchObject([{ itemId: 2 }]);
    await expect(findPosItemsByBarcode('893123')).resolves.toEqual([]);
  });

  it('returns every item when imported data reuses one code', async () => {
    vi.spyOn(apiClient, 'apiRequest').mockResolvedValue({
      data: [
        { itemType: 'product', itemId: 1, code: 'SP000316', barcode: '6947991205424', name: 'Mặt nạ Chando' },
        { itemType: 'product', itemId: 2, code: '6947991205424', barcode: '', name: 'Mặt nạ Chando' },
      ],
      meta: {},
    });
    await expect(findPosItemsByBarcode('6947991205424')).resolves.toHaveLength(2);
  });

  it('does not call the API for a blank code', async () => {
    const request = vi.spyOn(apiClient, 'apiRequest');
    await expect(findPosItemsByBarcode('   ')).resolves.toEqual([]);
    expect(request).not.toHaveBeenCalled();
  });
});
