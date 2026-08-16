import React, { useEffect, useState } from 'react';
import { formatNumber, parseMoney } from '@/lib/format';

export interface MoneyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'defaultValue'> {
  value?: number | string;
  defaultValue?: number | string;
  onChange?: (value: number) => void;
  suffix?: string;
  wrapperClassName?: string;
  allowEmpty?: boolean;
}

export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  (
    {
      value,
      defaultValue,
      onChange,
      suffix,
      wrapperClassName,
      allowEmpty = true,
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
    const formatDisplay = (val: number | string | undefined) => {
      if (val === undefined || val === null || val === '') {
        return allowEmpty ? '' : '0';
      }
      const num = typeof val === 'number' ? val : parseMoney(val);
      if (num === 0 && allowEmpty && val === '') return '';
      return formatNumber(num);
    };

    const [displayVal, setDisplayVal] = useState<string>(() =>
      formatDisplay(value !== undefined ? value : defaultValue)
    );

    useEffect(() => {
      if (value !== undefined) {
        setDisplayVal(formatDisplay(value));
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const num = parseMoney(raw);
      if (raw === '' && allowEmpty) {
        setDisplayVal('');
        onChange?.(0);
      } else {
        setDisplayVal(formatNumber(num));
        onChange?.(num);
      }
    };

    const inputElement = (
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
    );

    if (suffix || wrapperClassName) {
      return (
        <div className={wrapperClassName || 'input-suffix'}>
          {inputElement}
          {suffix && <span>{suffix}</span>}
        </div>
      );
    }

    return inputElement;
  }
);

MoneyInput.displayName = 'MoneyInput';
