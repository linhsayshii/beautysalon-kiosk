import { describe, expect, it } from 'vitest';
import { APPOINTMENT_STATUS_LABELS, appointmentStatusLabel } from './appointment-status';

describe('appointment status labels', () => {
  it('names every appointment status once, the way the lists show it', () => {
    expect(APPOINTMENT_STATUS_LABELS).toEqual({
      pending: 'Chờ xác nhận', confirmed: 'Chờ phục vụ', waiting: 'Đang chờ', in_service: 'Đang làm',
      completed: 'Đã xong', cancelled: 'Đã hủy', no_show: 'Không đến',
    });
  });
  it('falls back to the raw status for unknown values', () => {
    expect(appointmentStatusLabel('confirmed')).toBe('Chờ phục vụ');
    expect(appointmentStatusLabel('mystery')).toBe('mystery');
  });
});
