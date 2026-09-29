// Decides which commission records one paid invoice line earns. A service
// pays tour commission to its performer and its original commission to the
// consultant chosen on the line; nobody earns the original commission when no
// consultant was chosen. A product pays its seller. Packages and account cards
// earn nothing.

const amountFor = (type, rate, revenue, quantity) => {
  if (type === 'percent') return Math.round(revenue * rate);
  if (type === 'fixed') return quantity * rate;
  return 0;
};

export function buildCommissionEntries(item) {
  const entries = [];
  const add = (staffId, commissionType, sourceName, revenue, type, rate = 0) => {
    const amount = amountFor(type, rate, revenue, item.quantity);
    if (staffId && amount > 0) entries.push({ staffId, commissionType, sourceName, revenue, rate, amount });
  };

  if (item.itemType === 'service') {
    // A package session is free on the invoice, so a percent tour is taken
    // from the service's list price instead.
    const tourRevenue = item.isPackageRedemption ? item.listPrice * item.quantity : item.lineTotal;
    add(item.staffId, 'tour', 'Tua dịch vụ', tourRevenue, item.tourCommissionType, item.tourCommissionRate);
    add(item.consultantStaffId, 'consulting', 'Tư vấn bán dịch vụ', item.lineTotal, item.commissionType, item.commissionRate);
  } else if (item.itemType === 'product') {
    add(item.staffId, 'consulting', 'Bán sản phẩm', item.lineTotal, item.commissionType, item.commissionRate);
  }
  return entries;
}
