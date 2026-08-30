import { NavLink, Outlet } from "react-router-dom";
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
import { useOrganizationId } from "../hooks/useOrganizationId";
import styles from "./DashboardPage.module.css";

const NAV = [
  { to: "/", label: "Tableau de bord", end: true, icon: IconDashboard },
  { to: "/temperatures", label: "Températures", end: false, icon: IconThermometer },
  { to: "/procedures", label: "Procédures", end: false, icon: IconChecklist },
  { to: "/recipes", label: "Recettes", end: false, icon: IconBook },
  { to: "/inventory", label: "Inventaire", end: false, icon: IconBox },
  { to: "/groups", label: "Groupe", end: false, icon: IconPeople },
  { to: "/reports", label: "Rapports", end: false, icon: IconReport },
  { to: "/settings", label: "Paramètres", end: false, icon: IconGear },
] as const;

export function DashboardLayout() {
  const { user, signOutUser } = useAuth();
  const org = useOrganizationId(user);

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <BrandLogo size="sm" className={styles.brandLogo} />
          <p className={styles.brandTag}>Contrôle HACCP</p>
        </div>
        <nav className={styles.nav}>
          {NAV.map(({ to, label, end, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => (isActive ? styles.navActive : styles.navLink)}
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.sidebarFoot}>
          {org.organizationId ? (
            <p className={styles.orgChip} title={org.organizationId}>
              Org. {org.organizationId}
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
        <Outlet context={org} />
      </main>
    </div>
  );
}
