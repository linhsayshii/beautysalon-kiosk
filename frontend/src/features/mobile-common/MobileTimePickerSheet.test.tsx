import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MobileTimePickerSheet } from './MobileTimePickerSheet';

describe('MobileTimePickerSheet', () => {
  // 08:30 at the branch (Asia/Ho_Chi_Minh), represented as an ISO instant.
  const initialDate = new Date('2026-08-17T01:30:00.000Z');

  it('uses the shared website picker instead of a browser or device-specific picker', () => {
    render(
      <MobileTimePickerSheet
        isOpen
        value={initialDate}
        onClose={vi.fn()}
        onSelectTime={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Chọn thời gian' })).toBeInTheDocument();
    expect(screen.getByRole('grid', { name: /tháng 8 năm 2026/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Giờ')).toBeInTheDocument();
    expect(screen.getByLabelText('Phút')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeInTheDocument();
  });

  it('converts the selected branch-local time into the expected ISO instant', () => {
    const onClose = vi.fn();
    const onSelectTime = vi.fn();
    render(
      <MobileTimePickerSheet
        isOpen
        value={initialDate}
        onClose={onClose}
        onSelectTime={onSelectTime}
      />,
    );

    fireEvent.click(screen.getByLabelText('Giờ'));
    fireEvent.click(screen.getByRole('option', { name: '14 giờ' }));
    fireEvent.click(screen.getByLabelText('Phút'));
    fireEvent.click(screen.getByRole('option', { name: '45 phút' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));

    expect(onSelectTime).toHaveBeenCalledWith(expect.any(Date));
    expect(onSelectTime.mock.calls[0][0].toISOString()).toBe('2026-08-17T07:45:00.000Z');
    expect(onClose).toHaveBeenCalledOnce();
  });
});
