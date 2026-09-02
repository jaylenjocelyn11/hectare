import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useDashboardProfile } from "../hooks/useDashboardSession";
import { ROOT_DOMAIN, dashboardPublicUrl } from "../lib/dashboards";

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

  const slug = profile?.dashboardSlug || profile?.organizationId;
  if (slug) {
    const host = window.location.hostname.toLowerCase();
    if (host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}`) {
      window.location.replace(dashboardPublicUrl(slug));
      return (
        <div className="centered">
          <p className="muted">Ouverture de {dashboardPublicUrl(slug)}…</p>
        </div>
      );
    }
    return <Navigate to={`/${slug}`} replace />;
  }

  return (
    <div className="centered">
      <p className="muted">
        Aucun tableau de bord n’est lié à ce compte. Demande à l’administrateur de t’en créer un.
      </p>
    </div>
  );
}
