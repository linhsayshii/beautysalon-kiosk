import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MoneyInput } from './MoneyInput';

describe('MoneyInput', () => {
  it('renders initial formatted value with dots', () => {
    render(<MoneyInput value={1500000} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('1.500.000');
  });

  it('formats user input with dots and calls onChange with parsed number', () => {
    const handleChange = vi.fn();
    render(<MoneyInput value={0} onChange={handleChange} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '2500000' } });
    expect(handleChange).toHaveBeenCalledWith(2500000);
  });

  it('renders with suffix when provided', () => {
    const { container } = render(<MoneyInput value={50000} suffix="đ/giờ" />);
    expect(container.querySelector('.input-suffix')).toBeDefined();
    expect(container.textContent).toContain('đ/giờ');
  });
});
