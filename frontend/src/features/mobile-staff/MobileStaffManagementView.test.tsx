import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as staffApi from '@/features/staff/staff.api';
import { MobileStaffManagementView } from './MobileStaffManagementView';

vi.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: () => ({ subscribe: () => () => {} }),
}));

vi.mock('@/components/ui/Toast/ToastProvider', () => ({
  useToast: () => ({ notify: vi.fn() }),
}));

vi.mock('@/features/staff/components/StaffCreateDialog', () => ({
  StaffCreateDialog: ({ staff }: { staff: { name: string } }) => (
    <div data-testid="desktop-staff-edit-dialog">Cập nhật nhân viên: {staff.name}</div>
  ),
}));

describe('MobileStaffManagementView', () => {
  beforeEach(() => {
    vi.spyOn(staffApi, 'getStaff').mockResolvedValue({
      data: [{ id: 7, code: 'NV000007', name: 'Nguyễn Thị Lan', role: 'Kỹ thuật viên', phone: '0901234567' }],
      meta: {},
    } as any);
    vi.spyOn(staffApi, 'getAttendance').mockResolvedValue({ data: [], meta: {} } as any);
  });

  it('opens the desktop-equivalent edit dialog from the mobile staff detail sheet', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <MobileStaffManagementView />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Nguyễn Thị Lan')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Nguyễn Thị Lan').closest('.mobile-grouped-row')!);

    await waitFor(() => expect(screen.getByText('Hồ sơ nhân viên')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Sửa' }));

    expect(screen.getByTestId('desktop-staff-edit-dialog')).toHaveTextContent('Nguyễn Thị Lan');
  });
});
