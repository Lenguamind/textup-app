import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidMount() {
    window.addEventListener('unhandledrejection', this.promiseRejectionHandler);
    window.addEventListener('error', this.globalErrorHandler);
  }

  public componentWillUnmount() {
    window.removeEventListener('unhandledrejection', this.promiseRejectionHandler);
    window.removeEventListener('error', this.globalErrorHandler);
  }

  private promiseRejectionHandler = (event: PromiseRejectionEvent) => {
    this.setState({
      hasError: true,
      error: event.reason instanceof Error ? event.reason : new Error(String(event.reason))
    });
  };

  private globalErrorHandler = (event: ErrorEvent) => {
    this.setState({
      hasError: true,
      error: event.error
    });
  };

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    // You could also log the error to an error reporting service here
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
          return this.props.fallback;
      }
      
      let friendlyMessage = "Error del servidor.";
      let details = this.state.error?.message || "";
      
      try {
          // Si el missatge és el JSON estructurat de Firestore, extraiem la info per fer-ho friendly
          if (details.includes('operationType') && details.includes('Missing or insufficient permissions')) {
              const parsed = JSON.parse(details);
              friendlyMessage = `S'han detectat problemes de permisos ('${parsed.operationType}' a la ruta '${parsed.path}'). Probablement la teva sessió ha caducat o has accedit a dades alienes.`;
              details = JSON.stringify(parsed, null, 2);
          }
      } catch (e) {
          // No és json, deixem els valors per defecte
      }

      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
          <div className="bg-white border-3 border-pop-dark p-6 rounded-2xl shadow-neo text-center max-w-md w-full animate-pop-in">
            <h2 className="text-2xl font-black text-pop-dark uppercase tracking-tight mb-2">
              S'ha produït un error
            </h2>
            <p className="text-gray-600 font-medium mb-4 text-sm">
              {friendlyMessage}
            </p>
            <div className="bg-gray-100 p-3 rounded-lg border-2 border-gray-300 text-left text-xs font-mono text-gray-500 overflow-auto max-h-40 mb-4 whitespace-pre-wrap">
              {details}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="bg-pop-blue text-pop-dark font-black px-6 py-2 rounded-xl border-3 border-pop-dark w-full shadow-neo-sm btn-press uppercase"
            >
              Tornar a l'inici
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
