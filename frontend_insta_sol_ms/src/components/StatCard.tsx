import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn, formatNumber } from '../lib/format';
import { Spinner } from './Spinner';

interface StatCardProps {
  label: string;
  value: number | string | null | undefined;
  icon?: LucideIcon;
  /** Sub-line under the number, e.g. "last 30 days". */
  hint?: string;
  /** Signed change; positive renders green, negative red. */
  delta?: number | null;
  deltaSuffix?: string;
  loading?: boolean;
  /** Emphasise the card when the number itself is bad news (unanswered DMs). */
  alert?: boolean;
  onClick?: () => void;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  delta,
  deltaSuffix = '',
  loading = false,
  alert = false,
  onClick,
}: StatCardProps) {
  const display =
    typeof value === 'number' ? formatNumber(value) : (value ?? '—');
  const hasDelta = typeof delta === 'number' && Number.isFinite(delta) && delta !== 0;
  const positive = (delta ?? 0) > 0;

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </p>
        {Icon ? (
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              alert ? 'bg-red-50 text-danger' : 'bg-blue-50 text-brand',
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        {loading ? (
          <Spinner className="h-6 w-6" />
        ) : (
          <span
            className={cn(
              'text-2xl font-semibold tabular-nums sm:text-3xl',
              alert && value ? 'text-danger' : 'text-ink',
            )}
          >
            {display}
          </span>
        )}
        {hasDelta && !loading ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-medium',
              positive ? 'text-green-600' : 'text-danger',
            )}
          >
            {positive ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            {formatNumber(Math.abs(delta as number))}
            {deltaSuffix}
          </span>
        ) : null}
      </div>

      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </>
  );

  const className = cn(
    'rounded-xl border bg-white p-4 text-left shadow-sm transition',
    alert ? 'border-red-200' : 'border-slate-200',
    onClick && 'hover:border-brand hover:shadow focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1',
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(className, 'w-full')}>
        {body}
      </button>
    );
  }

  return <div className={className}>{body}</div>;
}
