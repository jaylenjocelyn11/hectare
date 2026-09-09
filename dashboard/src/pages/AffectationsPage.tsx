import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
import { asDate } from "../lib/dates";
import {
  createOrgDoc,
  parseAffectationTasks,
  patchOrgDoc,
  purgeCompletedAffectationTasksForUser,
  removeOrgDoc,
  writeMessage,
} from "../lib/orgWrite";
import { asText } from "../lib/text";
import type { OrgContext } from "./orgContext";
import { PageShell } from "./PageShell";
import styles from "./DashboardPage.module.css";

type AppUser = {
  name?: string;
  role?: string;
  isActive?: boolean;
};

type AffectationListDoc = {
  title?: string;
  tasks?: unknown;
  createdByName?: string;
  isActive?: boolean;
};

type AffectationAssignmentDoc = {
  listId?: string;
  listTitle?: string;
  assigneeUserId?: string;
  assigneeName?: string;
  assignedByName?: string;
  tasks?: unknown;
};

type TimePunch = {
  userId?: string;
  clockOutAt?: unknown;
};

type Pane = "lists" | "follow";

function newTaskId(): string {
  return crypto.randomUUID().toUpperCase();
}

export function AffectationsPage() {
  const { organizationId } = useOutletContext<OrgContext>();
  const users = useOrgCollection<AppUser>(organizationId, "users");
  const lists = useOrgCollection<AffectationListDoc>(organizationId, "affectationLists");
  const assignments = useOrgCollection<AffectationAssignmentDoc>(organizationId, "affectationAssignments");
  const punches = useOrgCollection<TimePunch>(organizationId, "timePunches");
  const manage = useManageState();
  const [pane, setPane] = useState<Pane>("follow");
  const [listTitle, setListTitle] = useState("");
  const [listTasks, setListTasks] = useState("");
  const [pickedByList, setPickedByList] = useState<Record<string, string[]>>({});
  const prevOpenIds = useRef<Set<string> | null>(null);

  const employees = useMemo(
    () =>
      [...users.docs]
        .filter((u) => u.isActive !== false)
        .sort((a, b) => asText(a.name).localeCompare(asText(b.name), "fr")),
    [users.docs]
  );

  const activeLists = useMemo(
    () =>
      [...lists.docs]
        .filter((list) => list.isActive !== false)
        .sort((a, b) => asText(a.title).localeCompare(asText(b.title), "fr")),
    [lists.docs]
  );

  const sortedAssignments = useMemo(
    () =>
      [...assignments.docs].sort((a, b) => asText(a.assigneeName).localeCompare(asText(b.assigneeName), "fr")),
    [assignments.docs]
  );

  const pendingCount = sortedAssignments.reduce((sum, item) => {
    return sum + parseAffectationTasks(item.tasks).filter((task) => !task.isCompleted).length;
  }, 0);

  useEffect(() => {
    const openIds = new Set(
      punches.docs.filter((punch) => !asDate(punch.clockOutAt)).map((punch) => punch.id)
    );
    if (prevOpenIds.current) {
      for (const id of prevOpenIds.current) {
        if (openIds.has(id) || !organizationId) continue;
        const punch = punches.docs.find((item) => item.id === id);
        const userId = asText(punch?.userId);
        if (userId) void purgeCompletedAffectationTasksForUser(organizationId, userId);
      }
    }
    prevOpenIds.current = openIds;
  }, [organizationId, punches.docs]);

  async function addList(e: FormEvent) {
    e.preventDefault();
    if (!organizationId) return;
    const title = listTitle.trim();
    const tasks = listTasks
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((title) => ({ id: newTaskId(), title, isCompleted: false, completedAt: null }));
    if (!title || tasks.length === 0) {
      manage.setError("Indique un nom et au moins une tâche (une par ligne).");
      return;
    }
    manage.setBusyId("list-new");
    try {
      await createOrgDoc(organizationId, "affectationLists", {
        title,
        tasks,
        createdByName: "Tableau de bord",
        createdByUserId: "",
        isActive: true,
      });
      setListTitle("");
      setListTasks("");
      manage.setOk("Liste créée.");
    } catch (err) {
      manage.setError(writeMessage(err));
    } finally {
      manage.setBusyId(null);
    }
  }

  async function assignList(listId: string) {
    if (!organizationId) return;
    const list = activeLists.find((item) => item.id === listId);
    const chosenUsers = employees.filter((user) => (pickedByList[listId] ?? []).includes(user.id));
    if (!list || chosenUsers.length === 0) {
      manage.setError("Choisis au moins un employé.");
      return;
    }
    manage.setBusyId(`assign-${listId}`);
    try {
      const template = parseAffectationTasks(list.tasks).map((task) => ({
        id: newTaskId(),
        title: task.title,
        isCompleted: false,
        completedAt: null,
      }));
      for (const user of chosenUsers) {
        await createOrgDoc(organizationId, "affectationAssignments", {
          listId: list.id,
          listTitle: asText(list.title, "Liste"),
          assigneeUserId: user.id,
          assigneeName: asText(user.name, "Employé"),
          assignedByUserId: "",
          assignedByName: "Tableau de bord",
          tasks: template,
        });
      }
      await removeOrgDoc(organizationId, "affectationLists", list.id);
      setPickedByList((prev) => {
        const next = { ...prev };
        delete next[listId];
        return next;
      });
      manage.setOk("Liste assignée. Elle a été retirée des brouillons.");
      setPane("follow");
    } catch (err) {
      manage.setError(writeMessage(err));
    } finally {
      manage.setBusyId(null);
    }
  }

  async function toggleTask(assignmentId: string, taskId: string, completed: boolean) {
    if (!organizationId) return;
    const assignment = assignments.docs.find((item) => item.id === assignmentId);
    if (!assignment) return;
    const tasks = parseAffectationTasks(assignment.tasks).map((task) =>
      task.id === taskId
        ? { ...task, isCompleted: completed, completedAt: completed ? Timestamp.now() : null }
        : task
    );
    manage.setBusyId(`${assignmentId}-${taskId}`);
    try {
      await patchOrgDoc(organizationId, "affectationAssignments", assignmentId, { tasks });
      manage.setOk(completed ? "Tâche marquée comme complétée." : "Tâche rouverte.");
    } catch (err) {
      manage.setError(writeMessage(err));
    } finally {
      manage.setBusyId(null);
    }
  }

  function toggleUser(listId: string, userId: string) {
    setPickedByList((prev) => {
      const current = prev[listId] ?? [];
      const next = current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId];
      return { ...prev, [listId]: next };
    });
  }

  return (
    <PageShell errors={[users.error, lists.error, assignments.error, punches.error]}>
      <h1 className={styles.h1}>Affectation</h1>
      <p className={styles.meta}>
        Crée une liste, assigne-la, puis elle disparaît des brouillons. Les tâches terminées sont
        retirées au pointage de sortie.
      </p>
      <ManageNotice error={manage.error} ok={manage.ok} />

      <div className={styles.kpis}>
        <article className={styles.kpi}>
          <span className={styles.kpiLabel}>Listes</span>
          <strong className={styles.kpiValue}>{activeLists.length}</strong>
        </article>
        <article className={styles.kpi}>
          <span className={styles.kpiLabel}>Affectations</span>
          <strong className={styles.kpiValue}>{sortedAssignments.length}</strong>
        </article>
        <article className={styles.kpi}>
          <span className={styles.kpiLabel}>Tâches en cours</span>
          <strong className={styles.kpiValue}>{pendingCount}</strong>
        </article>
      </div>

      <div className={styles.modeTabs} role="tablist" aria-label="Affectation">
        {(
          [
            ["follow", "Suivi"],
            ["lists", "Listes"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={pane === key}
            className={pane === key ? styles.modeTabActive : styles.modeTab}
            onClick={() => setPane(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {pane === "lists" ? (
        <>
          <h2 className={styles.h2}>Nouvelle liste</h2>
          <form className={styles.manageForm} onSubmit={addList}>
            <label className={styles.field}>
              Nom
              <input
                className={styles.fieldInput}
                value={listTitle}
                onChange={(e) => setListTitle(e.target.value)}
                placeholder="Fermeture cuisine"
                required
              />
            </label>
            <label className={`${styles.field} ${styles.spanAll}`}>
              Tâches (une par ligne)
              <textarea
                className={styles.fieldTextarea}
                value={listTasks}
                onChange={(e) => setListTasks(e.target.value)}
                placeholder={"Nettoyer les surfaces\nVérifier les frigos"}
                required
              />
            </label>
            <div className={styles.manageActions}>
              <button className="btnGold" type="submit" disabled={manage.busyId === "list-new"}>
                Créer
              </button>
            </div>
          </form>

          <h2 className={styles.h2}>En attente</h2>
          {lists.loading ? <p className="muted">Chargement…</p> : null}
          {activeLists.length === 0 ? (
            <p className="muted">Aucune liste. Crée-en une, puis assigne-la à l’équipe.</p>
          ) : (
            <div className={styles.draftStack}>
              {activeLists.map((list) => {
                const tasks = parseAffectationTasks(list.tasks);
                const picked = pickedByList[list.id] ?? [];
                return (
                  <article key={list.id} className={styles.draftCard}>
                    <div className={styles.draftHead}>
                      <h3 className={styles.draftTitle}>{asText(list.title, "Liste")}</h3>
                      <span className={styles.draftCount}>{tasks.length}</span>
                      {organizationId ? (
                        <DeleteControl
                          organizationId={organizationId}
                          collectionName="affectationLists"
                          id={list.id}
                          label="cette liste"
                          busy={manage.busy(list.id)}
                          onBusy={manage.setBusyId}
                          onError={manage.setError}
                        />
                      ) : null}
                    </div>
                    <ol className={styles.draftTasks}>
                      {tasks.map((task) => (
                        <li key={task.id}>{task.title}</li>
                      ))}
                    </ol>
                    <p className={styles.draftLabel}>Assigner à</p>
                    <div className={styles.peopleChips}>
                      {employees.map((user) => {
                        const on = picked.includes(user.id);
                        return (
                          <button
                            key={user.id}
                            type="button"
                            className={on ? styles.chipOn : styles.chip}
                            onClick={() => toggleUser(list.id, user.id)}
                          >
                            {asText(user.name, "Employé")}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      className="btnGold"
                      type="button"
                      disabled={manage.busyId === `assign-${list.id}` || picked.length === 0}
                      onClick={() => void assignList(list.id)}
                    >
                      Assigner
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </>
      ) : null}

      {pane === "follow" ? (
        <>
          <h2 className={styles.h2}>Tâches assignées</h2>
          {assignments.loading ? <p className="muted">Chargement…</p> : null}
          {sortedAssignments.length === 0 ? (
            <p className="muted">Aucune affectation en cours.</p>
          ) : (
            <div className={styles.stack}>
              {sortedAssignments.map((assignment) => {
                const tasks = parseAffectationTasks(assignment.tasks);
                const done = tasks.filter((task) => task.isCompleted).length;
                return (
                  <article key={assignment.id} className={styles.card}>
                    <div className={styles.cardHead}>
                      <div>
                        <strong>{asText(assignment.listTitle, "Liste")}</strong>
                        <div className={styles.hint}>
                          {asText(assignment.assigneeName, "Employé")} · {done}/{tasks.length} terminée(s)
                        </div>
                      </div>
                      {organizationId ? (
                        <RowActions>
                          <DeleteControl
                            organizationId={organizationId}
                            collectionName="affectationAssignments"
                            id={assignment.id}
                            label="cette affectation"
                            busy={manage.busy(assignment.id)}
                            onBusy={manage.setBusyId}
                            onError={manage.setError}
                          />
                        </RowActions>
                      ) : null}
                    </div>
                    {tasks.map((task) => (
                      <div key={task.id} className={styles.taskRow}>
                        <span className={task.isCompleted ? styles.taskDone : undefined}>{task.title}</span>
                        <GhostButton
                          disabled={manage.busy(`${assignment.id}-${task.id}`)}
                          onClick={() => void toggleTask(assignment.id, task.id, !task.isCompleted)}
                        >
                          {task.isCompleted ? "Annuler" : "Terminer"}
                        </GhostButton>
                      </div>
                    ))}
                    {tasks.some((task) => task.isCompleted) ? (
                      <p className={styles.hint}>Les tâches terminées seront retirées au pointage de sortie.</p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </>
      ) : null}
    </PageShell>
  );
}
