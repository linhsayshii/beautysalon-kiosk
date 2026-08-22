import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MobileStaffSalaryView } from './MobileStaffSalaryView';
import * as staffApi from '@/features/staff/staff.api';
import { monthStartIso } from '@/lib/date';

function monthStart(offset: number) {
  const date = new Date(`${monthStartIso()}T00:00:00`);
  date.setMonth(date.getMonth() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

describe('MobileStaffSalaryView', () => {
  it('shows real payroll records and lets staff switch the displayed month', async () => {
    const currentMonth = monthStart(0);
    const previousMonth = monthStart(-1);
    vi.spyOn(staffApi, 'getMyPayrollHistory').mockResolvedValue({
      data: [
        {
          id: 1, code: 'PL-previous', period: { id: 1, code: 'BL-previous', name: 'Tháng trước', startsOn: previousMonth, endsOn: previousMonth, status: 'paid' },
          baseSalary: 5800000, overtimeSalary: 0, allowance: 0, bonus: 0, commission: 1000000, deduction: 0,
          totalIncome: 6800000, netSalary: 6800000, paidAmount: 6800000, remainingAmount: 0, workUnits: 26, standardWorkDays: 26, hourlyRate: 0, status: 'paid',
        },
        {
          id: 2, code: 'PL-current', period: { id: 2, code: 'BL-current', name: 'Tháng hiện tại', startsOn: currentMonth, endsOn: currentMonth, status: 'approved' },
          baseSalary: 6000000, overtimeSalary: 0, allowance: 500000, bonus: 0, commission: 1200000, deduction: 0,
          totalIncome: 7700000, netSalary: 7700000, paidAmount: 5000000, remainingAmount: 2700000, workUnits: 24, standardWorkDays: 26, hourlyRate: 0, status: 'approved',
        },
      ],
    } as any);

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter><MobileStaffSalaryView /></MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(document.querySelector('.salary-amount')).toHaveTextContent('7.700.000đ'));
    expect(document.querySelector('.mobile-salary-sticky-shell')).toBeInTheDocument();
    expect(document.querySelector('.mobile-salary-month-menu')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Chọn tháng lương'), { target: { value: '1' } });
    expect(document.querySelector('.salary-amount')).toHaveTextContent('6.800.000đ');
  });
});
