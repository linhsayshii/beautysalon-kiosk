import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MobileMoreView } from './MobileMoreView';
import * as AuthContextModule from '@/features/auth/AuthProvider';
import * as BranchesApi from '@/features/branches/branches.api';

vi.mock('@/features/auth/AuthProvider', async () => {
  const actual = await vi.importActual<typeof AuthContextModule>('@/features/auth/AuthProvider');
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

vi.mock('@/features/branches/branches.api', () => ({
  getBranches: vi.fn(),
}));

describe('MobileMoreView', () => {
  let queryClient: QueryClient;
  const mockSwitchBranch = vi.fn().mockResolvedValue(undefined);
  const mockLogout = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();

    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      account: {
        id: 1,
        branchId: 101,
        staffId: 5,
        username: 'admin',
        displayName: 'Nguyễn Quản Lý',
        role: 'manager',
        branchName: 'Chi nhánh Quận 1',
        staffCode: 'ST001',
        phone: '0909000111',
        email: 'admin@annachill.test',
      },
      loading: false,
      login: vi.fn(),
      logout: mockLogout,
      updateLocalAccount: vi.fn(),
      switchBranch: mockSwitchBranch,
    });

    vi.mocked(BranchesApi.getBranches).mockResolvedValue({
      data: [
        { id: 101, name: 'Chi nhánh Quận 1', address: '123 Lê Lợi, Q1' },
        { id: 102, name: 'Chi nhánh Quận 3', address: '456 CMT8, Q3' },
      ],
      meta: {},
    });
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MobileMoreView />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('renders user profile and branch name accurately', () => {
    renderComponent();

    expect(screen.getByTestId('user-name')).toHaveTextContent('Nguyễn Quản Lý');
    expect(screen.getByTestId('user-branch')).toHaveTextContent('Chi nhánh Quận 1');
    expect(screen.getByTestId('user-avatar')).toHaveTextContent('QL');
  });

  it('renders store settings link pointing to /settings', () => {
    renderComponent();

    const settingsLink = screen.getByTestId('store-settings-link');
    expect(settingsLink).toBeInTheDocument();
    expect(settingsLink.getAttribute('href')).toBe('/settings');
  });

  it('renders all bento category sections and navigation links', () => {
    renderComponent();

    // Check Category Headers
    expect(screen.getByText('Đơn hàng')).toBeInTheDocument();
    expect(screen.getAllByText('Báo cáo').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Thuế & Kế toán').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Khách hàng').length).toBeGreaterThan(0);
    expect(screen.getByText('Hàng hóa & Kho')).toBeInTheDocument();
    expect(screen.getByText('Nhân sự')).toBeInTheDocument();
    expect(screen.getByText('Hệ thống & Tiện ích')).toBeInTheDocument();

    // Check specific navigation items
    expect(screen.getByText('Hóa đơn').closest('a')?.getAttribute('href')).toBe('/m/orders');
    expect(screen.getByText('Phân tích').closest('a')?.getAttribute('href')).toBe('/m/dashboard');
    expect(screen.getByText('Sổ quỹ').closest('a')?.getAttribute('href')).toBe('/m/dashboard');
    expect(screen.getByText('Hóa đơn điện tử').closest('a')?.getAttribute('href')).toBe('/m/orders');
    expect(screen.getByText('Gói thẻ đã bán').closest('a')?.getAttribute('href')).toBe('/m/customer-cards');
    expect(screen.getByText('Hàng hóa').closest('a')?.getAttribute('href')).toBe('/m/products');
    expect(screen.getByText('Bảng giá').closest('a')?.getAttribute('href')).toBe('/m/pricebooks');
    expect(screen.getByText('Nhập hàng').closest('a')?.getAttribute('href')).toBe('/m/purchase-orders');
    expect(screen.getByText('Danh sách NV').closest('a')?.getAttribute('href')).toBe('/m/staff');
    expect(screen.getByText('Lịch làm việc').closest('a')?.getAttribute('href')).toBe('/m/staff/schedule');
    expect(screen.getByText('Chấm công').closest('a')?.getAttribute('href')).toBe('/m/staff/attendance');
    expect(screen.getByText('Lương & HH').closest('a')?.getAttribute('href')).toBe('/m/staff/payroll');
    expect(screen.getByText('Quét chấm công').closest('a')?.getAttribute('href')).toBe('/m/attendance');
    expect(screen.getByText('Mã QR chấm công').closest('a')?.getAttribute('href')).toBe('/m/attendance/qr');
  });

  it('opens branch switcher modal and switches branch on click', async () => {
    renderComponent();

    // Modal initially closed
    expect(screen.queryByTestId('branch-modal-overlay')).not.toBeInTheDocument();

    // Click switch branch button
    const switchBtn = screen.getByTestId('switch-branch-btn');
    fireEvent.click(switchBtn);

    // Modal open
    expect(screen.getByTestId('branch-modal-overlay')).toBeInTheDocument();
    expect(screen.getByText('Chọn chi nhánh làm việc')).toBeInTheDocument();

    // Select second branch
    const branch2Option = await screen.findByTestId('branch-option-102');
    expect(branch2Option).toHaveTextContent('Chi nhánh Quận 3');

    fireEvent.click(branch2Option);

    expect(mockSwitchBranch).toHaveBeenCalledWith(102);

    // Wait for modal state update
    expect(await screen.findByTestId('switch-branch-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('branch-modal-overlay')).not.toBeInTheDocument();
  });

  it('handles desktop mode toggle button', () => {
    const setItemSpy = vi.spyOn(window.localStorage, 'setItem');
    renderComponent();

    const desktopBtn = screen.getByTestId('desktop-mode-btn');
    fireEvent.click(desktopBtn);

    expect(setItemSpy).toHaveBeenCalledWith('annachill-ui-mode', 'desktop');
  });

  it('handles logout with confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderComponent();

    const logoutBtn = screen.getByTestId('logout-btn');
    fireEvent.click(logoutBtn);

    expect(mockLogout).toHaveBeenCalled();
  });
});
