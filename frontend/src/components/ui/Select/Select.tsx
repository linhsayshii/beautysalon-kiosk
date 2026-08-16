import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

export interface SelectOption<T = string | number> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
  description?: ReactNode;
}

export interface SelectProps<T = string | number> {
  value?: T;
  onChange: (value: T) => void;
  options: Array<SelectOption<T>>;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  'aria-label'?: string;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  variant?: 'default' | 'filter' | 'chart' | 'bordered' | 'ghost' | 'pill';
  size?: 'sm' | 'md' | 'lg';
  align?: 'left' | 'right';
  fullWidth?: boolean;
  renderOption?: (option: SelectOption<T>, isSelected: boolean) => ReactNode;
}

export function Select<T extends string | number = string>({
  value,
  onChange,
  options,
  placeholder = 'Chọn một mục...',
  disabled = false,
  required = false,
  id,
  name,
  'aria-label': ariaLabel,
  className = '',
  triggerClassName = '',
  menuClassName = '',
  variant = 'default',
  size = 'md',
  align = 'left',
  fullWidth = false,
  renderOption,
}: SelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom');
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const generatedId = useId();
  const selectId = id || generatedId;

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  // Determine placement (top vs bottom) based on available screen space
  const updatePlacement = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const estimatedMenuHeight = Math.min(options.length * 44 + 16, 280);

    if (spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow) {
      setPlacement('top');
    } else {
      setPlacement('bottom');
    }
  }, [options.length]);

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      updatePlacement();
      const currentIndex = options.findIndex((opt) => String(opt.value) === String(value));
      setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
    }
    setIsOpen((prev) => !prev);
  };

  const handleSelect = (option: SelectOption<T>) => {
    if (option.disabled || disabled) return;
    onChange(option.value);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  // Close when clicked outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = (event: Event) => {
      // Don't close if scrolling inside the listbox
      if (listboxRef.current && listboxRef.current.contains(event.target as Node)) {
        return;
      }
      updatePlacement();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updatePlacement]);

  // Keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        setIsOpen(true);
        updatePlacement();
        const currentIndex = options.findIndex((opt) => String(opt.value) === String(value));
        setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        setHighlightedIndex((prev) => {
          let next = prev + 1;
          while (next < options.length && options[next]?.disabled) {
            next++;
          }
          return next < options.length ? next : prev;
        });
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        setHighlightedIndex((prev) => {
          let next = prev - 1;
          while (next >= 0 && options[next]?.disabled) {
            next--;
          }
          return next >= 0 ? next : prev;
        });
        break;
      }
      case 'Enter':
      case ' ': {
        event.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < options.length) {
          const opt = options[highlightedIndex];
          if (opt && !opt.disabled) {
            handleSelect(opt);
          }
        }
        break;
      }
      case 'Escape': {
        event.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
      }
      case 'Tab': {
        setIsOpen(false);
        break;
      }
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || highlightedIndex < 0 || !listboxRef.current) return;
    const items = listboxRef.current.querySelectorAll<HTMLLIElement>('[role="option"]');
    const highlightedItem = items[highlightedIndex];
    if (highlightedItem && typeof highlightedItem.scrollIntoView === 'function') {
      highlightedItem.scrollIntoView({ block: 'nearest' });
    }
  }, [isOpen, highlightedIndex]);

  return (
    <div
      ref={containerRef}
      className={`app-select-container variant-${variant} size-${size} ${isOpen ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''} ${fullWidth ? 'full-width' : ''} ${className}`}
      onKeyDown={handleKeyDown}
    >
      <button
        ref={triggerRef}
        type="button"
        id={selectId}
        name={name}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        aria-required={required}
        onClick={handleToggle}
        className={`app-select-trigger ${triggerClassName}`}
      >
        <span className="app-select-value">
          {selectedOption ? selectedOption.label : <span className="app-select-placeholder">{placeholder}</span>}
        </span>
        <span className="app-select-icon" aria-hidden="true">
          <i className={`ph ${isOpen ? 'ph-caret-up' : 'ph-caret-down'}`} />
        </span>
      </button>

      {isOpen && (
        <div
          className={`app-select-popover placement-${placement} align-${align} ${menuClassName}`}
          role="presentation"
        >
          <ul
            ref={listboxRef}
            id={`${selectId}-listbox`}
            role="listbox"
            aria-labelledby={selectId}
            aria-activedescendant={
              highlightedIndex >= 0 ? `${selectId}-opt-${highlightedIndex}` : undefined
            }
            tabIndex={-1}
            className="app-select-menu"
          >
            {options.map((option, index) => {
              const isSelected = String(option.value) === String(value);
              const isHighlighted = highlightedIndex === index;

              return (
                <li
                  key={`${option.value}-${index}`}
                  id={`${selectId}-opt-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled}
                  className={`app-select-item ${isSelected ? 'is-selected' : ''} ${isHighlighted ? 'is-highlighted' : ''} ${option.disabled ? 'is-disabled' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(option);
                  }}
                  onMouseEnter={() => {
                    if (!option.disabled) setHighlightedIndex(index);
                  }}
                >
                  <div className="app-select-item-content">
                    {renderOption ? (
                      renderOption(option, isSelected)
                    ) : (
                      <>
                        <span className="app-select-item-label">{option.label}</span>
                        {option.description && (
                          <span className="app-select-item-desc">{option.description}</span>
                        )}
                      </>
                    )}
                  </div>
                  {isSelected && (
                    <span className="app-select-check" aria-hidden="true">
                      <i className="ph ph-check" />
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
