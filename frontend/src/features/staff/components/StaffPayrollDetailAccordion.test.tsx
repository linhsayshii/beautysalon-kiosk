import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/Toast/ToastProvider';
import { StaffPayrollDetailAccordion } from './StaffPayrollDetailAccordion';
import * as staffApi from '../staff.api';
import * as exportLib from '@/lib/export';

vi.mock('../staff.api');
vi.mock('@/lib/export', () => ({
  exportCsv: vi.fn(),
}));

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
    {
      id: 102,
      code: 'PL000102',
      staff: {
        id: 11,
        code: 'NV0011',
        name: 'Trần Thị B',
        role: 'Lễ tân',
      },
      baseSalary: 7000000,
      overtimeSalary: 0,
      allowance: 200000,
      bonus: 0,
      commission: 500000,
      deduction: 0,
      totalIncome: 7700000,
      netSalary: 7700000,
      paidAmount: 7700000,
      remainingAmount: 0,
      workUnits: 26,
      standardWorkDays: 26,
      hourlyRate: 40000,
      status: 'paid',
    },
  ],
  payments: [
    {
      id: 201,
      amount: 5000000,
      paymentMethod: 'cash',
      paidAt: '2026-08-15T14:30:00.000Z',
      note: 'Tạm ứng lương đợt 1',
      staff: { id: 10, code: 'NV0010', name: 'Nguyễn Văn A' },
      actorName: 'Thủ quỹ Mai',
    },
  ],
  summary: {
    totalStaff: 2,
    totalBaseSalary: 15000000,
    totalOvertimeSalary: 500000,
    totalAllowance: 500000,
    totalBonus: 200000,
    totalCommission: 2000000,
    totalDeduction: 0,
    totalIncome: 18200000,
    totalNetSalary: 18200000,
    totalPaidAmount: 12700000,
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

describe('StaffPayrollDetailAccordion Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(staffApi.getPayrollDetail).mockResolvedValue({
      data: mockPayrollDetail,
    } as any);
  });

  it('renders all 5 layers: tabs, profile head, 4-column value strip, and info grid', async () => {
    const handleOpenSheet = vi.fn();

    renderWithClient(
      <StaffPayrollDetailAccordion periodId={1} onOpenSheetView={handleOpenSheet} />
    );

    // Layer 2: Tabs
    expect(await screen.findByRole('tab', { name: /Thông tin/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Phiếu lương \(2\)/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Lịch sử thanh toán \(1\)/i })).toBeInTheDocument();

    // Layer 3: Profile Head
    expect(screen.getAllByText('Bảng lương tháng 08/2026').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('BL202608').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Quản trị viên/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Kỳ làm việc:/i).length).toBeGreaterThanOrEqual(1);

    // Layer 4: 4-Column Value Strip
    expect(screen.getByText(/Tổng số nhân viên:/i)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/Tổng tiền lương:/i)).toBeInTheDocument();
    expect(screen.getByText('18.200.000đ')).toBeInTheDocument();
    expect(screen.getByText(/Đã chi trả:/i)).toBeInTheDocument();
    expect(screen.getByText('12.700.000đ')).toBeInTheDocument();
    expect(screen.getByText(/Còn cần trả:/i)).toBeInTheDocument();
    expect(screen.getByText('5.500.000đ')).toBeInTheDocument();

    // Layer 5: Tab "info" 4-column grid items
    expect(screen.getAllByText('Mã bảng lương:').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Tên bảng lương:')).toBeInTheDocument();
    expect(screen.getByText('Kỳ hạn trả:')).toBeInTheDocument();
    expect(screen.getByText('Hàng tháng')).toBeInTheDocument();
    expect(screen.getByText('Ngày tạo:')).toBeInTheDocument();
    expect(screen.getAllByText('Người tạo:').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Người lập bảng:')).toBeInTheDocument();
    expect(screen.getByText('Trạng thái:')).toBeInTheDocument();
    expect(screen.getByText('Phạm vi áp dụng:')).toBeInTheDocument();
    expect(screen.getByText('Tất cả nhân viên')).toBeInTheDocument();
    expect(screen.getByText('Người chốt lương:')).toBeInTheDocument();
    expect(screen.getByText('Nguyễn Văn B')).toBeInTheDocument();
    expect(screen.getByText('Bảng lương tạm tính kỳ tháng 8')).toBeInTheDocument();

    // Action buttons in info tab footer
    expect(screen.getByRole('button', { name: /Hủy bỏ/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tải lại dữ liệu/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Xem bảng lương/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Xuất file/i })).toBeInTheDocument();

    // Trigger onOpenSheetView
    fireEvent.click(screen.getByRole('button', { name: /Xem bảng lương/i }));
    expect(handleOpenSheet).toHaveBeenCalledWith(1);

    // Trigger export
    fireEvent.click(screen.getByRole('button', { name: /Xuất file/i }));
    expect(exportLib.exportCsv).toHaveBeenCalled();
  });

  it('handles recalculation and cancellation actions in draft mode', async () => {
    vi.mocked(staffApi.recalculatePayroll).mockResolvedValue({
      data: mockPayrollDetail,
      message: 'Tính lại thành công',
    } as any);

    vi.mocked(staffApi.cancelPayroll).mockResolvedValue({
      data: { id: 1, status: 'cancelled' },
      message: 'Hủy thành công',
    } as any);

    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);

    renderWithClient(
      <StaffPayrollDetailAccordion periodId={1} onOpenSheetView={vi.fn()} />
    );

    const recalcBtn = await screen.findByRole('button', { name: /Tải lại dữ liệu/i });
    fireEvent.click(recalcBtn);

    await waitFor(() => {
      expect(staffApi.recalculatePayroll).toHaveBeenCalledWith(1);
    });

    // Click cancel button
    const cancelBtn = screen.getByRole('button', { name: /Hủy bỏ/i });
    fireEvent.click(cancelBtn);
    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(staffApi.cancelPayroll).toHaveBeenCalledWith(1);
    });

    confirmSpy.mockRestore();
  });

  it('switches to records tab and payments tab properly', async () => {
    renderWithClient(
      <StaffPayrollDetailAccordion periodId={1} onOpenSheetView={vi.fn()} />
    );

    await screen.findAllByText('Bảng lương tháng 08/2026');

    // Switch to Tab Records
    const recordsTab = screen.getByRole('tab', { name: /Phiếu lương \(2\)/i });
    fireEvent.click(recordsTab);

    // Verify Records Table Headers & Rows
    expect(screen.getByRole('columnheader', { name: 'Mã phiếu' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Tên nhân viên' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Lương chính' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Phụ cấp / Hoa hồng' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Tổng thu nhập' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Đã trả NV' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Còn cần trả' })).toBeInTheDocument();

    // Verify Staff records rendered
    expect(screen.getByText('PL000101')).toBeInTheDocument();
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.getByText('Trần Thị B')).toBeInTheDocument();

    // Verify Payment button in records tab
    const payBtn = screen.getByRole('button', { name: /Thanh toán/i });
    expect(payBtn).toBeInTheDocument();
    fireEvent.click(payBtn);

    // Modal opens
    expect(screen.getByText('Thanh toán lương nhân viên')).toBeInTheDocument();
    const closeBtn = screen.getByRole('button', { name: /Hủy bỏ/i });
    fireEvent.click(closeBtn);

    // Switch to Tab Payments
    const paymentsTab = screen.getByRole('tab', { name: /Lịch sử thanh toán \(1\)/i });
    fireEvent.click(paymentsTab);

    // Verify Payment row
    expect(screen.getByRole('columnheader', { name: 'Thời gian' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Nhân viên nhận' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Số tiền' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Hình thức' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Người chi' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Ghi chú' })).toBeInTheDocument();

    expect(screen.getByText('Thủ quỹ Mai')).toBeInTheDocument();
    expect(screen.getByText('Tiền mặt')).toBeInTheDocument();
    expect(screen.getByText('Tạm ứng lương đợt 1')).toBeInTheDocument();
  });
});
