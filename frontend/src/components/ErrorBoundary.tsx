import * as React from "react";

type ErrorBoundaryState = {
  error: Error | null;
};

class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };
  private reloadTimer: ReturnType<typeof window.setTimeout> | null = null;

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("App crashed:", error, info);

    const message = String(error?.message || "");
    const isStaleModule =
      message.includes("Failed to fetch dynamically imported module") ||
      message.includes("Importing a module script failed");

    if (isStaleModule && typeof window !== "undefined") {
      const key = "brajmart-dynamic-import-reload";
      if (sessionStorage.getItem(key) !== "1") {
        sessionStorage.setItem(key, "1");
        this.reloadTimer = window.setTimeout(() => window.location.reload(), 250);
      }
    }
  }

  componentWillUnmount() {
    if (this.reloadTimer) window.clearTimeout(this.reloadTimer);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: "#555", marginBottom: 12 }}>
            Please reload the page. If the issue persists, share the error message below.
          </p>
          <pre style={{ whiteSpace: "pre-wrap", background: "#f7f7f7", padding: 12, borderRadius: 8 }}>
            {this.state.error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
