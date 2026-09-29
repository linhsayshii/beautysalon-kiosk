import { useState } from 'react';
import { formatMoney, formatNumber } from '@/lib/format';
import { Select } from '@/components/ui/Select/Select';
import { axisLabel, niceCountMaximum, niceMaximum, smoothPath, visibleLabelIndexes } from '@/components/charts/chartScale';
import type { ApiRecord } from '@/types/api';

type ChartView = 'hour' | 'day' | 'weekday';
export type DashboardPeriod = 'today' | 'yesterday' | 'last_7_days' | 'this_month' | 'last_month';

const chartWidth = 700;
const chartHeight = 270;
const tickRates = [1, 0.75, 0.5, 0.25, 0];
const views: Array<{ key: ChartView; label: string }> = [
  { key: 'hour', label: 'Theo giờ' },
  { key: 'day', label: 'Theo ngày' },
  { key: 'weekday', label: 'Theo thứ' },
];
export const dashboardPeriods: Array<{ key: DashboardPeriod; value: DashboardPeriod; label: string }> = [
  { key: 'today', value: 'today', label: 'Hôm nay' },
  { key: 'yesterday', value: 'yesterday', label: 'Hôm qua' },
  { key: 'last_7_days', value: 'last_7_days', label: '7 ngày qua' },
  { key: 'this_month', value: 'this_month', label: 'Tháng này' },
  { key: 'last_month', value: 'last_month', label: 'Tháng trước' },
];

// Line charts put points on the plot edges; bar charts centre each bar in its slot.
function ChartLabels({ points, centered = false }: { points: ApiRecord[]; centered?: boolean }) {
  const count = points.length;
  const onEdges = !centered && count > 1;
  return <div className="chart-x-labels" aria-hidden="true">{visibleLabelIndexes(count).map((index) => {
    const left = centered ? (index + 0.5) / count * 100 : count > 1 ? index / (count - 1) * 100 : 50;
    const edgeClass = onEdges && index === 0 ? 'is-first' : onEdges && index === count - 1 ? 'is-last' : '';
    return <span className={edgeClass} style={{ left: `${left}%` }} key={`${points[index].label}-${index}`}>{points[index].label}</span>;
  })}</div>;
}

function LineChart({ points, view }: { points: ApiRecord[]; view: ChartView }) {
  const values = points.map((point) => Number(point.value ?? 0));
  const maximum = niceCountMaximum(values);
  const coordinates = values.map((value, index) => ({
    x: points.length > 1 ? index / (points.length - 1) * chartWidth : chartWidth / 2,
    y: chartHeight - value / maximum * (chartHeight - 8),
  }));
  return <div className="standard-chart"><div className="chart-y-labels">{tickRates.map((rate) => <span key={rate}>{axisLabel(maximum * rate)}</span>)}</div><div className="standard-chart-plot"><svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" role="img" aria-label={`Biểu đồ lượng khách ${views.find((item) => item.key === view)?.label.toLowerCase()}`}>{tickRates.map((rate) => <line className="chart-grid-line" x1="0" x2={chartWidth} y1={chartHeight * (1 - rate)} y2={chartHeight * (1 - rate)} key={rate} />)}<path className="standard-line-path" d={smoothPath(coordinates)} /></svg><ChartLabels points={points} /></div></div>;
}

function BarChart({ points, view }: { points: ApiRecord[]; view: ChartView }) {
  const values = points.map((point) => Number(point.value ?? 0));
  const maximum = niceMaximum(values);
  const slot = chartWidth / Math.max(points.length, 1);
  const barWidth = Math.min(34, slot * 0.66);
  return <div className="standard-chart"><div className="chart-y-labels">{tickRates.map((rate) => <span key={rate}>{axisLabel(maximum * rate, true)}</span>)}</div><div className="standard-chart-plot"><svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" role="img" aria-label={`Biểu đồ doanh thu ${views.find((item) => item.key === view)?.label.toLowerCase()}`}>{tickRates.map((rate) => <line className="chart-grid-line" x1="0" x2={chartWidth} y1={chartHeight * (1 - rate)} y2={chartHeight * (1 - rate)} key={rate} />)}{points.map((point, index) => { const value = Number(point.value ?? 0); const height = value / maximum * (chartHeight - 8); return <rect className="standard-bar" x={index * slot + (slot - barWidth) / 2} y={chartHeight - height} width={barWidth} height={height} rx="6" key={`${point.label}-${index}`}><title>{point.label}: {formatMoney(value)}</title></rect>; })}</svg><ChartLabels points={points} centered /></div></div>;
}

function ChartTabs({ value, onChange }: { value: ChartView; onChange: (view: ChartView) => void }) {
  return <div className="chart-tabs" role="tablist" aria-label="Kiểu tổng hợp biểu đồ">{views.map((view) => <button type="button" role="tab" aria-selected={value === view.key} className={`chart-tab ${value === view.key ? 'is-active' : ''}`} onClick={() => onChange(view.key)} key={view.key}>{view.label}</button>)}</div>;
}

function PeriodSelect({ period, onChange, label }: { period: DashboardPeriod; onChange: (period: DashboardPeriod) => void; label: string }) {
  return (
    <Select<DashboardPeriod>
      className="chart-period-select-wrap"
      variant="chart"
      align="right"
      aria-label={label}
      value={period}
      onChange={onChange}
      options={dashboardPeriods}
    />
  );
}

export function DashboardCharts({ dashboard, period, onPeriodChange }: { dashboard: ApiRecord; period: DashboardPeriod; onPeriodChange: (period: DashboardPeriod) => void }) {
  const [customerView, setCustomerView] = useState<ChartView>('hour');
  const [revenueView, setRevenueView] = useState<ChartView>('hour');
  const customerPoints = dashboard.charts[customerView === 'hour' ? 'customersByHour' : customerView === 'day' ? 'customersByDay' : 'customersByWeekday'];
  const revenuePoints = dashboard.charts[revenueView === 'hour' ? 'revenueByHour' : revenueView === 'day' ? 'revenueByDay' : 'revenueByWeekday'];

  return <div className="charts-grid dashboard-charts-grid">
    <article className="card chart-card dashboard-chart-card" data-chart="customers">
      <div className="chart-header dashboard-chart-header"><div><h2>Lượng khách hàng</h2><div className="badge-row"><span className="metric-badge blue">{formatNumber(dashboard.month.customers)} lượt khách</span></div></div><PeriodSelect period={period} onChange={onPeriodChange} label="Kỳ xem lượng khách" /></div>
      <ChartTabs value={customerView} onChange={setCustomerView} />
      <LineChart points={customerPoints} view={customerView} />
    </article>
    <article className="card chart-card dashboard-chart-card revenue-card" data-chart="revenue">
      <div className="chart-header dashboard-chart-header"><div><h2>Doanh thu thuần</h2><div className="badge-row"><span className="metric-badge blue">{formatMoney(dashboard.month.revenue)}</span><span className="metric-badge green">{formatNumber(dashboard.month.invoices)} hóa đơn</span><span className="metric-badge orange">{formatNumber(dashboard.month.returns)} trả hàng</span></div></div><PeriodSelect period={period} onChange={onPeriodChange} label="Kỳ xem doanh thu" /></div>
      <ChartTabs value={revenueView} onChange={setRevenueView} />
      <BarChart points={revenuePoints} view={revenueView} />
    </article>
  </div>;
}
