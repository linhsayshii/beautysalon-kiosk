import React, { useEffect, useState } from 'react';

export interface PercentInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'defaultValue' | 'type'> {
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  suffix?: string;
}

export const PercentInput = React.forwardRef<HTMLInputElement, PercentInputProps>(
  (
    {
      value,
      defaultValue,
      onChange,
      suffix,
      className,
      placeholder,
      disabled,
      onBlur,
      onFocus,
      style,
      ...rest
    },
    ref
  ) => {
    const [displayVal, setDisplayVal] = useState<string>(() =>
      value !== undefined ? String(value) : String(defaultValue ?? 0)
    );

    useEffect(() => {
      if (value !== undefined) {
        setDisplayVal(String(value));
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/[^0-9]/g, '');
      const num = raw ? parseInt(raw, 10) : 0;
      setDisplayVal(String(num));
      onChange?.(num);
    };

    return (
      <div className="input-suffix">
        <input
          {...rest}
          ref={ref}
          type="text"
          inputMode="numeric"
          value={displayVal}
          placeholder={placeholder}
          disabled={disabled}
          className={className}
          style={style}
          onChange={handleChange}
          onFocus={onFocus}
          onBlur={onBlur}
        />
        {suffix && <span>{suffix}</span>}
      </div>
    );
  }
);

PercentInput.displayName = 'PercentInput';
