import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useOrgCollection } from "../hooks/useOrgCollection";
import { asDate, formatDateTime } from "../lib/dates";
import { asText, namedFromDocs } from "../lib/text";
import type { OrgContext } from "./orgContext";
import styles from "./DashboardPage.module.css";

type Equipment = { name?: string };
type TempReading = {
  temperature?: number;
  timestamp?: unknown;
  date?: unknown;
  equipmentId?: string;
  isOutOfRange?: boolean;
  timePeriod?: string;
  isCorrectiveActionCompleted?: boolean;
};

export function TemperaturesPage() {
  const { organizationId, resolving, error: orgError } = useOutletContext<OrgContext>();
  const equipment = useOrgCollection<Equipment>(organizationId, "equipment");
  const readings = useOrgCollection<TempReading>(organizationId, "tempReadings");
  const [onlyOutOfRange, setOnlyOutOfRange] = useState(false);

  const rows = [...readings.docs]
    .filter((r) => (onlyOutOfRange ? r.isOutOfRange : true))
    .sort((a, b) => {
      const da = asDate(a.timestamp) ?? asDate(a.date);
      const db = asDate(b.timestamp) ?? asDate(b.date);
      return (db?.getTime() ?? 0) - (da?.getTime() ?? 0);
    });

  return (
    <>
      {resolving ? <p className="muted">Recherche de l’organisation…</p> : null}
      {orgError ? <p className={styles.warn}>{orgError}</p> : null}
      {equipment.error || readings.error ? (
        <p className={styles.warn}>{equipment.error || readings.error}</p>
      ) : null}

      {!resolving && organizationId ? (
        <>
          <h1 className={styles.h1}>Registre des températures</h1>
          <p className={styles.meta}>
            Tous les relevés enregistrés sur l’iPad. La liste se met à jour en direct.
          </p>

          <label className={styles.filter}>
            <input
              type="checkbox"
              checked={onlyOutOfRange}
              onChange={(e) => setOnlyOutOfRange(e.target.checked)}
            />
            Afficher seulement les relevés hors plage
          </label>

          {readings.loading ? <p className="muted">Chargement…</p> : null}

          {rows.length === 0 ? (
            <p className="muted">Aucun relevé à afficher.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Quand</th>
                    <th>Équipement</th>
                    <th>Température</th>
                    <th>AM / PM</th>
                    <th>Statut</th>
                    <th>Action corrective</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{formatDateTime(r.timestamp ?? r.date)}</td>
                      <td>
                        {namedFromDocs(equipment.docs, r.equipmentId, "—")}
                      </td>
                      <td>
                        {typeof r.temperature === "number" ? `${r.temperature} °C` : "—"}
                      </td>
                      <td>{asText(r.timePeriod)}</td>
                      <td>
                        {r.isOutOfRange ? (
                          <span className={styles.tagBad}>Hors plage</span>
                        ) : (
                          <span className={styles.tagOk}>OK</span>
                        )}
                      </td>
                      <td>
                        {r.isOutOfRange
                          ? r.isCorrectiveActionCompleted
                            ? "Faite"
                            : "À faire"
                          : "—"}
                      </td>
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
