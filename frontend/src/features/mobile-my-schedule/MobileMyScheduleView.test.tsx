import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MobileMyScheduleView } from './MobileMyScheduleView';
import * as AuthProvider from '@/features/auth/AuthProvider';

// Module-level hoisted mocks — these are stable across all tests
const mockGetPosAppointments = vi.hoisted(() => vi.fn());
const mockGetOrders = vi.hoisted(() => vi.fn());

vi.mock('@/features/pos/pos.api', () => ({
  getPosAppointments: mockGetPosAppointments,
}));

vi.mock('@/features/operations/operations.api', () => ({
  getOrders: mockGetOrders,
}));

const mockAccount = {
  id: 1,
  branchId: 1,
  staffId: 5,
  username: 'staff',
  displayName: 'Trần Kỹ Thuật 1',
  role: 'staff' as const,
  branchName: 'Chi nhánh trung tâm',
  staffCode: 'NV001',
  phone: '0901234567',
  email: 'staff@example.com',
};

describe('MobileMyScheduleView', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.spyOn(AuthProvider, 'useAuth').mockReturnValue({
      account: mockAccount,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      switchBranch: vi.fn(),
      updateLocalAccount: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    queryClient.clear();
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MobileMyScheduleView />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('shows empty state when no appointments', async () => {
    mockGetPosAppointments.mockResolvedValue({ data: [] as any[], meta: {} });
    mockGetOrders.mockResolvedValue({
      data: [] as any[],
      meta: {},
    } as any);

    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Không có lịch hẹn nào hôm nay')).toBeInTheDocument();
    });
  });

  it('renders page title', () => {
    mockGetPosAppointments.mockResolvedValue({ data: [] as any[], meta: {} });
    mockGetOrders.mockResolvedValue({
      data: [] as any[],
      meta: {},
    } as any);

    renderComponent();
    expect(screen.getByText('Lịch của tôi')).toBeInTheDocument();
  });

  it('renders appointment items for the current staff', async () => {
    mockGetPosAppointments.mockResolvedValue({
      data: [
        {
          id: 11,
          startsAt: '2026-08-21T09:00:00Z',
          endsAt: '2026-08-21T10:00:00Z',
          status: 'confirmed',
          customer: { id: 1, name: 'Nguyễn Thị Hoa', phone: '0901111111' },
          staff: { id: 5, name: 'Trần Kỹ Thuật 1' },
          service: { id: 1, name: 'Gội đầu dưỡng' },
        },
        {
          id: 12,
          startsAt: '2026-08-21T14:00:00Z',
          endsAt: '2026-08-21T15:30:00Z',
          status: 'in_service',
          customer: { id: 2, name: 'Lê Văn Minh', phone: '0902222222' },
          staff: { id: 3, name: 'Người khác' },
          service: { id: 2, name: 'Massage body' },
        },
      ] as any[],
      meta: {},
    });
    mockGetOrders.mockResolvedValue({
      data: [] as any[],
      meta: {},
    } as any);

    renderComponent();
    await waitFor(() => {
      // Only staffId=5 appointments should appear (Nguyễn Thị Hoa, not Lê Văn Minh)
      expect(screen.getByText('Nguyễn Thị Hoa')).toBeInTheDocument();
    });
    expect(screen.queryByText('Lê Văn Minh')).not.toBeInTheDocument();
  });

  it('shows checkout button for appointments with invoiceId', async () => {
    mockGetPosAppointments.mockResolvedValue({
      data: [
        {
          id: 21,
          startsAt: '2026-08-21T09:00:00Z',
          endsAt: '2026-08-21T10:00:00Z',
          status: 'confirmed',
          customer: { name: 'Trần Thị B' },
          staff: { id: 5, name: 'Trần Kỹ Thuật 1' },
          service: { name: 'Gội đầu' },
          invoiceId: 101,
        },
        {
          id: 22,
          startsAt: '2026-08-21T11:00:00Z',
          endsAt: '2026-08-21T12:00:00Z',
          status: 'confirmed',
          customer: { name: 'Nguyễn Văn C' },
          staff: { id: 5, name: 'Trần Kỹ Thuật 1' },
          service: { name: 'Nhuộm tóc' },
          // no invoiceId — should not show checkout
        },
      ] as any[],
      meta: {},
    });
    mockGetOrders.mockResolvedValue({
      data: [] as any[],
      meta: {},
    } as any);

    renderComponent();
    await waitFor(() => {
      const checkoutBtns = screen.getAllByRole('button', { name: 'Thanh toán' });
      expect(checkoutBtns).toHaveLength(1);
    });
  });
});
