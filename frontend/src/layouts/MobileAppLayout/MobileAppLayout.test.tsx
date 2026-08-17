import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast/ToastProvider';
import { MobileAppLayout } from './MobileAppLayout';
import * as auth from '@/features/auth/AuthProvider';

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
});
