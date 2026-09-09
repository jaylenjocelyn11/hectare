import { FormEvent, useMemo, useState } from "react";
import { Timestamp } from "firebase/firestore";
import { useOutletContext } from "react-router-dom";
import {
  DeleteControl,
  GhostButton,
  ManageNotice,
  RowActions,
  useManageState,
} from "../components/ManageControls";
import { useOrgCollection } from "../hooks/useOrgCollection";
import { asDate, formatDateTime, isSameLocalDay } from "../lib/dates";
import { createOrgDoc, patchOrgDoc, purgeCompletedAffectationTasksForUser, writeMessage } from "../lib/orgWrite";
import { asText } from "../lib/text";
import type { OrgContext } from "./orgContext";
import { PageShell } from "./PageShell";
import styles from "./DashboardPage.module.css";

type AppUser = {
  name?: string;
  role?: string;
  isActive?: boolean;
};

type TimePunch = {
  userId?: string;
  userName?: string;
  clockInAt?: unknown;
  clockOutAt?: unknown;
  note?: string;
  source?: string;
};

type RangeKey = "today" | "week" | "all";

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

function startOfDay(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function mondayOf(date = new Date()): Date {
  const d = startOfDay(date);
  const weekday = d.getDay();
  d.setDate(d.getDate() + (weekday === 0 ? -6 : 1 - weekday));
  return d;
}

function punchMinutes(punch: TimePunch): number {
  const clockIn = asDate(punch.clockInAt);
  if (!clockIn) return 0;
  const clockOut = asDate(punch.clockOutAt) ?? new Date();
  return Math.max(0, Math.round((clockOut.getTime() - clockIn.getTime()) / 60000));
}

function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (!hours) return `${minutes} min`;
  if (!minutes) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

function formatDuration(start: Date | null, end: Date | null): string {
  if (!start) return "—";
  const close = end ?? new Date();
  return formatMinutes(Math.max(0, Math.round((close.getTime() - start.getTime()) / 60000)));
}

function belongsToUser(punch: TimePunch, userId: string): boolean {
  return (punch.userId || "").toLowerCase() === userId.toLowerCase();
}

function inRange(punch: TimePunch, range: RangeKey): boolean {
  const clockIn = asDate(punch.clockInAt);
  if (!clockIn) return false;
  if (range === "all") return true;
  if (range === "today") return isSameLocalDay(clockIn, new Date());
  return clockIn.getTime() >= mondayOf().getTime();
}

export function TimePunchesPage() {
  const { organizationId } = useOutletContext<OrgContext>();
  const users = useOrgCollection<AppUser>(organizationId, "users");
  const punches = useOrgCollection<TimePunch>(organizationId, "timePunches");
  const manage = useManageState();
  const [selectedUserId, setSelectedUserId] = useState("all");
  const [range, setRange] = useState<RangeKey>("week");
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

  const memberPunches = useMemo(() => {
    return sortedPunches.filter((punch) => {
      if (selectedUserId !== "all" && !belongsToUser(punch, selectedUserId)) return false;
      return inRange(punch, range);
    });
  }, [sortedPunches, selectedUserId, range]);

  const selectedUser = employees.find((u) => u.id === selectedUserId);
  const openCount = sortedPunches.filter((p) => !asDate(p.clockOutAt)).length;
  const todayCount = sortedPunches.filter((p) => {
    const d = asDate(p.clockInAt);
    return d ? isSameLocalDay(d, new Date()) : false;
  }).length;

  function userPunches(userId: string) {
    return sortedPunches.filter((punch) => belongsToUser(punch, userId));
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
        clockInAt: Timestamp.fromDate(clockIn),
        clockOutAt: clockOut ? Timestamp.fromDate(clockOut) : null,
        note: "",
        source: "web",
      });
      if (clockOut) {
        await purgeCompletedAffectationTasksForUser(organizationId, manualUserId);
      }
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
      if (clockOut) {
        const punch = punches.docs.find((item) => item.id === id);
        const userId = asText(punch?.userId);
        if (userId) await purgeCompletedAffectationTasksForUser(organizationId, userId);
      }
      setEditId(null);
      manage.setOk("Pointage mis à jour.");
    } catch (err) {
      manage.setError(writeMessage(err));
    } finally {
      manage.setBusyId(null);
    }
  }

  function selectMember(userId: string) {
    setSelectedUserId(userId);
    setEditId(null);
    if (userId !== "all") setManualUserId(userId);
  }

  return (
    <PageShell errors={[users.error, punches.error]}>
      <h1 className={styles.h1}>Pointages</h1>
      <p className={styles.meta}>
        Gère les arrivées et départs. Les employés pointent sur l’iPad avec le compte déjà connecté.
      </p>
      <ManageNotice error={manage.error} ok={manage.ok} />

      <div className={styles.kpis}>
        <article className={styles.kpi}>
          <span className={styles.kpiLabel}>Présents maintenant</span>
          <strong className={styles.kpiValue}>{openCount}</strong>
        </article>
        <article className={styles.kpi}>
          <span className={styles.kpiLabel}>Pointages aujourd’hui</span>
          <strong className={styles.kpiValue}>{todayCount}</strong>
        </article>
        <article className={styles.kpi}>
          <span className={styles.kpiLabel}>Employés actifs</span>
          <strong className={styles.kpiValue}>{employees.length}</strong>
        </article>
      </div>

      <div className={styles.modeTabs} role="tablist" aria-label="Période">
        {(
          [
            ["today", "Aujourd’hui"],
            ["week", "Cette semaine"],
            ["all", "Tout"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={range === key}
            className={range === key ? styles.modeTabActive : styles.modeTab}
            onClick={() => setRange(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <h2 className={styles.h2}>Membres</h2>
      {users.loading ? <p className="muted">Chargement des employés…</p> : null}
      {employees.length === 0 ? (
        <p className="muted">Aucun utilisateur actif. Ajoute-les dans Paramètres.</p>
      ) : (
        <div className={styles.roster}>
          <button
            type="button"
            className={selectedUserId === "all" ? styles.rosterMe : styles.rosterCard}
            onClick={() => selectMember("all")}
          >
            <div>
              <strong>Toute l’équipe</strong>
              <div className={styles.hint}>{sortedPunches.length} pointage(s) au total</div>
            </div>
            <div className={styles.rosterTimes}>
              <span className={styles.hint}>Voir tout</span>
            </div>
          </button>
          {employees.map((user) => {
            const list = userPunches(user.id);
            const open = list.find((p) => !asDate(p.clockOutAt));
            const weekMinutes = list.filter((p) => inRange(p, "week")).reduce((sum, p) => sum + punchMinutes(p), 0);
            const todayMinutes = list.filter((p) => inRange(p, "today")).reduce((sum, p) => sum + punchMinutes(p), 0);
            return (
              <button
                key={user.id}
                type="button"
                className={selectedUserId === user.id ? styles.rosterMe : styles.rosterCard}
                onClick={() => selectMember(user.id)}
              >
                <div>
                  <strong>{asText(user.name, "Employé")}</strong>
                  {open ? <span className={styles.tagOk}> En poste</span> : null}
                  <div className={styles.hint}>
                    {asText(user.role, "") === "manager" ? "Manager" : "Employé"}
                  </div>
                </div>
                <div className={styles.rosterTimes}>
                  {open ? `Depuis ${formatDateTime(open.clockInAt)}` : "Absent"}
                  <span className={styles.hint}>
                    Aujourd’hui {formatMinutes(todayMinutes)} · Semaine {formatMinutes(weekMinutes)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <h2 className={styles.h2}>Ajouter un pointage</h2>
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

      <h2 className={styles.h2}>
        {selectedUser ? `Pointages de ${asText(selectedUser.name, "l’employé")}` : "Historique de l’équipe"}
      </h2>
      <p className={styles.hint}>
        {range === "today"
          ? "Affichage : aujourd’hui"
          : range === "week"
            ? "Affichage : depuis lundi"
            : "Affichage : tous les pointages"}
      </p>
      {punches.loading ? <p className="muted">Chargement des pointages…</p> : null}
      {memberPunches.length === 0 ? (
        <p className="muted">Aucun pointage pour cette sélection.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Employé</th>
                <th>Arrivée</th>
                <th>Départ</th>
                <th>Durée</th>
                <th>Gestion</th>
              </tr>
            </thead>
            <tbody>
              {memberPunches.map((punch) => {
                const clockIn = asDate(punch.clockInAt);
                const clockOut = asDate(punch.clockOutAt);
                const editing = editId === punch.id;
                return (
                  <tr key={punch.id}>
                    <td>{asText(punch.userName, "Employé")}</td>
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
                      {organizationId ? (
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
