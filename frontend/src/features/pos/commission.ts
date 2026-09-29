type CommissionType = 'percent' | 'fixed' | null | undefined;

export interface CommissionLine {
  itemType: string;
  quantity: number;
  /** Unit price on this invoice line (0 for a package session). */
  unitPrice: number;
  /** Catalog price of the service, used for a percent tour on a package session. */
  listPrice?: number;
  isPackageRedemption?: boolean;
  staffId?: number | null;
  consultantStaffId?: number | null;
  /** Rates are fractions for percent (0.1 = 10%) and dong for fixed. */
  commissionType?: CommissionType;
  commissionRate?: number;
  tourCommissionType?: CommissionType;
  tourCommissionRate?: number;
}

export interface ExpectedCommission {
  /** Tour commission for the performer (staffId) of a service. */
  tour: number;
  /** Original commission: the consultant of a service, or the seller of a product. */
  consulting: number;
  total: number;
}

const amountFor = (type: CommissionType, rate = 0, revenue: number, quantity: number) => {
  if (type === 'percent') return Math.round(revenue * rate);
  if (type === 'fixed') return quantity * rate;
  return 0;
};

/** Mirrors backend/src/modules/pos/commission-entries.js so the cart shows what checkout records. */
export function expectedLineCommission(line: CommissionLine): ExpectedCommission {
  const revenue = line.unitPrice * line.quantity;
  let tour = 0;
  let consulting = 0;
  if (line.itemType === 'service') {
    const tourRevenue = line.isPackageRedemption ? (line.listPrice ?? 0) * line.quantity : revenue;
    if (line.staffId) tour = amountFor(line.tourCommissionType, line.tourCommissionRate, tourRevenue, line.quantity);
    if (line.consultantStaffId) consulting = amountFor(line.commissionType, line.commissionRate, revenue, line.quantity);
  } else if (line.itemType === 'product' && line.staffId) {
    consulting = amountFor(line.commissionType, line.commissionRate, revenue, line.quantity);
  }
  return { tour, consulting, total: tour + consulting };
}
