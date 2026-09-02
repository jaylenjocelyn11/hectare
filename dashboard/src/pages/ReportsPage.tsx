import { FormEvent, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  DeleteControl,
  GhostButton,
  ManageNotice,
  RowActions,
  useManageState,
} from "../components/ManageControls";
import { useEquipment } from "../hooks/useEquipment";
import { useOrgCollection } from "../hooks/useOrgCollection";
import { asDate, formatDateTime } from "../lib/dates";
import { noteCategoryLabel } from "../lib/labels";
import { createOrgDoc, patchOrgDoc, writeMessage } from "../lib/orgWrite";
import { asNumber, asText, namedFromDocs } from "../lib/text";
import type { OrgContext } from "./orgContext";
import { PageShell } from "./PageShell";
import styles from "./DashboardPage.module.css";

type TempReading = {
  timestamp?: unknown;
  date?: unknown;
  isOutOfRange?: boolean;
  temperature?: number;
  equipmentId?: string;
};

type ProcedureRun = {
  startTime?: unknown;
  date?: unknown;
  status?: string;
  isOverdue?: boolean;
  signedBy?: string;
  procedureTemplateId?: string;
};

type InventoryItem = {
  name?: string;
  quantity?: number;
  minStockLevel?: number;
};

type Note = {
  title?: string;
  content?: string;
  authorName?: string;
  createdAt?: unknown;
  isImportant?: boolean;
  category?: string;
};

type ProcedureTemplate = { name?: string };

type Period = "today" | "week" | "month";

function startOfPeriod(period: Period): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === "week") d.setDate(d.getDate() - 6);
  if (period === "month") d.setDate(d.getDate() - 29);
  return d;
}

function inPeriod(value: unknown, period: Period): boolean {
  const d = asDate(value);
  if (!d) return false;
  return d.getTime() >= startOfPeriod(period).getTime();
}

