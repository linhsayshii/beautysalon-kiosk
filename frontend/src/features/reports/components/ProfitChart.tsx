import { axisLabel, niceMaximum, smoothPath } from '@/components/charts/chartScale';
import { formatSignedMoney, formatMoney } from '@/lib/format';
import type { ProfitReport } from '../reports.api';

const width = 700;
const height = 270;
const ticks = 4;

/** Revenue and cost bars per period with the net profit line; supports losses below zero. */
export function ProfitChart({ series }: { series: ProfitReport['series'] }) {
  const top = niceMaximum(series.flatMap((point) => [point.revenue, point.cogs, point.netProfit]));
  const lowest = Math.min(0, ...series.map((point) => point.netProfit));
  const bottom = lowest < 0 ? -niceMaximum([-lowest]) : 0;
  const span = top - bottom || 1;
  const y = (value: number) => height - ((value - bottom) / span) * (height - 8);
  const slot = width / Math.max(series.length, 1);
  const barWidth = Math.max(2, Math.min(16, slot * 0.32));
  const tickValues = Array.from({ length: ticks + 1 }, (_, index) => top - (span * index) / ticks);
  const line = series.map((point, index) => ({ x: index * slot + slot / 2, y: y(point.netProfit) }));

  return (
    <div className="standard-chart report-chart">
      <div className="chart-y-labels">{tickValues.map((value) => <span key={value}>{axisLabel(value, true)}</span>)}</div>
      <div className="standard-chart-plot">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Biểu đồ doanh thu, giá vốn và lợi nhuận thuần">
          {tickValues.map((value) => <line className="chart-grid-line" x1="0" x2={width} y1={y(value)} y2={y(value)} key={value} />)}
          {bottom < 0 && <line className="report-zero-line" x1="0" x2={width} y1={y(0)} y2={y(0)} />}
          {series.map((point, index) => {
            const center = index * slot + slot / 2;
            return <g key={point.key}>
              <rect className="report-bar-revenue" x={center - barWidth - 1} y={y(point.revenue)} width={barWidth} height={y(0) - y(point.revenue)} rx="3">
                <title>{point.label} · Doanh thu {formatMoney(point.revenue)}</title>
              </rect>
              <rect className="report-bar-cost" x={center + 1} y={y(point.cogs)} width={barWidth} height={y(0) - y(point.cogs)} rx="3">
                <title>{point.label} · Giá vốn {formatMoney(point.cogs)}</title>
              </rect>
            </g>;
          })}
          <path className="report-profit-line" d={smoothPath(line)} />
          {series.length <= 31 && line.map((point, index) => (
            <circle className="report-profit-dot" cx={point.x} cy={point.y} r="3" key={series[index].key}>
              <title>{series[index].label} · Lợi nhuận thuần {formatSignedMoney(series[index].netProfit)}</title>
            </circle>
          ))}
        </svg>
        <div className={`chart-x-labels ${series.length <= 12 ? 'show-all' : ''}`} aria-hidden="true">
          {series.map((point, index) => <span key={point.key} style={{ left: `${((index + 0.5) / Math.max(series.length, 1)) * 100}%` }}>{point.label}</span>)}
        </div>
      </div>
    </div>
  );
}

export function ProfitChartLegend() {
  return (
    <div className="report-legend" aria-hidden="true">
      <span><i className="report-swatch is-revenue" />Doanh thu thuần</span>
      <span><i className="report-swatch is-cost" />Giá vốn</span>
      <span><i className="report-swatch is-profit" />Lợi nhuận thuần</span>
    </div>
  );
}
