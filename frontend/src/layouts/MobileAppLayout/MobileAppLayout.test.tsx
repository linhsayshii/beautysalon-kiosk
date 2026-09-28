import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, Link, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast/ToastProvider';
import { MobileAppLayout } from './MobileAppLayout';
import { MobilePageHeader } from '@/components/ui/MobilePageHeader/MobilePageHeader';
import * as auth from '@/features/auth/AuthProvider';
import { WebSocketProvider } from '@/context/WebSocketContext';

vi.mock('@/services/websocket', () => ({
  createPosSocketConnection: vi.fn(() => ({
    isConnected: () => true,
    disconnect: vi.fn(),
  })),
}));

describe('MobileAppLayout Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  it('resets scroll position of main content on route change', () => {
    vi.spyOn(auth, 'useAuth').mockReturnValue({
      account: { id: 1, role: 'manager', displayName: 'Hằng', branchId: 1, branchName: 'Chi nhánh Quận 1', staffId: null, staffCode: null, phone: '', email: '', username: 'hang' },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      updateLocalAccount: vi.fn(),
      switchBranch: vi.fn(),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <WebSocketProvider>
          <ToastProvider>
            <MemoryRouter initialEntries={['/m/more']}>
              <Routes>
                <Route path="/m" element={<MobileAppLayout />}>
                  <Route path="more" element={
                    <div>
                      <h1>More Page</h1>
                      <Link to="/m/products" data-testid="to-products">Go to Products</Link>
                    </div>
                  } />
                  <Route path="products" element={<h1>Products Page</h1>} />
                </Route>
              </Routes>
            </MemoryRouter>
          </ToastProvider>
        </WebSocketProvider>
      </QueryClientProvider>
    );

    const mainContent = document.querySelector('.mobile-main-content') as HTMLElement;
    expect(mainContent).toBeInTheDocument();

    // Mock scrollTo on mainContent
    const scrollToMock = vi.fn();
    mainContent.scrollTo = scrollToMock;

    const toProductsLink = screen.getByTestId('to-products');
    fireEvent.click(toProductsLink);

    expect(screen.getByText('Products Page')).toBeInTheDocument();
    expect(scrollToMock).toHaveBeenCalledWith(0, 0);
  });

  it('restores the previous scroll position when navigating back', () => {
    vi.spyOn(auth, 'useAuth').mockReturnValue({
      account: { id: 1, role: 'manager', displayName: 'Hằng', branchId: 1, branchName: 'Chi nhánh Quận 1', staffId: null, staffCode: null, phone: '', email: '', username: 'hang' },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      updateLocalAccount: vi.fn(),
      switchBranch: vi.fn(),
    });

    function Back() {
      const navigate = useNavigate();
      return <button type="button" onClick={() => navigate(-1)}>Back</button>;
    }

    render(
      <QueryClientProvider client={queryClient}>
        <WebSocketProvider>
          <ToastProvider>
            <MemoryRouter initialEntries={['/m/more']}>
              <Routes>
                <Route path="/m" element={<MobileAppLayout />}>
                  <Route path="more" element={<Link to="/m/staff">Go to Staff</Link>} />
                  <Route path="staff" element={<Back />} />
                </Route>
              </Routes>
            </MemoryRouter>
          </ToastProvider>
        </WebSocketProvider>
      </QueryClientProvider>
    );

    const main = document.querySelector('.mobile-main-content') as HTMLElement;
    let scrollTop = 0;
    Object.defineProperty(main, 'scrollTop', { configurable: true, get: () => scrollTop, set: (value: number) => { scrollTop = value; } });
    Object.defineProperty(main, 'scrollHeight', { configurable: true, value: 2000 });
    Object.defineProperty(main, 'clientHeight', { configurable: true, value: 700 });
    main.scrollTo = vi.fn((_x: number, y: number) => { scrollTop = y; }) as unknown as typeof main.scrollTo;

    scrollTop = 900;
    fireEvent.scroll(main);
    fireEvent.click(screen.getByText('Go to Staff'));
    expect(scrollTop).toBe(0);

    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText('Go to Staff')).toBeInTheDocument();
    expect(scrollTop).toBe(900);
  });

  it('returns to the parent page position from the header back button', () => {
    vi.spyOn(auth, 'useAuth').mockReturnValue({
      account: { id: 1, role: 'manager', displayName: 'Hằng', branchId: 1, branchName: 'Chi nhánh Quận 1', staffId: null, staffCode: null, phone: '', email: '', username: 'hang' },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      updateLocalAccount: vi.fn(),
      switchBranch: vi.fn(),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <WebSocketProvider>
          <ToastProvider>
            <MemoryRouter initialEntries={['/m/more']}>
              <Routes>
                <Route path="/m" element={<MobileAppLayout />}>
                  <Route path="more" element={<><Link to="/m/staff">Go to Staff</Link><Link to="/m/dashboard">Dashboard</Link></>} />
                  <Route path="staff" element={<MobilePageHeader title="Nhân viên" backTo="/m/more" />} />
                  <Route path="dashboard" element={<Link to="/m/more">Open More</Link>} />
                </Route>
              </Routes>
            </MemoryRouter>
          </ToastProvider>
        </WebSocketProvider>
      </QueryClientProvider>
    );

    const main = document.querySelector('.mobile-main-content') as HTMLElement;
    let scrollTop = 0;
    Object.defineProperty(main, 'scrollTop', { configurable: true, get: () => scrollTop, set: (value: number) => { scrollTop = value; } });
    main.scrollTo = vi.fn((_x: number, y: number) => { scrollTop = y; }) as unknown as typeof main.scrollTo;

    scrollTop = 640;
    fireEvent.scroll(main);
    fireEvent.click(screen.getByText('Go to Staff'));
    expect(scrollTop).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }));
    expect(screen.getByText('Go to Staff')).toBeInTheDocument();
    expect(scrollTop).toBe(640);

    // Opening the page afresh (a tab or link) still starts at the top.
    fireEvent.click(screen.getByText('Dashboard'));
    fireEvent.click(screen.getByText('Open More'));
    expect(scrollTop).toBe(0);
  });
});
