import { useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { useOrgCollection } from "../hooks/useOrgCollection";
import { asDate, formatDateTime } from "../lib/dates";
import type { OrgContext } from "./orgContext";
import styles from "./DashboardPage.module.css";

type ProcedureTemplate = { name?: string; type?: string };
type ProcedureRun = {
  status?: string;
  isOverdue?: boolean;
  signedBy?: string;
  startTime?: unknown;
  date?: unknown;
  currentStep?: number;
  totalSteps?: number;
  procedureTemplateId?: string;
};

export function ProceduresPage() {
  const { organizationId, resolving, error: orgError } = useOutletContext<OrgContext>();
  const templates = useOrgCollection<ProcedureTemplate>(
    organizationId,
    "procedureTemplates"
  );
  const runs = useOrgCollection<ProcedureRun>(organizationId, "procedureRuns");

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of templates.docs) map.set(t.id, t.name || t.id);
    return map;
  }, [templates.docs]);

  const rows = [...runs.docs].sort((a, b) => {
    const da = asDate(a.startTime) ?? asDate(a.date);
    const db = asDate(b.startTime) ?? asDate(b.date);
    return (db?.getTime() ?? 0) - (da?.getTime() ?? 0);
  });

  return (
    <>
      {resolving ? <p className="muted">Recherche de l’organisation…</p> : null}
      {orgError ? <p className={styles.warn}>{orgError}</p> : null}
      {templates.error || runs.error ? (
        <p className={styles.warn}>{templates.error || runs.error}</p>
      ) : null}

      {!resolving && organizationId ? (
        <>
          <h1 className={styles.h1}>Procédures</h1>
          <p className={styles.meta}>
            Ouverture, fermeture et autres checklists lancées depuis l’iPad.
          </p>

          <h2 className={styles.h2}>Modèles ({templates.docs.length})</h2>
          {templates.docs.length === 0 ? (
            <p className="muted">Aucun modèle. Crée-les dans l’app iPad.</p>
          ) : (
            <ul className={styles.list}>
              {templates.docs.map((t) => (
                <li key={t.id}>
                  <strong>{t.name || t.id}</strong>
                  {t.type ? <span className="muted"> — {t.type}</span> : null}
                </li>
              ))}
            </ul>
          )}

          <h2 className={styles.h2}>Exécutions</h2>
          {runs.loading ? <p className="muted">Chargement…</p> : null}
          {rows.length === 0 ? (
            <p className="muted">Aucune exécution pour l’instant.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Quand</th>
                    <th>Procédure</th>
                    <th>Progression</th>
                    <th>Statut</th>
                    <th>Signé par</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{formatDateTime(r.startTime ?? r.date)}</td>
                      <td>
                        {r.procedureTemplateId
                          ? nameById.get(r.procedureTemplateId) ?? r.procedureTemplateId
                          : "—"}
                      </td>
                      <td>
                        {typeof r.currentStep === "number" && typeof r.totalSteps === "number"
                          ? `${r.currentStep} / ${r.totalSteps}`
                          : "—"}
                      </td>
                      <td>{statusLabel(r.status, r.isOverdue)}</td>
                      <td>{r.signedBy || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </>
  );
}

function statusLabel(status?: string, overdue?: boolean) {
  const s = (status ?? "").toLowerCase();
  if (overdue) return <span className={styles.tagBad}>En retard</span>;
  if (s === "completed") return <span className={styles.tagOk}>Terminée</span>;
  if (s === "running" || s === "inprogress") return <span className={styles.tagWarn}>En cours</span>;
  if (s === "paused") return <span className={styles.tagWarn}>En pause</span>;
  if (s === "cancelled") return <span className={styles.tagMuted}>Annulée</span>;
  return status || "—";
}
