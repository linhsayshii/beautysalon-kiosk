import './mobile-common.css';

export interface MobileSegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: string;
  badge?: number | string;
}

export interface MobileSegmentedControlProps<T extends string> {
  options: MobileSegmentedOption<T>[];
  value: T;
  onChange: (val: T) => void;
}

export function MobileSegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: MobileSegmentedControlProps<T>) {
  return (
    <div className="mobile-segmented-control" role="tablist">
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`mobile-segmented-btn ${isActive ? 'is-active' : ''}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.icon && <i className={opt.icon} />}
            <span>{opt.label}</span>
            {opt.badge !== undefined && opt.badge !== null && (
              <span className="mobile-segmented-badge">{opt.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
