import type { ReactNode } from 'react';
import { Loader2, SearchX, WifiOff } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

export function Spinner({ className, size = 22 }: { className?: string; size?: number }) {
  return <Loader2 className={cn('animate-spin text-marigold', className)} size={size} aria-label="Loading" role="status" />;
}

export function PageSpinner() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner size={28} />
    </div>
  );
}

export interface EmptyStateProps {
  title: string;
  body?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, body, icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center rounded-card border border-dashed border-line bg-paper-2/50 px-6 py-12 text-center', className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-marigold-soft text-marigold-deep">{icon ?? <SearchX size={26} aria-hidden />}</div>
      <h3 className="font-display text-base font-extrabold text-ink">{title}</h3>
      {body && <p className="mt-2 max-w-sm text-sm leading-relaxed text-dust-dim">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Kuch gadbad ho gayi', body, onRetry, className }: { title?: string; body?: ReactNode; onRetry?: () => void; className?: string }) {
  return (
    <EmptyState
      className={className}
      icon={<WifiOff size={26} aria-hidden />}
      title={title}
      body={body ?? 'We could not load this. Check your connection and try again.'}
      action={
        onRetry && (
          <Button variant="outline" onClick={onRetry}>
            Try again
          </Button>
        )
      }
    />
  );
}
