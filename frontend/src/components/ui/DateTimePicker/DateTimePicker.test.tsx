import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DatePickerField, DateRangePickerField, DateTimePickerField, rangePresets } from './DateTimePicker';

describe('rangePresets', () => {
  it('ends current periods today and spans past periods fully', () => {
    const byLabel = Object.fromEntries(rangePresets('2026-10-07').map((preset) => [preset.label, preset.range]));
    expect(byLabel['7 ngày qua']).toEqual({ from: '2026-10-01', to: '2026-10-07' });
    expect(byLabel['Tháng này']).toEqual({ from: '2026-10-01', to: '2026-10-07' });
    expect(byLabel['Tháng trước']).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(byLabel['Quý này']).toEqual({ from: '2026-10-01', to: '2026-10-07' });
    expect(byLabel['Quý trước']).toEqual({ from: '2026-07-01', to: '2026-09-30' });
    expect(byLabel['Năm trước']).toEqual({ from: '2025-01-01', to: '2025-12-31' });
  });
});

describe('date pickers', () => {
  it('picks a range with two clicks in either order', () => {
    const onChange = vi.fn();
    render(<DateRangePickerField aria-label="Thời gian" from="2026-10-01" to="2026-10-07" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Thời gian/ }));
    const october = screen.getByRole('grid', { name: 'Tháng 10 năm 2026' });
    fireEvent.click(october.querySelector('[data-date="2026-10-20"]')!);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(october.querySelector('[data-date="2026-10-12"]')!);
    expect(onChange).toHaveBeenCalledWith('2026-10-12', '2026-10-20');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('applies a preset in one click', () => {
    const onChange = vi.fn();
    render(<DateRangePickerField aria-label="Thời gian" from="2026-10-01" to="2026-10-07" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Thời gian/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Năm trước' }));
    expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/-01-01$/), expect.stringMatching(/-12-31$/));
  });

  it('disables days after max', () => {
    render(<DatePickerField aria-label="Ngày" value="2026-10-07" max="2026-10-07" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ngày' }));
    const grid = screen.getByRole('grid', { name: 'Tháng 10 năm 2026' });
    expect(grid.querySelector('[data-date="2026-10-08"]')).toBeDisabled();
    expect(grid.querySelector('[data-date="2026-10-06"]')).toBeEnabled();
  });

  it('keeps the time when the day changes', () => {
    const onChange = vi.fn();
    render(<DateTimePickerField aria-label="Giờ vào" value="2026-10-07T08:54" onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Giờ vào' })).toHaveTextContent('08:54 07/10/2026');
    fireEvent.click(screen.getByRole('button', { name: 'Giờ vào' }));
    fireEvent.click(screen.getByRole('grid', { name: 'Tháng 10 năm 2026' }).querySelector('[data-date="2026-10-03"]')!);
    expect(onChange).toHaveBeenCalledWith('2026-10-03T08:54');
  });
});
