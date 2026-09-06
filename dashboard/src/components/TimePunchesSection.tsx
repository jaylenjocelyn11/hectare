import { FormEvent, useMemo, useState } from "react";
import { Timestamp } from "firebase/firestore";
import { DeleteControl, GhostButton, RowActions } from "./ManageControls";
import { useOrgCollection } from "../hooks/useOrgCollection";
import { asDate, formatDateTime, isSameLocalDay } from "../lib/dates";
import { createOrgDoc, patchOrgDoc, writeMessage } from "../lib/orgWrite";
import { asText } from "../lib/text";
import styles from "../pages/DashboardPage.module.css";

type AppUser = {
  name?: string;
  role?: string;
  isActive?: boolean;
  badgeNumber?: string;
};

type TimePunch = {
  userId?: string;
  userName?: string;
  badgeNumber?: string;
  clockInAt?: unknown;
  clockOutAt?: unknown;
  note?: string;
  source?: string;
};

type ManageLike = {
  busyId: string | null;
  setBusyId: (id: string | null) => void;
  setError: (msg: string | null) => void;
  setOk: (msg: string | null) => void;
  busy: (id: string) => boolean;
};

function normalizeBadge(raw: string): string {
  return raw.replace(/\D/g, "");
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toLocalInput(value: unknown): string {
  const date = asDate(value);
  if (!date) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDuration(start: Date | null, end: Date | null): string {
  if (!start) return "—";
  const close = end ?? new Date();
  const total = Math.max(0, Math.round((close.getTime() - start.getTime()) / 60000));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (!hours) return `${minutes} min`;
  if (!minutes) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

export function TimePunchesSection({
  organizationId,
  manage,
}: {
  organizationId: string | null;
  manage: ManageLike;
}) {
  const users = useOrgCollection<AppUser>(organizationId, "users");
  const punches = useOrgCollection<TimePunch>(organizationId, "timePunches");
  const [badgeDrafts, setBadgeDrafts] = useState<Record<string, string>>({});
  const [manualUserId, setManualUserId] = useState("");
  const [manualIn, setManualIn] = useState("");
  const [manualOut, setManualOut] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editIn, setEditIn] = useState("");
  const [editOut, setEditOut] = useState("");
  const [editNote, setEditNote] = useState("");

  const employees = useMemo(() => {
    return [...users.docs]
      .filter((u) => u.isActive !== false)
      .sort((a, b) => asText(a.name).localeCompare(asText(b.name), "fr"));
  }, [users.docs]);

  const sortedPunches = useMemo(() => {
    return [...punches.docs].sort((a, b) => {
      const da = asDate(a.clockInAt)?.getTime() ?? 0;
      const db = asDate(b.clockInAt)?.getTime() ?? 0;
      return db - da;
    });
  }, [punches.docs]);

  const todayPunches = sortedPunches.filter((p) => {
    const d = asDate(p.clockInAt);
    return d ? isSameLocalDay(d, new Date()) : false;
  });
  const openCount = sortedPunches.filter((p) => !asDate(p.clockOutAt)).length;

  function badgeValue(userId: string, stored?: string): string {
    return badgeDrafts[userId] ?? (typeof stored === "string" ? stored : "");
  }

  async function saveBadge(userId: string, current: string) {
    if (!organizationId) return;
    const badge = normalizeBadge(current);
    if (badge && (badge.length < 3 || badge.length > 8)) {
      manage.setError("Le numéro de badge doit contenir 3 à 8 chiffres.");
      return;
    }
    const duplicate = employees.find(
      (u) => u.id !== userId && normalizeBadge(asText(u.badgeNumber, "")) === badge && badge
    );
    if (duplicate) {
      manage.setError(`Ce badge est déjà attribué à ${asText(duplicate.name, "un employé")}.`);
      return;
    }
    manage.setBusyId(`badge-${userId}`);
    try {
      await patchOrgDoc(organizationId, "users", userId, { badgeNumber: badge });
      manage.setOk(badge ? "Numéro de badge enregistré." : "Numéro de badge retiré.");
      setBadgeDrafts((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    } catch (err) {
      manage.setError(writeMessage(err));
    } finally {
      manage.setBusyId(null);
    }
  }

  async function addManualPunch(e: FormEvent) {
    e.preventDefault();
    if (!organizationId || !manualUserId) return;
    const clockIn = fromLocalInput(manualIn);
    if (!clockIn) {
      manage.setError("Indique une heure d’arrivée.");
      return;
    }
    const clockOut = fromLocalInput(manualOut);
    if (clockOut && clockOut.getTime() < clockIn.getTime()) {
      manage.setError("L’heure de départ doit être après l’arrivée.");
      return;
    }
    const user = employees.find((u) => u.id === manualUserId);
    manage.setBusyId("punch-new");
    try {
      await createOrgDoc(organizationId, "timePunches", {
        userId: manualUserId,
        userName: asText(user?.name, "Employé"),
        badgeNumber: normalizeBadge(asText(user?.badgeNumber, "")),
        clockInAt: Timestamp.fromDate(clockIn),
        clockOutAt: clockOut ? Timestamp.fromDate(clockOut) : null,
        note: "",
        source: "web",
      });
      setManualIn("");
      setManualOut("");
      manage.setOk("Pointage ajouté.");
    } catch (err) {
      manage.setError(writeMessage(err));
    } finally {
      manage.setBusyId(null);
    }
  }

  async function saveEdit(id: string) {
    if (!organizationId) return;
    const clockIn = fromLocalInput(editIn);
    if (!clockIn) {
      manage.setError("Indique une heure d’arrivée.");
      return;
    }
    const clockOut = fromLocalInput(editOut);
    if (clockOut && clockOut.getTime() < clockIn.getTime()) {
      manage.setError("L’heure de départ doit être après l’arrivée.");
      return;
    }
    manage.setBusyId(id);
    try {
      await patchOrgDoc(organizationId, "timePunches", id, {
        clockInAt: Timestamp.fromDate(clockIn),
        clockOutAt: clockOut ? Timestamp.fromDate(clockOut) : null,
        note: editNote.trim(),
      });
      setEditId(null);
      manage.setOk("Pointage mis à jour.");
    } catch (err) {
      manage.setError(writeMessage(err));
    } finally {
      manage.setBusyId(null);
    }
  }

  if (!organizationId) return null;

  return (
    <>
      <h2 className={styles.h2}>Pointages et badges</h2>
      {users.error ? <p className={styles.warn}>{users.error}</p> : null}
      {punches.error ? <p className={styles.warn}>{punches.error}</p> : null}
      <p className={styles.meta}>
        Attribue un numéro de badge à chaque employé, puis corrige ou ajoute des pointages. Les
        employés pointent sur l’iPad avec ce numéro.
      </p>

      <div className={styles.kpis}>
        <article className={styles.kpi}>
          <span className={styles.kpiLabel}>Présents maintenant</span>
          <strong className={styles.kpiValue}>{openCount}</strong>
        </article>
        <article className={styles.kpi}>
          <span className={styles.kpiLabel}>Pointages aujourd’hui</span>
          <strong className={styles.kpiValue}>{todayPunches.length}</strong>
        </article>
      </div>

      <h3 className={styles.h2}>Numéros de badge</h3>
      {users.loading ? <p className="muted">Chargement des employés…</p> : null}
      {employees.length === 0 ? (
        <p className="muted">Aucun utilisateur actif. Ajoute-les dans Paramètres.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Employé</th>
                <th>Rôle</th>
                <th>Badge</th>
                <th>Gestion</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((user) => {
                const value = badgeValue(user.id, user.badgeNumber);
                return (
                  <tr key={user.id}>
                    <td>{asText(user.name, "Employé")}</td>
                    <td>{asText(user.role, "") === "manager" ? "Manager" : "Employé"}</td>
                    <td>
                      <input
                        className={styles.fieldInput}
                        inputMode="numeric"
                        placeholder="ex. 1042"
                        value={value}
                        onChange={(e) =>
                          setBadgeDrafts((prev) => ({
                            ...prev,
                            [user.id]: normalizeBadge(e.target.value).slice(0, 8),
                          }))
                        }
                      />
                    </td>
                    <td>
                      <RowActions>
                        <GhostButton
                          disabled={manage.busy(`badge-${user.id}`)}
                          onClick={() => void saveBadge(user.id, value)}
                        >
                          Enregistrer
                        </GhostButton>
                      </RowActions>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h3 className={styles.h2}>Ajouter un pointage</h3>
      <form className={styles.manageForm} onSubmit={addManualPunch}>
        <label className={styles.field}>
          Employé
          <select
            className={styles.fieldInput}
            value={manualUserId}
            onChange={(e) => setManualUserId(e.target.value)}
            required
          >
            <option value="">Choisir</option>
            {employees.map((user) => (
              <option key={user.id} value={user.id}>
                {asText(user.name, "Employé")}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Arrivée
          <input
            className={styles.fieldInput}
            type="datetime-local"
            value={manualIn}
            onChange={(e) => setManualIn(e.target.value)}
            required
          />
        </label>
        <label className={styles.field}>
          Départ (optionnel)
          <input
            className={styles.fieldInput}
            type="datetime-local"
            value={manualOut}
            onChange={(e) => setManualOut(e.target.value)}
          />
        </label>
        <div className={styles.manageActions}>
          <button className="btnGold" type="submit" disabled={manage.busyId === "punch-new"}>
            Ajouter
          </button>
        </div>
      </form>

      <h3 className={styles.h2}>Historique</h3>
      {punches.loading ? <p className="muted">Chargement des pointages…</p> : null}
      {sortedPunches.length === 0 ? (
        <p className="muted">Aucun pointage pour l’instant.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Employé</th>
                <th>Badge</th>
                <th>Arrivée</th>
                <th>Départ</th>
                <th>Durée</th>
                <th>Gestion</th>
              </tr>
            </thead>
            <tbody>
              {sortedPunches.map((punch) => {
                const clockIn = asDate(punch.clockInAt);
                const clockOut = asDate(punch.clockOutAt);
                const editing = editId === punch.id;
                return (
                  <tr key={punch.id}>
                    <td>{asText(punch.userName, "Employé")}</td>
                    <td>{asText(punch.badgeNumber, "—")}</td>
                    <td>
                      {editing ? (
                        <input
                          className={styles.fieldInput}
                          type="datetime-local"
                          value={editIn}
                          onChange={(e) => setEditIn(e.target.value)}
                        />
                      ) : (
                        formatDateTime(punch.clockInAt)
                      )}
                    </td>
                    <td>
                      {editing ? (
                        <input
                          className={styles.fieldInput}
                          type="datetime-local"
                          value={editOut}
                          onChange={(e) => setEditOut(e.target.value)}
                        />
                      ) : clockOut ? (
                        formatDateTime(punch.clockOutAt)
                      ) : (
                        <span className={styles.tagWarn}>En poste</span>
                      )}
                    </td>
                    <td>{formatDuration(clockIn, clockOut)}</td>
                    <td>
                      <RowActions>
                        {editing ? (
                          <>
                            <GhostButton
                              disabled={manage.busy(punch.id)}
                              onClick={() => void saveEdit(punch.id)}
                            >
                              Sauver
                            </GhostButton>
                            <GhostButton onClick={() => setEditId(null)}>Annuler</GhostButton>
                          </>
                        ) : (
                          <GhostButton
                            onClick={() => {
                              setEditId(punch.id);
                              setEditIn(toLocalInput(punch.clockInAt));
                              setEditOut(toLocalInput(punch.clockOutAt));
                              setEditNote(typeof punch.note === "string" ? punch.note : "");
                            }}
                          >
                            Modifier
                          </GhostButton>
                        )}
                        <DeleteControl
                          organizationId={organizationId}
                          collectionName="timePunches"
                          id={punch.id}
                          label="ce pointage"
                          busy={manage.busy(punch.id)}
                          onBusy={manage.setBusyId}
                          onError={manage.setError}
                        />
                      </RowActions>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
