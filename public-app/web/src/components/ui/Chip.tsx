import { X } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children: ReactNode;
  selected?: boolean;
  /** gulal tint — reserved for AI-derived chips */
  ai?: boolean;
  onRemove?: () => void;
  size?: 'sm' | 'md';
  icon?: ReactNode;
}

export function Chip({ children, selected, ai, onRemove, size = 'md', icon, className, type = 'button', ...rest }: ChipProps) {
  const base = cn(
    'inline-flex select-none items-center gap-1.5 whitespace-nowrap rounded-pill border font-bold transition-colors duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marigold focus-visible:ring-offset-2 focus-visible:ring-offset-paper',
    size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-[13px]',
    ai
      ? selected
        ? 'border-gulal bg-gulal text-paper'
        : 'border-gulal/40 bg-gulal-soft text-gulal-deep hover:border-gulal'
      : selected
        ? 'border-ink bg-ink text-paper'
        : 'border-line bg-paper text-ink hover:border-ink/60',
    onRemove && 'pr-2',
    className,
  );

  return (
    <button type={type} aria-pressed={selected} className={base} {...rest}>
      {icon}
      <span className="truncate">{children}</span>
      {onRemove && (
        <span
          role="button"
          tabIndex={0}
          aria-label="Remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }
          }}
          className={cn(
            'ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full',
            selected ? 'hover:bg-white/20' : ai ? 'hover:bg-gulal/15' : 'hover:bg-ink/10',
          )}
        >
          <X size={12} strokeWidth={2.5} aria-hidden />
        </span>
      )}
    </button>
  );
}
