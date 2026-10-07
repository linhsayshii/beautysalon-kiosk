import { useRef, type ReactNode } from 'react';

export interface MobileSearchBarProps {
  value: string;
  placeholder?: string;
  ariaLabel?: string;
  onChange?: (val: string) => void;
  onFilterClick?: () => void;
  activeFilterCount?: number;
  action?: ReactNode;
  autoFocus?: boolean;
}

export function MobileSearchBar({
  value,
  placeholder = 'Tìm kiếm...',
  ariaLabel = placeholder,
  onChange,
  onFilterClick,
  activeFilterCount = 0,
  action,
  autoFocus = false,
}: MobileSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="mobile-search-bar-wrap">
      <div className="mobile-search-bar-input-box">
        <i className="ph ph-magnifying-glass mobile-search-bar-icon" />
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          type="search"
          aria-label={ariaLabel}
          enterKeyHint="search"
          className="mobile-search-bar-input"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
        />
        {value.length > 0 && (
          <button
            type="button"
            className="mobile-search-bar-clear-btn"
            aria-label="Xóa tìm kiếm"
            onClick={() => { onChange?.(''); inputRef.current?.focus(); }}
          >
            <i className="ph ph-x-circle" />
          </button>
        )}
      </div>

      {onFilterClick && (
        <button
          type="button"
          className={`mobile-search-bar-filter-btn ${activeFilterCount > 0 ? 'has-active' : ''}`}
          aria-label="Mở bộ lọc"
          onClick={onFilterClick}
        >
          <i className="ph ph-funnel" />
          {activeFilterCount > 0 && (
            <span className="mobile-search-bar-badge">{activeFilterCount}</span>
          )}
        </button>
      )}

      {action}
    </div>
  );
}
