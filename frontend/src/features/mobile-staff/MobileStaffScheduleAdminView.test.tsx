import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast/ToastProvider';
import { MobileStaffScheduleAdminView } from './MobileStaffScheduleAdminView';
import * as staffApi from '@/features/staff/staff.api';

describe('MobileStaffScheduleAdminView Component', () => {
  let queryClient: QueryClient;

  const mockStaffResponse = {
    data: [
      { id: 1, name: 'AnnaChillBeauty', code: 'NV000009', role: 'Quản trị viên' },
      { id: 2, name: 'Em Huệ', code: 'NV000005', role: 'Kỹ thuật viên' },
      { id: 3, name: 'Thu Phương', code: 'NV000016', role: 'Kỹ thuật viên chính' },
    ],
  };

  const mockShiftsResponse = {
    data: [
      { name: 'Ca Partime', startsAt: '18:00', endsAt: '22:00' },
      { name: 'Ca Full', startsAt: '09:00', endsAt: '21:00' },
      { name: 'Ca sáng chuẩn', startsAt: '09:00', endsAt: '20:00' },
    ],
  };

  const mockScheduleResponse = {
    data: {
      shifts: [
        {
          id: 101,
          staffId: 3,
          shiftDate: '2026-08-17',
          date: '2026-08-17',
          startsAt: '09:00',
          endsAt: '21:00',
          shiftName: 'Ca Full',
          status: 'scheduled',
        },
      ],
    },
  };

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(staffApi, 'getStaff').mockResolvedValue(mockStaffResponse as any);
    vi.spyOn(staffApi, 'getShifts').mockResolvedValue(mockShiftsResponse as any);
    vi.spyOn(staffApi, 'getSchedule').mockResolvedValue(mockScheduleResponse as any);
    vi.spyOn(staffApi, 'assignShift').mockResolvedValue({ success: true } as any);
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter>
            <MobileStaffScheduleAdminView />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );

  it('renders title, week navigator, and staff schedule list without metric cards', async () => {
    renderComponent();

    expect(screen.getByText('Lịch làm việc')).toBeInTheDocument();

    // Weekday chips
    expect(screen.getByText('T2')).toBeInTheDocument();
    expect(screen.getByText('CN')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('AnnaChillBeauty')).toBeInTheDocument();
      expect(screen.getByText('Em Huệ')).toBeInTheDocument();
      expect(screen.getByText('Thu Phương')).toBeInTheDocument();
    });
  });

  it('toggles view mode between by-staff and by-shift', async () => {
    renderComponent();

    const shiftTab = screen.getByRole('tab', { name: /Theo ca làm/i });
    fireEvent.click(shiftTab);

    await waitFor(() => {
      expect(screen.getByText(/Ca Partime/)).toBeInTheDocument();
      expect(screen.getByText(/Ca Full/)).toBeInTheDocument();
      expect(screen.getByText(/Ca sáng chuẩn/)).toBeInTheDocument();
    });
  });

  it('opens assign shift bottom sheet when clicking assign button', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Em Huệ')).toBeInTheDocument();
    });

    const assignBtns = screen.getAllByRole('button', { name: /Xếp ca|Đổi ca/i });
    fireEvent.click(assignBtns[0]);

    await waitFor(() => {
      expect(screen.getByText('Chọn ca làm việc')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeInTheDocument();
    });

    // Click confirm
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));

    await waitFor(() => {
      expect(staffApi.assignShift).toHaveBeenCalled();
    });
  });
});
