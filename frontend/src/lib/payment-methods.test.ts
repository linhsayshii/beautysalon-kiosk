import { describe, expect, it } from 'vitest';
import { PAYMENT_METHOD_LABELS, paymentMethodLabel } from './payment-methods';
import { statusLabels } from '@/types/api';

describe('payment method names', () => {
  it('uses one name per method on every screen', () => {
    expect(PAYMENT_METHOD_LABELS).toEqual({
      cash: 'Tiền mặt', bank_transfer: 'Chuyển khoản', card: 'Quẹt thẻ', wallet: 'Thẻ tài khoản', mixed: 'Kết hợp',
    });
    for (const [method, label] of Object.entries(PAYMENT_METHOD_LABELS)) expect(statusLabels[method]).toBe(label);
  });
  it('falls back to the raw value', () => {
    expect(paymentMethodLabel('wallet')).toBe('Thẻ tài khoản');
    expect(paymentMethodLabel('crypto')).toBe('crypto');
  });
});
