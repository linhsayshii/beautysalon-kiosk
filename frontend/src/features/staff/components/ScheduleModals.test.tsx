import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ApplyWeeksModal } from '@/components/ApplyWeeksModal';
import { AssignShiftForStaffModal } from './AssignShiftForStaffModal';
import { AssignStaffModal } from './AssignStaffModal';

describe('schedule dialogs', () => {
  it('applies a single cell to this week only unless the manager chooses to repeat', () => {
    const onConfirm = vi.fn();
    render(<ApplyWeeksModal isOpen onClose={vi.fn()} onConfirm={onConfirm} currentWeekLabel="Tuần 4 - Th. 9 2026" />);
    expect(screen.getByRole('dialog', { name: 'Áp dụng lịch tuần 4 - Th. 9 2026' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Chỉ tuần này/ })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Gán lịch' }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ weeks: 1 }));
  });

  it('prints the shift date as dd/mm/yyyy', () => {
    render(<AssignShiftForStaffModal isOpen onClose={vi.fn()} staff={{ id: 1, name: 'Hậu', code: 'NV000016' }} shiftDate="2026-09-29" dayLabel="Thứ ba" workShifts={[]} onAssign={vi.fn()} />);
    expect(screen.getByText(/Thứ ba, 29\/09\/2026/)).toBeInTheDocument();
    expect(screen.queryByText(/2026-09-29/)).not.toBeInTheDocument();
  });

  it('prints the date in the assign-staff dialog as dd/mm/yyyy', () => {
    render(<AssignStaffModal isOpen onClose={vi.fn()} shiftName="Ca sáng" startsAt="08:00" endsAt="12:00" shiftDate="2026-09-29" staffList={[]} assignedStaffIds={[]} onAssign={vi.fn()} />);
    expect(screen.getByText(/Ngày 29\/09\/2026/)).toBeInTheDocument();
  });
});
