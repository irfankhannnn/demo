import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '../lib/format';
import { Spinner } from './Spinner';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function PageHeader({
  title,
  description,
  actions,
  onRefresh,
  refreshing = false,
}: PageHeaderProps) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {actions}
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className={cn(
              'inline-flex min-h-touch items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition',
              refreshing ? 'opacity-60' : 'hover:border-brand hover:text-brand',
            )}
          >
            {refreshing ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </button>
        ) : null}
      </div>
    </div>
  );
}
