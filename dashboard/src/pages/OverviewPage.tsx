import { useOutletContext } from "react-router-dom";
import { useOrgCollection } from "../hooks/useOrgCollection";
import { asDate, formatDateTime, isSameLocalDay } from "../lib/dates";
import { asText } from "../lib/text";
import type { OrgContext } from "./orgContext";
import styles from "./DashboardPage.module.css";

type Equipment = {
  name?: string;
  isActive?: boolean;
};

type TempReading = {
  temperature?: number;
  timestamp?: unknown;
  date?: unknown;
  equipmentId?: string;
  isOutOfRange?: boolean;
  timePeriod?: string;
};

type ProcedureRun = {
  status?: string;
  isOverdue?: boolean;
  signedBy?: string;
  startTime?: unknown;
  date?: unknown;
  procedureTemplateId?: string;
};

type ProcedureTemplate = {
  name?: string;
};

export function OverviewPage() {
  const { organizationId, resolving, error: orgError } = useOutletContext<OrgContext>();
  const equipment = useOrgCollection<Equipment>(organizationId, "equipment");
  const readings = useOrgCollection<TempReading>(organizationId, "tempReadings");
  const runs = useOrgCollection<ProcedureRun>(organizationId, "procedureRuns");
  const templates = useOrgCollection<ProcedureTemplate>(
    organizationId,
    "procedureTemplates"
  );

  const listenError =
    equipment.error || readings.error || runs.error || templates.error;
  const loadingLists =
    equipment.loading || readings.loading || runs.loading || templates.loading;

  const today = new Date();
  const readingsToday = readings.docs.filter((r) => {
    const d = asDate(r.timestamp) ?? asDate(r.date);
    return d ? isSameLocalDay(d, today) : false;
  });
  const outOfRangeToday = readingsToday.filter((r) => r.isOutOfRange).length;
  const activeEquipment = equipment.docs.filter((e) => e.isActive !== false).length;
  const runsInProgress = runs.docs.filter((r) => {
    const s = asText(r.status, "").toLowerCase();
    return s === "running" || s === "inprogress" || s === "paused";
  }).length;
  const overdueRuns = runs.docs.filter((r) => r.isOverdue).length;

  const templateName = (id?: string) =>
    templates.docs.find((t) => t.id === id)?.name ?? "Procédure";

  const equipmentName = (id?: string) =>
    equipment.docs.find((e) => e.id === id)?.name ?? "Équipement";

  const latestReadings = [...readings.docs]
    .sort((a, b) => {
      const da = asDate(a.timestamp) ?? asDate(a.date);
      const db = asDate(b.timestamp) ?? asDate(b.date);
      return (db?.getTime() ?? 0) - (da?.getTime() ?? 0);
    })
    .slice(0, 8);

  const latestRuns = [...runs.docs]
    .sort((a, b) => {
      const da = asDate(a.startTime) ?? asDate(a.date);
      const db = asDate(b.startTime) ?? asDate(b.date);
      return (db?.getTime() ?? 0) - (da?.getTime() ?? 0);
    })
    .slice(0, 8);

  const dateLabel = today.toLocaleDateString("fr-CA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <>
      {resolving ? <p className="muted">Recherche de ton restaurant (organisation)…</p> : null}
      {orgError ? <p className={styles.warn}>{orgError}</p> : null}
      {listenError ? <p className={styles.warn}>{listenError}</p> : null}

      {!resolving && organizationId ? (
        <>
          <section className={styles.hero}>
            <div>
              <p className={styles.kicker}>Contrôle HACCP</p>
              <h1 className={styles.heroTitle}>Bonjour</h1>
              <p className={styles.meta}>
                Voici un aperçu de votre journée. Les saisies de l’iPad apparaissent ici en direct.
              </p>
            </div>
            <div className={styles.dateBadge}>
              <span className={styles.dateDay}>{dateLabel}</span>
            </div>
          </section>

          {loadingLists ? <p className="muted">Chargement des données…</p> : null}

          <div className={styles.kpis}>
            <article className={styles.kpi}>
              <span className={styles.kpiLabel}>Équipements actifs</span>
              <strong className={styles.kpiValue}>{activeEquipment}</strong>
            </article>
            <article className={styles.kpi}>
              <span className={styles.kpiLabel}>Relevés aujourd’hui</span>
              <strong className={styles.kpiValue}>{readingsToday.length}</strong>
            </article>
            <article className={styles.kpi}>
              <span className={styles.kpiLabel}>Hors plage aujourd’hui</span>
              <strong className={`${styles.kpiValue} ${outOfRangeToday ? styles.danger : ""}`}>
                {outOfRangeToday}
              </strong>
            </article>
            <article className={styles.kpi}>
              <span className={styles.kpiLabel}>Procédures en cours</span>
              <strong className={styles.kpiValue}>{runsInProgress}</strong>
              {overdueRuns > 0 ? (
                <span className={styles.kpiHint}>{overdueRuns} en retard</span>
              ) : null}
            </article>
          </div>

          <h2 className={styles.h2}>Derniers relevés</h2>
          {latestReadings.length === 0 ? (
            <p className="muted">Aucun relevé pour l’instant. Fais-en un dans l’app iPad.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Quand</th>
                    <th>Équipement</th>
                    <th>Température</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {latestReadings.map((r) => (
                    <tr key={r.id}>
                      <td>{formatDateTime(r.timestamp ?? r.date)}</td>
                      <td>{equipmentName(typeof r.equipmentId === "string" ? r.equipmentId : undefined)}</td>
                      <td>
                        {typeof r.temperature === "number" ? `${r.temperature} °C` : "—"}
                        {asText(r.timePeriod, "") ? ` (${asText(r.timePeriod, "")})` : ""}
                      </td>
                      <td>
                        {r.isOutOfRange ? (
                          <span className={styles.tagBad}>Hors plage</span>
                        ) : (
                          <span className={styles.tagOk}>OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2 className={styles.h2}>Dernières procédures</h2>
          {latestRuns.length === 0 ? (
            <p className="muted">Aucune procédure lancée pour l’instant.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Quand</th>
                    <th>Nom</th>
                    <th>Statut</th>
                    <th>Signé par</th>
                  </tr>
                </thead>
                <tbody>
                  {latestRuns.map((r) => (
                    <tr key={r.id}>
                      <td>{formatDateTime(r.startTime ?? r.date)}</td>
                      <td>{templateName(typeof r.procedureTemplateId === "string" ? r.procedureTemplateId : undefined)}</td>
                      <td>{statusLabel(r.status, r.isOverdue)}</td>
                      <td>{asText(r.signedBy)}</td>
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

function statusLabel(status: unknown, overdue?: boolean) {
  const s = asText(status, "").toLowerCase();
  if (overdue) return <span className={styles.tagBad}>En retard</span>;
  if (s === "completed") return <span className={styles.tagOk}>Terminée</span>;
  if (s === "running" || s === "inprogress") return <span className={styles.tagWarn}>En cours</span>;
  if (s === "paused") return <span className={styles.tagWarn}>En pause</span>;
  if (s === "cancelled") return <span className={styles.tagMuted}>Annulée</span>;
  return asText(status);
}
