import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCommissions } from '@/features/staff/staff.api';
import { formatMoney } from '@/lib/format';
import { useAuth } from '@/features/auth/AuthProvider';
import { monthStartIso, todayIso } from '@/lib/date';
import type { ApiRecord } from '@/types/api';
import './mobile-staff.css';

export function MobileStaffSalaryView() {
  const { account } = useAuth();

  const { data: commissionData } = useQuery({
    queryKey: ['mobile-staff-commissions', monthStartIso(), todayIso()],
    queryFn: () => getCommissions(monthStartIso(), todayIso()),
  });

  // Calculate estimated salary components
  const myCommissions = useMemo(() => {
    const list = commissionData?.data?.byStaff ?? [];
    if (account?.staffId) {
      const match = list.find((item: ApiRecord) => Number(item.staffId) === Number(account.staffId));
      return Number(match?.totalCommission ?? 0);
    }
    return 3200000; // Mock fallback for technician preview
  }, [commissionData, account]);

  const baseSalary = 6500000;
  const allowances = 1000000;
  const bonus = 500000;
  const deduction = 0;
  const netSalary = baseSalary + myCommissions + allowances + bonus - deduction;

  return (
    <div className="mobile-staff-container">
      <div className="mobile-staff-header">
        <h1>Thu nhập & Hoa hồng</h1>
      </div>

      {/* Salary Hero Card */}
      <div className="salary-overview-card">
        <div className="salary-label">Thu nhập dự tính tháng này</div>
        <div className="salary-amount">{formatMoney(netSalary)}</div>
        <div className="salary-meta-row">
          <span>Lương cơ bản: <strong>{formatMoney(baseSalary)}</strong></span>
          <span>Hoa hồng: <strong>{formatMoney(myCommissions)}</strong></span>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="salary-breakdown-list">
        <h2 style={{ fontSize: 14, fontWeight: 700, margin: '8px 0 4px', color: '#0f172a' }}>
          Chi tiết các khoản
        </h2>

        <div className="salary-breakdown-item">
          <div className="breakdown-left">
            <span className="breakdown-title">Lương theo ca / Ngày công</span>
            <span className="breakdown-sub">24/26 ngày tiêu chuẩn</span>
          </div>
          <span className="breakdown-value">{formatMoney(baseSalary)}</span>
        </div>

        <div className="salary-breakdown-item">
          <div className="breakdown-left">
            <span className="breakdown-title">Hoa hồng dịch vụ & sản phẩm</span>
            <span className="breakdown-sub">Theo doanh số tháng</span>
          </div>
          <span className="breakdown-value" style={{ color: '#0284c7' }}>
            +{formatMoney(myCommissions)}
          </span>
        </div>

        <div className="salary-breakdown-item">
          <div className="breakdown-left">
            <span className="breakdown-title">Phụ cấp ăn trưa & chuyên cần</span>
            <span className="breakdown-sub">Cố định hàng tháng</span>
          </div>
          <span className="breakdown-value" style={{ color: '#16a34a' }}>
            +{formatMoney(allowances)}
          </span>
        </div>

        <div className="salary-breakdown-item">
          <div className="breakdown-left">
            <span className="breakdown-title">Thưởng đánh giá 5 sao</span>
            <span className="breakdown-sub">10 khách đánh giá tốt</span>
          </div>
          <span className="breakdown-value" style={{ color: '#16a34a' }}>
            +{formatMoney(bonus)}
          </span>
        </div>

        <div className="salary-breakdown-item">
          <div className="breakdown-left">
            <span className="breakdown-title">Giảm trừ / Đi muộn</span>
            <span className="breakdown-sub">0 vi phạm</span>
          </div>
          <span className="breakdown-value" style={{ color: '#94a3b8' }}>
            0đ
          </span>
        </div>
      </div>
    </div>
  );
}
