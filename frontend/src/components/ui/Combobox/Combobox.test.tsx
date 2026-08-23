import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Combobox } from './Combobox';

describe('Combobox', () => {
  it('keeps free text input while showing website options in a portal', () => {
    const onChange = vi.fn();
    render(<Combobox value="" onChange={onChange} options={['Chăm sóc da', 'Gói dịch vụ']} aria-label="Nhóm hàng" />);

    const input = screen.getByRole('combobox', { name: 'Nhóm hàng' });
    fireEvent.focus(input);
    const listbox = screen.getByRole('listbox', { name: 'Gợi ý nhóm hàng' });
    expect(listbox.closest('.app-select-popover')?.parentElement).toBe(document.body);

    fireEvent.change(input, { target: { value: 'Nhóm mới' } });
    expect(onChange).toHaveBeenCalledWith('Nhóm mới');
  });

  it('selects a suggested option', () => {
    const onChange = vi.fn();
    render(<Combobox value="" onChange={onChange} options={['Chăm sóc da', 'Gói dịch vụ']} aria-label="Nhóm hàng" />);

    fireEvent.focus(screen.getByRole('combobox', { name: 'Nhóm hàng' }));
    fireEvent.click(screen.getByRole('option', { name: 'Gói dịch vụ' }));
    expect(onChange).toHaveBeenCalledWith('Gói dịch vụ');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
