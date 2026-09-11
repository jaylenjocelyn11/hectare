import { useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { IosDashboardStudio } from "../components/IosDashboardStudio";
import type { IosLiveSnapshot } from "../components/IosNativeWidgets";
import { LocationCategoriesSection } from "../components/LocationCategoriesSection";
import { ManageNotice, useManageState } from "../components/ManageControls";
import { useEquipment } from "../hooks/useEquipment";
import { useIosDashboardLayout } from "../hooks/useIosDashboardLayout";
import { useOrgCollection } from "../hooks/useOrgCollection";
import { asDate, formatDateTime, isSameLocalDay } from "../lib/dates";
import { asDisplayName, asNumber, asText, namedFromDocs } from "../lib/text";
import type { OrgContext } from "./orgContext";
import styles from "./DashboardPage.module.css";

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

type Note = {
  title?: string;
  content?: string;
  createdAt?: unknown;
};

export function OverviewPage() {
  const { organizationId, resolving, error: orgError } = useOutletContext<OrgContext>();
  const iosLayout = useIosDashboardLayout(organizationId);
  const equipment = useEquipment(organizationId);
  const readings = useOrgCollection<TempReading>(organizationId, "tempReadings");
  const runs = useOrgCollection<ProcedureRun>(organizationId, "procedureRuns");
  const templates = useOrgCollection<ProcedureTemplate>(
    organizationId,
    "procedureTemplates"
  );
  const notes = useOrgCollection<Note>(organizationId, "notes");
  const manage = useManageState();

  const listenError =
    equipment.error || readings.error || runs.error || templates.error || notes.error;
  const loadingLists =
    equipment.loading ||
    readings.loading ||
    runs.loading ||
    templates.loading ||
    notes.loading;

  const today = new Date();
  const readingsToday = readings.docs.filter((r) => {
    const d = asDate(r.timestamp) ?? asDate(r.date);
    return d ? isSameLocalDay(d, today) : false;
  });
  const outOfRangeToday = readingsToday.filter((r) => r.isOutOfRange).length;
  const activeEquipment = equipment.list.filter((e) => e.isActive !== false).length;
  const runsInProgress = runs.docs.filter((r) => {
    const s = asText(r.status, "").toLowerCase();
    return s === "running" || s === "inprogress" || s === "paused";
  }).length;
  const overdueRuns = runs.docs.filter((r) => r.isOverdue).length;

  const templateName = (id?: unknown) => namedFromDocs(templates.docs, id, "Procédure");

  const equipmentName = (id?: unknown) => namedFromDocs(equipment.lookup, id, "—");

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

  const iosLive = useMemo((): IosLiveSnapshot => {
    const completedToday = runs.docs.filter((r) => {
      const d = asDate(r.startTime) ?? asDate(r.date);
      return d && isSameLocalDay(d, today) && asText(r.status, "").toLowerCase() === "completed";
    }).length;
    const pendingToday = runs.docs.filter((r) => {
      const d = asDate(r.startTime) ?? asDate(r.date);
      const s = asText(r.status, "").toLowerCase();
      return d && isSameLocalDay(d, today) && (s === "inprogress" || s === "running" || s === "paused");
    }).length;
    const temps = readingsToday
      .map((r) => asNumber(r.temperature))
      .filter((n): n is number => n != null);
    const avgTemp = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null;
    const compliance =
      readingsToday.length === 0
        ? 100
        : Math.round(((readingsToday.length - outOfRangeToday) / readingsToday.length) * 100);

    const latestByEquipment = new Map<string, { temp: number; ok: boolean }>();
    for (const r of readings.docs) {
      const id = asText(r.equipmentId, "");
      if (!id) continue;
      const d = asDate(r.timestamp) ?? asDate(r.date);
      if (!d || !isSameLocalDay(d, today)) continue;
      const temp = asNumber(r.temperature);
      if (temp == null) continue;
      latestByEquipment.set(id, { temp, ok: !r.isOutOfRange });
    }

    return {
      dayName: today.toLocaleDateString("fr-CA", { weekday: "long" }),
      monthName: today.toLocaleDateString("fr-CA", { day: "numeric", month: "long" }),
      readingsToday: readingsToday.length,
      outOfRange: outOfRangeToday,
      avgTemp,
      completedProcedures: completedToday,
      pendingProcedures: pendingToday,
      overdueRuns,
      activeEquipment,
      compliance,
      equipment: equipment.list.slice(0, 3).map((item) => {
        const latest = latestByEquipment.get(item.id);
        const kind = asDisplayName(item.kind ?? item.type, "ambient");
        return {
          name: asDisplayName(item.name, "Équipement"),
          kind,
          temp: latest ? `${Math.round(latest.temp)}°C` : null,
          ok: latest?.ok ?? true,
        };
      }),
      procedures: latestRuns.slice(0, 3).map((r) => ({
        name: namedFromDocs(templates.docs, r.procedureTemplateId, "Procédure"),
        status: asText(r.status, ""),
      })),
      notes: [...notes.docs]
        .sort((a, b) => {
          const da = asDate(a.createdAt);
          const db = asDate(b.createdAt);
          return (db?.getTime() ?? 0) - (da?.getTime() ?? 0);
        })
        .slice(0, 3)
        .map((n) => ({
          title: asDisplayName(n.title || n.content, "Note"),
          when: formatDateTime(n.createdAt),
        })),
    };
  }, [
    activeEquipment,
    equipment.list,
    latestRuns,
    notes.docs,
    outOfRangeToday,
    overdueRuns,
    readings.docs,
    readingsToday,
    templates.docs,
    today,
  ]);

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

          <ManageNotice error={manage.error} ok={manage.ok} />
          {organizationId ? (
            <IosDashboardStudio
              layouts={iosLayout.layouts}
              saveState={iosLayout.saveState}
              error={iosLayout.error}
              setLayout={iosLayout.setLayout}
              live={iosLive}
            />
          ) : null}
          <LocationCategoriesSection organizationId={organizationId} manage={manage} />

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
                      <td>{equipmentName(r.equipmentId)}</td>
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
                      <td>{templateName(r.procedureTemplateId)}</td>
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
