import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GoodsTypeBadge } from '@/components/data-display/Badges';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/DataState';
import { SummaryStrip } from '@/components/data-display/SummaryStrip';
import { DateRangeFilter } from '@/components/forms/FilterPanel';
import { PageHeader } from '@/components/ui/PageHeader/PageHeader';
import { Select } from '@/components/ui/Select/Select';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { isIsoDate } from '@/lib/date';
import { exportCsv } from '@/lib/export';
import { formatMoney, formatNumber, formatSignedMoney } from '@/lib/format';
import { statusLabels } from '@/types/api';
import { formatMargin, getProfitReport, periodRange, reportPeriods, type ProfitReport, type ReportGroupBy, type ReportPeriod } from '../reports.api';
import { ProfitChart, ProfitChartLegend } from './ProfitChart';
import { ProfitStatement, profitStatementLines } from './ProfitStatement';

type ReportTab = 'statement' | 'items' | 'types' | 'time';
const tabs: Array<{ value: ReportTab; label: string }> = [
  { value: 'statement', label: 'Kết quả kinh doanh' },
  { value: 'items', label: 'Theo hàng hóa' },
  { value: 'types', label: 'Theo nhóm hàng' },
  { value: 'time', label: 'Theo thời gian' },
];

function readPeriod(params: URLSearchParams): { period: ReportPeriod; dateFrom: string; dateTo: string } {
  const period = (reportPeriods.some((item) => item.value === params.get('period')) ? params.get('period') : 'this_month') as ReportPeriod;
  const from = params.get('from');
  const to = params.get('to');
  const custom = period === 'custom' && isIsoDate(from) && isIsoDate(to) ? { dateFrom: from, dateTo: to } : undefined;
  return { period, ...periodRange(period, custom) };
}

const profitClass = (value: number) => (value < 0 ? 'text-danger' : 'text-success');

export function ProfitReportView() {
  const { notify } = useToast();
  const [params, setParams] = useSearchParams();
  const { period, dateFrom, dateTo } = readPeriod(params);
  const [groupBy, setGroupBy] = useState<ReportGroupBy | undefined>(undefined);
  const [tab, setTab] = useState<ReportTab>('statement');
  const query = useQuery({
    queryKey: ['profit-report', dateFrom, dateTo, groupBy],
    queryFn: () => getProfitReport({ dateFrom, dateTo, groupBy }),
  });
  const report = query.data?.data;

  const setPeriod = (next: ReportPeriod) => setParams(next === 'custom' ? { period: next, from: dateFrom, to: dateTo } : { period: next }, { replace: true });
  const setRange = (from: string, to: string) => setParams({ period: 'custom', from, to }, { replace: true });

  const exportRows = () => {
    if (!report) return notify('Không có dữ liệu', 'Hãy tải báo cáo trước khi xuất file.');
    const rows = tab === 'statement' ? profitStatementLines(report).map((line) => ({ 'Chỉ tiêu': line.label, 'Giá trị': line.value }))
      : tab === 'items' ? report.topItems.map((row) => ({ 'Mã': row.code, 'Tên hàng': row.name, 'Loại': statusLabels[row.itemType] ?? row.itemType, 'Số lượng': row.quantity, 'Doanh thu': row.revenue, 'Giá vốn': row.cogs, 'Lợi nhuận': row.profit, 'Tỷ suất': formatMargin(row.margin) }))
        : tab === 'types' ? report.byItemType.map((row) => ({ 'Nhóm': statusLabels[row.itemType] ?? row.itemType, 'Số lượng': row.quantity, 'Doanh thu': row.revenue, 'Giá vốn': row.cogs, 'Lợi nhuận': row.profit, 'Tỷ suất': formatMargin(row.margin) }))
          : report.series.map((row) => ({ 'Kỳ': row.label, 'Doanh thu': row.revenue, 'Giá vốn': row.cogs, 'Lợi nhuận gộp': row.grossProfit, 'Chi phí': row.expenses, 'Lợi nhuận thuần': row.netProfit }));
    if (!exportCsv(rows, `bao-cao-lai-lo-${dateFrom}-${dateTo}`)) notify('Không có dữ liệu', 'Bảng hiện tại chưa có dòng nào.');
  };

  return <main className="page"><div className="page-stack">
    <PageHeader
      title="Báo cáo lãi lỗ"
      subtitle="Doanh thu, giá vốn, chi phí và lợi nhuận của chi nhánh theo kỳ."
      extraActions={<button className="btn btn-secondary" type="button" onClick={exportRows}><i className="ph ph-export" />Xuất file</button>}
    />
    <section className="card report-toolbar" aria-label="Kỳ báo cáo">
      <div className="report-toolbar-period">
        <Select<ReportPeriod> aria-label="Kỳ báo cáo" value={period} onChange={setPeriod} options={reportPeriods} />
        <DateRangeFilter layout="inline" label="Thời gian" from={dateFrom} to={dateTo} onFromChange={(from) => setRange(from, dateTo)} onToChange={(to) => setRange(dateFrom, to)} />
      </div>
      <div className="segmented" role="group" aria-label="Gom nhóm biểu đồ">
        <button type="button" aria-pressed={(groupBy ?? report?.groupBy) === 'day'} onClick={() => setGroupBy('day')}>Theo ngày</button>
        <button type="button" aria-pressed={(groupBy ?? report?.groupBy) === 'month'} onClick={() => setGroupBy('month')}>Theo tháng</button>
      </div>
    </section>

    {query.isPending ? <LoadingState /> : query.error ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : report && <ReportBody report={report} tab={tab} onTabChange={setTab} />}
  </div></main>;
}

