import type { IosWidgetType } from "../lib/iosDashboardLayout";
import styles from "./IosNativeWidgets.module.css";

export type IosLiveSnapshot = {
  dayName: string;
  monthName: string;
  readingsToday: number;
  outOfRange: number;
  avgTemp: number | null;
  completedProcedures: number;
  pendingProcedures: number;
  overdueRuns: number;
  activeEquipment: number;
  compliance: number;
  equipment: Array<{ name: string; kind: string; temp: string | null; ok: boolean }>;
  procedures: Array<{ name: string; status: string }>;
  notes: Array<{ title: string; when: string }>;
};

const emptyLive: IosLiveSnapshot = {
  dayName: "Aujourd’hui",
  monthName: "",
  readingsToday: 0,
  outOfRange: 0,
  avgTemp: null,
  completedProcedures: 0,
  pendingProcedures: 0,
  overdueRuns: 0,
  activeEquipment: 0,
  compliance: 100,
  equipment: [],
  procedures: [],
  notes: [],
};

export function IosNativeWidget({
  type,
  title,
  live = emptyLive,
  phone,
}: {
  type: IosWidgetType;
  title: string;
  live?: IosLiveSnapshot;
  phone: boolean;
}) {
  const data = live;
  switch (type) {
    case "greeting":
      return (
        <div className={`${styles.stack} ${phone ? styles.stackPhone : styles.stackPad}`}>
          <div>
            <p className={styles.hello}>Bonjour ! 👋</p>
            <p className={styles.sub}>Voici un aperçu de votre journée HACCP</p>
          </div>
          <div className={styles.dateChip}>
            <span className={styles.iconCircle} aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="2" />
                <path d="M8 3v4M16 3v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <div>
              <p className={styles.dateDay}>{data.dayName}</p>
              <p className={styles.sub}>{data.monthName}</p>
            </div>
          </div>
        </div>
      );
    case "metrics":
      return (
        <div className={phone ? styles.metricsPhone : styles.metricsPad}>
          <Metric
            title="Relevés aujourd'hui"
            value={String(data.readingsToday)}
            subtitle={`${data.outOfRange} hors plage`}
            color={data.outOfRange > 0 ? "err" : "ok"}
          />
          <Metric
            title="Procédures"
            value={String(data.completedProcedures)}
            subtitle={`${data.pendingProcedures} en attente`}
            color={data.pendingProcedures > 0 ? "warn" : "ok"}
          />
          <Metric title="Équipements" value={String(data.activeEquipment)} subtitle="En surveillance" color="info" />
          <div className={styles.compliance}>
            <div>
              <p className={styles.metricTitle} style={{ color: "#fff", fontSize: "0.92rem", fontWeight: 650 }}>
                Conformité
              </p>
              <p className={styles.sub}>Taux de conformité</p>
            </div>
            <span className={styles.ring} style={{ ["--p" as string]: data.compliance }} />
            <strong className={data.compliance >= 95 ? styles.ok : styles.warn}>{data.compliance}%</strong>
          </div>
        </div>
      );
    case "timeClock":
      return (
        <div className={styles.clock}>
          <p className={styles.clockTitle}>{title || "Pointage"}</p>
          <p className={styles.clockHint}>Tu n’es pas encore pointé.</p>
          <div className={styles.punch}>Pointer l’arrivée</div>
        </div>
      );
    case "equipment":
      return (
        <div>
          <div className={styles.rowHead}>
            <p className={styles.sectionTitle}>{title || "État des équipements"}</p>
            <span className={styles.badge}>{data.equipment.length || data.activeEquipment} équipements</span>
          </div>
          {data.equipment.length === 0 ? (
            <p className={styles.sub}>Aucun équipement pour l’instant.</p>
          ) : (
            <ul className={styles.rows}>
              {data.equipment.slice(0, 3).map((item) => (
                <li key={item.name}>
            <span className={`${styles.eqIcon} ${item.kind.toLowerCase().includes("cold") || item.kind.toLowerCase().includes("froid") ? styles.eqCold : styles.eqHot}`} />
                  <span className={styles.grow}>
                    <strong>{item.name}</strong>
                    <em>Range: {item.kind}</em>
                  </span>
                  <b className={item.ok ? styles.ok : styles.err}>{item.temp ?? "--°C"}</b>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    case "procedures":
      return (
        <div>
          <p className={styles.sectionTitle}>{title || "Procédures récentes"}</p>
          {data.procedures.length === 0 ? (
            <p className={styles.empty}>Aucune procédure aujourd'hui</p>
          ) : (
            <ul className={styles.rows}>
              {data.procedures.slice(0, 3).map((item) => (
                <li key={item.name}>
                  <span className={styles.grow}>
                    <strong>{item.name}</strong>
                    <em>{statusFr(item.status)}</em>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    case "notes":
      return (
        <div>
          <div className={styles.rowHead}>
            <div>
              <p className={styles.sectionTitle}>{title || "Notes récentes"}</p>
              <p className={styles.sub}>Aujourd'hui</p>
            </div>
            <span className={styles.linkish}>Voir tout</span>
          </div>
          {data.notes.length === 0 ? (
            <p className={styles.empty}>Aucune note récente</p>
          ) : (
            <ul className={styles.rows}>
              {data.notes.slice(0, 3).map((item) => (
                <li key={item.title}>
                  <span className={styles.grow}>
                    <strong>{item.title}</strong>
                    <em>{item.when}</em>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    case "temperatureOverview":
      return (
        <Kv
          rows={[
            ["Total relevés", String(data.readingsToday)],
            ["Hors plage", String(data.outOfRange), data.outOfRange > 0 ? "err" : "ok"],
            ["Moyenne", data.avgTemp == null ? "—" : `${Math.round(data.avgTemp)}°C`],
          ]}
        />
      );
    case "procedureStatus":
      return (
        <Kv
          rows={[
            ["Terminées", String(data.completedProcedures), "ok"],
            ["En cours", String(data.pendingProcedures), "warn"],
            ["En retard", String(data.overdueRuns), data.overdueRuns > 0 ? "err" : "ok"],
          ]}
        />
      );
    case "inventoryAlerts":
      return (
        <Kv
          rows={[
            ["Expirés", "—", "err"],
            ["Expirent bientôt", "—", "warn"],
            ["Stock bas", "—", "warn"],
          ]}
        />
      );
    case "complianceScore":
      return (
        <div className={styles.compliance}>
          <div>
            <p className={styles.sub}>Score global</p>
            <strong className={data.compliance >= 90 ? styles.ok : styles.warn}>{data.compliance}%</strong>
          </div>
        </div>
      );
    case "temperatureTrends":
      return (
        <Kv
          rows={[
            ["Tendance AM", "—"],
            ["Tendance PM", "—"],
            ["Écart", "—"],
          ]}
        />
      );
    case "procedurePerformance":
      return (
        <Kv
          rows={[
            ["Taux de réussite", "—", "ok"],
            ["Durée moyenne", "—"],
            ["Retards", String(data.overdueRuns), data.overdueRuns > 0 ? "err" : "ok"],
          ]}
        />
      );
    default:
      return <p className={styles.sectionTitle}>{title}</p>;
  }
}

function Metric({
  title,
  value,
  subtitle,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  color: "ok" | "warn" | "err" | "info";
}) {
  return (
    <div className={styles.metric}>
      <span className={`${styles.metricIcon} ${styles[color]}`}>●</span>
      <p className={styles.metricValue}>{value}</p>
      <p className={styles.metricTitle}>{title}</p>
      <p className={styles.sub}>{subtitle}</p>
    </div>
  );
}

function Kv({ rows }: { rows: Array<[string, string, string?] > }) {
  return (
    <ul className={styles.kv}>
      {rows.map(([label, value, tone]) => (
        <li key={label}>
          <span>{label}</span>
          <b className={tone === "err" ? styles.err : tone === "ok" ? styles.ok : tone === "warn" ? styles.warn : undefined}>
            {value}
          </b>
        </li>
      ))}
    </ul>
  );
}

function statusFr(status: string) {
  const s = status.toLowerCase();
  if (s === "completed") return "Terminé";
  if (s === "running" || s === "inprogress") return "En cours";
  if (s === "overdue") return "En retard";
  return status || "—";
}
