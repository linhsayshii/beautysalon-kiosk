import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MobileStaffPayrollAdminView } from './MobileStaffPayrollAdminView';
import * as staffApi from '@/features/staff/staff.api';

describe('MobileStaffPayrollAdminView Component', () => {
  let queryClient: QueryClient;

  const mockPayrollListResponse = {
    data: [
      {
        id: 1,
        code: 'BL-2026-08',
        name: 'Bảng lương tháng 08/2026',
        periodType: 'monthly',
        startsOn: '2026-08-01',
        endsOn: '2026-08-31',
        status: 'approved',
        totalStaffCount: 3,
        totalNetSalary: 27500000,
        totalPaidAmount: 16200000,
        totalRemainingAmount: 11300000,
        totalCommission: 7400000,
      },
    ],
    summary: {
      totalNetSalary: 27500000,
      totalPaidAmount: 16200000,
      totalRemainingAmount: 11300000,
      totalCommission: 7400000,
    },
  };

  const mockPayrollDetailResponse = {
    data: {
      period: {
        id: 1,
        code: 'BL-2026-08',
        name: 'Bảng lương tháng 08/2026',
        periodType: 'monthly',
        startsOn: '2026-08-01',
        endsOn: '2026-08-31',
        status: 'approved',
      },
      records: [
        {
          id: 1,
          code: 'PL001',
          staff: { id: 4, code: 'NV000016', name: 'Thu Phương', role: 'Kỹ thuật viên chính' },
          baseSalary: 6000000,
          overtimeSalary: 500000,
          allowance: 1000000,
          bonus: 500000,
          commission: 3200000,
          deduction: 0,
          totalIncome: 11200000,
          netSalary: 11200000,
          paidAmount: 11200000,
          remainingAmount: 0,
          workUnits: 26,
          standardWorkDays: 26,
          hourlyRate: 45000,
          status: 'approved',
        },
      ],
      summary: {
        totalStaff: 1,
        totalBaseSalary: 6000000,
        totalOvertimeSalary: 500000,
        totalAllowance: 1000000,
        totalBonus: 500000,
        totalCommission: 3200000,
        totalDeduction: 0,
        totalIncome: 11200000,
        totalNetSalary: 11200000,
        totalPaidAmount: 11200000,
        totalRemainingAmount: 0,
      },
    },
  };

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(staffApi, 'getPayrollList').mockResolvedValue(mockPayrollListResponse as any);
    vi.spyOn(staffApi, 'getPayrollDetail').mockResolvedValue(mockPayrollDetailResponse as any);
  });

  it('renders title, summary metrics, period type switch, and staff payroll cards', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MobileStaffPayrollAdminView />
      </QueryClientProvider>
    );

    expect(screen.getByText('Bảng tính lương nhân sự')).toBeInTheDocument();
    expect(screen.getByText('Tổng thực lĩnh')).toBeInTheDocument();
    expect(screen.getByText('Đã chi trả')).toBeInTheDocument();
    expect(screen.getByText('Còn lại cần trả')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Thu Phương')).toBeInTheDocument();
      expect(screen.getByText('NV000016 • Kỹ thuật viên chính')).toBeInTheDocument();
      expect(screen.getByText('Đã chốt lương')).toBeInTheDocument();
    });
  });

  it('filters payroll records using search input', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MobileStaffPayrollAdminView />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Thu Phương')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Tìm phiếu lương theo tên, mã thợ...');
    fireEvent.change(searchInput, { target: { value: 'KhôngTồnTại' } });

    await waitFor(() => {
      expect(screen.getByText('Chưa có bảng lương')).toBeInTheDocument();
    });
  });

  it('opens payslip detail bottom sheet when clicking a payroll card', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MobileStaffPayrollAdminView />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Thu Phương')).toBeInTheDocument();
    });

    const card = screen.getByText('Thu Phương').closest('.mobile-card');
    fireEvent.click(card!);

    await waitFor(() => {
      expect(screen.getByText('Chi tiết phiếu lương')).toBeInTheDocument();
      expect(screen.getByText('Thực lĩnh kỳ này')).toBeInTheDocument();
      expect(screen.getByText('Chi tiết thu nhập & khấu trừ')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Đóng phiếu lương' })).toBeInTheDocument();
    });
  });
});
