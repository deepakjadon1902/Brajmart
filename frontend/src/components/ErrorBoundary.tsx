import * as React from "react";
import { isModuleLoadError, recoverFromModuleLoadError } from '@/lib/moduleLoadRecovery';

type ErrorBoundaryState = {
  error: Error | null;
  recovering: boolean;
};

export const AppErrorFallback = ({ error, recovering = false }: { error: Error; recovering?: boolean }) => (
  <main role="alert" className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
    <section className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <h1 className="font-cinzel text-xl font-bold text-foreground">
        {recovering ? 'Updating this page…' : isModuleLoadError(error) ? 'This page needs a refresh' : 'Something went wrong'}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {recovering ? 'Loading the latest version. You will return to this page automatically.'
          : isModuleLoadError(error) ? 'The page files could not be loaded. Check your connection and reload to continue.'
          : 'Please reload the page to try again. If the issue persists, share the error details below with support.'}
      </p>
      <button type="button" onClick={() => window.location.reload()} className="mt-5 min-h-11 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        Reload page
      </button>
      <details className="mt-5 text-xs text-muted-foreground">
        <summary className="cursor-pointer">Error details</summary>
        <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-muted p-3">{error.message}</pre>
      </details>
    </section>
  </main>
);

class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, recovering: false };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("App crashed:", error, info);

    if (recoverFromModuleLoadError(error)) this.setState({ recovering: true });
  }

  render() {
    if (this.state.error) {
      return <AppErrorFallback error={this.state.error} recovering={this.state.recovering} />;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
