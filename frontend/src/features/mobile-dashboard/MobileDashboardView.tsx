import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ErrorState, LoadingState } from '@/components/data-display/DataState';
import { todayIso } from '@/lib/date';
import { getDashboard } from '@/features/dashboard/dashboard.api';
import { DashboardStats } from '@/features/dashboard/components/DashboardStats';
import { DashboardCharts, type DashboardPeriod } from '@/features/dashboard/components/DashboardCharts';
import { DashboardSide, TopGoods } from '@/features/dashboard/components/DashboardSide';
import './mobile-dashboard.css';

export function MobileDashboardView() {
  const [period, setPeriod] = useState<DashboardPeriod>('this_month');
  const date = todayIso();

  const query = useQuery({
    queryKey: ['dashboard', date, period],
    queryFn: () => getDashboard(date, period),
  });

  const dashboard = query.data?.data;
  const currentDate = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());

  if (query.isPending) {
    return (
      <div className="mobile-dashboard-loading">
        <LoadingState />
      </div>
    );
  }

  if (query.error) {
    return (
      <div className="mobile-dashboard-error">
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </div>
    );
  }

  if (!dashboard) return null;

  return (
    <div className="mobile-dashboard-container">
      {/* 1. Header with Branch & Date */}
      <div className="mobile-dashboard-page-header">
        <div>
          <p className="mobile-welcome-date">{currentDate}</p>
          <h1 className="mobile-dashboard-heading">Tổng quan hoạt động</h1>
        </div>
        <div className="mobile-branch-tag">
          <span className="mobile-branch-pin"><i className="ph ph-map-pin" /></span>
          <span className="mobile-branch-info">
            <small>Chi nhánh</small>
            <strong>{dashboard.meta?.branch?.name ?? 'Chi nhánh chính'}</strong>
          </span>
        </div>
      </div>

      {/* 2. Full Desktop Cards Arranged Vertically */}
      <div className="mobile-dashboard-vertical-stack">
        {/* Stats Summary: Lịch hẹn (Gauge), Khách hàng (Donut), Thu chi (Mini-bars) */}
        <section className="mobile-dashboard-section" aria-label="Thống kê tổng quan">
          <DashboardStats dashboard={dashboard} />
        </section>

        {/* Revenue Charts: Theo giờ / ngày / thứ */}
        <section className="mobile-dashboard-section" aria-label="Biểu đồ doanh thu">
          <DashboardCharts
            dashboard={dashboard}
            period={period}
            onPeriodChange={setPeriod}
          />
        </section>

        {/* Top 5 Best Selling Goods & Services */}
        <section className="mobile-dashboard-section" aria-label="Top 5 hàng hóa bán chạy">
          <TopGoods
            rows={dashboard.topGoods ?? []}
            period={period}
            onPeriodChange={setPeriod}
          />
        </section>

        {/* Side Cards: Nhắc việc, Lịch hẹn chưa tới, Hoạt động gần đây */}
        <section className="mobile-dashboard-section" aria-label="Nhắc việc và hoạt động">
          <DashboardSide dashboard={dashboard} />
        </section>
      </div>
    </div>
  );
}

