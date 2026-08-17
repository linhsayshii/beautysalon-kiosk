import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { MobileAccountView } from './MobileAccountView';
import * as AuthProvider from '@/features/auth/AuthProvider';

// Mock ToastProvider
vi.mock('@/components/ui/Toast/ToastProvider', () => ({
  useToast: () => ({ notify: vi.fn() }),
}));

describe('MobileAccountView', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MobileAccountView />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('renders profile tab and user info for cashier/staff role', () => {
    vi.spyOn(AuthProvider, 'useAuth').mockReturnValue({
      account: {
        id: 1,
        username: 'staff01',
        displayName: 'Nguyễn Văn A',
        role: 'staff',
        branchId: 1,
        branchName: 'Chi nhánh Quận 1',
        staffId: 10,
        staffCode: 'NV-01',
        phone: '0901234567',
        email: 'staff01@example.com',
      },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      switchBranch: vi.fn(),
      updateLocalAccount: vi.fn(),
    });

    renderComponent();

    expect(screen.getByRole('heading', { level: 1, name: 'Cài đặt tài khoản' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Thông tin tài khoản' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Đổi mật khẩu' })).toBeInTheDocument();
    // Manager tabs should NOT be visible
    expect(screen.queryByRole('button', { name: /Quản lý chi nhánh/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Tài khoản & phân quyền/i })).not.toBeInTheDocument();
  });

  it('renders all 3 tabs for manager role and switches between them', () => {
    vi.spyOn(AuthProvider, 'useAuth').mockReturnValue({
      account: {
        id: 2,
        username: 'manager01',
        displayName: 'Chủ Spa',
        role: 'manager',
        branchId: 1,
        branchName: 'Chi nhánh Quận 1',
        staffId: null,
        staffCode: null,
        phone: '0988888888',
        email: 'manager@example.com',
      },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      switchBranch: vi.fn(),
      updateLocalAccount: vi.fn(),
    });

    renderComponent();

    expect(screen.getByRole('button', { name: /Thông tin cá nhân/i })).toBeInTheDocument();
    const branchTab = screen.getByRole('button', { name: /Quản lý chi nhánh/i });
    const accountTab = screen.getByRole('button', { name: /Tài khoản & phân quyền/i });

    expect(branchTab).toBeInTheDocument();
    expect(accountTab).toBeInTheDocument();

    // Switch to branches tab
    fireEvent.click(branchTab);
    expect(screen.getAllByRole('button', { name: 'Thêm chi nhánh' }).length).toBeGreaterThan(0);

    // Switch to accounts tab
    fireEvent.click(accountTab);
    expect(screen.getAllByRole('button', { name: 'Thêm tài khoản' }).length).toBeGreaterThan(0);
    expect(screen.getByText('Quản lý')).toBeInTheDocument();
    expect(screen.getByText('Thu ngân')).toBeInTheDocument();
    expect(screen.getByText('Nhân viên')).toBeInTheDocument();
  });
});
