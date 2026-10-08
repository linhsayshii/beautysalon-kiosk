import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { FloatingLayer } from '@/components/ui/FloatingLayer/FloatingLayer';

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<string>;
  id?: string;
  placeholder?: string;
  'aria-label'?: string;
}

export function Combobox({ value, onChange, options, id, placeholder, 'aria-label': ariaLabel }: ComboboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const filteredOptions = useMemo(() => {
    const query = value.trim().toLocaleLowerCase('vi');
    return options.filter((option) => !query || option.toLocaleLowerCase('vi').includes(query));
  }, [options, value]);

  useEffect(() => {
    if (!isOpen) return;
    const close = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [isOpen]);

  const choose = (option: string) => {
    onChange(option);
    setIsOpen(false);
  };

  return (
    <div ref={rootRef} className={`app-combobox ${isOpen ? 'is-open' : ''}`}>
      <input
        ref={inputRef}
        className="input"
        id={inputId}
        value={value}
        placeholder={placeholder}
        role="combobox"
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={isOpen ? `${inputId}-listbox` : undefined}
        onFocus={() => {
          setHighlightedIndex(0);
          setIsOpen(true);
        }}
        onChange={(event) => {
          onChange(event.target.value);
          setHighlightedIndex(0);
          setIsOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setIsOpen(true);
            setHighlightedIndex((index) => Math.min(index + 1, filteredOptions.length - 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlightedIndex((index) => Math.max(index - 1, 0));
          } else if (event.key === 'Enter' && isOpen && filteredOptions[highlightedIndex]) {
            event.preventDefault();
            choose(filteredOptions[highlightedIndex]);
          } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            setIsOpen(false);
          }
        }}
      />
      <button
        type="button"
        className="app-combobox-toggle"
        aria-label={isOpen ? 'Đóng danh sách' : 'Mở danh sách'}
        onClick={() => {
          setHighlightedIndex(0);
          setIsOpen((open) => !open);
          inputRef.current?.focus();
        }}
      >
        <i className={`ph ph-caret-${isOpen ? 'up' : 'down'}`} />
      </button>
      <FloatingLayer open={isOpen && filteredOptions.length > 0} anchorRef={rootRef} layerRef={menuRef} matchAnchorWidth className="app-select-popover app-combobox-popover" role="presentation">
        <ul id={`${inputId}-listbox`} className="app-select-menu" role="listbox" aria-label="Gợi ý nhóm hàng">
          {filteredOptions.map((option, index) => (
            <li
              key={option}
              role="option"
              aria-selected={option === value}
              className={`app-select-item ${option === value ? 'is-selected' : ''} ${index === highlightedIndex ? 'is-highlighted' : ''}`}
              onMouseEnter={() => setHighlightedIndex(index)}
              onClick={() => choose(option)}
            >
              <span className="app-select-item-label">{option}</span>
              {option === value && <span className="app-select-check"><i className="ph ph-check" /></span>}
            </li>
          ))}
        </ul>
      </FloatingLayer>
    </div>
  );
}
