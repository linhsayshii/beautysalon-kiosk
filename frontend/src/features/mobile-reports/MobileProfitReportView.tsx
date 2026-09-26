import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ErrorState, LoadingState } from '@/components/data-display/DataState';
import { MobilePageHeader } from '@/components/ui/MobilePageHeader/MobilePageHeader';
import { MobileEmptyState, MobileMetricCards } from '@/features/mobile-common';
import { profitStatementLines } from '@/features/reports/components/ProfitStatement';
import { formatMargin, getProfitReport, periodRange, reportPeriods, type ReportPeriod } from '@/features/reports/reports.api';
import { formatDateOnly } from '@/lib/date';
import { formatMoney, formatNumber, formatSignedMoney } from '@/lib/format';
import { statusLabels } from '@/types/api';

const presets = reportPeriods.filter((period) => period.value !== 'custom');

export function MobileProfitReportView() {
  const [period, setPeriod] = useState<ReportPeriod>('this_month');
  const range = periodRange(period);
  const query = useQuery({ queryKey: ['profit-report', range.dateFrom, range.dateTo, 'mobile'], queryFn: () => getProfitReport(range) });
  const report = query.data?.data;
  const summary = report?.summary;

  return (
    <div className="m-page mobile-report">
      <MobilePageHeader title="Báo cáo lãi lỗ" backTo="/m/more">
        <div className="m-chip-strip">
          {presets.map((preset) => (
            <button key={preset.value} type="button" className="chip" aria-pressed={period === preset.value} onClick={() => setPeriod(preset.value)}>{preset.label}</button>
          ))}
        </div>
        <div className="m-summary-bar">
          <span className="m-summary-title">{formatDateOnly(range.dateFrom)} - {formatDateOnly(range.dateTo)}</span>
          {summary && <span className="m-summary-count"><strong>{formatNumber(summary.invoiceCount)}</strong> hóa đơn</span>}
        </div>
      </MobilePageHeader>

      <div className="m-body">
        {query.isPending ? <LoadingState compact />
          : query.error ? <ErrorState compact error={query.error} onRetry={() => query.refetch()} />
            : report && summary && <>
              <MobileMetricCards items={[
                { label: 'Doanh thu thuần', value: formatMoney(summary.netRevenue), tone: 'blue' },
                { label: 'Giá vốn', value: formatMoney(summary.cogs), tone: 'orange' },
                { label: 'Lợi nhuận gộp', value: formatSignedMoney(summary.grossProfit), note: `Biên ${formatMargin(summary.grossMargin)}`, tone: summary.grossProfit < 0 ? 'red' : 'green' },
                { label: 'Lợi nhuận thuần', value: formatSignedMoney(summary.netProfit), note: `Biên ${formatMargin(summary.netMargin)}`, tone: summary.netProfit < 0 ? 'red' : 'violet' },
              ]} />

              {summary.missingCostCount > 0 && (
                <div className="alert alert-warning" role="status">
                  {formatNumber(summary.missingCostCount)} hàng hóa chưa có giá vốn, lợi nhuận đang cao hơn thực tế. <Link to="/m/products">Cập nhật</Link>
                </div>
              )}

              <section className="card card-body">
                <div className="m-section">
                  <div className="m-section-head"><span className="m-section-title">Kết quả kinh doanh</span></div>
                  <dl className="mobile-report-statement">
                    {profitStatementLines(report).map((line, index) => (
                      <div className={`mobile-report-line is-${line.level}`} key={`${line.label}-${index}`}>
                        <dt>{line.sign && <span className="text-muted">({line.sign}) </span>}{line.label}</dt>
                        <dd className={line.value < 0 ? 'text-danger' : undefined}>{formatSignedMoney(line.value)}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="m-note">Tiền bán thẻ tài khoản {formatMoney(summary.prepaidCardSales)} chưa tính doanh thu (ghi nhận khi khách dùng thẻ).</p>
                </div>
              </section>

              <section className="card card-body">
                <div className="m-section">
                  <div className="m-section-head"><span className="m-section-title">Theo nhóm hàng</span></div>
                  {!report.byItemType.length ? <p className="m-note">Chưa có doanh thu trong kỳ.</p> : (
                    <div className="mobile-report-items">
                      {report.byItemType.map((row) => (
                        <div className="mobile-report-item" key={row.itemType}>
                          <span><strong>{statusLabels[row.itemType] ?? row.itemType}</strong><small>Doanh thu {formatMoney(row.revenue)} · Giá vốn {formatMoney(row.cogs)}</small></span>
                          <span className="mobile-report-item-profit"><strong className={row.profit < 0 ? 'text-danger' : 'text-success'}>{formatSignedMoney(row.profit)}</strong><small>{formatMargin(row.margin)}</small></span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="card card-body">
                <div className="m-section">
                  <div className="m-section-head"><span className="m-section-title">Hàng hóa bán chạy</span></div>
                  {!report.topItems.length ? <MobileEmptyState icon="ph ph-chart-bar" title="Chưa có hàng hóa bán ra" /> : (
                    <div className="mobile-report-items">
                      {report.topItems.slice(0, 10).map((row) => (
                        <div className="mobile-report-item" key={`${row.itemType}-${row.itemId ?? row.name}`}>
                          <span><strong>{row.name}</strong><small>SL {formatNumber(row.quantity)} · Doanh thu {formatMoney(row.revenue)}</small></span>
                          <span className="mobile-report-item-profit"><strong className={row.profit < 0 ? 'text-danger' : 'text-success'}>{formatSignedMoney(row.profit)}</strong><small>{formatMargin(row.margin)}</small></span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </>}
      </div>
    </div>
  );
}
