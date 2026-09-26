import { Select } from '@/components/ui/Select/Select';

export interface SortOption<T extends string = string> {
  value: T;
  label: string;
}

interface MobileSortDropdownProps<T extends string = string> {
  value: T;
  options: SortOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}

export function MobileSortDropdown<T extends string = string>({
  value,
  options,
  onChange,
  className = '',
}: MobileSortDropdownProps<T>) {
  return (
    <Select<T>
      aria-label="Sắp xếp theo"
      value={value}
      options={options}
      onChange={onChange}
      variant="pill"
      className={className}
    />
  );
}
