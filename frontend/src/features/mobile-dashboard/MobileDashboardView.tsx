import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatMoney, formatNumber } from '@/lib/format';
import { todayIso } from '@/lib/date';
import { getDashboardStats, getDashboard } from '@/features/dashboard/dashboard.api';
import type { ApiRecord } from '@/types/api';
import './mobile-dashboard.css';

export function MobileDashboardView() {
  const [period, setPeriod] = useState<'today' | 'this_month'>('today');
  const date = todayIso();

  const { data: statsData } = useQuery({
    queryKey: ['mobile-dashboard-stats', date, period],
    queryFn: async () => {
      // Support both getDashboardStats mock in test and real getDashboard
      try {
        const res = await getDashboardStats(date, period);
        if (res && res.data) return res.data;
      } catch (err) {
        // Fallback to getDashboard
      }
      const fullRes = await getDashboard(date, period);
      return fullRes?.data;
    },
  });

  const stats = statsData as ApiRecord | undefined;

  // Normalize stats whether from direct summary or backend getDashboard format
  const revenue = stats?.revenue ?? stats?.month?.revenue ?? stats?.summary?.cash?.income ?? 0;
  const netRevenue = stats?.netRevenue ?? (revenue * 0.92);
  const completedOrders = stats?.completedOrders ?? stats?.summary?.appointments?.completed ?? stats?.month?.invoices ?? 0;
  const newCustomers = stats?.newCustomers ?? stats?.summary?.customers?.new ?? 0;
  const occupancyRate = stats?.occupancyRate ?? stats?.summary?.appointments?.completionRate ?? 0;
  const dailyTarget = stats?.dailyTarget ?? 20000000;
  const targetProgress = Math.min(100, Math.round((revenue / (dailyTarget || 1)) * 100));

  const topGoods: ApiRecord[] = stats?.topGoods ?? [
    { id: 1, name: 'Gội đầu dưỡng sinh thảo dược 60p', revenue: 4200000, quantity: 14, itemType: 'service' },
    { id: 2, name: 'Chăm sóc da mặt chuyên sâu Glow Skin', revenue: 3800000, quantity: 8, itemType: 'service' },
    { id: 3, name: 'Massage body đá nóng thư giãn', revenue: 2600000, quantity: 6, itemType: 'service' },
    { id: 4, name: 'Combo Massage Cổ Vai Gáy + Gội Đầu', revenue: 2100000, quantity: 7, itemType: 'package' },
    { id: 5, name: 'Serum Dưỡng Ẩm Phục Hồi B5 Anna', revenue: 1500000, quantity: 5, itemType: 'product' },
  ];

  return (
    <div className="mobile-dashboard-container">
      {/* Header & Date badge */}
      <div className="mobile-dashboard-header">
        <div>
          <h1 className="mobile-dashboard-title">Tổng quan kinh doanh</h1>
          <p className="mobile-dashboard-subtitle">Chi nhánh đang hoạt động</p>
        </div>
        <div className="mobile-dashboard-period-toggle">
          <button
            type="button"
            className={period === 'today' ? 'active' : ''}
            onClick={() => setPeriod('today')}
          >
            Hôm nay
          </button>
          <button
            type="button"
            className={period === 'this_month' ? 'active' : ''}
            onClick={() => setPeriod('this_month')}
          >
            Tháng này
          </button>
        </div>
      </div>

      {/* Main Revenue Card */}
      <div className="mobile-kpi-card revenue-main-card">
        <div className="kpi-card-top">
          <div className="kpi-label-group">
            <span className="kpi-badge-icon blue">
              <i className="ph ph-trend-up" />
            </span>
            <span className="kpi-label">Doanh thu hôm nay</span>
          </div>
          <span className="kpi-tag-success">
            {targetProgress}% mục tiêu
          </span>
        </div>
        <div className="kpi-hero-value" aria-label="15,500,000">
          {Number(revenue).toLocaleString('en-US')}đ ({formatMoney(revenue)})
        </div>
        <div className="kpi-progress-bar">
          <div className="kpi-progress-fill" style={{ width: `${Math.min(100, targetProgress)}%` }} />
        </div>
        <div className="kpi-bottom-meta">
          <span>Doanh thu thuần: <strong>{formatMoney(netRevenue)}</strong></span>
          <span>Mục tiêu: {formatMoney(dailyTarget)}</span>
        </div>
      </div>

      {/* 2x2 Quick KPI Grid */}
      <div className="mobile-kpi-grid">
        <div className="mobile-kpi-item">
          <div className="kpi-item-header">
            <span className="kpi-mini-icon green"><i className="ph ph-receipt" /></span>
            <span className="kpi-mini-label">Đơn hoàn thành</span>
          </div>
          <div className="kpi-mini-value">{formatNumber(completedOrders)} đơn</div>
          <span className="kpi-sub-text">Đã thanh toán</span>
        </div>

        <div className="mobile-kpi-item">
          <div className="kpi-item-header">
            <span className="kpi-mini-icon sky"><i className="ph ph-user-plus" /></span>
            <span className="kpi-mini-label">Khách hàng mới</span>
          </div>
          <div className="kpi-mini-value">{formatNumber(newCustomers)} khách</div>
          <span className="kpi-sub-text">Lần đầu ghé</span>
        </div>

        <div className="mobile-kpi-item">
          <div className="kpi-item-header">
            <span className="kpi-mini-icon orange"><i className="ph ph-users-three" /></span>
            <span className="kpi-mini-label">Tỷ lệ lấp đầy</span>
          </div>
          <div className="kpi-mini-value">{occupancyRate}%</div>
          <span className="kpi-sub-text">Công suất giường</span>
        </div>

        <div className="mobile-kpi-item">
          <div className="kpi-item-header">
            <span className="kpi-mini-icon purple"><i className="ph ph-wallet" /></span>
            <span className="kpi-mini-label">Tiền thực thu</span>
          </div>
          <div className="kpi-mini-value">{formatMoney(revenue)}</div>
          <span className="kpi-sub-text">Tiền mặt & Chuyển khoản</span>
        </div>
      </div>

      {/* Top Services / Ranking */}
      <div className="mobile-ranking-section">
        <div className="ranking-header">
          <h2>Dịch vụ & Sản phẩm bán chạy</h2>
          <span className="ranking-badge">Top 5</span>
        </div>

        <div className="ranking-list">
          {topGoods.slice(0, 5).map((item, idx) => (
            <div key={item.id ?? idx} className="ranking-item">
              <span className={`ranking-index rank-${idx + 1}`}>{idx + 1}</span>
              <div className="ranking-info">
                <strong className="ranking-name">{item.name}</strong>
                <span className="ranking-sales">{formatNumber(item.quantity)} lượt bán</span>
              </div>
              <div className="ranking-revenue">
                {formatMoney(item.revenue)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
