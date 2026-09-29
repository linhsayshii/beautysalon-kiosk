import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConsultantPicker } from './PosView';

const staffList = [{ id: 1, name: 'Hậu' }, { id: 2, name: 'Em Huệ' }];

describe('ConsultantPicker', () => {
  it('stays behind a small button until the cashier adds a consultant', () => {
    const onChange = vi.fn();
    render(<ConsultantPicker serviceName="Gội đầu" value={null} open={false} staffList={staffList} triggerClassName="t" onChange={onChange} />);

    expect(screen.queryByLabelText('Nhân viên tư vấn Gội đầu')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tư vấn bán' }));
    expect(onChange).toHaveBeenCalledWith(null, true);
  });

  it('shows the chosen consultant and can remove it', () => {
    const onChange = vi.fn();
    render(<ConsultantPicker serviceName="Gội đầu" value={2} open staffList={staffList} triggerClassName="t" onChange={onChange} />);

    expect(screen.getByLabelText('Nhân viên tư vấn Gội đầu')).toHaveTextContent('Em Huệ');
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ nhân viên tư vấn Gội đầu' }));
    expect(onChange).toHaveBeenCalledWith(null, false);
  });
});
