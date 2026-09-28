import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/Toast/ToastProvider';
import * as AuthProvider from '@/features/auth/AuthProvider';
import * as staffApi from '@/features/staff/staff.api';
import * as accountsApi from './accounts.api';
import { AccountDialog } from './StaffAccountsView';

vi.mock('@/features/staff/staff.api');
vi.mock('./accounts.api');

const manager = { id: 1, username: 'admin', displayName: 'Quản lý', role: 'manager', branchId: 1, staffId: null };
const cashier = { id: 5, username: 'thungan', displayName: 'Thu ngân', role: 'cashier', active: true, staffId: null };

function renderDialog(account: Record<string, unknown>, updateLocalAccount = vi.fn()) {
  vi.spyOn(AuthProvider, 'useAuth').mockReturnValue({
    account: manager, loading: false, login: vi.fn(), logout: vi.fn(), switchBranch: vi.fn(), updateLocalAccount,
  } as any);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AccountDialog account={account} onClose={onClose} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { onClose, updateLocalAccount };
}

describe('AccountDialog editing', () => {
  beforeEach(() => {
    vi.mocked(staffApi.getStaff).mockResolvedValue({ data: [{ id: 3, code: 'NV3', name: 'Hậu' }] } as any);
    vi.mocked(accountsApi.getAccounts).mockResolvedValue({ data: [manager, cashier] } as any);
    vi.mocked(accountsApi.updateAccount).mockResolvedValue({ data: { ...cashier, role: 'manager', sessionsRevoked: true } } as any);
  });

  it('loads the saved account and changes its type without resetting the password', async () => {
    const { onClose } = renderDialog(cashier);

    expect(screen.getByRole('heading', { name: 'Sửa tài khoản' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('thungan')).toBeInTheDocument();
    expect(screen.getByLabelText('Đặt lại mật khẩu')).toHaveValue('');

    fireEvent.click(screen.getByRole('button', { name: 'Loại tài khoản' }));
    fireEvent.click(await screen.findByRole('option', { name: /Quản lý/ }));
    expect(screen.getByText(/sẽ đăng xuất Thu ngân/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => expect(accountsApi.updateAccount).toHaveBeenCalledWith(5, {
      displayName: 'Thu ngân', username: 'thungan', role: 'manager', staffId: null,
    }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('locks the account type and password reset when editing yourself', async () => {
    vi.mocked(accountsApi.updateAccount).mockResolvedValue({ data: { ...manager, displayName: 'Chủ salon', sessionsRevoked: false } } as any);
    const { updateLocalAccount } = renderDialog(manager);

    expect(screen.getByRole('button', { name: 'Loại tài khoản' })).toBeDisabled();
    expect(screen.queryByLabelText('Đặt lại mật khẩu')).not.toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('Quản lý'), { target: { value: 'Chủ salon' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => expect(updateLocalAccount).toHaveBeenCalledWith(expect.objectContaining({ displayName: 'Chủ salon' })));
  });
});
