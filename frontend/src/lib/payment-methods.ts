/** One Vietnamese name per payment method, used by checkout, debt collection, receipts and lists. */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Tiền mặt',
  bank_transfer: 'Chuyển khoản',
  card: 'Quẹt thẻ',
  wallet: 'Thẻ tài khoản',
  mixed: 'Kết hợp',
};

export function paymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method] ?? method;
}
