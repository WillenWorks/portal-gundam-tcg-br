import * as React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: any;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-white">
            <div className="text-center max-w-xl">
              <h1 className="text-2xl font-bold mb-2">Ocorreu um erro inesperado</h1>
              {this.state.error?.message && (
                <p className="text-xs font-mono text-rose-400 bg-rose-950/40 p-3 border border-rose-500/30 text-left mb-4 overflow-auto max-h-40">
                  {this.state.error.message}
                </p>
              )}
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold uppercase tracking-wider hover:bg-primary/90"
              >
                Recarregar Página
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