export function ReportsPage() {
  const { organizationId } = useOutletContext<OrgContext>();
  const [period, setPeriod] = useState<Period>("week");
  const manage = useManageState();
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteCategory, setNoteCategory] = useState("general");
  const [noteImportant, setNoteImportant] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const equipment = useEquipment(organizationId);
  const readings = useOrgCollection<TempReading>(organizationId, "tempReadings");
  const templates = useOrgCollection<ProcedureTemplate>(organizationId, "procedureTemplates");
  const runs = useOrgCollection<ProcedureRun>(organizationId, "procedureRuns");
  const inventory = useOrgCollection<InventoryItem>(organizationId, "inventory");
  const notes = useOrgCollection<Note>(organizationId, "notes");

  const periodReadings = useMemo(
    () => readings.docs.filter((r) => inPeriod(r.timestamp ?? r.date, period)),
    [readings.docs, period]
  );
  const periodRuns = useMemo(
    () => runs.docs.filter((r) => inPeriod(r.startTime ?? r.date, period)),
    [runs.docs, period]
  );
  const periodNotes = useMemo(
    () =>
      [...notes.docs]
        .filter((n) => inPeriod(n.createdAt, period))
        .sort((a, b) => (asDate(b.createdAt)?.getTime() ?? 0) - (asDate(a.createdAt)?.getTime() ?? 0)),
    [notes.docs, period]
  );

  const outOfRange = periodReadings.filter((r) => r.isOutOfRange).length;
  const completed = periodRuns.filter((r) => asText(r.status, "").toLowerCase() === "completed").length;
  const overdue = periodRuns.filter((r) => r.isOverdue).length;
  const lowStock = inventory.docs.filter((item) => {
    const qty = asNumber(item.quantity);
    const min = asNumber(item.minStockLevel);
    return qty != null && min != null && qty <= min;
  }).length;

  const equipmentName = (id?: unknown) => namedFromDocs(equipment.lookup, id, "—");
  const templateName = (id?: unknown) => namedFromDocs(templates.docs, id, "Procédure");

  async function addNote(e: FormEvent) {
    e.preventDefault();
    if (!organizationId || !noteTitle.trim()) return;
    manage.setBusyId("create");
    try {
      await createOrgDoc(organizationId, "notes", {
        title: noteTitle.trim(),
        content: noteContent.trim(),
        category: noteCategory,
        isImportant: noteImportant,
        authorName: "Manager",
        isReadByManager: true,
      });
      setNoteTitle("");
      setNoteContent("");
      setNoteImportant(false);
      manage.setCreating(false);
      manage.setOk("Note enregistrée.");
    } catch (err) {
      manage.setError(writeMessage(err));
    } finally {
      manage.setBusyId(null);
    }
  }

  async function saveNote(id: string) {
    if (!organizationId) return;
    manage.setBusyId(id);
    try {
      await patchOrgDoc(organizationId, "notes", id, {
        title: editTitle.trim(),
        content: editContent.trim(),
      });
      manage.setEditingId(null);
      manage.setOk("Note mise à jour.");
    } catch (err) {
      manage.setError(writeMessage(err));
    } finally {
      manage.setBusyId(null);
    }
  }

  return (
    <PageShell
      errors={[
        equipment.error,
        readings.error,
        templates.error,
        runs.error,
        inventory.error,
        notes.error,
      ]}
    >
      <h1 className={styles.h1}>Rapports</h1>
      <p className={styles.meta}>Historique HACCP à partir des données de l’iPad (80 derniers documents par type).</p>

      <label className={styles.filter}>
        Période
        <select value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
          <option value="today">Aujourd’hui</option>
          <option value="week">7 derniers jours</option>
          <option value="month">30 derniers jours</option>
        </select>
      </label>

      <div className={styles.kpis}>
        <article className={styles.kpi}>
          <span className={styles.kpiLabel}>Relevés</span>
          <strong className={styles.kpiValue}>{periodReadings.length}</strong>
        </article>
        <article className={styles.kpi}>
          <span className={styles.kpiLabel}>Hors plage</span>
          <strong className={`${styles.kpiValue} ${outOfRange ? styles.danger : ""}`}>
            {outOfRange}
          </strong>
        </article>
        <article className={styles.kpi}>
          <span className={styles.kpiLabel}>Procédures terminées</span>
          <strong className={styles.kpiValue}>{completed}</strong>
        </article>
        <article className={styles.kpi}>
          <span className={styles.kpiLabel}>En retard / stock bas</span>
          <strong className={styles.kpiValue}>
            {overdue} / {lowStock}
          </strong>
        </article>
      </div>

      <h2 className={styles.h2}>Notes</h2>
      {organizationId ? (
        <>
          <GhostButton onClick={() => manage.setCreating((v) => !v)}>
            {manage.creating ? "Fermer" : "Nouvelle note"}
          </GhostButton>
          <ManageNotice error={manage.error} ok={manage.ok} />
          {manage.creating ? (
            <form className={styles.manageForm} onSubmit={addNote}>
              <label className={styles.field}>
                Titre
                <input
                  className={styles.fieldInput}
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  required
                />
              </label>
              <label className={styles.field}>
                Catégorie
                <select
                  className={styles.fieldInput}
                  value={noteCategory}
                  onChange={(e) => setNoteCategory(e.target.value)}
                >
                  <option value="general">Général</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="inventory">Inventaire</option>
                  <option value="procedure">Procédure</option>
                  <option value="temperature">Température</option>
                  <option value="other">Autre</option>
                </select>
              </label>
              <label className={styles.field}>
                Contenu
                <input
                  className={styles.fieldInput}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                />
              </label>
              <label className={styles.checkInline}>
                <input
                  type="checkbox"
                  checked={noteImportant}
                  onChange={(e) => setNoteImportant(e.target.checked)}
                />
                Importante
              </label>
              <div className={styles.manageActions}>
                <button className="btnGold" type="submit" disabled={manage.busyId === "create"}>
                  Enregistrer
                </button>
              </div>
            </form>
          ) : null}
        </>
      ) : null}
      {periodNotes.length === 0 ? (
        <p className="muted">Aucune note sur cette période.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Quand</th>
                <th>Titre</th>
                <th>Catégorie</th>
                <th>Auteur</th>
                <th>Gestion</th>
              </tr>
            </thead>
            <tbody>
              {periodNotes.slice(0, 20).map((n) => (
                <tr key={n.id}>
                  <td>{formatDateTime(n.createdAt)}</td>
                  <td className={styles.wrap}>
                    {manage.editingId === n.id ? (
                      <>
                        <input className={styles.fieldInput} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                        <input className={styles.fieldInput} value={editContent} onChange={(e) => setEditContent(e.target.value)} />
                      </>
                    ) : (
                      <>
                    {asText(n.title)}
                    {n.isImportant ? <span className={styles.tagWarn}> Important</span> : null}
                    {asText(n.content, "") ? (
                      <div className="muted">{asText(n.content)}</div>
                    ) : null}
                      </>
                    )}
                  </td>
                  <td>{noteCategoryLabel(n.category)}</td>
                  <td>{asText(n.authorName)}</td>
                  <td>
                    {organizationId ? (
                      <RowActions>
                        {manage.editingId === n.id ? (
                          <>
                            <GhostButton onClick={() => void saveNote(n.id)}>Sauver</GhostButton>
                            <GhostButton onClick={() => manage.setEditingId(null)}>Annuler</GhostButton>
                          </>
                        ) : (
                          <GhostButton
                            onClick={() => {
                              manage.setEditingId(n.id);
                              setEditTitle(asText(n.title, ""));
                              setEditContent(asText(n.content, "") === "—" ? "" : asText(n.content, ""));
                            }}
                          >
                            Modifier
                          </GhostButton>
                        )}
                        <DeleteControl
                          organizationId={organizationId}
                          collectionName="notes"
                          id={n.id}
                          label="cette note"
                          busy={manage.busy(n.id)}
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

      <h2 className={styles.h2}>Relevés hors plage</h2>
      {periodReadings.filter((r) => r.isOutOfRange).length === 0 ? (
        <p className="muted">Aucun relevé hors plage sur cette période.</p>
      ) : (
        <ul className={styles.list}>
          {periodReadings
            .filter((r) => r.isOutOfRange)
            .slice(0, 15)
            .map((r) => (
              <li key={r.id}>
                {formatDateTime(r.timestamp ?? r.date)} —{" "}
                {equipmentName(r.equipmentId)}
                {typeof r.temperature === "number" ? ` · ${r.temperature} °C` : ""}
              </li>
            ))}
        </ul>
      )}

      <h2 className={styles.h2}>Procédures de la période</h2>
      {periodRuns.length === 0 ? (
        <p className="muted">Aucune procédure sur cette période.</p>
      ) : (
        <ul className={styles.list}>
          {periodRuns.slice(0, 15).map((r) => (
            <li key={r.id}>
              {formatDateTime(r.startTime ?? r.date)} —{" "}
              {templateName(r.procedureTemplateId)}{" "}
              · {asText(r.status)}
              {asText(r.signedBy, "") ? ` · ${asText(r.signedBy)}` : ""}
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
