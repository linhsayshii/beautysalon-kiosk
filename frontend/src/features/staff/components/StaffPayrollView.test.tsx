import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/Toast/ToastProvider';
import { StaffPayrollView } from './StaffPayrollView';
import * as staffApi from '../staff.api';
import * as exportLib from '@/lib/export';

vi.mock('../staff.api');
vi.mock('@/lib/export', () => ({
  exportCsv: vi.fn(),
}));

const mockPayrollListResponse = {
  data: [
    {
      id: 1,
      code: 'BL202608',
      name: 'Bảng lương tháng 08/2026',
      periodType: 'monthly',
      startsOn: '2026-08-01T00:00:00.000Z',
      endsOn: '2026-08-31T23:59:59.000Z',
      status: 'draft' as const,
      creatorType: 'staff',
      creatorName: 'Quản trị viên',
      approvedByName: 'Nguyễn Văn B',
      approvedAt: '2026-08-31T18:00:00.000Z',
      updatedDataAt: '2026-08-16T10:00:00.000Z',
      note: 'Bảng lương tạm tính kỳ tháng 8',
      createdAt: '2026-08-01T08:00:00.000Z',
      totalStaffCount: 2,
      totalNetSalary: 18200000,
      totalPaidAmount: 12700000,
      totalRemainingAmount: 5500000,
      totalCommission: 2000000,
    },
    {
      id: 2,
      code: 'BL202607',
      name: 'Bảng lương tháng 07/2026',
      periodType: 'monthly',
      startsOn: '2026-07-01T00:00:00.000Z',
      endsOn: '2026-07-31T23:59:59.000Z',
      status: 'approved' as const,
      creatorType: 'staff',
      creatorName: 'Quản trị viên',
      approvedByName: 'Nguyễn Văn B',
      approvedAt: '2026-07-31T18:00:00.000Z',
      updatedDataAt: '2026-07-31T18:00:00.000Z',
      note: 'Bảng lương đã chốt',
      createdAt: '2026-07-01T08:00:00.000Z',
      totalStaffCount: 2,
      totalNetSalary: 20000000,
      totalPaidAmount: 20000000,
      totalRemainingAmount: 0,
      totalCommission: 2500000,
    },
  ],
  summary: {
    totalNetSalary: 38200000,
    totalPaidAmount: 32700000,
    totalRemainingAmount: 5500000,
    totalCommission: 4500000,
  },
};

const mockPayrollDetail = {
  period: {
    id: 1,
    code: 'BL202608',
    name: 'Bảng lương tháng 08/2026',
    periodType: 'monthly',
    startsOn: '2026-08-01T00:00:00.000Z',
    endsOn: '2026-08-31T23:59:59.000Z',
    status: 'draft' as const,
    creatorType: 'staff',
    creatorName: 'Quản trị viên',
    approvedByName: 'Nguyễn Văn B',
    approvedAt: '2026-08-31T18:00:00.000Z',
    updatedDataAt: '2026-08-16T10:00:00.000Z',
    note: 'Bảng lương tạm tính kỳ tháng 8',
    createdAt: '2026-08-01T08:00:00.000Z',
  },
  records: [
    {
      id: 101,
      code: 'PL000101',
      staff: {
        id: 10,
        code: 'NV0010',
        name: 'Nguyễn Văn A',
        role: 'Kỹ thuật viên',
      },
      baseSalary: 8000000,
      overtimeSalary: 500000,
      allowance: 300000,
      bonus: 200000,
      commission: 1500000,
      deduction: 0,
      totalIncome: 10500000,
      netSalary: 10500000,
      paidAmount: 5000000,
      remainingAmount: 5500000,
      workUnits: 26,
      standardWorkDays: 26,
      hourlyRate: 50000,
      status: 'draft',
    },
  ],
  payments: [],
  summary: {
    totalStaff: 1,
    totalBaseSalary: 8000000,
    totalOvertimeSalary: 500000,
    totalAllowance: 300000,
    totalBonus: 200000,
    totalCommission: 1500000,
    totalDeduction: 0,
    totalIncome: 10500000,
    totalNetSalary: 10500000,
    totalPaidAmount: 5000000,
    totalRemainingAmount: 5500000,
  },
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
      <ToastProvider>
        {ui}
      </ToastProvider>
    </QueryClientProvider>
  );
}