function ReportBody({ report, tab, onTabChange }: { report: ProfitReport; tab: ReportTab; onTabChange: (tab: ReportTab) => void }) {
  const { summary } = report;
  return <>
    <SummaryStrip items={[
      { label: 'Doanh thu thuần', value: formatMoney(summary.netRevenue), note: `${formatNumber(summary.invoiceCount)} hóa đơn · giảm giá ${formatMoney(summary.discount)}` },
      { label: 'Giá vốn', value: formatMoney(summary.cogs), note: 'Theo giá vốn hiện tại', tone: 'orange' },
      { label: 'Lợi nhuận gộp', value: formatSignedMoney(summary.grossProfit), note: `Biên gộp ${formatMargin(summary.grossMargin)}`, tone: summary.grossProfit < 0 ? 'red' : 'green' },
      { label: 'Lợi nhuận thuần', value: formatSignedMoney(summary.netProfit), note: `Chi phí ${formatMoney(summary.operatingExpenses)} · biên ròng ${formatMargin(summary.netMargin)}`, tone: summary.netProfit < 0 ? 'red' : 'violet' },
    ]} />
    {summary.missingCostCount > 0 && (
      <div className="alert alert-warning" role="status">
        <i className="ph ph-warning" aria-hidden="true" /> {formatNumber(summary.missingCostCount)} hàng hóa đã bán trong kỳ chưa có giá vốn nên lợi nhuận đang cao hơn thực tế. <Link to="/products">Cập nhật giá vốn</Link>
      </div>
    )}
    <article className="card chart-card report-chart-card">
      <div className="chart-header">
        <div><h2>Doanh thu và lợi nhuận</h2><ProfitChartLegend /></div>
      </div>
      <ProfitChart series={report.series} />
    </article>
    <section className="data-panel report-panel">
      <div className="tabs report-tabs" role="tablist" aria-label="Bảng báo cáo">
        {tabs.map((item) => <button key={item.value} type="button" role="tab" className="tab" aria-selected={tab === item.value} onClick={() => onTabChange(item.value)}>{item.label}</button>)}
      </div>
      {tab === 'statement' && <ProfitStatement report={report} />}
      {tab === 'items' && (!report.topItems.length ? <EmptyState title="Chưa có hàng hóa bán ra" message="Không có hóa đơn đã thanh toán trong kỳ." /> : (
        <div className="table-scroll"><table className="data-table">
          <thead><tr><th>Mã</th><th>Tên hàng</th><th>Loại</th><th className="text-right">SL</th><th className="text-right">Doanh thu</th><th className="text-right">Giá vốn</th><th className="text-right">Lợi nhuận</th><th className="text-right">Tỷ suất</th></tr></thead>
          <tbody>{report.topItems.map((row) => (
            <tr key={`${row.itemType}-${row.itemId ?? row.name}`}>
              <td data-label="Mã" className="text-muted">{row.code || '-'}</td>
              <td data-label="Tên hàng"><span className="cell-main">{row.name}</span></td>
              <td data-label="Loại"><GoodsTypeBadge type={row.itemType} /></td>
              <td data-label="SL" className="numeric-cell text-right">{formatNumber(row.quantity)}</td>
              <td data-label="Doanh thu" className="money-cell">{formatMoney(row.revenue)}</td>
              <td data-label="Giá vốn" className="money-cell">{formatMoney(row.cogs)}</td>
              <td data-label="Lợi nhuận" className={`money-cell ${profitClass(row.profit)}`}>{formatSignedMoney(row.profit)}</td>
              <td data-label="Tỷ suất" className="numeric-cell text-right">{formatMargin(row.margin)}</td>
            </tr>
          ))}</tbody>
        </table></div>
      ))}
      {tab === 'types' && (!report.byItemType.length ? <EmptyState title="Chưa có doanh thu" message="Không có hóa đơn đã thanh toán trong kỳ." /> : (
        <div className="table-scroll"><table className="data-table">
          <thead><tr><th>Nhóm hàng</th><th className="text-right">SL</th><th className="text-right">Doanh thu</th><th className="text-right">Giá vốn</th><th className="text-right">Lợi nhuận</th><th className="text-right">Tỷ suất</th></tr></thead>
          <tbody>{report.byItemType.map((row) => (
            <tr key={row.itemType}>
              <td data-label="Nhóm hàng"><GoodsTypeBadge type={row.itemType} /></td>
              <td data-label="SL" className="numeric-cell text-right">{formatNumber(row.quantity)}</td>
              <td data-label="Doanh thu" className="money-cell">{formatMoney(row.revenue)}</td>
              <td data-label="Giá vốn" className="money-cell">{formatMoney(row.cogs)}</td>
              <td data-label="Lợi nhuận" className={`money-cell ${profitClass(row.profit)}`}>{formatSignedMoney(row.profit)}</td>
              <td data-label="Tỷ suất" className="numeric-cell text-right">{formatMargin(row.margin)}</td>
            </tr>
          ))}</tbody>
        </table></div>
      ))}
      {tab === 'time' && (
        <div className="table-scroll"><table className="data-table">
          <thead><tr><th>{report.groupBy === 'month' ? 'Tháng' : 'Ngày'}</th><th className="text-right">Doanh thu</th><th className="text-right">Giá vốn</th><th className="text-right">LN gộp</th><th className="text-right">Chi phí</th><th className="text-right">LN thuần</th></tr></thead>
          <tbody>{report.series.map((row) => (
            <tr key={row.key}>
              <td data-label="Kỳ">{row.label}</td>
              <td data-label="Doanh thu" className="money-cell">{formatMoney(row.revenue)}</td>
              <td data-label="Giá vốn" className="money-cell">{formatMoney(row.cogs)}</td>
              <td data-label="LN gộp" className={`money-cell ${profitClass(row.grossProfit)}`}>{formatSignedMoney(row.grossProfit)}</td>
              <td data-label="Chi phí" className="money-cell">{formatMoney(row.expenses)}</td>
              <td data-label="LN thuần" className={`money-cell ${profitClass(row.netProfit)}`}>{formatSignedMoney(row.netProfit)}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </section>
  </>;
}
