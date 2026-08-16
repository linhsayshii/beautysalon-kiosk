import { useState } from 'react';
import { formatNumber } from '@/lib/format';
import { Select } from '@/components/ui/Select/Select';
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

function niceMaximum(values: number[]) {
  const raw = Math.max(...values, 0);
  if (!raw) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

function axisLabel(value: number, money = false) {
  if (money && value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(1))}tr`;
  if (value >= 1_000) return `${Number((value / 1_000).toFixed(1))}k`;
  return Number(value.toFixed(1)).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
}

function smoothPath(points: Array<{ x: number; y: number }>) {
  if (!points.length) return '';
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;
  return points.slice(0, -1).reduce((path, point, index) => {
    const previous = points[index - 1] ?? point;
    const next = points[index + 1];
    const afterNext = points[index + 2] ?? next;
    const controlOneX = point.x + (next.x - previous.x) / 6;
    const minimumY = Math.min(point.y, next.y);
    const maximumY = Math.max(point.y, next.y);
    const controlOneY = Math.min(maximumY, Math.max(minimumY, point.y + (next.y - previous.y) / 6));
    const controlTwoX = next.x - (afterNext.x - point.x) / 6;
    const controlTwoY = Math.min(maximumY, Math.max(minimumY, next.y - (afterNext.y - point.y) / 6));
    return `${path} C${controlOneX.toFixed(1)},${controlOneY.toFixed(1)} ${controlTwoX.toFixed(1)},${controlTwoY.toFixed(1)} ${next.x.toFixed(1)},${next.y.toFixed(1)}`;
  }, `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`);
}

function ChartLabels({ points }: { points: ApiRecord[] }) {
  return <div className={`chart-x-labels ${points.length <= 7 ? 'show-all' : ''}`} aria-hidden="true">{points.map((point, index) => <span className={index === 0 ? 'is-first' : index === points.length - 1 ? 'is-last' : ''} style={{ left: `${points.length > 1 ? index / (points.length - 1) * 100 : 50}%` }} key={`${point.label}-${index}`}>{point.label}</span>)}</div>;
}

function LineChart({ points, view }: { points: ApiRecord[]; view: ChartView }) {
  const values = points.map((point) => Number(point.value ?? 0));
  const maximum = niceMaximum(values);
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
  return <div className="standard-chart"><div className="chart-y-labels">{tickRates.map((rate) => <span key={rate}>{axisLabel(maximum * rate, true)}</span>)}</div><div className="standard-chart-plot"><svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" role="img" aria-label={`Biểu đồ doanh thu ${views.find((item) => item.key === view)?.label.toLowerCase()}`}>{tickRates.map((rate) => <line className="chart-grid-line" x1="0" x2={chartWidth} y1={chartHeight * (1 - rate)} y2={chartHeight * (1 - rate)} key={rate} />)}{points.map((point, index) => { const value = Number(point.value ?? 0); const height = value / maximum * (chartHeight - 8); return <rect className="standard-bar" x={index * slot + (slot - barWidth) / 2} y={chartHeight - height} width={barWidth} height={height} rx="6" key={`${point.label}-${index}`}><title>{point.label}: {formatNumber(value)}đ</title></rect>; })}</svg><ChartLabels points={points} /></div></div>;
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
      <div className="chart-header dashboard-chart-header"><div><h2>Doanh thu thuần</h2><div className="badge-row"><span className="metric-badge blue">{formatNumber(dashboard.month.revenue)}đ</span><span className="metric-badge green">{formatNumber(dashboard.month.invoices)} hóa đơn</span><span className="metric-badge orange">{formatNumber(dashboard.month.returns)} trả hàng</span></div></div><PeriodSelect period={period} onChange={onPeriodChange} label="Kỳ xem doanh thu" /></div>
      <ChartTabs value={revenueView} onChange={setRevenueView} />
      <BarChart points={revenuePoints} view={revenueView} />
    </article>
  </div>;
}
