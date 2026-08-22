import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaffAttendanceDetail } from './StaffAttendanceDetail';
import * as staffApi from '../staff.api';

vi.mock('../staff.api');

const mockStaff = {
  id: 1,
  code: 'NV000015',
  name: 'Yến',
  role: 'Kỹ thuật viên',
  department: 'Chăm sóc da',
  phone: '0912345678',
  avatarTone: 'blue',
  branchName: 'Chi nhánh Quận 1',
  salaryType: 'monthly',
  baseSalary: 8000000,
};

function renderWithClient(ui: React.ReactElement) {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={testQueryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('StaffAttendanceDetail Component', () => {
  it('renders 5-layer layout with tabs, profile head, 4-column value strip, and timekeeping table', async () => {
    vi.mocked(staffApi.getSchedule).mockResolvedValue({
      data: {
        schedules: [],
        shifts: [],
      },
    } as any);

    vi.mocked(staffApi.getAttendance).mockResolvedValue({
      data: [],
    } as any);

    renderWithClient(
      <StaffAttendanceDetail
        staff={mockStaff}
        currentMonday="2026-08-10"
      />
    );

    // Layer 2: Tabs
    expect(screen.getByRole('tab', { name: /Bảng chấm công tuần/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Tổng hợp công & Tăng ca/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Lịch ca được xếp/i })).toBeInTheDocument();

    // Layer 3: Profile Head
    expect(screen.getByText('Yến')).toBeInTheDocument();
    expect(screen.getByText('NV000015')).toBeInTheDocument();
    expect(screen.getByText('Kỹ thuật viên')).toBeInTheDocument();
    expect(screen.getByText('Chi nhánh Quận 1')).toBeInTheDocument();
    expect(screen.getByText(/Tuần:/i)).toBeInTheDocument();

    // Layer 4: 4-Column Value Strip (empty state - no schedule/attendance data)
    expect(screen.getByText(/Ngày đi làm:/i)).toBeInTheDocument();
    expect(screen.getByText(/0 ngày \/ 0 giờ/i)).toBeInTheDocument();
    expect(screen.getByText(/Đi muộn \/ Về sớm:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/0 lần/i)).toHaveLength(2); // Late and OT both show "0 lần"
    expect(screen.getByText(/Tăng ca \(OT\):/i)).toBeInTheDocument();
    expect(screen.getByText(/Nghỉ làm \/ Vắng:/i)).toBeInTheDocument();
    expect(screen.getByText(/7 ngày/i)).toBeInTheDocument();

    // Layer 5: Timekeeping Table Columns
    expect(screen.getByRole('columnheader', { name: 'Ngày / Thứ' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Ca làm việc' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Giờ vào' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Giờ ra' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Đi muộn' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Về sớm' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Tăng ca' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Trạng thái' })).toBeInTheDocument();

    // Weekdays present
    expect(screen.getByText('Thứ hai')).toBeInTheDocument();
    expect(screen.getByText('Thứ sáu')).toBeInTheDocument();
    expect(screen.getByText('Chủ nhật')).toBeInTheDocument();
  });

  it('switches properly between summary tab and shifts tab', async () => {
    vi.mocked(staffApi.getSchedule).mockResolvedValue({
      data: {
        schedules: [],
        shifts: [],
      },
    } as any);

    vi.mocked(staffApi.getAttendance).mockResolvedValue({
      data: [],
    } as any);

    renderWithClient(
      <StaffAttendanceDetail
        staff={mockStaff}
        currentMonday="2026-08-10"
      />
    );

    // Switch to Summary Tab
    fireEvent.click(screen.getByRole('tab', { name: /Tổng hợp công & Tăng ca/i }));
    expect(screen.getByText('Tổng ngày công thực tế:')).toBeInTheDocument();
    expect(screen.getByText('Tổng giờ làm việc:')).toBeInTheDocument();
    expect(screen.getByText('Tổng thời gian muộn/sớm:')).toBeInTheDocument();
    expect(screen.getByText('Tổng giờ tăng ca:')).toBeInTheDocument();
    expect(screen.getByText('Loại lương áp dụng:')).toBeInTheDocument();
    expect(screen.getByText('Theo ngày công chuẩn')).toBeInTheDocument();

    // Switch to Shifts Tab
    fireEvent.click(screen.getByRole('tab', { name: /Lịch ca được xếp/i }));
    expect(screen.getByText('Tên ca làm việc')).toBeInTheDocument();
    expect(screen.getByText('Khung giờ')).toBeInTheDocument();
    expect(screen.getByText('Trạng thái ca')).toBeInTheDocument();
  });
});
