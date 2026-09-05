import { FormEvent, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  DeleteControl,
  GhostButton,
  ManageNotice,
  RowActions,
  useManageState,
} from "../components/ManageControls";
import { useEquipment } from "../hooks/useEquipment";
import { useOrgCollection } from "../hooks/useOrgCollection";
import { DEFAULT_ACCENT, NAV_ITEMS, resolveAccent, type NavKey } from "../lib/dashboards";
import { formatDateTime } from "../lib/dates";
import { getFirebaseFirestore } from "../lib/firebase";
import { equipmentTypeLabel, scheduleTypeLabel, userRoleLabel } from "../lib/labels";
import {
  createOrgDoc,
  patchEquipment,
  patchOrgDoc,
  removeEquipment,
  writeMessage,
} from "../lib/orgWrite";
import { asDisplayName, asNumber, asText } from "../lib/text";
import {
  LocationCategoriesSection,
  LocationCategorySelect,
  locationCategoryName,
} from "../components/LocationCategoriesSection";
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
  const locationCategories = useOrgCollection<{ name?: string }>(organizationId, "locationCategories");
  const schedules = useOrgCollection<Schedule>(organizationId, "temperatureSchedules");
  const [dashName, setDashName] = useState(dashboard?.name ?? "");
  const [tagline, setTagline] = useState(dashboard?.tagline ?? "Contrôle HACCP");
  const [accent, setAccent] = useState(resolveAccent(dashboard?.accent ?? DEFAULT_ACCENT));
  const [nav, setNav] = useState(dashboard?.nav ?? {});
  const [savingLook, setSavingLook] = useState(false);
  const [lookMsg, setLookMsg] = useState<string | null>(null);
  const manage = useManageState();
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("employee");
  const [userPin, setUserPin] = useState("");
  const [eqName, setEqName] = useState("");
  const [eqKind, setEqKind] = useState("cold");
  const [eqMin, setEqMin] = useState("0");
  const [eqMax, setEqMax] = useState("4");
  const [eqLocation, setEqLocation] = useState("");
  const [schedName, setSchedName] = useState("");
  const [schedType, setSchedType] = useState("morning");
  const [schedHour, setSchedHour] = useState("8");
  const [schedMinute, setSchedMinute] = useState("0");

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

  async function addUser(e: FormEvent) {
    e.preventDefault();
    if (!organizationId || !userName.trim()) return;
    manage.setBusyId("user");
    try {
      await createOrgDoc(organizationId, "users", {
        name: userName.trim(),
        role: userRole,
        ...(userPin.trim() ? { pin: userPin.trim() } : {}),
        isActive: true,
        fcmTokens: [],
      });
      setUserName("");
      setUserPin("");
      manage.setOk("Utilisateur créé (PIN pour l’iPad).");
    } catch (err) {
      manage.setError(writeMessage(err));
    } finally {
      manage.setBusyId(null);
    }
  }

  async function addEquipment(e: FormEvent) {
    e.preventDefault();
    if (!organizationId || !eqName.trim()) return;
    manage.setBusyId("eq");
    try {
      await createOrgDoc(organizationId, "equipment", {
        name: eqName.trim(),
        type: eqName.trim(),
        kind: eqKind,
        isActive: true,
        minTemperature: Number(eqMin),
        maxTemperature: Number(eqMax),
        temperatureUnit: "°C",
        correctiveActions: [],
        locationCategoryId: eqLocation,
      });
      setEqName("");
      setEqLocation("");
      manage.setOk("Équipement ajouté.");
    } catch (err) {
      manage.setError(writeMessage(err));
    } finally {
      manage.setBusyId(null);
    }
  }

  async function addSchedule(e: FormEvent) {
    e.preventDefault();
    if (!organizationId || !schedName.trim()) return;
    manage.setBusyId("sched");
    try {
      await createOrgDoc(organizationId, "temperatureSchedules", {
        name: schedName.trim(),
        scheduleDescription: "",
        type: schedType,
        isActive: true,
        isOverdue: false,
        isTimeWindowActive: true,
        targetHour: Number(schedHour) || 8,
        targetMinute: Number(schedMinute) || 0,
        toleranceMinutes: 30,
        equipmentIds: [],
        temperaturePoints: [],
      });
      setSchedName("");
      manage.setOk("Horaire de relevé ajouté.");
    } catch (err) {
      manage.setError(writeMessage(err));
    } finally {
      manage.setBusyId(null);
    }
  }

  return (
    <PageShell errors={[users.error, equipment.error, schedules.error, locationCategories.error]}>
      <h1 className={styles.h1}>Paramètres</h1>
      <p className={styles.meta}>
        Gère utilisateurs, équipements et horaires. Les PIN existants ne s’affichent pas. Organisation :{" "}
        {organizationId}
      </p>
      <ManageNotice error={manage.error} ok={manage.ok} />

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
      {organizationId ? (
        <form className={styles.manageForm} onSubmit={addUser}>
          <label className={styles.field}>
            Nom
            <input className={styles.fieldInput} value={userName} onChange={(e) => setUserName(e.target.value)} required />
          </label>
          <label className={styles.field}>
            Rôle
            <select className={styles.fieldInput} value={userRole} onChange={(e) => setUserRole(e.target.value)}>
              <option value="employee">Employé</option>
              <option value="manager">Manager</option>
            </select>
          </label>
          <label className={styles.field}>
            PIN iPad
            <input className={styles.fieldInput} value={userPin} onChange={(e) => setUserPin(e.target.value)} />
          </label>
          <div className={styles.manageActions}>
            <button className="btnGold" type="submit" disabled={manage.busyId === "user"}>
              Ajouter
            </button>
          </div>
        </form>
      ) : null}
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
                <th>Gestion</th>
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
                    <td>
                      {organizationId ? (
                        <RowActions>
                          <GhostButton
                            onClick={async () => {
                              manage.setBusyId(u.id);
                              try {
                                await patchOrgDoc(organizationId, "users", u.id, {
                                  isActive: u.isActive === false,
                                });
                              } catch (err) {
                                manage.setError(writeMessage(err));
                              } finally {
                                manage.setBusyId(null);
                              }
                            }}
                          >
                            {u.isActive === false ? "Activer" : "Désactiver"}
                          </GhostButton>
                          <DeleteControl
                            organizationId={organizationId}
                            collectionName="users"
                            id={u.id}
                            label="cet utilisateur"
                            busy={manage.busy(u.id)}
                            onBusy={manage.setBusyId}
                            onError={manage.setError}
                          />
                        </RowActions>
                      ) : null}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      <LocationCategoriesSection organizationId={organizationId} manage={manage} />

      <h2 className={styles.h2}>Équipements</h2>
      {organizationId ? (
        <form className={styles.manageForm} onSubmit={addEquipment}>
          <label className={styles.field}>
            Nom
            <input className={styles.fieldInput} value={eqName} onChange={(e) => setEqName(e.target.value)} required />
          </label>
          <label className={styles.field}>
            Type
            <select className={styles.fieldInput} value={eqKind} onChange={(e) => setEqKind(e.target.value)}>
              <option value="cold">Froid</option>
              <option value="hot">Chaud</option>
              <option value="ambient">Ambiance</option>
              <option value="freezer">Congélateur</option>
              <option value="refrigerator">Réfrigérateur</option>
            </select>
          </label>
          <label className={styles.field}>
            Min °C
            <input className={styles.fieldInput} value={eqMin} onChange={(e) => setEqMin(e.target.value)} />
          </label>
          <label className={styles.field}>
            Max °C
            <input className={styles.fieldInput} value={eqMax} onChange={(e) => setEqMax(e.target.value)} />
          </label>
          <label className={styles.field}>
            Lieu
            <LocationCategorySelect
              categories={locationCategories.docs}
              value={eqLocation}
              onChange={setEqLocation}
            />
          </label>
          <div className={styles.manageActions}>
            <button className="btnGold" type="submit" disabled={manage.busyId === "eq"}>
              Ajouter
            </button>
          </div>
        </form>
      ) : null}
      {equipment.list.length === 0 ? (
        <p className="muted">Aucun équipement.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Type</th>
                <th>Lieu</th>
                <th>Plage</th>
                <th>Actif</th>
                <th>Gestion</th>
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
                      {organizationId ? (
                        <LocationCategorySelect
                          categories={locationCategories.docs}
                          value={asText(e.locationCategoryId, "")}
                          onChange={async (next) => {
                            manage.setBusyId(e.id);
                            try {
                              await patchEquipment(organizationId, e.id, { locationCategoryId: next });
                            } catch (err) {
                              manage.setError(writeMessage(err));
                            } finally {
                              manage.setBusyId(null);
                            }
                          }}
                        />
                      ) : (
                        locationCategoryName(locationCategories.docs, e.locationCategoryId) || "—"
                      )}
                    </td>
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
                    <td>
                      {organizationId ? (
                        <RowActions>
                          <GhostButton
                            onClick={async () => {
                              manage.setBusyId(e.id);
                              try {
                                await patchEquipment(organizationId, e.id, { isActive: e.isActive === false });
                              } catch (err) {
                                manage.setError(writeMessage(err));
                              } finally {
                                manage.setBusyId(null);
                              }
                            }}
                          >
                            {e.isActive === false ? "Activer" : "Désactiver"}
                          </GhostButton>
                          <button
                            type="button"
                            className={styles.dangerButton}
                            disabled={manage.busy(e.id)}
                            onClick={async () => {
                              if (!window.confirm("Supprimer cet équipement ?")) return;
                              manage.setBusyId(e.id);
                              try {
                                await removeEquipment(organizationId, e.id);
                              } catch (err) {
                                manage.setError(writeMessage(err));
                              } finally {
                                manage.setBusyId(null);
                              }
                            }}
                          >
                            Supprimer
                          </button>
                        </RowActions>
                      ) : null}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className={styles.h2}>Horaires de température</h2>
      {organizationId ? (
        <form className={styles.manageForm} onSubmit={addSchedule}>
          <label className={styles.field}>
            Nom
            <input className={styles.fieldInput} value={schedName} onChange={(e) => setSchedName(e.target.value)} required />
          </label>
          <label className={styles.field}>
            Moment
            <select className={styles.fieldInput} value={schedType} onChange={(e) => setSchedType(e.target.value)}>
              <option value="morning">Matin</option>
              <option value="afternoon">Après-midi</option>
              <option value="evening">Soir</option>
            </select>
          </label>
          <label className={styles.field}>
            Heure
            <input className={styles.fieldInput} value={schedHour} onChange={(e) => setSchedHour(e.target.value)} />
          </label>
          <label className={styles.field}>
            Minute
            <input className={styles.fieldInput} value={schedMinute} onChange={(e) => setSchedMinute(e.target.value)} />
          </label>
          <div className={styles.manageActions}>
            <button className="btnGold" type="submit" disabled={manage.busyId === "sched"}>
              Ajouter
            </button>
          </div>
        </form>
      ) : null}
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
                <th>Gestion</th>
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
                    <td>
                      {organizationId ? (
                        <RowActions>
                          <GhostButton
                            onClick={async () => {
                              manage.setBusyId(s.id);
                              try {
                                await patchOrgDoc(organizationId, "temperatureSchedules", s.id, {
                                  isActive: s.isActive === false,
                                });
                              } catch (err) {
                                manage.setError(writeMessage(err));
                              } finally {
                                manage.setBusyId(null);
                              }
                            }}
                          >
                            {s.isActive === false ? "Activer" : "Désactiver"}
                          </GhostButton>
                          <DeleteControl
                            organizationId={organizationId}
                            collectionName="temperatureSchedules"
                            id={s.id}
                            label="cet horaire"
                            busy={manage.busy(s.id)}
                            onBusy={manage.setBusyId}
                            onError={manage.setError}
                          />
                        </RowActions>
                      ) : null}
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
