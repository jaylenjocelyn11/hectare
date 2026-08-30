import type { ReactNode } from "react";
import { useOutletContext } from "react-router-dom";
import type { OrgContext } from "./orgContext";
import styles from "./DashboardPage.module.css";

export function PageShell({
  errors = [],
  children,
}: {
  errors?: Array<string | null | undefined>;
  children: ReactNode;
}) {
  const { organizationId, resolving, error: orgError } = useOutletContext<OrgContext>();
  const listenError = errors.find((e) => e);

  return (
    <>
      {resolving ? <p className="muted">Recherche de l’organisation…</p> : null}
      {orgError ? <p className={styles.warn}>{orgError}</p> : null}
      {listenError ? <p className={styles.warn}>{listenError}</p> : null}
      {!resolving && organizationId ? children : null}
    </>
  );
}
