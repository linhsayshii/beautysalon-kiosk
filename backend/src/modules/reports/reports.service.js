import { pool } from '../../db.js';
import { cashCategories } from '../cashbook/cashbook.ledger.js';

const number = (value) => Number(value ?? 0);
const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const ratio = (part, whole) => (whole > 0 ? Math.round((part / whole) * 10000) / 10000 : 0);

const profitExpenseKeys = cashCategories.filter((category) => category.type === 'expense' && category.countsInProfit).map((category) => category.key);
const profitIncomeKeys = cashCategories.filter((category) => category.type === 'income' && category.countsInProfit).map((category) => category.key);
const categoryLabel = new Map(cashCategories.map((category) => [category.key, category.label]));

const bucketFormats = { day: 'YYYY-MM-DD', month: 'YYYY-MM' };

/**
 * Revenue lines of paid invoices in the branch-local date range.
 *
 * - Invoice-level discount is spread over lines in proportion to line totals.
 * - Prepaid account-card sales are a deposit, not revenue: they are reported
 *   separately and revenue is recognised when the wallet pays an invoice.
 * - A package redemption (0đ line with customer_package_id) carries no cost;
 *   the package's cost was taken when the package was sold.
 * - Cost is quantity × the item's current cost price.
 */
const linesCte = `
  WITH bounds AS (
    SELECT ($2::date AT TIME ZONE b.timezone) AS range_start,
           (($3::date + 1) AT TIME ZONE b.timezone) AS range_end,
           b.timezone
    FROM branches b WHERE b.id = $1
  ),
  lines AS (
    SELECT
      ii.invoice_id,
      ii.item_type,
      COALESCE(ii.service_id, ii.product_id, ii.package_id, ii.account_card_id) AS item_id,
      COALESCE(s.code, p.sku, sp.code) AS item_code,
      COALESCE(s.name, p.name, sp.name, ii.description) AS item_name,
      ii.quantity,
      ii.line_total AS gross,
      ii.line_total * CASE WHEN i.subtotal > 0 THEN i.total / i.subtotal ELSE 0 END AS revenue,
      (ii.customer_package_id IS NOT NULL AND ii.unit_price = 0) AS redemption,
      COALESCE(s.cost_price, p.cost_price, sp.cost_price, 0) AS unit_cost,
      TO_CHAR(i.issued_at AT TIME ZONE bounds.timezone, $4) AS bucket
    FROM invoices i
    CROSS JOIN bounds
    JOIN invoice_items ii ON ii.invoice_id = i.id
    LEFT JOIN services s ON ii.item_type = 'service' AND s.id = ii.service_id
    LEFT JOIN products p ON ii.item_type = 'product' AND p.id = ii.product_id
    LEFT JOIN service_packages sp ON ii.item_type = 'package' AND sp.id = ii.package_id
    WHERE i.branch_id = $1 AND i.status = 'paid'
      AND i.issued_at >= bounds.range_start AND i.issued_at < bounds.range_end
  ),
  sales AS (
    SELECT *, CASE WHEN redemption THEN 0 ELSE quantity * unit_cost END AS cogs
    FROM lines WHERE item_type <> 'account_card'
  )`;

const cashCte = `
  WITH bounds AS (
    SELECT ($2::date AT TIME ZONE b.timezone) AS range_start,
           (($3::date + 1) AT TIME ZONE b.timezone) AS range_end,
           b.timezone
    FROM branches b WHERE b.id = $1
  )`;

