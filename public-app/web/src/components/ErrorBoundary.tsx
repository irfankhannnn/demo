import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './ui/Button';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[marketplace-web] render error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="container-x flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-gulal">Oops</p>
        <h1 className="mt-3 font-display text-2xl font-extrabold">Kuch toot gaya on our side.</h1>
        <p className="mt-2 max-w-md text-sm text-dust-dim">The page hit an error. Reloading usually fixes it; if not, come back in a minute.</p>
        <div className="mt-6 flex gap-2">
          <Button onClick={() => window.location.reload()}>Reload</Button>
          <Button variant="outline" onClick={() => (window.location.href = '/')}>
            Go home
          </Button>
        </div>
      </div>
    );
  }
}
