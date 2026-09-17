import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last line of defence against a blank screen.
 *
 * A render-time throw anywhere below this boundary would otherwise unmount the
 * whole tree and leave an empty `#root`, which is exactly the failure the brief
 * forbids. Reset re-mounts the subtree without a full page reload.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // No Sentry in this app yet; the console is the only sink available.
    console.error('[insta] render error', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-danger">
            <AlertOctagon className="h-5 w-5" />
          </div>
          <h1 className="text-base font-semibold text-ink">Something broke on this screen</h1>
          <p className="mt-2 break-words text-sm text-slate-500">{error.message}</p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={this.handleReset}
              className="min-h-touch rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-light focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-touch rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Reload the page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