function buckets(dateFrom, dateTo, groupBy) {
  const result = [];
  const cursor = new Date(`${dateFrom}T00:00:00Z`);
  const end = new Date(`${dateTo}T00:00:00Z`);
  if (groupBy === 'month') cursor.setUTCDate(1);
  while (cursor <= end) {
    const iso = cursor.toISOString();
    if (groupBy === 'month') {
      result.push({ key: iso.slice(0, 7), label: `${iso.slice(5, 7)}/${iso.slice(0, 4)}` });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    } else {
      result.push({ key: iso.slice(0, 10), label: `${iso.slice(8, 10)}/${iso.slice(5, 7)}` });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return result;
}

export function defaultGroupBy(dateFrom, dateTo) {
  const days = (Date.parse(`${dateTo}T00:00:00Z`) - Date.parse(`${dateFrom}T00:00:00Z`)) / 86_400_000 + 1;
  return days > 62 ? 'month' : 'day';
}

export async function getProfitReport({ branchId, dateFrom, dateTo, groupBy = defaultGroupBy(dateFrom, dateTo) }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const params = [branchId, dateFrom, dateTo, bucketFormats[groupBy]];
    const summary = await client.query(
      `${linesCte}
       SELECT
         (SELECT COALESCE(SUM(gross), 0) FROM sales) AS gross_sales,
         (SELECT COALESCE(SUM(revenue), 0) FROM sales) AS net_revenue,
         (SELECT COALESCE(SUM(cogs), 0) FROM sales) AS cogs,
         (SELECT COUNT(DISTINCT invoice_id) FROM lines) AS invoice_count,
         (SELECT COALESCE(SUM(revenue), 0) FROM lines WHERE item_type = 'account_card') AS prepaid_card_sales,
         (SELECT COUNT(DISTINCT (item_type, item_id)) FROM sales WHERE NOT redemption AND unit_cost = 0) AS missing_cost_count`,
      params,
    );
    const salesSeries = await client.query(
      `${linesCte}
       SELECT bucket, SUM(revenue) AS revenue, SUM(cogs) AS cogs FROM sales GROUP BY bucket`,
      params,
    );
    const byItemType = await client.query(
      `${linesCte}
       SELECT item_type, SUM(quantity) AS quantity, SUM(revenue) AS revenue, SUM(cogs) AS cogs
       FROM sales GROUP BY item_type ORDER BY SUM(revenue) DESC`,
      params,
    );
    const items = await client.query(
      `${linesCte}
       SELECT item_type, item_id, MAX(item_code) AS item_code, MAX(item_name) AS item_name,
         SUM(quantity) AS quantity, SUM(revenue) AS revenue, SUM(cogs) AS cogs
       FROM sales GROUP BY item_type, item_id
       ORDER BY SUM(revenue) DESC, MAX(item_name) LIMIT 100`,
      params,
    );
    const cash = await client.query(
      `${cashCte}
       SELECT c.transaction_type, c.category_key,
         TO_CHAR(c.occurred_at AT TIME ZONE bounds.timezone, $4) AS bucket, SUM(c.amount) AS amount
       FROM cash_transactions c CROSS JOIN bounds
       WHERE c.branch_id = $1 AND c.fund IS NOT NULL AND c.status = 'active'
         AND c.occurred_at >= bounds.range_start AND c.occurred_at < bounds.range_end
         AND ((c.transaction_type = 'expense' AND c.category_key = ANY($5::text[]))
           OR (c.transaction_type = 'income' AND c.category_key = ANY($6::text[])))
       GROUP BY c.transaction_type, c.category_key, bucket`,
      [...params, profitExpenseKeys, profitIncomeKeys],
    );
    await client.query('COMMIT');

    const totals = summary.rows[0];
    const grossSales = round(number(totals.gross_sales));
    const netRevenue = round(number(totals.net_revenue));
    const cogs = round(number(totals.cogs));
    const grossProfit = round(netRevenue - cogs);

    const expenseRows = cash.rows.filter((row) => row.transaction_type === 'expense');
    const incomeRows = cash.rows.filter((row) => row.transaction_type === 'income');
    const operatingExpenses = round(expenseRows.reduce((sum, row) => sum + number(row.amount), 0));
    const otherIncome = round(incomeRows.reduce((sum, row) => sum + number(row.amount), 0));
    const netProfit = round(grossProfit - operatingExpenses + otherIncome);

    const groupByCategory = (rows) => [...rows.reduce((map, row) => map.set(row.category_key, (map.get(row.category_key) ?? 0) + number(row.amount)), new Map())]
      .map(([key, amount]) => ({ categoryKey: key, label: categoryLabel.get(key) ?? key, amount: round(amount) }))
      .sort((a, b) => b.amount - a.amount);

    const salesByBucket = new Map(salesSeries.rows.map((row) => [row.bucket, row]));
    const cashByBucket = cash.rows.reduce((map, row) => {
      const entry = map.get(row.bucket) ?? { expenses: 0, otherIncome: 0 };
      if (row.transaction_type === 'expense') entry.expenses += number(row.amount);
      else entry.otherIncome += number(row.amount);
      return map.set(row.bucket, entry);
    }, new Map());
    const series = buckets(dateFrom, dateTo, groupBy).map(({ key, label }) => {
      const sale = salesByBucket.get(key);
      const revenue = round(number(sale?.revenue));
      const bucketCogs = round(number(sale?.cogs));
      const { expenses = 0, otherIncome: bucketIncome = 0 } = cashByBucket.get(key) ?? {};
      return {
        key,
        label,
        revenue,
        cogs: bucketCogs,
        grossProfit: round(revenue - bucketCogs),
        expenses: round(expenses),
        netProfit: round(revenue - bucketCogs - expenses + bucketIncome),
      };
    });

    const mapProfitRow = (row) => {
      const revenue = round(number(row.revenue));
      const rowCogs = round(number(row.cogs));
      return { quantity: number(row.quantity), revenue, cogs: rowCogs, profit: round(revenue - rowCogs), margin: ratio(revenue - rowCogs, revenue) };
    };

    return {
      dateFrom,
      dateTo,
      groupBy,
      summary: {
        grossSales,
        discount: round(grossSales - netRevenue),
        netRevenue,
        cogs,
        grossProfit,
        grossMargin: ratio(grossProfit, netRevenue),
        operatingExpenses,
        otherIncome,
        netProfit,
        netMargin: ratio(netProfit, netRevenue),
        invoiceCount: number(totals.invoice_count),
        prepaidCardSales: round(number(totals.prepaid_card_sales)),
        missingCostCount: number(totals.missing_cost_count),
      },
      series,
      byItemType: byItemType.rows.map((row) => ({ itemType: row.item_type, ...mapProfitRow(row) })),
      topItems: items.rows.map((row) => ({
        itemType: row.item_type,
        itemId: row.item_id == null ? null : number(row.item_id),
        code: row.item_code ?? '',
        name: row.item_name,
        ...mapProfitRow(row),
      })),
      expensesByCategory: groupByCategory(expenseRows),
      otherIncomeByCategory: groupByCategory(incomeRows),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
