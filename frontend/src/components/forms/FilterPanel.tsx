import type { ReactNode } from 'react';
import { Select } from '@/components/ui/Select/Select';
import { DateRangePickerField } from '@/components/ui/DateTimePicker';

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

export function DateRangeFilter({ label, from, to, onChange, layout = 'stacked' }: { label: string; from: string; to: string; onChange: (from: string, to: string) => void; layout?: 'stacked' | 'inline' }) {
  return (
    <div className={`filter-group date-filter-group date-filter-group--${layout}`}>
      <label>{layout === 'inline' ? `${label}:` : label}</label>
      <DateRangePickerField className="filter-control" aria-label={label} from={from} to={to} onChange={onChange} />
    </div>
  );
}
