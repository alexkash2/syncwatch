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
      <div className="min-h-screen flex items-center justify-center bg-surface p-6">
        <div className="max-w-md text-center space-y-6">
          <div className="text-5xl">⚠</div>
          <h1 className="font-black text-2xl tracking-tighter text-on-surface">
            Something went wrong
          </h1>
          <p className="text-on-surface-variant text-sm">
            The app hit an unexpected error. You can try reloading this page or
            going back to the dashboard.
          </p>
          <pre className="text-[11px] text-on-surface-variant/60 bg-surface-container-lowest p-3 overflow-auto text-left max-h-32">
            {this.state.error.message}
          </pre>
          <div className="flex gap-3 justify-center">
            <button
              onClick={this.handleReload}
              className="px-6 py-3 bg-gradient-to-br from-primary-container to-[#0053da] text-on-primary-container font-bold uppercase text-xs tracking-widest active:scale-95 transition-all cursor-pointer"
            >
              Reload
            </button>
            <button
              onClick={this.handleGoHome}
              className="px-6 py-3 border border-outline-variant/30 text-on-surface-variant hover:text-on-surface font-bold uppercase text-xs tracking-widest active:scale-95 transition-all cursor-pointer"
            >
              Go home
            </button>
          </div>
        </div>
      </div>
    );
  }
}
