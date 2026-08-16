import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MobileStaffAttendanceAdminView } from './MobileStaffAttendanceAdminView';
import * as staffApi from '@/features/staff/staff.api';

describe('MobileStaffAttendanceAdminView Component', () => {
  let queryClient: QueryClient;

  const mockStaffResponse = {
    data: [
      { id: 1, name: 'AnnaChillBeauty', code: 'NV000009', role: 'Quản trị viên' },
      { id: 2, name: 'Em Huệ', code: 'NV000005', role: 'Kỹ thuật viên' },
      { id: 3, name: 'Thu Phương', code: 'NV000016', role: 'Kỹ thuật viên chính' },
    ],
  };

  const mockAttendanceResponse = {
    data: [
      {
        id: 1,
        staffId: 2,
        staffCode: 'NV000005',
        checkInTime: '08:55',
        checkOutTime: '18:00',
        workMinutes: 545,
        isLate: false,
        isEarlyLeave: false,
      },
      {
        id: 2,
        staffId: 3,
        staffCode: 'NV000016',
        checkInTime: '09:15',
        checkOutTime: '21:00',
        workMinutes: 705,
        isLate: true,
        lateMinutes: 15,
      },
    ],
  };

  const mockScheduleResponse = {
    data: {
      shifts: [
        { id: 101, staffId: 2, shiftName: 'Ca sáng', date: '2026-08-17' },
        { id: 102, staffId: 3, shiftName: 'Ca Full', date: '2026-08-17' },
      ],
    },
  };

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(staffApi, 'getStaff').mockResolvedValue(mockStaffResponse as any);
    vi.spyOn(staffApi, 'getAttendance').mockResolvedValue(mockAttendanceResponse as any);
    vi.spyOn(staffApi, 'getSchedule').mockResolvedValue(mockScheduleResponse as any);
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MobileStaffAttendanceAdminView />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('renders title, week/month switch and staff attendance rows without metric boxes', async () => {
    renderComponent();

    expect(screen.getByText('Bảng chấm công')).toBeInTheDocument();

    // Segmented tabs
    expect(screen.getByRole('tab', { name: /Theo tuần/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Theo tháng/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('AnnaChillBeauty')).toBeInTheDocument();
      expect(screen.getByText('Em Huệ')).toBeInTheDocument();
      expect(screen.getByText('Thu Phương')).toBeInTheDocument();
    });
  });

  it('switches between week and month modes', async () => {
    renderComponent();

    const monthTab = screen.getByRole('tab', { name: /Theo tháng/i });
    fireEvent.click(monthTab);

    await waitFor(() => {
      expect(screen.queryByLabelText('Tuần trước')).not.toBeInTheDocument();
    });
  });

  it('opens detail bottom sheet when clicking a staff row to view GPS log', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Thu Phương')).toBeInTheDocument();
    });

    const staffRow = screen.getByText('Thu Phương').closest('.mobile-grouped-row');
    fireEvent.click(staffRow!);

    await waitFor(() => {
      expect(screen.getByText('Nhật ký chấm công GPS')).toBeInTheDocument();
      expect(screen.getByText('Tổng giờ làm thực tế')).toBeInTheDocument();
      expect(screen.getByText('Nhật ký quét mã chi tiết')).toBeInTheDocument();
    });
  });
});
