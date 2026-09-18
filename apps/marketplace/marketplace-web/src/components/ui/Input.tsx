import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const FIELD =
  'w-full rounded-xl border border-line bg-white/60 px-4 text-[15px] text-ink placeholder:text-dust-dim transition-colors ' +
  'focus:border-ink focus:bg-white focus:outline-none focus:ring-2 focus:ring-marigold/40 disabled:opacity-60';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, hint, error, leftIcon, className, id, ...rest }, ref) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-[13px] font-bold text-ink">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-dust-dim">{leftIcon}</span>}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error || undefined}
          aria-describedby={hint || error ? hintId : undefined}
          className={cn(FIELD, 'h-12', leftIcon ? 'pl-11' : undefined, error ? 'border-danger focus:border-danger focus:ring-danger/30' : undefined, className)}
          {...rest}
        />
      </div>
      {(error || hint) && (
        <p id={hintId} className={cn('mt-1.5 text-xs', error ? 'font-semibold text-danger' : 'text-dust-dim')}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ label, hint, error, className, id, ...rest }, ref) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-[13px] font-bold text-ink">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        aria-invalid={!!error || undefined}
        className={cn(FIELD, 'min-h-[96px] resize-y py-3 leading-relaxed', error && 'border-danger', className)}
        {...rest}
      />
      {(error || hint) && <p className={cn('mt-1.5 text-xs', error ? 'font-semibold text-danger' : 'text-dust-dim')}>{error ?? hint}</p>}
    </div>
  );
});

export interface SelectProps extends InputHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, options, className, id, ...rest }: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="mb-1.5 block text-[13px] font-bold text-ink">
          {label}
        </label>
      )}
      <select id={selectId} className={cn(FIELD, 'h-12 appearance-none bg-no-repeat pr-10', className)} style={SELECT_ARROW} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

const SELECT_ARROW = {
  backgroundImage:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23948575' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='m6 9 6 6 6-6'/></svg>\")",
  backgroundPosition: 'right 14px center',
} as const;
