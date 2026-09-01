import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useDashboardProfile } from "../hooks/useDashboardSession";

export function HomeRedirect() {
  const { user } = useAuth();
  const { profile, resolving, error, isPlatformAdmin } = useDashboardProfile(user);

  if (resolving) {
    return (
      <div className="centered">
        <p className="muted">Recherche de ton tableau de bord…</p>
      </div>
    );
  }

  if (isPlatformAdmin) return <Navigate to="/admin" replace />;

  if (error) {
    return (
      <div className="centered">
        <p className="muted">{error}</p>
      </div>
    );
  }
  if (profile?.dashboardSlug) return <Navigate to={`/${profile.dashboardSlug}`} replace />;
  if (profile?.organizationId) return <Navigate to={`/${profile.organizationId}`} replace />;

  return (
    <div className="centered">
      <p className="muted">
        Aucun tableau de bord n’est lié à ce compte. Demande à l’administrateur de t’en créer un.
      </p>
    </div>
  );
}
