import { useState, useEffect, useRef } from 'react';

interface NumericInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  required?: boolean;
  placeholder?: string;
  className?: string;
  allowDecimal?: boolean;
}

export default function NumericInput({
  value,
  onChange,
  min = 0,
  max,
  required = false,
  placeholder = '',
  className = '',
  allowDecimal = false,
}: NumericInputProps) {
  const [displayValue, setDisplayValue] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Only update display if input is not focused
    if (document.activeElement !== inputRef.current) {
      setDisplayValue(value === 0 ? '' : String(value));
    }
  }, [value]);

  const handleFocus = () => {
    // Clear the display when focused if value is 0
    if (value === 0) {
      setDisplayValue('');
    }
  };

  const handleBlur = () => {
    // If empty, set to 0
    if (displayValue === '' || displayValue === '.') {
      onChange(0);
      setDisplayValue('');
    } else {
      const numValue = allowDecimal ? parseFloat(displayValue) : parseInt(displayValue, 10);
      if (!isNaN(numValue)) {
        const clampedValue = max !== undefined ? Math.min(numValue, max) : numValue;
        const finalValue = Math.max(clampedValue, min);
        onChange(finalValue);
        setDisplayValue(finalValue === 0 ? '' : String(finalValue));
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Allow empty string
    if (inputValue === '') {
      setDisplayValue('');
      onChange(0);
      return;
    }

    // Validate input based on allowDecimal
    const regex = allowDecimal ? /^[0-9]*\.?[0-9]*$/ : /^[0-9]*$/;
    if (!regex.test(inputValue)) {
      return;
    }

    // Remove leading zeros (except for decimal numbers like "0.5")
    let cleanValue = inputValue;
    if (!allowDecimal) {
      cleanValue = inputValue.replace(/^0+/, '') || '';
    } else {
      // For decimals, only remove leading zeros if not followed by a decimal point
      if (inputValue.match(/^0[0-9]/)) {
        cleanValue = inputValue.replace(/^0+/, '');
      }
    }

    setDisplayValue(cleanValue);

    const numValue = allowDecimal ? parseFloat(cleanValue) : parseInt(cleanValue, 10);
    if (!isNaN(numValue)) {
      onChange(numValue);
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      pattern={allowDecimal ? "[0-9]*\\.?[0-9]*" : "[0-9]*"}
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      required={required}
      placeholder={placeholder}
      className={className}
    />
  );
}
