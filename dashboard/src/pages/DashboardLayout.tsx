import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useOrganizationId } from "../hooks/useOrganizationId";
import styles from "./DashboardPage.module.css";

export function DashboardLayout() {
  const { user, signOutUser } = useAuth();
  const org = useOrganizationId(user);

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div>
          <strong>Hectare</strong>
          <span className={styles.badge}>Tableau de bord</span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.live} title="Les données se mettent à jour toutes seules">
            En direct
          </span>
          <span className={styles.email} title={user?.email ?? ""}>
            {user?.email}
          </span>
          <button type="button" className={styles.linkButton} onClick={() => signOutUser()}>
            Déconnexion
          </button>
        </div>
      </header>

      <aside className={styles.sidebar}>
        <nav className={styles.nav}>
          <NavLink
            to="/"
            end
            className={({ isActive }) => (isActive ? styles.navActive : styles.navLink)}
          >
            Vue d’ensemble
          </NavLink>
          <NavLink
            to="/temperatures"
            className={({ isActive }) => (isActive ? styles.navActive : styles.navLink)}
          >
            Températures
          </NavLink>
          <NavLink
            to="/procedures"
            className={({ isActive }) => (isActive ? styles.navActive : styles.navLink)}
          >
            Procédures
          </NavLink>
        </nav>
      </aside>

      <main className={styles.main}>
        <Outlet context={org} />
      </main>
    </div>
  );
}
