import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/Toast/ToastProvider';
import { StaffCreateDialog } from './StaffCreateDialog';
import * as staffApi from '../staff.api';
import * as accountsApi from '@/features/accounts/accounts.api';

vi.mock('../staff.api');
vi.mock('@/features/accounts/accounts.api');

function renderDialog(props: Partial<Parameters<typeof StaffCreateDialog>[0]> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <StaffCreateDialog onClose={() => undefined} {...props} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('StaffCreateDialog', () => {
  beforeEach(() => {
    vi.mocked(accountsApi.getAccounts).mockResolvedValue({ data: [] } as any);
    vi.mocked(staffApi.createStaff).mockResolvedValue({ data: { id: 1, name: 'Lan', code: 'NV1' } } as any);
    vi.mocked(staffApi.updateStaff).mockResolvedValue({ data: { id: 7, name: 'Mai Anh', code: 'NV7' } } as any);
  });

  it('starts a new staff member with no sample salary, allowances or deductions', async () => {
    renderDialog({ initialTab: 'salary' });

    expect(screen.getByLabelText('Mức lương tháng')).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Xóa phụ cấp' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xóa giảm trừ' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Thông tin' }));
    fireEvent.change(screen.getByLabelText(/Tên nhân viên/), { target: { value: 'Lan' } });
    fireEvent.change(screen.getByLabelText(/Số điện thoại/), { target: { value: '0900000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));

    await waitFor(() => expect(staffApi.createStaff).toHaveBeenCalled());
    const payload = vi.mocked(staffApi.createStaff).mock.calls[0][0];
    expect(payload.baseSalary).toBe(0);
    expect(payload.profile).toMatchObject({ allowances: [], deductions: [] });
  });

  it('edits the saved salary setup instead of replacing it with samples', async () => {
    const deductions = [{ id: 'd1', name: 'Đi muộn', unit: 'Theo số phút', amount: '2000' }];
    renderDialog({
      initialTab: 'salary',
      staff: {
        id: 7, name: 'Mai Anh', code: 'NV7', role: 'Kỹ thuật viên', salaryType: 'monthly',
        baseSalary: 9000000, hourlyRate: 0, enableAllowance: false, enableDeduction: true,
        allowances: [], deductions,
      },
    });

    expect(screen.getByLabelText('Mức lương tháng')).toHaveValue('9.000.000');
    expect(screen.getByRole('switch', { name: 'Áp dụng phụ cấp' })).not.toBeChecked();
    expect(screen.getAllByRole('button', { name: 'Xóa giảm trừ' })).toHaveLength(1);
    expect(screen.getByLabelText('Khoản giảm trừ')).toHaveValue('2.000');

    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => expect(staffApi.updateStaff).toHaveBeenCalled());
    const payload = vi.mocked(staffApi.updateStaff).mock.calls[0][1];
    expect(payload.baseSalary).toBe(9000000);
    expect(payload.profile).toMatchObject({ enableAllowance: false, allowances: [], deductions });
  });

  it('drops rows the manager added but never named', async () => {
    renderDialog({ initialTab: 'salary' });

    fireEvent.click(screen.getByRole('button', { name: /Thêm giảm trừ/ }));
    expect(screen.getAllByRole('button', { name: 'Xóa giảm trừ' })).toHaveLength(1);

    fireEvent.click(screen.getByRole('tab', { name: 'Thông tin' }));
    fireEvent.change(screen.getByLabelText(/Tên nhân viên/), { target: { value: 'Lan' } });
    fireEvent.change(screen.getByLabelText(/Số điện thoại/), { target: { value: '0900000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));

    await waitFor(() => expect(staffApi.createStaff).toHaveBeenCalled());
    expect(vi.mocked(staffApi.createStaff).mock.calls[0][0].profile).toMatchObject({ deductions: [] });
  });
});
