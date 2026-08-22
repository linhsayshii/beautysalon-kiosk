import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/Toast/ToastProvider';
import { weekStartIso } from '@/lib/date';
import { StaffScheduleView } from './StaffScheduleView';
import * as staffApi from '../staff.api';

vi.mock('../staff.api');

describe('StaffScheduleView', () => {
  it('renders an assigned API schedule and adds every created shift to the colour legend', async () => {
    const currentMonday = weekStartIso();
    vi.mocked(staffApi.getStaff).mockResolvedValue({
      data: [{ id: 41, name: 'Mai Anh', code: 'NV000041' }],
    } as any);
    vi.mocked(staffApi.getShifts).mockResolvedValue({
      data: [{ name: 'Ca tư vấn da', startsAt: '10:00', endsAt: '18:00', color: 'blue' }],
    } as any);
    vi.mocked(staffApi.getSchedule).mockResolvedValue({
      data: {
        shifts: [{ name: 'Ca tư vấn da', startsAt: '10:00', endsAt: '18:00', color: 'blue' }],
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
    vi.mocked(staffApi.getWorkScheduleSettings).mockResolvedValue({
      data: { activeWorkDays: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'], holidays: [] },
    } as any);
    vi.mocked(staffApi.assignShift).mockResolvedValue({ data: {} } as any);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <StaffScheduleView />
        </ToastProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Mai Anh')).toBeInTheDocument();
    });

    // One label is the assigned staff cell and one is the dynamically generated legend item.
    expect(screen.getAllByText('Ca tư vấn da')).toHaveLength(2);
    expect(screen.getByText('10:00 - 18:00')).toBeInTheDocument();

    fireEvent.click(screen.getAllByText('Ca tư vấn da')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu lịch' }));

    await waitFor(() => {
      expect(staffApi.assignShift).toHaveBeenCalledWith({
        staffId: 41,
        shiftDate: currentMonday,
        startsAt: '10:00',
        endsAt: '18:00',
        shiftName: 'Ca tư vấn da',
      });
    });
  });
});
