import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileTimePickerSheet } from './MobileTimePickerSheet';

describe('MobileTimePickerSheet', () => {
  const initialDate = new Date(2026, 7, 17, 8, 30); // 2026-08-17 08:30

  it('renders header, date strip, shift sections, and confirm button', () => {
    const onClose = vi.fn();
    const onSelectTime = vi.fn();

    render(
      <MobileTimePickerSheet
        isOpen={true}
        value={initialDate}
        onClose={onClose}
        onSelectTime={onSelectTime}
      />
    );

    expect(screen.getByText('Chọn thời gian')).toBeInTheDocument();
    expect(screen.getByText('Chọn ngày giờ cụ thể')).toBeInTheDocument();
    expect(screen.getByText(/Ca sáng/i)).toBeInTheDocument();
    expect(screen.getByText(/Ca chiều/i)).toBeInTheDocument();
    expect(screen.getByText(/Ca tối/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tiếp tục|áp dụng/i })).toBeInTheDocument();
  });

  it('allows selecting a time slot and submitting', () => {
    const onClose = vi.fn();
    const onSelectTime = vi.fn();

    render(
      <MobileTimePickerSheet
        isOpen={true}
        value={initialDate}
        onClose={onClose}
        onSelectTime={onSelectTime}
      />
    );

    // Click slot 14:30
    const slot1430 = screen.getByRole('button', { name: '14:30' });
    fireEvent.click(slot1430);

    // Click confirm button
    const confirmBtn = screen.getByRole('button', { name: /tiếp tục|áp dụng/i });
    fireEvent.click(confirmBtn);

    expect(onSelectTime).toHaveBeenCalledTimes(1);
    const selected: Date = onSelectTime.mock.calls[0][0];
    expect(selected.getHours()).toBe(14);
    expect(selected.getMinutes()).toBe(30);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('allows switching dates from the 14-day horizontal strip', () => {
    const onClose = vi.fn();
    const onSelectTime = vi.fn();

    render(
      <MobileTimePickerSheet
        isOpen={true}
        value={initialDate}
        onClose={onClose}
        onSelectTime={onSelectTime}
      />
    );

    // Strip buttons exist
    const dateButtons = screen.getAllByRole('button', { name: /thứ|cn/i });
    expect(dateButtons.length).toBeGreaterThanOrEqual(14);

    // Select second day
    fireEvent.click(dateButtons[1]);

    // Select time slot 09:00
    fireEvent.click(screen.getByRole('button', { name: '09:00' }));

    // Confirm
    fireEvent.click(screen.getByRole('button', { name: /tiếp tục|áp dụng/i }));
    expect(onSelectTime).toHaveBeenCalled();
  });

  it('opens exact time roller modal when clicking "Chọn ngày giờ cụ thể" and updates selected time', () => {
    const onClose = vi.fn();
    const onSelectTime = vi.fn();

    render(
      <MobileTimePickerSheet
        isOpen={true}
        value={initialDate}
        onClose={onClose}
        onSelectTime={onSelectTime}
      />
    );

    const customTimeBtn = screen.getByText('Chọn ngày giờ cụ thể');
    fireEvent.click(customTimeBtn);

    // Wheel picker modal should appear
    expect(screen.getByRole('dialog', { name: /chọn ngày giờ chi tiết|chọn giờ chi tiết/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /hủy bỏ/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /áp dụng giờ/i })).toBeInTheDocument();

    // Select custom hour and minute via select inputs or roller controls
    const hourInput = screen.getByLabelText(/^giờ/i);
    const minuteInput = screen.getByLabelText(/^phút/i);

    fireEvent.change(hourInput, { target: { value: '16' } });
    fireEvent.change(minuteInput, { target: { value: '45' } });

    // Apply custom time
    fireEvent.click(screen.getByRole('button', { name: /áp dụng giờ/i }));

    // Confirm sheet
    fireEvent.click(screen.getByRole('button', { name: /tiếp tục|áp dụng/i }));
    expect(onSelectTime).toHaveBeenCalledTimes(1);
    const result: Date = onSelectTime.mock.calls[0][0];
    expect(result.getHours()).toBe(16);
    expect(result.getMinutes()).toBe(45);
  });
});
