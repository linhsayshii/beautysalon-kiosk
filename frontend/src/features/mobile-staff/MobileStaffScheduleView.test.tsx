import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MobileStaffScheduleView } from './MobileStaffScheduleView';
import { todayIso, weekStartIso } from '@/lib/date';
import * as staffApi from '@/features/staff/staff.api';
import * as auth from '@/features/auth/AuthProvider';

describe('MobileStaffScheduleView', () => {
  it('renders the current staff schedule returned by the self-service API', async () => {
    vi.spyOn(auth, 'useAuth').mockReturnValue({
      account: { id: 2, role: 'staff', displayName: 'Thợ', branchId: 1, branchName: 'CN1', staffId: 10, staffCode: 'NV01', phone: '', email: '', username: 'staff1' },
      loading: false, login: vi.fn(), logout: vi.fn(), updateLocalAccount: vi.fn(), switchBranch: vi.fn(),
    });
    vi.spyOn(staffApi, 'getMySchedule').mockResolvedValue({
      data: {
        startDate: weekStartIso(),
        shifts: [],
        schedules: [{ id: 1, staffId: 10, shiftDate: todayIso(), startsAt: '09:00', endsAt: '18:00', shiftName: 'Ca ngày', status: 'confirmed' }],
      },
    } as any);

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MobileStaffScheduleView />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByText('Ca ngày')).toBeInTheDocument());
    expect(staffApi.getMySchedule).toHaveBeenCalledWith(weekStartIso());
  });
});
