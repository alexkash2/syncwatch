import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/**
 * App-level error boundary. Without it, any uncaught render error produces a
 * blank white page with no indication of what happened. Here we catch, log,
 * and show a minimal recovery UI so the user can reload or go home.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled app error:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-bg p-6">
        <div className="max-w-md space-y-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[14px] bg-warning-tint text-2xl text-warning">
            ⚠
          </div>
          <h1 className="text-2xl font-bold -tracking-[0.02em] text-ink">Something went wrong</h1>
          <p className="text-sm leading-7 text-ink-2">
            The app hit an unexpected error. You can try reloading this page or going back to the
            dashboard.
          </p>
          <pre className="max-h-32 overflow-auto rounded-[10px] bg-surface-2 p-3 text-left text-[11px] text-ink-3">
            {this.state.error.message}
          </pre>
          <div className="flex justify-center gap-3">
            <button
              onClick={this.handleReload}
              className="h-12 rounded-[14px] bg-accent px-[22px] text-[15px] font-semibold text-white transition hover:bg-accent-strong"
            >
              Reload
            </button>
            <button
              onClick={this.handleGoHome}
              className="h-12 rounded-[14px] border border-line-2 bg-surface px-[22px] text-[15px] font-semibold text-ink transition hover:bg-surface-2"
            >
              Go home
            </button>
          </div>
        </div>
      </div>
    );
  }
}
