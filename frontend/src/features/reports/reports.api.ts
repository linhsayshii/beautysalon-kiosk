import { apiRequest, toQueryString, type ApiEnvelope } from '@/services/api-client';
import { addCalendarDays, monthStartIso, todayIso } from '@/lib/date';

export type ReportGroupBy = 'day' | 'month';

export interface ProfitRow { quantity: number; revenue: number; cogs: number; profit: number; margin: number }

export interface ProfitReport {
  dateFrom: string;
  dateTo: string;
  groupBy: ReportGroupBy;
  summary: {
    grossSales: number;
    discount: number;
    netRevenue: number;
    cogs: number;
    grossProfit: number;
    grossMargin: number;
    operatingExpenses: number;
    otherIncome: number;
    netProfit: number;
    netMargin: number;
    invoiceCount: number;
    prepaidCardSales: number;
    missingCostCount: number;
  };
  series: Array<{ key: string; label: string; revenue: number; cogs: number; grossProfit: number; expenses: number; netProfit: number }>;
  byItemType: Array<ProfitRow & { itemType: string }>;
  topItems: Array<ProfitRow & { itemType: string; itemId: number | null; code: string; name: string }>;
  expensesByCategory: Array<{ categoryKey: string; label: string; amount: number }>;
  otherIncomeByCategory: Array<{ categoryKey: string; label: string; amount: number }>;
}

export const getProfitReport = (params: { dateFrom: string; dateTo: string; groupBy?: ReportGroupBy }) =>
  apiRequest<ApiEnvelope<ProfitReport>>(`/reports/profit?${toQueryString(params)}`);

export type ReportPeriod = 'today' | 'yesterday' | 'last_7_days' | 'this_month' | 'last_month' | 'this_year' | 'custom';

export const reportPeriods: Array<{ value: ReportPeriod; label: string }> = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'yesterday', label: 'Hôm qua' },
  { value: 'last_7_days', label: '7 ngày qua' },
  { value: 'this_month', label: 'Tháng này' },
  { value: 'last_month', label: 'Tháng trước' },
  { value: 'this_year', label: 'Năm nay' },
  { value: 'custom', label: 'Tùy chọn' },
];

/** Branch-local date range of a preset period (custom keeps the given range). */
export function periodRange(period: ReportPeriod, custom?: { dateFrom: string; dateTo: string }) {
  const today = todayIso();
  switch (period) {
    case 'today': return { dateFrom: today, dateTo: today };
    case 'yesterday': { const day = addCalendarDays(today, -1); return { dateFrom: day, dateTo: day }; }
    case 'last_7_days': return { dateFrom: addCalendarDays(today, -6), dateTo: today };
    case 'last_month': {
      const lastDay = addCalendarDays(monthStartIso(), -1);
      return { dateFrom: `${lastDay.slice(0, 8)}01`, dateTo: lastDay };
    }
    case 'this_year': return { dateFrom: `${today.slice(0, 4)}-01-01`, dateTo: today };
    case 'custom': return custom ?? { dateFrom: monthStartIso(), dateTo: today };
    default: return { dateFrom: monthStartIso(), dateTo: today };
  }
}

const marginFormatter = new Intl.NumberFormat('vi-VN', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const formatMargin = (value: number) => marginFormatter.format(value);
