import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/Toast/ToastProvider';
import { weekStartIso } from '@/lib/date';
import { StaffAttendanceView } from './StaffAttendanceView';
import * as staffApi from '../staff.api';

vi.mock('../staff.api');

describe('StaffAttendanceView', () => {
  it('uses the assignments created in the work schedule as attendance shifts', async () => {
    const currentMonday = weekStartIso();
    vi.mocked(staffApi.getStaff).mockResolvedValue({
      data: [{ id: 41, name: 'Mai Anh', code: 'NV000041', role: 'Kỹ thuật viên' }],
    } as any);
    vi.mocked(staffApi.getShifts).mockResolvedValue({
      data: [{ name: 'Ca tư vấn da', startsAt: '10:00', endsAt: '18:00' }],
    } as any);
    vi.mocked(staffApi.getSchedule).mockResolvedValue({
      data: {
        shifts: [{ name: 'Ca tư vấn da', startsAt: '10:00', endsAt: '18:00' }],
        schedules: [{
          id: 99,
          staffId: 41,
          shiftDate: currentMonday,
          startsAt: '10:00',
          endsAt: '18:00',
          shiftName: 'Ca tư vấn da',
          status: 'scheduled',
        }],
      },
    } as any);
    vi.mocked(staffApi.getAttendance).mockResolvedValue({ data: [] } as any);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <StaffAttendanceView />
        </ToastProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Mai Anh')).toBeInTheDocument();
    });
    expect(screen.getByText('Ca tư vấn da')).toBeInTheDocument();
    expect(screen.getAllByText('10:00 - 18:00')).toHaveLength(2);
  });
});
