import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MobilePosView } from './MobilePosView';
import * as posApi from '@/features/pos/pos.api';
import * as auth from '@/features/auth/AuthProvider';

describe('MobilePosView Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(auth, 'useAuth').mockReturnValue({
      account: { id: 1, role: 'manager', displayName: 'Manager', branchId: 1, branchName: 'CN1', staffId: null, staffCode: null, phone: '', email: '', username: 'admin' },
      loading: false, login: vi.fn(), logout: vi.fn(), updateLocalAccount: vi.fn(), switchBranch: vi.fn(),
    });
    vi.spyOn(posApi, 'getPosCatalog').mockResolvedValue({
      data: [
        { itemId: 1, itemType: 'package', code: 'RF01', name: 'RF Needle Skinlip 1 buổi', category: 'gói dịch vụ', unit: 'buổi', salePrice: 2500000, stockQuantity: null },
        { itemId: 2, itemType: 'service', code: 'GOI01', name: 'Gội đầu 60k', category: 'dầu gội', unit: 'lần', salePrice: 60000, stockQuantity: null },
      ],
      meta: {},
    });
    vi.spyOn(posApi, 'getPosStaff').mockResolvedValue({ data: [], meta: {} });
  });

  it('renders search bar, category tabs, and grouped item cards correctly', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MobilePosView />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByPlaceholderText('Tìm hàng hóa')).toBeInTheDocument();
    expect(screen.getByText('Tất cả')).toBeInTheDocument();
    expect(screen.getByText('Dịch vụ')).toBeInTheDocument();
    expect(screen.getByText('Gói DV')).toBeInTheDocument();
    expect(screen.getByText('Thẻ TK')).toBeInTheDocument();
    expect(screen.getByText('Sản phẩm')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('RF Needle Skinlip 1 buổi')).toBeInTheDocument();
      expect(screen.getByText(/2[.,]500[.,]000/)).toBeInTheDocument();
      expect(screen.getByText('Gội đầu 60k')).toBeInTheDocument();
      expect(screen.getByText(/60[.,]000/)).toBeInTheDocument();
    });
  });

  it('adds item to cart and opens bottom sheet checkout on cart bar click', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MobilePosView />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => screen.getByText('Gội đầu 60k'));
    fireEvent.click(screen.getByText('Gội đầu 60k'));

    expect(screen.getByText(/Giỏ hàng \(1\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/60[.,]000/i).length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole('button', { name: /^Thanh toán$/i }));
    expect(screen.getByText('Chi tiết giỏ hàng & Thanh toán')).toBeInTheDocument();
  });
});
