import { useMemo, useState } from "react";
import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { useOutletContext } from "react-router-dom";
import { useOrgCollection } from "../hooks/useOrgCollection";
import { getFirebaseFirestore } from "../lib/firebase";
import {
  addWeeks,
  emptyDays,
  formatWeekRange,
  formatWeekStart,
  mondayOf,
  parseDays,
  scheduleDocumentId,
  shiftHours,
  weekHours,
  workingShift,
  WEEKDAYS,
  type ShiftDraft,
  type WeekdayKey,
} from "../lib/schedule";
import { asText } from "../lib/text";
import type { OrgContext } from "./orgContext";
import { PageShell } from "./PageShell";
import styles from "./DashboardPage.module.css";

type AppUser = {
  name?: string;
  role?: string;
  isActive?: boolean;
};

type ScheduleDoc = {
  userId?: string;
  userName?: string;
  weekStart?: string;
  days?: unknown;
  note?: string;
};

type RowState = {
  userId: string;
  userName: string;
  days: Record<WeekdayKey, ShiftDraft>;
  note: string;
};

function formatHours(hours: number): string {
  if (!hours) return "0 h";
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded} h` : `${String(rounded).replace(".", ",")} h`;
}

export function SchedulePage() {
  const { organizationId } = useOutletContext<OrgContext>();
  const users = useOrgCollection<AppUser>(organizationId, "users");
  const schedules = useOrgCollection<ScheduleDoc>(organizationId, "employeeSchedules");
  const [weekStart, setWeekStart] = useState(() => formatWeekStart(mondayOf()));
  const [drafts, setDrafts] = useState<Record<string, RowState>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const employees = useMemo(() => {
    return [...users.docs]
      .filter((u) => u.isActive !== false)
      .sort((a, b) => asText(a.name).localeCompare(asText(b.name), "fr"));
  }, [users.docs]);

  const rows = useMemo(() => {
    return employees.map((user) => {
      const existing = schedules.docs.find((docRow) => {
        const expectedId = scheduleDocumentId(user.id, weekStart);
        return (
          docRow.id === expectedId ||
          (docRow.weekStart === weekStart &&
            (docRow.userId === user.id || docRow.linkedId === user.id))
        );
      });
      const draft = drafts[`${user.id}_${weekStart}`];
      if (draft) return draft;
      return {
        userId: user.id,
        userName: asText(user.name, "Employé"),
        days: existing ? parseDays(existing.days) : emptyDays(),
        note: typeof existing?.note === "string" ? existing.note : "",
      } satisfies RowState;
    });
  }, [employees, schedules.docs, weekStart, drafts]);

  function updateRow(userId: string, updater: (row: RowState) => RowState) {
    const key = `${userId}_${weekStart}`;
    const current = rows.find((row) => row.userId === userId);
    if (!current) return;
    setDrafts((prev) => ({ ...prev, [key]: updater(current) }));
    setMessage(null);
  }

  function setShift(userId: string, day: WeekdayKey, patch: Partial<ShiftDraft>) {
    updateRow(userId, (row) => ({
      ...row,
      days: { ...row.days, [day]: { ...row.days[day], ...patch } },
    }));
  }

  async function saveWeek() {
    if (!organizationId) return;
    setSaving(true);
    setMessage(null);
    try {
      const db = getFirebaseFirestore();
      const batch = writeBatch(db);
      for (const row of rows) {
        const id = scheduleDocumentId(row.userId, weekStart);
        const ref = doc(db, "organizations", organizationId, "employeeSchedules", id);
        const days: Record<string, { off: boolean; start: string; end: string; note: string }> = {};
        for (const weekday of WEEKDAYS) {
          const shift = row.days[weekday.key];
          days[weekday.key] = {
            off: shift.off,
            start: shift.off ? "" : shift.start,
            end: shift.off ? "" : shift.end,
            note: shift.note,
          };
        }
        batch.set(ref, {
          userId: row.userId,
          userName: row.userName,
          weekStart,
          days,
          note: row.note,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      setDrafts({});
      setMessage("Horaire publié. Les employés le voient tout de suite sur iPhone.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  }

  async function copyPreviousWeek() {
    const previous = addWeeks(weekStart, -1);
    const copied: Record<string, RowState> = {};
    for (const user of employees) {
      const existing = schedules.docs.find((docRow) => {
        const expectedId = scheduleDocumentId(user.id, previous);
        return (
          docRow.id === expectedId ||
          (docRow.weekStart === previous &&
            (docRow.userId === user.id || docRow.linkedId === user.id))
        );
      });
      copied[`${user.id}_${weekStart}`] = {
        userId: user.id,
        userName: asText(user.name, "Employé"),
        days: existing ? parseDays(existing.days) : emptyDays(),
        note: typeof existing?.note === "string" ? existing.note : "",
      };
    }
    setDrafts(copied);
    setMessage("Semaine précédente copiée. Vérifie puis enregistre.");
  }

  function applyWeekdays(userId: string) {
    updateRow(userId, (row) => {
      const source = row.days.monday.off ? workingShift() : row.days.monday;
      const next = { ...row.days };
      for (const day of ["monday", "tuesday", "wednesday", "thursday", "friday"] as WeekdayKey[]) {
        next[day] = { ...source };
      }
      return { ...row, days: next };
    });
  }

  const teamHours = rows.reduce((sum, row) => sum + weekHours(row.days), 0);

  return (
    <PageShell errors={[users.error, schedules.error]}>
      <h1 className={styles.h1}>Horaire</h1>
      <p className={styles.meta}>
        Publie la semaine de chaque employé. L’app iPhone affiche uniquement l’horaire de la personne
        connectée.
      </p>

      <div className={styles.scheduleToolbar}>
        <div className={styles.weekNav}>
          <button type="button" className={styles.linkButton} onClick={() => setWeekStart(addWeeks(weekStart, -1))}>
            Semaine préc.
          </button>
          <div>
            <strong>{formatWeekRange(weekStart)}</strong>
            <div className={styles.hint}>{weekStart}</div>
          </div>
          <button type="button" className={styles.linkButton} onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
            Semaine suiv.
          </button>
        </div>
        <div className={styles.scheduleActions}>
          <button type="button" className={styles.linkButton} onClick={copyPreviousWeek}>
            Copier la semaine précédente
          </button>
          <button type="button" className="btnGold" onClick={saveWeek} disabled={saving || !organizationId}>
            {saving ? "Publication…" : "Publier la semaine"}
          </button>
        </div>
      </div>

      <div className={styles.kpis}>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Employés</span>
          <span className={styles.kpiValue}>{rows.length}</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Heures équipe</span>
          <span className={styles.kpiValue}>{formatHours(teamHours)}</span>
        </div>
      </div>

      {message ? <p className={styles.hint}>{message}</p> : null}
      {users.loading || schedules.loading ? <p className="muted">Chargement…</p> : null}

      {rows.length === 0 ? (
        <p className="muted">Aucun employé actif. Crée les utilisateurs dans l’app, puis reviens ici.</p>
      ) : (
        <div className={styles.scheduleStack}>
          {rows.map((row) => (
            <article key={row.userId} className={styles.scheduleCard}>
              <header className={styles.cardHead}>
                <div>
                  <h2 className={styles.scheduleName}>{row.userName}</h2>
                  <p className={styles.hint}>{formatHours(weekHours(row.days))} cette semaine</p>
                </div>
                <button type="button" className={styles.linkButton} onClick={() => applyWeekdays(row.userId)}>
                  Lun–Ven comme lundi
                </button>
              </header>
              <div className={styles.scheduleGrid}>
                {WEEKDAYS.map((day) => {
                  const shift = row.days[day.key];
                  return (
                    <div key={day.key} className={styles.dayCell}>
                      <div className={styles.dayCellHead}>
                        <span>{day.short}</span>
                        <label className={styles.offToggle}>
                          <input
                            type="checkbox"
                            checked={shift.off}
                            onChange={(e) =>
                              setShift(
                                row.userId,
                                day.key,
                                e.target.checked
                                  ? { off: true }
                                  : { off: false, start: shift.start || "09:00", end: shift.end || "17:00" }
                              )
                            }
                          />
                          Congé
                        </label>
                      </div>
                      {shift.off ? (
                        <p className={styles.restLabel}>Repos</p>
                      ) : (
                        <>
                          <label className={styles.timeField}>
                            Début
                            <input
                              type="time"
                              value={shift.start}
                              onChange={(e) => setShift(row.userId, day.key, { start: e.target.value })}
                            />
                          </label>
                          <label className={styles.timeField}>
                            Fin
                            <input
                              type="time"
                              value={shift.end}
                              onChange={(e) => setShift(row.userId, day.key, { end: e.target.value })}
                            />
                          </label>
                          <span className={styles.hint}>{formatHours(shiftHours(shift))}</span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              <label className={styles.field}>
                Note (visible sur iPhone)
                <input
                  className={styles.fieldInput}
                  value={row.note}
                  onChange={(e) => updateRow(row.userId, (current) => ({ ...current, note: e.target.value }))}
                  placeholder="Ex. fermeture, formation…"
                />
              </label>
            </article>
          ))}
        </div>
      )}
    </PageShell>
  );
}
