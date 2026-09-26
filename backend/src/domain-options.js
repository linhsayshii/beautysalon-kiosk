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
  cashbook: {
    funds: ['cash', 'bank'],
    voucherTypes: ['income', 'expense'],
    statuses: ['active', 'cancelled'],
    // `manual`: may be picked when creating a voucher by hand.
    // `countsInProfit`: included in the profit report (income adds, expense subtracts).
    categories: [
      { key: 'sales', type: 'income', label: 'Thu tiền bán hàng', manual: false, countsInProfit: false },
      { key: 'debt_collection', type: 'income', label: 'Thu nợ khách hàng', manual: false, countsInProfit: false },
      { key: 'other_income', type: 'income', label: 'Thu khác', manual: true, countsInProfit: true },
      { key: 'opening_balance', type: 'income', label: 'Số dư đầu kỳ', manual: false, countsInProfit: false },
      { key: 'fund_transfer_in', type: 'income', label: 'Chuyển quỹ (nhận)', manual: false, countsInProfit: false },
      { key: 'salary', type: 'expense', label: 'Chi trả lương nhân viên', manual: true, countsInProfit: true },
      { key: 'supplier_payment', type: 'expense', label: 'Chi trả nhà cung cấp', manual: true, countsInProfit: false },
      { key: 'rent', type: 'expense', label: 'Tiền thuê mặt bằng', manual: true, countsInProfit: true },
      { key: 'utilities', type: 'expense', label: 'Điện, nước, internet', manual: true, countsInProfit: true },
      { key: 'supplies', type: 'expense', label: 'Vật tư tiêu hao', manual: true, countsInProfit: true },
      { key: 'marketing', type: 'expense', label: 'Marketing, quảng cáo', manual: true, countsInProfit: true },
      { key: 'other_expense', type: 'expense', label: 'Chi khác', manual: true, countsInProfit: true },
      { key: 'fund_transfer_out', type: 'expense', label: 'Chuyển quỹ (chuyển đi)', manual: false, countsInProfit: false },
    ],
  },
});
