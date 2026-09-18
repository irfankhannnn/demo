import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tone?: 'paper' | 'ink' | 'glass';
  size?: 'sm' | 'md';
}

const TONES = {
  paper: 'bg-paper text-ink border border-line hover:bg-paper-2',
  ink: 'bg-ink text-paper hover:bg-ink-2',
  glass: 'bg-ink/55 text-paper backdrop-blur-md hover:bg-ink/75',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, tone = 'paper', size = 'md', className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full transition-colors duration-150 active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marigold focus-visible:ring-offset-2 focus-visible:ring-offset-paper',
        size === 'sm' ? 'h-9 w-9' : 'h-11 w-11',
        TONES[tone],
        className,
      )}
      {...rest}
    />
  );
});
