import { describe, expect, it } from 'vitest';
import { expectedLineCommission } from './commission';

const service = {
  itemType: 'service',
  quantity: 2,
  unitPrice: 1000000,
  staffId: 1,
  consultantStaffId: 2,
  commissionType: 'percent' as const,
  commissionRate: 0.1,
  tourCommissionType: 'fixed' as const,
  tourCommissionRate: 50000,
};

describe('expectedLineCommission', () => {
  it('splits a service into tour for the performer and consulting for the consultant', () => {
    expect(expectedLineCommission(service)).toEqual({ tour: 100000, consulting: 200000, total: 300000 });
  });

  it('pays no original commission without a consultant and no tour without a performer', () => {
    expect(expectedLineCommission({ ...service, consultantStaffId: null })).toEqual({ tour: 100000, consulting: 0, total: 100000 });
    expect(expectedLineCommission({ ...service, staffId: null })).toEqual({ tour: 0, consulting: 200000, total: 200000 });
  });

  it('takes a percent tour on a package session from the list price', () => {
    expect(expectedLineCommission({
      ...service, unitPrice: 0, listPrice: 400000, isPackageRedemption: true, tourCommissionType: 'percent', tourCommissionRate: 0.05,
    })).toEqual({ tour: 40000, consulting: 0, total: 40000 });
  });

  it('pays a product seller the original commission', () => {
    expect(expectedLineCommission({
      itemType: 'product', quantity: 2, unitPrice: 150000, staffId: 3, commissionType: 'fixed', commissionRate: 20000,
    })).toEqual({ tour: 0, consulting: 40000, total: 40000 });
  });
});
