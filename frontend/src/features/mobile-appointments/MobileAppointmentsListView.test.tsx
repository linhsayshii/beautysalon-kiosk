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

  it('renders header with title, tabs, filter chips, and appointment cards', async () => {
    renderComponent();

    // Header
    expect(screen.getByRole('heading', { name: /Lịch dịch vụ/i })).toBeInTheDocument();

    // Tabs
    expect(screen.getByRole('tab', { name: 'Danh sách' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Lưới thời gian' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Lưới nhân viên' })).toBeInTheDocument();

    // Filter controls
    expect(screen.getByLabelText('Chọn ngày')).toBeInTheDocument();
    expect(screen.getByLabelText('Chọn nhân viên')).toBeInTheDocument();

    // Floating action button
    const fab = screen.getByRole('link', { name: /Tạo lịch hẹn mới/i });
    expect(fab).toBeInTheDocument();
    expect(fab).toHaveAttribute('href', '/m/appointments/new');

    // Appointment items
    await waitFor(() => {
      expect(screen.getByText('Nguyễn Thị Hoa')).toBeInTheDocument();
      expect(screen.getByText('Chăm sóc da chuyên sâu')).toBeInTheDocument();
      expect(screen.getByText(/bởi Trần Kỹ Thuật 1/i)).toBeInTheDocument();
      expect(screen.getByText('Lê Văn Nam')).toBeInTheDocument();
      expect(screen.getByText('Phạm Thị Lan')).toBeInTheDocument();
    });

    // Quick call buttons for customers with phone
    const phoneLinks = screen.getAllByRole('link', { name: /09/ });
    expect(phoneLinks).toHaveLength(2);
    expect(phoneLinks[0]).toHaveAttribute('href', 'tel:0901234567');
  });

  it('filters appointments by searching customer name or staff', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Nguyễn Thị Hoa')).toBeInTheDocument();
    });

    // Open search
    const searchTrigger = screen.getByLabelText('Tìm kiếm');
    fireEvent.click(searchTrigger);

    const searchInput = screen.getByPlaceholderText(/Tìm khách hàng/i);
    fireEvent.change(searchInput, { target: { value: 'Nam' } });

    expect(screen.getByText('Lê Văn Nam')).toBeInTheDocument();
    expect(screen.queryByText('Nguyễn Thị Hoa')).not.toBeInTheDocument();
    expect(screen.queryByText('Phạm Thị Lan')).not.toBeInTheDocument();
  });

  it('switches tabs smoothly', async () => {
    renderComponent();

    const timelineTab = screen.getByRole('tab', { name: 'Lưới thời gian' });
    fireEvent.click(timelineTab);

    expect(timelineTab).toHaveClass('is-active');
  });
});
