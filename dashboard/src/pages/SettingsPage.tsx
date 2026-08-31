import { FormEvent, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useEquipment } from "../hooks/useEquipment";
import { useOrgCollection } from "../hooks/useOrgCollection";
import { DEFAULT_ACCENT, NAV_ITEMS, resolveAccent, type NavKey } from "../lib/dashboards";
import { formatDateTime } from "../lib/dates";
import { getFirebaseFirestore } from "../lib/firebase";
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
  const session = useOutletContext<OrgContext>();
  const { organizationId, dashboard, slug } = session;
  const users = useOrgCollection<AppUser>(organizationId, "users");
  const equipment = useEquipment(organizationId);
  const schedules = useOrgCollection<Schedule>(organizationId, "temperatureSchedules");
  const [dashName, setDashName] = useState(dashboard?.name ?? "");
  const [tagline, setTagline] = useState(dashboard?.tagline ?? "Contrôle HACCP");
  const [accent, setAccent] = useState(resolveAccent(dashboard?.accent ?? DEFAULT_ACCENT));
  const [nav, setNav] = useState(dashboard?.nav ?? {});
  const [savingLook, setSavingLook] = useState(false);
  const [lookMsg, setLookMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!dashboard) return;
    setDashName(dashboard.name);
    setTagline(dashboard.tagline);
    setAccent(resolveAccent(dashboard.accent));
    setNav(dashboard.nav);
  }, [dashboard]);

  async function saveLook(e: FormEvent) {
    e.preventDefault();
    if (!slug || !organizationId) return;
    setSavingLook(true);
    setLookMsg(null);
    try {
      await setDoc(
        doc(getFirebaseFirestore(), "dashboards", slug),
        {
          slug,
          organizationId,
          name: dashName.trim() || slug,
          tagline: tagline.trim() || "Contrôle HACCP",
          accent: resolveAccent(accent),
          nav,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setLookMsg("Apparence enregistrée. Recharge la page pour voir le menu à jour.");
    } catch (err) {
      setLookMsg(err instanceof Error ? err.message : "Enregistrement impossible");
    } finally {
      setSavingLook(false);
    }
  }

  return (
    <PageShell errors={[users.error, equipment.error, schedules.error]}>
      <h1 className={styles.h1}>Paramètres</h1>
      <p className={styles.meta}>
        Utilisateurs, équipements et horaires de relevé. Consultation seulement — les PIN et mots de
        passe ne s’affichent pas ici. Organisation : {organizationId}
      </p>

      {slug && (dashboard?.persisted || session.isPlatformAdmin) ? (
        <>
          <h2 className={styles.h2}>Apparence de ce tableau de bord</h2>
          <form className={styles.formStack} onSubmit={saveLook}>
            <label className={styles.field}>
              Nom affiché
              <input
                className={styles.fieldInput}
                value={dashName}
                onChange={(e) => setDashName(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              Accroche
              <input
                className={styles.fieldInput}
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              Couleur
              <input
                className={styles.fieldInput}
                type="color"
                value={resolveAccent(accent)}
                onChange={(e) => setAccent(e.target.value)}
              />
            </label>
            <fieldset className={styles.fieldset}>
              <legend>Pages visibles</legend>
              {NAV_ITEMS.filter((item) => item.key !== "overview" && item.key !== "settings").map(
                (item) => (
                  <label key={item.key} className={styles.checkRow}>
                    <input
                      type="checkbox"
                      checked={nav[item.key as NavKey] !== false}
                      onChange={(e) =>
                        setNav((prev) => ({ ...prev, [item.key]: e.target.checked }))
                      }
                    />
                    {item.label}
                  </label>
                )
              )}
            </fieldset>
            {lookMsg ? <p className={styles.hint}>{lookMsg}</p> : null}
            <button className="btnGold" type="submit" disabled={savingLook}>
              {savingLook ? "Enregistrement…" : "Enregistrer l’apparence"}
            </button>
          </form>
        </>
      ) : null}

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
      {equipment.list.length === 0 ? (
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
              {[...equipment.list]
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
