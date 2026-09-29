import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MobilePosView } from './MobilePosView';
import * as posApi from '@/features/pos/pos.api';
import * as auth from '@/features/auth/AuthProvider';
import { WebSocketProvider } from '@/context/WebSocketContext';
import { ToastProvider } from '@/components/ui/Toast/ToastProvider';

vi.mock('@/services/websocket', () => ({
  createPosSocketConnection: vi.fn(() => ({
    isConnected: () => true,
    disconnect: vi.fn(),
  })),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <WebSocketProvider><ToastProvider>{children}</ToastProvider></WebSocketProvider>
);

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
    vi.spyOn(posApi, 'getPosPaymentRequests').mockResolvedValue({ data: [], meta: {} });
  });

  it('renders search bar, category tabs, and grouped item cards correctly', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <WebSocketProvider><ToastProvider>
          <MemoryRouter>
            <MobilePosView />
          </MemoryRouter>
        </ToastProvider></WebSocketProvider>
      </QueryClientProvider>
    );

    expect(screen.getByPlaceholderText('Tìm tên, mã, mã vạch')).toBeInTheDocument();
    expect(screen.getByText('Tất cả')).toBeInTheDocument();
    expect(screen.getByText('Dịch vụ')).toBeInTheDocument();
    expect(screen.getByText('Gói DV')).toBeInTheDocument();
    expect(screen.getByText('Thẻ TK')).toBeInTheDocument();
    expect(screen.getByText('Sản phẩm')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('RF Needle Skinlip 1 buổi')).toBeInTheDocument();
      expect(screen.getByText('2.500.000đ')).toBeInTheDocument();
      expect(screen.getByText('Gội đầu 60k')).toBeInTheDocument();
      expect(screen.getByText('60.000đ')).toBeInTheDocument();
    });
  });

  it('adds item to cart and opens bottom sheet checkout on cart bar click', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <WebSocketProvider><ToastProvider>
          <MemoryRouter>
            <MobilePosView />
          </MemoryRouter>
        </ToastProvider></WebSocketProvider>
      </QueryClientProvider>
    );

    await waitFor(() => screen.getByText('Gội đầu 60k'));
    fireEvent.click(screen.getByText('Gội đầu 60k'));

    expect(screen.getByText(/Giỏ hàng \(1\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/60[.,]000/i).length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole('button', { name: /^Thanh toán ·/i }));
    expect(screen.getByRole('dialog', { name: 'Thanh toán' })).toBeInTheDocument();
  });

  it('adds a scanned product to the cart', async () => {
    vi.spyOn(posApi, 'findPosItemsByBarcode').mockResolvedValue([{
      itemId: 9, itemType: 'product', code: 'SP000009', barcode: '8931234567890', name: 'Toner hoa hồng',
      category: 'Mỹ phẩm', unit: 'chai', salePrice: 150000, stockQuantity: 4,
    }]);
    render(
      <QueryClientProvider client={queryClient}>
        <WebSocketProvider><ToastProvider>
          <MemoryRouter>
            <MobilePosView />
          </MemoryRouter>
        </ToastProvider></WebSocketProvider>
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Quét mã vạch' }));
    fireEvent.change(screen.getByLabelText('Hoặc nhập mã vạch'), { target: { value: '8931234567890' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));

    await waitFor(() => expect(screen.getByText(/Giỏ hàng \(1\)/i)).toBeInTheDocument());
    expect(posApi.findPosItemsByBarcode).toHaveBeenCalledWith('8931234567890', undefined);
    expect(screen.getByText('Đã thêm vào giỏ hàng')).toBeInTheDocument();
  });

  it('lists the matches instead of guessing when several items share a scanned code', async () => {
    vi.spyOn(posApi, 'findPosItemsByBarcode').mockResolvedValue([
      { itemId: 9, itemType: 'product', code: 'SP000009', barcode: '6947991205424', name: 'Mặt nạ Chando' },
      { itemId: 10, itemType: 'product', code: '6947991205424', barcode: '', name: 'Mặt nạ Chando' },
    ]);
    render(
      <QueryClientProvider client={queryClient}>
        <WebSocketProvider><ToastProvider>
          <MemoryRouter>
            <MobilePosView />
          </MemoryRouter>
        </ToastProvider></WebSocketProvider>
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Quét mã vạch' }));
    fireEvent.change(screen.getByLabelText('Hoặc nhập mã vạch'), { target: { value: '6947991205424' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));

    expect(await screen.findByText('Nhiều hàng hóa cùng mã')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Tìm tên, mã, mã vạch')).toHaveValue('6947991205424');
    expect(screen.queryByText(/Giỏ hàng \(1\)/i)).not.toBeInTheDocument();
  });

  it('shows an actionable payment request for cashier or manager', async () => {
    vi.spyOn(posApi, 'getPosPaymentRequests').mockResolvedValue({
      data: [{
        id: 51, code: 'INV-51', total: 300000, issuedAt: '2026-08-22T09:00:00Z',
        paymentRequestedAt: '2026-08-22T10:00:00Z', requestedByName: 'KTV An',
        customer: { name: 'Nguyễn Thị Hoa', phone: '0901234567' },
        serviceProgress: { total: 2, completed: 2 },
      }],
      meta: {},
    });

    render(
      <QueryClientProvider client={queryClient}>
        <WebSocketProvider><ToastProvider>
          <MemoryRouter>
            <MobilePosView />
          </MemoryRouter>
        </ToastProvider></WebSocketProvider>
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByText('Nguyễn Thị Hoa')).toBeInTheDocument());
    expect(
      within(screen.getByLabelText('Hóa đơn chờ thanh toán')).getByRole('button', { name: 'Thanh toán' }),
    ).toBeInTheDocument();
  });
});
