import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast/ToastProvider';
import { MobileTopBar } from './MobileTopBar';
import * as auth from '@/features/auth/AuthProvider';
import { WebSocketProvider } from '@/context/WebSocketContext';

vi.mock('@/services/websocket', () => ({
  createPosSocketConnection: vi.fn(() => ({
    isConnected: () => true,
    disconnect: vi.fn(),
  })),
}));

vi.mock('@/services/metadata', () => ({
  useStoreName: () => 'Salon thử nghiệm',
}));

describe('MobileTopBar Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  it('renders salon brand name and storefront icon on root tab /m/dashboard', () => {
    vi.spyOn(auth, 'useAuth').mockReturnValue({
      account: { id: 1, role: 'manager', displayName: 'Hằng', branchId: 1, branchName: 'Chi nhánh Quận 1', staffId: null, staffCode: null, phone: '', email: '', username: 'hang' },
      loading: false, login: vi.fn(), logout: vi.fn(), updateLocalAccount: vi.fn(), switchBranch: vi.fn(),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <WebSocketProvider>
          <ToastProvider>
            <MemoryRouter initialEntries={['/m/dashboard']}>
              <Routes>
                <Route path="/m/dashboard" element={<MobileTopBar />} />
              </Routes>
            </MemoryRouter>
          </ToastProvider>
        </WebSocketProvider>
      </QueryClientProvider>
    );

    expect(screen.getByText('Salon thử nghiệm')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /chi nhánh/i })).toBeInTheDocument();
    expect(screen.queryByTestId('mobile-topbar-back-btn')).not.toBeInTheDocument();
  });

  it('hides topbar for full-bleed subpages like /m/products that have their own embedded header', () => {
    vi.spyOn(auth, 'useAuth').mockReturnValue({
      account: { id: 1, role: 'manager', displayName: 'Hằng', branchId: 1, branchName: 'Chi nhánh Quận 1', staffId: null, staffCode: null, phone: '', email: '', username: 'hang' },
      loading: false, login: vi.fn(), logout: vi.fn(), updateLocalAccount: vi.fn(), switchBranch: vi.fn(),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <WebSocketProvider>
          <ToastProvider>
            <MemoryRouter initialEntries={['/m/products']}>
              <Routes>
                <Route path="/m/products" element={<MobileTopBar />} />
                <Route path="/m/more" element={<div>More Page</div>} />
              </Routes>
            </MemoryRouter>
          </ToastProvider>
        </WebSocketProvider>
      </QueryClientProvider>
    );

    expect(screen.queryByTestId('mobile-topbar-title')).not.toBeInTheDocument();
  });

  it('hides topbar for full-bleed subpages like /m/products and /m/appointments/new that have their own embedded header', () => {
    vi.spyOn(auth, 'useAuth').mockReturnValue({
      account: { id: 1, role: 'manager', displayName: 'Hằng', branchId: 1, branchName: 'Chi nhánh Quận 1', staffId: null, staffCode: null, phone: '', email: '', username: 'hang' },
      loading: false, login: vi.fn(), logout: vi.fn(), updateLocalAccount: vi.fn(), switchBranch: vi.fn(),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <WebSocketProvider>
          <ToastProvider>
            <MemoryRouter initialEntries={['/m/appointments/new']}>
              <Routes>
                <Route path="/m/appointments/new" element={<MobileTopBar />} />
                <Route path="/m/appointments" element={<div>Appointments List</div>} />
              </Routes>
            </MemoryRouter>
          </ToastProvider>
        </WebSocketProvider>
      </QueryClientProvider>
    );

    expect(screen.queryByTestId('mobile-topbar-title')).not.toBeInTheDocument();
  });

  it('falls back to a titled sub-page bar for routes without their own header', () => {
    vi.spyOn(auth, 'useAuth').mockReturnValue({
      account: { id: 1, role: 'manager', displayName: 'Hằng', branchId: 1, branchName: 'Chi nhánh Quận 1', staffId: null, staffCode: null, phone: '', email: '', username: 'hang' },
      loading: false, login: vi.fn(), logout: vi.fn(), updateLocalAccount: vi.fn(), switchBranch: vi.fn(),
    });

    const subpageTestCases = [
      { path: '/m/unlisted-subpage', expectedTitle: 'Chi tiết' },
    ];

    for (const { path, expectedTitle } of subpageTestCases) {
      const { unmount } = render(
        <QueryClientProvider client={queryClient}>
          <WebSocketProvider>
            <ToastProvider>
              <MemoryRouter initialEntries={[path]}>
                <Routes>
                  <Route path={path} element={<MobileTopBar />} />
                </Routes>
              </MemoryRouter>
            </ToastProvider>
          </WebSocketProvider>
        </QueryClientProvider>
      );

      expect(screen.getByTestId('mobile-topbar-title')).toHaveTextContent(expectedTitle);
      expect(screen.getByTestId('mobile-topbar-back-btn')).toBeInTheDocument();
      unmount();
    }
  });
});