describe('StaffPayrollView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(staffApi.getPayrollList).mockResolvedValue(mockPayrollListResponse as any);
    vi.mocked(staffApi.getPayrollDetail).mockResolvedValue({ data: mockPayrollDetail } as any);
  });

  it('renders payroll list with grand summary row and sidebar filters', async () => {
    renderWithClient(<StaffPayrollView />);

    // Check header
    expect(await screen.findByRole('heading', { level: 2, name: 'Bảng lương' })).toBeInTheDocument();

    // Check Sidebar filters
    expect(screen.getByText('Kỳ hạn trả lương')).toBeInTheDocument();
    expect(screen.getByText('Trạng thái')).toBeInTheDocument();
    expect(screen.getByLabelText(/Tạm tính/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Đã chốt lương/i)).toBeInTheDocument();

    // Check Action buttons
    expect(screen.getByRole('button', { name: /Bảng tính lương/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Xuất file/i })).toBeInTheDocument();

    // Check Table Headers
    expect(await screen.findByRole('columnheader', { name: 'Mã' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Tên' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Kỳ hạn trả' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Kỳ làm việc' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Tổng lương' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Đã trả nhân viên' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Còn cần trả' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Trạng thái' })).toBeInTheDocument();

    // Check Grand summary row values
    expect(screen.getByText('38.200.000đ')).toBeInTheDocument();
    expect(screen.getByText('32.700.000đ')).toBeInTheDocument();

    // Check Rows rendered
    expect(screen.getByText('BL202608')).toBeInTheDocument();
    expect(screen.getByText('Bảng lương tháng 08/2026')).toBeInTheDocument();
    expect(screen.getByText('BL202607')).toBeInTheDocument();
    expect(screen.getByText('Bảng lương tháng 07/2026')).toBeInTheDocument();

    // Check Pagination text
    expect(screen.getByText(/1 - 2 trong 2 bảng lương/i)).toBeInTheDocument();
  });

  it('filters rows by search term and status checkboxes', async () => {
    renderWithClient(<StaffPayrollView />);

    await screen.findByText('BL202608');
    expect(screen.getByText('BL202607')).toBeInTheDocument();

    // Type in search input
    const searchInput = screen.getByPlaceholderText('Theo mã, tên bảng lương');
    fireEvent.change(searchInput, { target: { value: '08/2026' } });

    await waitFor(() => {
      // BL202608 stays, BL202607 filtered out by useMemo
      expect(screen.getByText('BL202608')).toBeInTheDocument();
      expect(screen.queryByText('BL202607')).not.toBeInTheDocument();
    });

    // Reset search
    fireEvent.change(searchInput, { target: { value: '' } });
    await waitFor(() => {
      expect(screen.getByText('BL202607')).toBeInTheDocument();
    });

    // Uncheck "approved" status
    const approvedCheck = screen.getByLabelText(/Đã chốt lương/i);
    fireEvent.click(approvedCheck);

    await waitFor(() => {
      // Only draft BL202608 remains
      expect(screen.getByText('BL202608')).toBeInTheDocument();
      expect(screen.queryByText('BL202607')).not.toBeInTheDocument();
    });
  });

  it('triggers export file when clicking export button', async () => {
    renderWithClient(<StaffPayrollView />);

    await screen.findByText('BL202608');
    const exportBtn = screen.getByRole('button', { name: /Xuất file/i });
    fireEvent.click(exportBtn);

    expect(exportLib.exportCsv).toHaveBeenCalled();
  });

  it('toggles sheet matrix view when clicking "+ Bảng tính lương" button and returns on back', async () => {
    renderWithClient(<StaffPayrollView />);

    await screen.findByText('BL202608');

    // Click "+ Bảng tính lương"
    const sheetBtn = screen.getByRole('button', { name: /Bảng tính lương/i });
    fireEvent.click(sheetBtn);

    // Should switch to Sheet View
    expect(await screen.findByRole('heading', { level: 2, name: /Cập nhật bảng tính lương/i })).toBeInTheDocument();
    expect(screen.getByText(/Lương chính/i)).toBeInTheDocument();
    expect(screen.getByText(/Hoa hồng/i)).toBeInTheDocument();
    expect(screen.getByText(/Tổng thu nhập/i)).toBeInTheDocument();

    // Click Back button
    const backBtn = screen.getByRole('button', { name: /Quay lại/i });
    fireEvent.click(backBtn);

    // Returned to Payroll list
    expect(await screen.findByRole('heading', { level: 2, name: 'Bảng lương' })).toBeInTheDocument();
  });

  it('expands accordion detail row on table row click', async () => {
    renderWithClient(<StaffPayrollView />);

    const row = await screen.findByText('BL202608');
    fireEvent.click(row);

    // Accordion should open with Tabs
    expect(await screen.findByRole('tab', { name: /Thông tin/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Phiếu lương/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Lịch sử thanh toán/i })).toBeInTheDocument();
  });
});
