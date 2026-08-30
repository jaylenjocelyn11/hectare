import { useOutletContext } from "react-router-dom";
import { useOrgCollection } from "../hooks/useOrgCollection";
import { formatDateTime } from "../lib/dates";
import { equipmentTypeLabel, scheduleTypeLabel, userRoleLabel } from "../lib/labels";
import { asDisplayName, asNumber, asText } from "../lib/text";
import type { OrgContext } from "./orgContext";
import { PageShell } from "./PageShell";
import styles from "./DashboardPage.module.css";

type AppUser = {
  name?: string;
  role?: string;
  isActive?: boolean;
  createdAt?: unknown;
};

type Equipment = {
  name?: string;
  type?: string;
  kind?: string;
  isActive?: boolean;
  minTemperature?: number;
  maxTemperature?: number;
};

type Schedule = {
  name?: string;
  type?: string;
  isActive?: boolean;
  isOverdue?: boolean;
  targetHour?: number;
  targetMinute?: number;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function SettingsPage() {
  const { organizationId } = useOutletContext<OrgContext>();
  const users = useOrgCollection<AppUser>(organizationId, "users");
  const equipment = useOrgCollection<Equipment>(organizationId, "equipment");
  const schedules = useOrgCollection<Schedule>(organizationId, "temperatureSchedules");

  return (
    <PageShell errors={[users.error, equipment.error, schedules.error]}>
      <h1 className={styles.h1}>Paramètres</h1>
      <p className={styles.meta}>
        Utilisateurs, équipements et horaires de relevé. Consultation seulement — les PIN et mots de
        passe ne s’affichent pas ici. Organisation : {organizationId}
      </p>

      <h2 className={styles.h2}>Utilisateurs</h2>
      {users.loading ? <p className="muted">Chargement…</p> : null}
      {users.docs.length === 0 ? (
        <p className="muted">Aucun utilisateur.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Rôle</th>
                <th>Actif</th>
                <th>Créé le</th>
              </tr>
            </thead>
            <tbody>
              {[...users.docs]
                .sort((a, b) => asText(a.name).localeCompare(asText(b.name), "fr"))
                .map((u) => (
                  <tr key={u.id}>
                    <td>{asText(u.name)}</td>
                    <td>{userRoleLabel(u.role)}</td>
                    <td>
                      {u.isActive === false ? (
                        <span className={styles.tagMuted}>Non</span>
                      ) : (
                        <span className={styles.tagOk}>Oui</span>
                      )}
                    </td>
                    <td>{formatDateTime(u.createdAt)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className={styles.h2}>Équipements</h2>
      {equipment.docs.length === 0 ? (
        <p className="muted">Aucun équipement.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Type</th>
                <th>Plage</th>
                <th>Actif</th>
              </tr>
            </thead>
            <tbody>
              {[...equipment.docs]
                .sort((a, b) => asText(a.name).localeCompare(asText(b.name), "fr"))
                .map((e) => (
                  <tr key={e.id}>
                    <td>{asDisplayName(e.name)}</td>
                    <td>{equipmentTypeLabel(e.type, e.kind)}</td>
                    <td>
                      {asNumber(e.minTemperature) != null && asNumber(e.maxTemperature) != null
                        ? `${asNumber(e.minTemperature)} – ${asNumber(e.maxTemperature)} °C`
                        : "—"}
                    </td>
                    <td>
                      {e.isActive === false ? (
                        <span className={styles.tagMuted}>Non</span>
                      ) : (
                        <span className={styles.tagOk}>Oui</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className={styles.h2}>Horaires de température</h2>
      {schedules.docs.length === 0 ? (
        <p className="muted">Aucun horaire.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Moment</th>
                <th>Heure cible</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {schedules.docs.map((s) => {
                const h = asNumber(s.targetHour);
                const m = asNumber(s.targetMinute);
                return (
                  <tr key={s.id}>
                    <td>{asText(s.name)}</td>
                    <td>{scheduleTypeLabel(s.type)}</td>
                    <td>{h != null && m != null ? `${pad(h)}:${pad(m)}` : "—"}</td>
                    <td>
                      {s.isOverdue ? (
                        <span className={styles.tagBad}>En retard</span>
                      ) : s.isActive === false ? (
                        <span className={styles.tagMuted}>Inactif</span>
                      ) : (
                        <span className={styles.tagOk}>Actif</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
