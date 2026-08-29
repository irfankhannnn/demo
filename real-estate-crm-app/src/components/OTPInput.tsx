/**
 * 6-digit OTP input component with auto-focus and paste support
 */

import { useRef, useEffect, KeyboardEvent, ClipboardEvent } from 'react';

interface OTPInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

export default function OTPInput({ value, onChange, error, disabled }: OTPInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.split('');

  useEffect(() => {
    // Auto-focus first empty input
    const firstEmptyIndex = digits.findIndex((d) => !d);
    if (firstEmptyIndex !== -1 && inputRefs.current[firstEmptyIndex]) {
      inputRefs.current[firstEmptyIndex]?.focus();
    } else if (digits.length === 6) {
      inputRefs.current[5]?.focus();
    }
  }, [digits]);

  const handleChange = (index: number, digit: string) => {
    if (!/^\d*$/.test(digit)) return;

    const newDigits = [...digits];
    newDigits[index] = digit[digit.length - 1] || '';
    const newValue = newDigits.join('');
    onChange(newValue);

    // Auto-focus next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pastedData);
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-slate-700 text-center">
        Enter OTP
      </label>
      <div className="flex justify-center gap-2.5">
        {[0, 1, 2, 3, 4, 5].map((index) => {
          const hasValue = !!digits[index];
          return (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digits[index] || ''}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              disabled={disabled}
              style={{ animationDelay: `${index * 40}ms` }}
              className={`
                w-12 h-14 text-center text-2xl font-bold rounded-2xl
                transition-all duration-200
                animate-fadeInUp
                ${error
                  ? 'border-2 border-rose-300 focus:border-rose-500 focus:shadow-[0_0_0_3px_rgba(244,63,94,0.12)]'
                  : hasValue
                    ? 'border-2 border-indigo-400 bg-gradient-to-b from-indigo-50 to-white text-indigo-700 shadow-sm'
                    : 'border-2 border-slate-200 focus:border-indigo-400 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.10)]'
                }
                ${disabled ? 'bg-slate-100 cursor-not-allowed opacity-60' : 'bg-white'}
                focus:outline-none
                placeholder:text-slate-300
              `}
            />
          );
        })}
      </div>
      {error && (
        <p className="text-sm text-rose-600 text-center font-medium animate-fadeIn">{error}</p>
      )}
      <p className="text-xs text-slate-400 text-center font-medium tracking-wide uppercase">
        6-digit code sent to your phone
      </p>
    </div>
  );
}
