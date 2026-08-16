import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ErrorState, LoadingState } from '@/components/data-display/DataState';
import { todayIso } from '@/lib/date';
import { getDashboard } from '../dashboard.api';
import { DashboardCharts, type DashboardPeriod } from './DashboardCharts';
import { DashboardSide, TopGoods } from './DashboardSide';
import { DashboardStats } from './DashboardStats';

export function DashboardView() {
  const [period, setPeriod] = useState<DashboardPeriod>(() => (new URLSearchParams(window.location.search).get('period') as DashboardPeriod) || 'this_month');
  const date = todayIso();
  const setDashboardPeriod = (nextPeriod: DashboardPeriod) => { setPeriod(nextPeriod); const params = new URLSearchParams(window.location.search); params.set('period', nextPeriod); window.history.replaceState({}, '', `/dashboard?${params.toString()}`); };
  const query = useQuery({ queryKey: ['dashboard', date, period], queryFn: () => getDashboard(date, period) });
  const dashboard = query.data?.data;
  const currentDate = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
  return (
    <main className="dashboard">
      <div className="page-heading">
        <div>
          <p className="welcome">{currentDate}</p>
          <h1>Tổng quan hoạt động</h1>
        </div>
        <div className="branch-selector">
          <span className="branch-icon"><i className="ph ph-map-pin" /></span>
          <span>
            <small>Chi nhánh đang xem</small>
            <strong>{dashboard?.meta.branch.name ?? 'Đang tải...'}</strong>
          </span>
        </div>
      </div>
      {query.isPending ? <LoadingState /> : query.error ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : dashboard && (
        <div className="dashboard-layout">
          <section className="dashboard-main" aria-label="Tổng quan kinh doanh">
            <DashboardStats dashboard={dashboard} />
            <DashboardCharts dashboard={dashboard} period={period} onPeriodChange={setDashboardPeriod} />
            <TopGoods rows={dashboard.topGoods} period={period} onPeriodChange={setDashboardPeriod} />
          </section>
          <DashboardSide dashboard={dashboard} />
        </div>
      )}
    </main>
  );
}
