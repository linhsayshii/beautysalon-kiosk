import { apiRequest, toQueryString, type ApiEnvelope } from '@/services/api-client';
import type { Pagination } from '@/types/api';

export type CashFund = 'cash' | 'bank';
export type CashVoucherType = 'income' | 'expense';

export interface CashVoucher {
  id: number;
  code: string;
  type: CashVoucherType;
  fund: CashFund;
  paymentMethod: string | null;
  categoryKey: string;
  categoryLabel: string;
  amount: number;
  note: string;
  occurredAt: string;
  createdAt: string;
  sourceType: 'manual' | 'invoice' | 'customer_payment' | 'payroll_payment' | 'purchase_order' | 'transfer' | 'opening';
  sourceId: number | null;
  sourceCode: string | null;
  counterpartyType: 'customer' | 'supplier' | 'staff' | 'other' | null;
  counterpartyId: number | null;
  counterpartyName: string;
  status: 'active' | 'cancelled';
  cancelledAt: string | null;
  cancelReason: string;
  cancelledByName: string | null;
  createdByName: string | null;
  cancellable: boolean;
}

export interface CashFundBalance {
  fund: CashFund;
  opening: number;
  income: number;
  expense: number;
  closing: number;
  currentBalance: number;
}

export interface CashbookSummary {
  dateFrom: string;
  dateTo: string;
  funds: CashFundBalance[];
  total: Omit<CashFundBalance, 'fund'>;
}

export interface CashVoucherListMeta {
  pagination: Pagination;
  summary: { total: number; income: number; expense: number };
  dateFrom: string;
  dateTo: string;
}

export interface CashVoucherFilters {
  [key: string]: string | number | undefined;
  dateFrom?: string;
  dateTo?: string;
  type?: string;
  fund?: string;
  category?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export const fundLabels: Record<CashFund, string> = { cash: 'Tiền mặt', bank: 'Ngân hàng' };
export const voucherTypeLabels: Record<CashVoucherType, string> = { income: 'Phiếu thu', expense: 'Phiếu chi' };
export const voucherStatusLabels: Record<CashVoucher['status'], string> = { active: 'Đã ghi sổ', cancelled: 'Đã hủy' };
export const voucherSourceLabels: Record<CashVoucher['sourceType'], string> = {
  manual: 'Lập tại sổ quỹ',
  invoice: 'Hóa đơn bán hàng',
  customer_payment: 'Thu nợ khách hàng',
  payroll_payment: 'Thanh toán lương',
  purchase_order: 'Phiếu nhập hàng',
  transfer: 'Chuyển quỹ',
  opening: 'Số dư đầu kỳ',
};

export const getCashbookSummary = (range: { dateFrom: string; dateTo: string }) =>
  apiRequest<ApiEnvelope<CashbookSummary>>(`/cashbook/summary?${toQueryString(range)}`);

export const getCashVouchers = (filters: CashVoucherFilters) =>
  apiRequest<ApiEnvelope<CashVoucher[], CashVoucherListMeta>>(`/cashbook/vouchers?${toQueryString(filters)}`);

export interface CreateCashVoucherBody {
  type: CashVoucherType;
  fund: CashFund;
  categoryKey: string;
  amount: number;
  occurredAt?: string;
  counterpartyName: string;
  note: string;
  requestKey: string;
}

export const createCashVoucher = (body: CreateCashVoucherBody) =>
  apiRequest<ApiEnvelope<CashVoucher>>('/cashbook/vouchers', { method: 'POST', body: JSON.stringify(body) });

export const cancelCashVoucher = (id: number, reason: string) =>
  apiRequest<ApiEnvelope<CashVoucher>>(`/cashbook/vouchers/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) });

export const createCashTransfer = (body: { fromFund: CashFund; toFund: CashFund; amount: number; occurredAt?: string; note: string; requestKey: string }) =>
  apiRequest<ApiEnvelope<{ transferGroup: string; vouchers: CashVoucher[] }>>('/cashbook/transfers', { method: 'POST', body: JSON.stringify(body) });

export const createOpeningBalance = (body: { fund: CashFund; amount: number; occurredAt?: string; note: string; requestKey: string }) =>
  apiRequest<ApiEnvelope<CashVoucher>>('/cashbook/opening-balance', { method: 'POST', body: JSON.stringify(body) });
