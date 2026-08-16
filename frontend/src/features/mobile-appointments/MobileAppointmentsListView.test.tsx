import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MobileAppointmentsListView } from './MobileAppointmentsListView';
import * as posApi from '@/features/pos/pos.api';

describe('MobileAppointmentsListView Component', () => {
  let queryClient: QueryClient;

  const mockAppointments = [
    {
      id: 1,
      startsAt: '2026-08-17T09:00:00.000Z',
      endsAt: '2026-08-17T10:00:00.000Z',
      status: 'confirmed',
      customer: { id: 101, name: 'Nguyễn Thị Hoa', phone: '0901234567' },
      staff: { id: 1, name: 'Trần Kỹ Thuật 1' },
      service: { id: 1, name: 'Chăm sóc da chuyên sâu', salePrice: 350000 },
    },
    {
      id: 2,
      startsAt: '2026-08-17T14:30:00.000Z',
      endsAt: '2026-08-17T15:30:00.000Z',
      status: 'in_service',
      customer: { id: 102, name: 'Lê Văn Nam', phone: '0912345678' },
      staff: { id: 2, name: 'Lê Kỹ Thuật 2' },
      service: { id: 2, name: 'Gội đầu dưỡng sinh', salePrice: 150000 },
    },
    {
      id: 3,
      startsAt: '2026-08-17T16:00:00.000Z',
      endsAt: '2026-08-17T17:00:00.000Z',
      status: 'completed',
      customer: { id: 103, name: 'Phạm Thị Lan' },
      staff: null,
      service: { id: 3, name: 'Massage cổ vai gáy', salePrice: 200000 },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.spyOn(posApi, 'getPosAppointments').mockResolvedValue({
      data: mockAppointments as any,
      meta: {} as any,
    });
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MobileAppointmentsListView />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('renders header with title, date filter buttons, status chips, and appointment cards', async () => {
    renderComponent();

    // Header
    expect(screen.getByRole('heading', { name: /Lịch dịch vụ/i })).toBeInTheDocument();

    // Date filters
    expect(screen.getByRole('button', { name: 'Hôm nay' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ngày mai' })).toBeInTheDocument();
    expect(screen.getByLabelText('Chọn ngày')).toBeInTheDocument();

    // Status chips
    expect(screen.getByRole('button', { name: 'Tất cả' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chờ phục vụ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đang làm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hoàn thành' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đã hủy' })).toBeInTheDocument();

    // Floating action button
    const fab = screen.getByRole('link', { name: /Đặt lịch/i });
    expect(fab).toBeInTheDocument();
    expect(fab).toHaveAttribute('href', '/m/appointments/new');

    // Appointment items
    await waitFor(() => {
      expect(screen.getByText('Nguyễn Thị Hoa')).toBeInTheDocument();
      expect(screen.getByText('Chăm sóc da chuyên sâu')).toBeInTheDocument();
      expect(screen.getByText('KTV: Trần Kỹ Thuật 1')).toBeInTheDocument();
      expect(screen.getByText('Lê Văn Nam')).toBeInTheDocument();
      expect(screen.getByText('Phạm Thị Lan')).toBeInTheDocument();
    });

    // Quick call buttons for customers with phone
    const callButtons = screen.getAllByRole('link', { name: /Gọi cho/i });
    expect(callButtons).toHaveLength(2);
    expect(callButtons[0]).toHaveAttribute('href', 'tel:0901234567');
  });

  it('filters appointments by status when clicking status chips', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Nguyễn Thị Hoa')).toBeInTheDocument();
    });

    // Filter by "Đang làm"
    fireEvent.click(screen.getByRole('button', { name: 'Đang làm' }));

    expect(screen.getByText('Lê Văn Nam')).toBeInTheDocument();
    expect(screen.queryByText('Nguyễn Thị Hoa')).not.toBeInTheDocument();
    expect(screen.queryByText('Phạm Thị Lan')).not.toBeInTheDocument();

    // Filter by "Hoàn thành"
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn thành' }));

    expect(screen.getByText('Phạm Thị Lan')).toBeInTheDocument();
    expect(screen.queryByText('Nguyễn Thị Hoa')).not.toBeInTheDocument();
    expect(screen.queryByText('Lê Văn Nam')).not.toBeInTheDocument();
  });

  it('switches date to Ngày mai and refetches appointments', async () => {
    renderComponent();

    const tomorrowBtn = screen.getByRole('button', { name: 'Ngày mai' });
    fireEvent.click(tomorrowBtn);

    expect(tomorrowBtn).toHaveClass('is-active');
    expect(posApi.getPosAppointments).toHaveBeenCalled();
  });
});
