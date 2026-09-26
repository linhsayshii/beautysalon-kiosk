import type { ReactNode } from 'react';
import { Select } from '@/components/ui/Select/Select';
import { DatePickerField } from '@/components/ui/DateTimePicker';

export interface SelectOption {
  value: string;
  label: string;
}

export function FilterPanel({ title, children, onApply, onReset }: { title: string; children: ReactNode; onApply: () => void; onReset: () => void }) {
  return <aside className="filter-panel"><h2>{title}</h2>{children}<div className="filter-actions"><button className="btn btn-secondary" type="button" onClick={onReset}>Đặt lại</button><button className="btn btn-primary" type="button" onClick={onApply}>Lọc</button></div></aside>;
}

export function SelectFilter({ label, value, options, onChange }: { label: string; value: string; options: SelectOption[]; onChange: (value: string) => void }) {
  return (
    <div className="filter-group">
      <label>{label}</label>
      <Select<string>
        value={value}
        onChange={onChange}
        options={options}
        variant="filter"
        fullWidth
        aria-label={label}
      />
    </div>
  );
}

export function DateRangeFilter({ label, from, to, onFromChange, onToChange, layout = 'stacked' }: { label: string; from: string; to: string; onFromChange: (value: string) => void; onToChange: (value: string) => void; layout?: 'stacked' | 'inline' }) {
  return (
    <div className={`filter-group date-filter-group date-filter-group--${layout}`}>
      <label>{layout === 'inline' ? `${label}:` : label}</label>
      <div className="date-range-inputs">
        <DatePickerField
          className="filter-control"
          aria-label={`${label} từ ngày`}
          value={from}
          onChange={onFromChange}
        />
        <span className="date-range-separator" aria-hidden="true">-</span>
        <DatePickerField
          className="filter-control"
          aria-label={`${label} đến ngày`}
          value={to}
          onChange={onToChange}
        />
      </div>
    </div>
  );
}
