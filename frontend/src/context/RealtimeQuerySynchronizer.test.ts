import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { resynchronizeRealtimeQueries, synchronizeRealtimeEvent } from './RealtimeQuerySynchronizer';

function invalidatedKeys(invalidateQueries: ReturnType<typeof vi.fn>) {
  return invalidateQueries.mock.calls.map(([filters]) => filters.queryKey);
}

describe('realtime query synchronization', () => {
  it('refreshes both appointment and invoice views when an appointment changes', () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();

    synchronizeRealtimeEvent(queryClient, 'appointment:updated');

    expect(invalidatedKeys(invalidateQueries)).toEqual(expect.arrayContaining([
      ['pos-appointments'],
      ['my-work-items'],
      ['pos-invoice'],
      ['orders'],
      ['mobile-orders'],
      ['dashboard'],
    ]));
  });

  it('refreshes package/card lists and POS package choices after customer value changes', () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();

    synchronizeRealtimeEvent(queryClient, 'customer-account-card:updated');

    expect(invalidatedKeys(invalidateQueries)).toEqual(expect.arrayContaining([
      ['customer-cards'],
      ['mobile-customer-cards'],
      ['customer-card'],
      ['mobile-customer-card-detail'],
      ['pos-customer-service-packages'],
      ['pos-customer-available-packages'],
    ]));
  });

  it('revalidates live data once when the socket reconnects', () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();

    resynchronizeRealtimeQueries(queryClient);

    const keys = invalidatedKeys(invalidateQueries).map((key) => JSON.stringify(key));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain(JSON.stringify(['pos-appointments']));
    expect(keys).toContain(JSON.stringify(['customer-cards']));
  });
});
