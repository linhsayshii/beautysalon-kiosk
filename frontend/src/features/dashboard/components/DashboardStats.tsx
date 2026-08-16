import { formatNumber } from '@/lib/format';
import type { ApiRecord } from '@/types/api';

export function DashboardStats({ dashboard }: { dashboard: ApiRecord }) {
  const { appointments, customers, cash } = dashboard.summary;
  const totalCustomers = Math.max(customers.total, 1);
  const newShare = (customers.new / totalCustomers) * 100;
  const returningShare = (customers.returning / totalCustomers) * 100;
  const cashMax = Math.max(cash.income, cash.expense, 1);
  const completionRate = Math.min(100, Math.max(0, Number(appointments.completionRate)));
  return <div className="stats-grid">
    <article className="card stat-card appointments-stat">
      <div className="stat-copy">
        <div className="card-title-row">
          <span className="title-icon blue"><i className="ph ph-calendar-check" /></span>
          <h2>Lịch hẹn</h2>
          <span className={`trend ${appointments.changePercent < 0 ? 'negative' : 'positive'}`}>
            <i className={`ph ${appointments.changePercent < 0 ? 'ph-arrow-down' : 'ph-arrow-up'}`} />
            {Math.abs(appointments.changePercent).toFixed(2)}%
          </span>
        </div>
        <strong className="stat-value">{formatNumber(appointments.total)}</strong>
        <p>So với cùng kỳ trước</p>
      </div>
      <div className="gauge" role="img" aria-label={`Hoàn thành ${completionRate} phần trăm`}>
        <svg viewBox="0 0 100 58">
          <path className="gauge-track" pathLength="100" d="M 10 52 A 40 40 0 0 1 90 52" />
          <path className="gauge-progress" pathLength="100" style={{ strokeDasharray: `${completionRate} 100` }} d="M 10 52 A 40 40 0 0 1 90 52" />
        </svg>
        <span className="gauge-label">
          <strong>{completionRate.toFixed(2)}%</strong>
          <span>Hoàn thành: {appointments.completed} lịch</span>
        </span>
      </div>
    </article>
    <article className="card stat-card customer-stat"><div className="stat-copy"><div className="card-title-row"><span className="title-icon sky"><i className="ph ph-users" /></span><h2>Khách hàng</h2></div><strong className="stat-value">{formatNumber(customers.total)}</strong><ul className="legend-list"><li><span className="dot blue" />Khách mới <strong>{customers.new} lượt</strong></li><li><span className="dot sky" />Quay lại <strong>{customers.returning} lượt</strong></li><li><span className="dot pale" />Khách lẻ <strong>{customers.walkIn} lượt</strong></li></ul></div><div className="donut" role="img" aria-label={`${Math.round(returningShare)} phần trăm khách quay lại`} style={{ background: `conic-gradient(var(--blue-700) 0 ${newShare}%, var(--blue-400) ${newShare}% ${newShare + returningShare}%, var(--blue-200) ${newShare + returningShare}% 100%)` }}><span>{Math.round(returningShare)}%</span></div></article>
    <article className="card stat-card cash-stat"><div className="stat-copy"><div className="card-title-row"><span className="title-icon green"><i className="ph ph-wallet" /></span><h2>Thu chi hôm nay</h2></div><strong className="stat-value">{formatNumber(cash.income)}đ</strong><ul className="legend-list compact"><li><span className="dot blue" />Tiền thu <strong>{formatNumber(cash.income)}đ</strong></li><li><span className="dot pale" />Tiền chi <strong>{formatNumber(cash.expense)}đ</strong></li></ul></div><div className="mini-bars" role="img" aria-label={`Tiền thu ${formatNumber(cash.income)} đồng, tiền chi ${formatNumber(cash.expense)} đồng`}><span style={{ '--h': `${cash.income / cashMax * 100}%` } as React.CSSProperties} /><span style={{ '--h': `${cash.expense / cashMax * 100}%` } as React.CSSProperties} /></div></article>
  </div>;
}
