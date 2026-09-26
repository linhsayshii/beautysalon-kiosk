export const PAYROLL_PERIOD_TYPES = [
  { value: 'monthly', label: 'Hàng tháng' },
  { value: 'weekly', label: 'Hàng tuần' },
  { value: 'semi_monthly', label: 'Nửa tháng' },
];

export const payrollPeriodTypeLabel = (value: string) =>
  PAYROLL_PERIOD_TYPES.find((option) => option.value === value)?.label ?? value;
