import { formatMoney } from '@/lib/format';
import { formatMargin, type ProfitReport } from '../reports.api';

type Level = 'total' | 'grand' | 'sub' | 'detail';
interface StatementLine { label: string; value: number; level: Level; sign?: '+' | '-' }

/** Income statement rows in the KiotViet "Báo cáo kết quả kinh doanh" order. */
export function profitStatementLines(report: ProfitReport): StatementLine[] {
  const { summary } = report;
  return [
    { label: 'Doanh thu bán hàng', value: summary.grossSales, level: 'sub' },
    { label: 'Giảm giá hóa đơn', value: summary.discount, level: 'sub', sign: '-' },
    { label: 'Doanh thu thuần', value: summary.netRevenue, level: 'total' },
    { label: 'Giá vốn hàng bán', value: summary.cogs, level: 'sub', sign: '-' },
    { label: 'Lợi nhuận gộp', value: summary.grossProfit, level: 'total' },
    { label: 'Chi phí hoạt động', value: summary.operatingExpenses, level: 'sub', sign: '-' },
    ...report.expensesByCategory.map((row): StatementLine => ({ label: row.label, value: row.amount, level: 'detail' })),
    { label: 'Thu nhập khác', value: summary.otherIncome, level: 'sub', sign: '+' },
    ...report.otherIncomeByCategory.map((row): StatementLine => ({ label: row.label, value: row.amount, level: 'detail' })),
    { label: 'Lợi nhuận thuần', value: summary.netProfit, level: 'grand' },
  ];
}

export function ProfitStatement({ report }: { report: ProfitReport }) {
  const revenue = report.summary.netRevenue;
  return (
    <div className="table-scroll">
      <table className="data-table report-statement">
        <thead><tr><th>Chỉ tiêu</th><th className="text-right">Giá trị</th><th className="text-right">% doanh thu thuần</th></tr></thead>
        <tbody>
          {profitStatementLines(report).map((line, index) => (
            <tr className={`report-line-${line.level}`} key={`${line.label}-${index}`}>
              <td data-label="Chỉ tiêu">{line.sign && <span className="report-sign">({line.sign})</span>}{line.label}</td>
              <td data-label="Giá trị" className={`money-cell ${line.value < 0 ? 'text-danger' : ''}`}>{line.value < 0 ? '-' : ''}{formatMoney(Math.abs(line.value))}</td>
              <td data-label="% doanh thu thuần" className="numeric-cell text-right">{revenue > 0 ? formatMargin(line.value / revenue) : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="field-hint report-footnote">
        Tiền bán thẻ tài khoản trong kỳ: <strong>{formatMoney(report.summary.prepaidCardSales)}</strong> — là tiền khách nạp trước nên chưa tính vào doanh thu; doanh thu được ghi nhận khi khách dùng thẻ thanh toán.
        Giá vốn tính theo giá vốn hiện tại của hàng hóa. Chi trả nhà cung cấp và chuyển quỹ không tính là chi phí.
      </p>
    </div>
  );
}
