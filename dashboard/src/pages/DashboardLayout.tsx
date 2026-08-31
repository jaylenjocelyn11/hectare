import { NavLink, Outlet, useParams } from "react-router-dom";
import { BrandLogo } from "../components/BrandLogo";
import {
  IconBook,
  IconBox,
  IconChecklist,
  IconDashboard,
  IconGear,
  IconPeople,
  IconReport,
  IconThermometer,
} from "../components/NavIcons";
import { useAuth } from "../contexts/AuthContext";
import { useDashboardSession } from "../hooks/useDashboardSession";
import { DEFAULT_ACCENT, NAV_ITEMS, navVisible, resolveAccent, themeFromAccent } from "../lib/dashboards";
import styles from "./DashboardPage.module.css";

const ICONS = {
  overview: IconDashboard,
  temperatures: IconThermometer,
  procedures: IconChecklist,
  recipes: IconBook,
  inventory: IconBox,
  groups: IconPeople,
  reports: IconReport,
  settings: IconGear,
} as const;

export function DashboardLayout() {
  const { orgSlug } = useParams();
  const { user, signOutUser } = useAuth();
  const session = useDashboardSession(user, orgSlug);
  const slug = session.slug;
  const accent = resolveAccent(session.dashboard?.accent || DEFAULT_ACCENT);
  const tagline = session.dashboard?.tagline || "Contrôle HACCP";
  const title = session.dashboard?.name;

  return (
    <div className={styles.layout} style={themeFromAccent(accent)}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <BrandLogo size="sm" className={styles.brandLogo} />
          {title ? <p className={styles.brandName}>{title}</p> : null}
          <p className={styles.brandTag}>{tagline}</p>
        </div>
        <nav className={styles.nav}>
          {NAV_ITEMS.filter((item) => navVisible(session.dashboard?.nav ?? {}, item.key)).map(
            (item) => {
              const Icon = ICONS[item.key];
              const to = item.path && slug ? `/${slug}/${item.path}` : slug ? `/${slug}` : "/";
              return (
                <NavLink
                  key={item.key}
                  to={to}
                  end={!item.path}
                  className={({ isActive }) => (isActive ? styles.navActive : styles.navLink)}
                >
                  <Icon />
                  {item.label}
                </NavLink>
              );
            }
          )}
        </nav>
        <div className={styles.sidebarFoot}>
          {session.isPlatformAdmin ? (
            <NavLink to="/admin" className={styles.navLink}>
              Tous les tableaux
            </NavLink>
          ) : null}
          {slug ? (
            <p className={styles.orgChip} title={session.organizationId ?? slug}>
              {slug}
            </p>
          ) : null}
          <button type="button" className={styles.linkButton} onClick={() => signOutUser()}>
            Déconnexion
          </button>
        </div>
      </aside>

      <header className={styles.header}>
        <span className={styles.live} title="Les données se mettent à jour toutes seules">
          En direct
        </span>
        <span className={styles.email} title={user?.email ?? ""}>
          {user?.email}
        </span>
      </header>

      <main className={styles.main}>
        <Outlet context={session} />
      </main>
    </div>
  );
}
