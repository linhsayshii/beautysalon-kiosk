import type { ReactNode } from 'react';
import './mobile-common.css';

export interface MobileSearchBarProps {
  value: string;
  placeholder?: string;
  onChange?: (val: string) => void;
  onFilterClick?: () => void;
  activeFilterCount?: number;
  action?: ReactNode;
}

export function MobileSearchBar({
  value,
  placeholder = 'Tìm kiếm...',
  onChange,
  onFilterClick,
  activeFilterCount = 0,
  action,
}: MobileSearchBarProps) {
  return (
    <div className="mobile-search-bar-wrap">
      <div className="mobile-search-bar-input-box">
        <i className="ph ph-magnifying-glass mobile-search-bar-icon" />
        <input
          type="text"
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
            onClick={() => onChange?.('')}
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
