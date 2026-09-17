import { cn } from '../lib/format';

interface SpinnerProps {
  className?: string;
  label?: string;
}

export function Spinner({ className, label = 'Loading' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        'inline-block animate-spin rounded-full border-2 border-slate-200 border-t-brand',
        className ?? 'h-5 w-5',
      )}
    />
  );
}

/** Full-panel loading state. Every page uses this rather than rendering nothing. */
export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
      <Spinner className="h-7 w-7" />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

/** Placeholder rows for a table that is loading for the first time. */
export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 px-4 py-4">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-slate-100" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-slate-50" />
          </div>
        </div>
      ))}
    </div>
  );
}
