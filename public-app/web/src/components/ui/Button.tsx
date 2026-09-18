import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'ink' | 'gulal' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  full?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-marigold text-ink hover:bg-marigold-hover active:bg-marigold-hover shadow-[0_6px_18px_-8px_rgba(255,122,26,0.7)]',
  secondary: 'bg-paper-2 text-ink hover:bg-paper-3 border border-line',
  outline: 'border border-ink/20 text-ink hover:border-ink hover:bg-ink/5',
  ghost: 'text-ink hover:bg-ink/5',
  ink: 'bg-ink text-paper hover:bg-ink-2',
  gulal: 'bg-gulal text-paper hover:bg-gulal-hover',
  danger: 'bg-danger/10 text-danger hover:bg-danger/15 border border-danger/30',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-[13px] gap-1.5 rounded-xl',
  md: 'h-11 px-5 text-sm gap-2 rounded-xl',
  lg: 'h-[52px] px-6 text-[15px] gap-2 rounded-2xl',
};

/** Router <Link> styled exactly like <Button>. */
export function LinkButton({ to, variant = 'primary', size = 'md', leftIcon, rightIcon, full, className, children }: { to: string; variant?: Variant; size?: Size; leftIcon?: ReactNode; rightIcon?: ReactNode; full?: boolean; className?: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap font-extrabold tracking-[-0.01em] transition-[background-color,transform,box-shadow,border-color] duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marigold focus-visible:ring-offset-2 focus-visible:ring-offset-paper active:scale-[0.98]',
        VARIANTS[variant],
        SIZES[size],
        full && 'w-full',
        className,
      )}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </Link>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, leftIcon, rightIcon, full, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap font-extrabold tracking-[-0.01em] transition-[background-color,transform,box-shadow,border-color] duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marigold focus-visible:ring-offset-2 focus-visible:ring-offset-paper',
        'disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]',
        VARIANTS[variant],
        SIZES[size],
        full && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="animate-spin" size={size === 'sm' ? 14 : 18} aria-hidden /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
});
