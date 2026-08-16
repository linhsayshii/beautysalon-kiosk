import { apiRequest, toQueryString } from '@/services/api-client';
import type { ApiEnvelope } from '@/services/api-client';
import type { ApiRecord } from '@/types/api';

export interface CreateStaffInput extends ApiRecord {
  name: string;
  role: string;
}

export interface CreateShiftInput {
  name: string;
  startsAt: string;
  endsAt: string;
  allowCheckInFrom?: string;
  allowCheckInTo?: string;
}

export interface AssignShiftInput {
  staffId: number;
  shiftDate: string;
  startsAt: string;
  endsAt: string;
  shiftName: string;
  status?: string;
}

export interface PayrollRecordItem {
  id: number;
  code: string;
  staff: {
    id: number;
    code: string;
    name: string;
    role: string;
    avatarTone?: string;
    salaryType?: string;
  };
  baseSalary: number;
  overtimeSalary: number;
  allowance: number;
  bonus: number;
  commission: number;
  deduction: number;
  totalIncome: number;
  netSalary: number;
  paidAmount: number;
  remainingAmount: number;
  workUnits: number;
  standardWorkDays: number;
  hourlyRate: number;
  status: string;
  note?: string;
}

export interface PayrollPeriodDetail {
  period: {
    id: number;
    code: string;
    name: string;
    periodType: string;
    startsOn: string;
    endsOn: string;
    status: 'draft' | 'approved' | 'cancelled' | 'paid';
    creatorType: string;
    creatorName: string;
    approvedByName?: string;
    approvedAt?: string;
    updatedDataAt?: string;
    note?: string;
    createdAt: string;
  };
  records: PayrollRecordItem[];
  payments: Array<{
    id: number;
    amount: number;
    paymentMethod: string;
    paidAt: string;
    note?: string;
    staff: { id: number; code: string; name: string };
    actorName?: string;
  }>;
  summary: {
    totalStaff: number;
    totalBaseSalary: number;
    totalOvertimeSalary: number;
    totalAllowance: number;
    totalBonus: number;
    totalCommission: number;
    totalDeduction: number;
    totalIncome: number;
    totalNetSalary: number;
    totalPaidAmount: number;
    totalRemainingAmount: number;
  };
}

export interface PayrollPeriodListItem {
  id: number;
  code: string;
  name: string;
  periodType: string;
  startsOn: string;
  endsOn: string;
  status: 'draft' | 'approved' | 'cancelled' | 'paid';
  creatorType: string;
  creatorName: string;
  approvedByName?: string;
  approvedAt?: string;
  updatedDataAt?: string;
  note?: string;
  createdAt: string;
  totalStaffCount: number;
  totalNetSalary: number;
  totalPaidAmount: number;
  totalRemainingAmount: number;
  totalCommission: number;
}

export interface PayrollListResponse {
  data: PayrollPeriodListItem[];
  summary: {
    totalNetSalary: number;
    totalPaidAmount: number;
    totalRemainingAmount: number;
    totalCommission: number;
  };
}

export const getStaff = (filters: ApiRecord) => apiRequest<ApiEnvelope<ApiRecord[]>>(`/staff?${toQueryString(filters)}`);
export const createStaff = (body: CreateStaffInput) => apiRequest<ApiEnvelope<ApiRecord>>('/staff', { method: 'POST', body: JSON.stringify(body) });
export const updateStaff = (id: number, body: CreateStaffInput) => apiRequest<ApiEnvelope<ApiRecord>>(`/staff/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const getShifts = () => apiRequest<ApiEnvelope<ApiRecord[]>>('/staff/shifts');
export const createShift = (body: CreateShiftInput) => apiRequest<ApiEnvelope<ApiRecord>>('/staff/shifts', { method: 'POST', body: JSON.stringify(body) });
export const assignShift = (body: AssignShiftInput) => apiRequest<ApiEnvelope<ApiRecord>>('/staff/schedule/assign', { method: 'POST', body: JSON.stringify(body) });
export const getSchedule = (startDate: string) => apiRequest<ApiEnvelope<ApiRecord>>(`/staff/schedule?${toQueryString({ startDate })}`);
export const getAttendance = (dateFrom: string, dateTo: string) => apiRequest<ApiEnvelope<ApiRecord[]>>(`/staff/attendance?${toQueryString({ dateFrom, dateTo })}`);
export const getCommissions = (dateFrom: string, dateTo: string) => apiRequest<ApiEnvelope<{ rows: ApiRecord[]; byStaff: ApiRecord[] }>>(`/staff/commissions?${toQueryString({ dateFrom, dateTo })}`);

// ============================================================================
// PAYROLL CLIENT APIS
// ============================================================================
export const getPayrollList = (filters?: { search?: string; status?: string[]; periodType?: string }) => {
  const queryObj: Record<string, string> = {};
  if (filters?.search) queryObj.search = filters.search;
  if (filters?.periodType) queryObj.periodType = filters.periodType;
  if (filters?.status && filters.status.length > 0) queryObj.status = filters.status.join(',');
  return apiRequest<PayrollListResponse>(`/staff/payroll?${toQueryString(queryObj)}`);
};

export const getPayrollDetail = (id: number) => apiRequest<{ data: PayrollPeriodDetail }>(`/staff/payroll/${id}`);
export const recalculatePayroll = (id: number) => apiRequest<{ data: PayrollPeriodDetail; message: string }>(`/staff/payroll/${id}/recalculate`, { method: 'POST' });
export const updatePayroll = (id: number, body: { records?: Partial<PayrollRecordItem>[]; note?: string }) =>
  apiRequest<{ data: PayrollPeriodDetail; message: string }>(`/staff/payroll/${id}`, { method: 'PUT', body: JSON.stringify(body) });
export const approvePayroll = (id: number) => apiRequest<{ data: PayrollPeriodDetail; message: string }>(`/staff/payroll/${id}/approve`, { method: 'POST' });
export const cancelPayroll = (id: number) => apiRequest<{ data: { id: number; status: string }; message: string }>(`/staff/payroll/${id}/cancel`, { method: 'POST' });
export const payPayroll = (id: number, body: { staffId: number; amount: number; paymentMethod?: string; note?: string }) =>
  apiRequest<{ data: PayrollPeriodDetail; message: string }>(`/staff/payroll/${id}/pay`, { method: 'POST', body: JSON.stringify(body) });

// Legacy compatibility
export const getPayroll = (periodCode: string) => apiRequest<ApiEnvelope<ApiRecord>>(`/staff/payroll?${toQueryString({ periodCode })}`);
