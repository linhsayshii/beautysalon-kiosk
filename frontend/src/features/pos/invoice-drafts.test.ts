import { describe, expect, it } from 'vitest';
import { closeInvoiceConfirmation } from './invoice-drafts';

const empty = { name: 'Hóa đơn 1', customer: null, lines: [] };

describe('closeInvoiceConfirmation', () => {
  it('closes an empty invoice without asking', () => {
    expect(closeInvoiceConfirmation(empty)).toBeNull();
  });
  it('asks before discarding an invoice with items', () => {
    expect(closeInvoiceConfirmation({ ...empty, lines: [{ quantity: 2 }] })).toBe('Đóng Hóa đơn 1? 2 món trong hóa đơn sẽ bị bỏ.');
  });
  it('asks before discarding an invoice that only has a customer', () => {
    expect(closeInvoiceConfirmation({ ...empty, customer: { name: 'Đỗ Mỹ Linh' } })).toBe('Đóng Hóa đơn 1 của Đỗ Mỹ Linh? Hóa đơn chưa được lưu.');
  });
});
