import { AlertTriangle, RefreshCw } from 'lucide-react';
import { ApiError } from '../api/client';

interface ErrorStateProps {
  error: Error | ApiError;
  onRetry?: () => void;
  /** What the user was trying to see, e.g. "the reel leaderboard". */
  context?: string;
}

export function ErrorState({ error, onRetry, context }: ErrorStateProps) {
  const status = error instanceof ApiError ? error.status : undefined;
  const details = error instanceof ApiError ? error.details : undefined;

  const heading =
    status === 403
      ? 'You do not have access to this'
      : status === 404
        ? 'Not found'
        : status === 0
          ? 'Cannot reach the Instagram service'
          : `Could not load ${context ?? 'this page'}`;

  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 px-5 py-6 text-left"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-red-900">{heading}</h3>
          <p className="mt-1 break-words text-sm text-red-800">{error.message}</p>
          {details ? (
            <p className="mt-1 break-words text-xs text-red-700/80">{details}</p>
          ) : null}
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex min-h-touch items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-800 transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-1"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
