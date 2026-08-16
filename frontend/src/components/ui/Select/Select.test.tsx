import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Select } from './Select';

const sampleOptions = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'yesterday', label: 'Hôm qua' },
  { value: 'last_7_days', label: '7 ngày qua' },
  { value: 'this_month', label: 'Tháng này' },
  { value: 'last_month', label: 'Tháng trước' },
];

describe('CustomSelect Component', () => {
  it('renders with selected value and label', () => {
    render(
      <Select
        value="this_month"
        onChange={() => {}}
        options={sampleOptions}
        aria-label="Kỳ tổng quan"
      />
    );

    const trigger = screen.getByRole('button', { name: 'Kỳ tổng quan' });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent('Tháng này');
  });

  it('opens menu on click and displays all options', () => {
    render(
      <Select
        value="this_month"
        onChange={() => {}}
        options={sampleOptions}
        aria-label="Kỳ tổng quan"
      />
    );

    const trigger = screen.getByRole('button', { name: 'Kỳ tổng quan' });
    fireEvent.click(trigger);

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(5);
  });

  it('triggers onChange and closes menu when an option is clicked', () => {
    const handleChange = vi.fn();
    render(
      <Select
        value="this_month"
        onChange={handleChange}
        options={sampleOptions}
        aria-label="Kỳ tổng quan"
      />
    );

    const trigger = screen.getByRole('button', { name: 'Kỳ tổng quan' });
    fireEvent.click(trigger);

    const option = screen.getByText('Hôm nay');
    fireEvent.click(option);

    expect(handleChange).toHaveBeenCalledWith('today');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('renders checkmark on selected option', () => {
    render(
      <Select
        value="this_month"
        onChange={() => {}}
        options={sampleOptions}
        aria-label="Kỳ tổng quan"
      />
    );

    const trigger = screen.getByRole('button', { name: 'Kỳ tổng quan' });
    fireEvent.click(trigger);

    const selectedItem = screen.getByRole('option', { selected: true });
    expect(selectedItem).toHaveTextContent('Tháng này');
    expect(selectedItem).toHaveClass('is-selected');
    expect(selectedItem.querySelector('.ph-check')).toBeInTheDocument();
  });

  it('renders placeholder when value is empty or not matched', () => {
    render(
      <Select
        value=""
        onChange={() => {}}
        options={sampleOptions}
        placeholder="Vui lòng chọn"
        aria-label="Kỳ tổng quan"
      />
    );

    const trigger = screen.getByRole('button', { name: 'Kỳ tổng quan' });
    expect(trigger).toHaveTextContent('Vui lòng chọn');
  });

  it('closes dropdown when Escape key is pressed', () => {
    render(
      <Select
        value="today"
        onChange={() => {}}
        options={sampleOptions}
        aria-label="Kỳ tổng quan"
      />
    );

    const trigger = screen.getByRole('button', { name: 'Kỳ tổng quan' });
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    const container = trigger.parentElement!;
    fireEvent.keyDown(container, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
