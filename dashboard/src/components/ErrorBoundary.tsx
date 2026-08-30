import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { message: string | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { message: null };

  static getDerivedStateFromError(error: Error): State {
    return { message: error.message || "Erreur inattendue" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info);
  }

  render() {
    if (this.state.message) {
      return (
        <div className="centered" style={{ padding: "2rem", maxWidth: 480, margin: "0 auto" }}>
          <p>
            Le tableau de bord a rencontré un problème. Recharge la page. Si ça continue, reconnecte-toi.
          </p>
          <p className="muted">{this.state.message}</p>
          <button type="button" onClick={() => window.location.reload()}>
            Recharger
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
