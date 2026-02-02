import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/dashboard";
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground">
          <div className="max-w-md w-full space-y-8 text-center">
            <div className="flex justify-center">
              <div className="p-4 bg-destructive/10 rounded-full">
                <AlertTriangle className="h-12 w-12 text-destructive" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">Ops! Algo deu errado.</h1>
              <p className="text-muted-foreground">
                Ocorreu um erro inesperado na aplicação. Você pode tentar recarregar a página ou voltar para o início.
              </p>
            </div>

            {this.state.error && (
              <div className="p-4 bg-muted rounded-lg text-left overflow-auto max-h-40">
                <p className="text-xs font-mono text-muted-foreground break-all">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Button onClick={this.handleReload} variant="outline" className="gap-2">
                <RefreshCcw className="h-4 w-4" />
                Recarregar Página
              </Button>
              <Button onClick={this.handleReset} className="gap-2">
                <Home className="h-4 w-4" />
                Ir para o Início
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
