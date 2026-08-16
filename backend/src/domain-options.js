export const domainOptions = Object.freeze({
  filters: {
    orders: {
      statuses: ['paid', 'draft', 'refunded', 'cancelled'],
      paymentMethods: ['cash', 'bank_transfer', 'card', 'wallet', 'mixed'],
    },
    customers: { debtStatuses: ['with_debt', 'no_debt'] },
    customerPackages: { statuses: ['active', 'completed', 'depleted', 'expired', 'cancelled'] },
    products: {
      types: ['product', 'service', 'package', 'account_card'],
      stockStatuses: ['in_stock', 'low', 'out'],
      statuses: ['active', 'inactive'],
    },
    purchaseOrders: {
      statuses: ['draft', 'completed', 'cancelled'],
      paymentMethods: ['cash', 'bank_transfer', 'card'],
    },
  },
});
