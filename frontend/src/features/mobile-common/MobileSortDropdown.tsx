import { useState, useRef, useEffect } from 'react';
import './mobile-common.css';

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
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentOption = options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`mobile-sort-dropdown-container ${className}`} ref={containerRef}>
      <button
        type="button"
        className={`mobile-sort-trigger-btn ${isOpen ? 'is-active' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        aria-expanded={isOpen}
      >
        <span>{currentOption?.label || 'Sắp xếp'}</span>
        <i className={`ph ph-caret-${isOpen ? 'up' : 'down'}`} />
      </button>

      {isOpen && (
        <div className="mobile-sort-dropdown-menu" role="menu">
          <div className="mobile-sort-dropdown-header">Sắp xếp theo</div>
          <div className="mobile-sort-dropdown-list">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`mobile-sort-menu-item ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  role="menuitem"
                >
                  <span>{opt.label}</span>
                  {isSelected && <i className="ph-fill ph-check-circle" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
