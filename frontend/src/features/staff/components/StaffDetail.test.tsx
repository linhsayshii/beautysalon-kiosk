import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaffDetail } from './StaffDetail';
import * as staffApi from '../staff.api';

vi.mock('../staff.api');

const mockStaff = {
  id: 1,
  code: 'NV0001',
  name: 'Nguyễn Văn A',
  role: 'Kỹ thuật viên',
  department: 'Chăm sóc da',
  phone: '0912345678',
  avatarTone: 'blue',
  branchName: 'Chi nhánh Quận 1',
  salaryType: 'monthly',
  baseSalary: 8000000,
  hourlyRate: 50000,
  defaultCommissionRate: 0.1,
  canSell: true,
  canManageInventory: true,
  active: true,
  startDate: '2026-01-15T00:00:00.000Z',
  createdAt: '2026-01-15T00:00:00.000Z',
  monthRevenue: 25000000,
  monthOrders: 15,
  debtBalance: 500000,
  advanceBalance: 200000,
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

describe('StaffDetail Component', () => {
  it('renders 5-layer layout: tabs, profile head, 4-column value strip, and info grid', async () => {
    const handleEdit = vi.fn();

    renderWithClient(<StaffDetail staff={mockStaff} onEdit={handleEdit} />);

    // Layer 2: Check all 5 inline detail tabs
    expect(screen.getByRole('tab', { name: /Thông tin/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Lịch làm việc/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Thiết lập lương/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Phiếu lương/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Nợ và tạm ứng/i })).toBeInTheDocument();

    // Layer 3: Check profile head
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.getByText('NV0001')).toBeInTheDocument();
    expect(screen.getAllByText('Kỹ thuật viên').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Chi nhánh Quận 1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Ngày tạo:/i)).toBeInTheDocument();

    // Layer 4: 4-Column Value Strip
    expect(screen.getByText(/Doanh thu tháng:/i)).toBeInTheDocument();
    expect(screen.getByText('25.000.000đ')).toBeInTheDocument();
    expect(screen.getByText(/Đơn tháng này:/i)).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getAllByText(/Lương cơ bản:/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('8.000.000đ').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Hoa hồng mặc định:/i)).toBeInTheDocument();
    expect(screen.getByText('10%')).toBeInTheDocument();

    // Layer 5 (Tab info): 4-column grid fields
    expect(screen.getByText('Số điện thoại:')).toBeInTheDocument();
    expect(screen.getByText('0912345678')).toBeInTheDocument();
    expect(screen.getByText('Phòng ban:')).toBeInTheDocument();
    expect(screen.getByText('Chăm sóc da')).toBeInTheDocument();
    expect(screen.getByText('Chức danh:')).toBeInTheDocument();
    expect(screen.getByText('Chi nhánh làm việc:')).toBeInTheDocument();
    expect(screen.getByText('Hình thức lương:')).toBeInTheDocument();
    expect(screen.getByText('Trạng thái hoạt động:')).toBeInTheDocument();
    expect(screen.getByText('Đang hoạt động')).toBeInTheDocument();
    expect(screen.getByText('Ngày vào làm:')).toBeInTheDocument();
    expect(screen.getByText('Quyền thao tác:')).toBeInTheDocument();
    expect(screen.getByText('Bán hàng, Quản lý kho')).toBeInTheDocument();

    // Action button "Cập nhật" in Info tab
    const updateButtons = screen.getAllByRole('button', { name: /Cập nhật/i });
    expect(updateButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(updateButtons[0]);
    expect(handleEdit).toHaveBeenCalledWith('info');
  });

  it('switches tabs properly to schedule, salary, payslips, and debt', async () => {
    const handleEdit = vi.fn();

    vi.mocked(staffApi.getSchedule).mockResolvedValue({
      data: {
        shifts: [
          {
            id: 10,
            staffId: 1,
            date: new Date().toISOString().slice(0, 10),
            shiftName: 'Ca sáng',
            startsAt: '08:00',
            endsAt: '12:00',
            status: 'scheduled',
          },
        ],
      },
    } as any);

    vi.mocked(staffApi.getPayroll).mockResolvedValue({
      data: {
        period: {
          startsOn: '2026-08-01',
          endsOn: '2026-08-31',
        },
        rows: [
          {
            id: 1,
            staff: { id: 1 },
            baseSalary: 8000000,
            commission: 2500000,
            allowance: 500000,
            netSalary: 11000000,
            status: 'approved',
          },
        ],
      },
    } as any);

    renderWithClient(<StaffDetail staff={mockStaff} onEdit={handleEdit} />);

    // Switch to Schedule Tab
    fireEvent.click(screen.getByRole('tab', { name: /Lịch làm việc/i }));
    expect(await screen.findByText('Lịch làm việc trong tuần')).toBeInTheDocument();
    expect(screen.getByText('Ca làm việc')).toBeInTheDocument();

    // Switch to Salary Tab
    fireEvent.click(screen.getByRole('tab', { name: /Thiết lập lương/i }));
    expect(screen.getByText('Lương làm thêm giờ:')).toBeInTheDocument();
    expect(screen.getByText('50.000đ / giờ')).toBeInTheDocument();
    const updateSalaryBtn = screen.getByRole('button', { name: /Cập nhật/i });
    fireEvent.click(updateSalaryBtn);
    expect(handleEdit).toHaveBeenCalledWith('salary');

    // Switch to Payslips Tab
    fireEvent.click(screen.getByRole('tab', { name: /Phiếu lương/i }));
    expect(await screen.findByText('PL000001')).toBeInTheDocument();
    expect(screen.getByText('11.000.000đ')).toBeInTheDocument();

    // Switch to Debt Tab
    fireEvent.click(screen.getByRole('tab', { name: /Nợ và tạm ứng/i }));
    expect(screen.getByText('Dư nợ hiện tại:')).toBeInTheDocument();
    expect(screen.getByText('500.000đ')).toBeInTheDocument();
    expect(screen.getByText('Tạm ứng trong kỳ:')).toBeInTheDocument();
    expect(screen.getByText('200.000đ')).toBeInTheDocument();
    expect(screen.getByText('Đang có khoản nợ cần thu')).toBeInTheDocument();
  });
});
