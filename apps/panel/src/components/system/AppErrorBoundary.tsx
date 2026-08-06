import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('AppErrorBoundary', error, errorInfo);
  }

  private handleReload = () => {
    window.location.assign('/');
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#09090b] px-4 text-zinc-200">
          <div className="max-w-md rounded-2xl border border-white/10 bg-zinc-900/70 p-6 text-center">
            <h1 className="text-lg font-semibold">Se produjo un error inesperado</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Puedes recargar la aplicacion. Si el problema persiste, comparte la hora y accion realizada con soporte.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="mt-4 rounded-lg border border-amber-500/40 px-4 py-2 text-sm font-medium text-amber-300 hover:bg-amber-500/10"
            >
              Volver al panel
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
