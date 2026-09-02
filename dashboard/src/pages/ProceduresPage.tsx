import { FormEvent, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  DeleteControl,
  GhostButton,
  ManageNotice,
  RowActions,
  useManageState,
} from "../components/ManageControls";
import { useOrgCollection } from "../hooks/useOrgCollection";
import { asDate, formatDateTime } from "../lib/dates";
import { createOrgDoc, patchOrgDoc, writeMessage } from "../lib/orgWrite";
import { asDisplayName, asText, namedFromDocs } from "../lib/text";
import type { OrgContext } from "./orgContext";
import styles from "./DashboardPage.module.css";

type ProcedureTemplate = { name?: string; type?: string; procedureDescription?: string; isActive?: boolean };
type ProcedureRun = {
  status?: string;
  isOverdue?: boolean;
  signedBy?: string;
  startTime?: unknown;
  date?: unknown;
  currentStep?: number;
  totalSteps?: number;
  procedureTemplateId?: string;
};

export function ProceduresPage() {
  const { organizationId, resolving, error: orgError } = useOutletContext<OrgContext>();
  const templates = useOrgCollection<ProcedureTemplate>(organizationId, "procedureTemplates");
  const runs = useOrgCollection<ProcedureRun>(organizationId, "procedureRuns");
  const manage = useManageState();
  const [name, setName] = useState("");
  const [type, setType] = useState("opening");
  const [description, setDescription] = useState("");
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("opening");
  const [editStatus, setEditStatus] = useState("completed");

  const rows = [...runs.docs].sort((a, b) => {
    const da = asDate(a.startTime) ?? asDate(a.date);
    const db = asDate(b.startTime) ?? asDate(b.date);
    return (db?.getTime() ?? 0) - (da?.getTime() ?? 0);
  });

  async function addTemplate(e: FormEvent) {
    e.preventDefault();
    if (!organizationId || !name.trim()) return;
    manage.setBusyId("create");
    manage.setError(null);
    try {
      await createOrgDoc(organizationId, "procedureTemplates", {
        name: name.trim(),
        type,
        procedureDescription: description.trim(),
        steps: [],
        estimatedDuration: 0,
        isActive: true,
      });
      setName("");
      setDescription("");
      manage.setCreating(false);
      manage.setOk("Modèle créé. L’iPad le verra au prochain sync.");
    } catch (err) {
      manage.setError(writeMessage(err));
    } finally {
      manage.setBusyId(null);
    }
  }

  async function saveTemplate(id: string) {
    if (!organizationId) return;
    manage.setBusyId(id);
    try {
      await patchOrgDoc(organizationId, "procedureTemplates", id, {
        name: editName.trim(),
        type: editType,
      });
      manage.setEditingId(null);
      manage.setOk("Modèle mis à jour.");
    } catch (err) {
      manage.setError(writeMessage(err));
    } finally {
      manage.setBusyId(null);
    }
  }

  async function saveRun(id: string) {
    if (!organizationId) return;
    manage.setBusyId(id);
    try {
      const patch: Record<string, unknown> = { status: editStatus };
      if (editStatus === "completed") {
        patch.completedAt = new Date();
        patch.isOverdue = false;
      }
      if (editStatus === "cancelled") patch.isOverdue = false;
      await patchOrgDoc(organizationId, "procedureRuns", id, patch);
      manage.setEditingId(null);
      manage.setOk("Exécution mise à jour.");
    } catch (err) {
      manage.setError(writeMessage(err));
    } finally {
      manage.setBusyId(null);
    }
  }

  return (
    <>
      {resolving ? <p className="muted">Recherche de l’organisation…</p> : null}
      {orgError ? <p className={styles.warn}>{orgError}</p> : null}
      {templates.error || runs.error ? (
        <p className={styles.warn}>{templates.error || runs.error}</p>
      ) : null}

      {!resolving && organizationId ? (
        <>
          <h1 className={styles.h1}>Procédures</h1>
          <p className={styles.meta}>
            Ouverture, fermeture et autres checklists lancées depuis l’iPad.
          </p>
          <ManageNotice error={manage.error} ok={manage.ok} />

          <h2 className={styles.h2}>Modèles ({templates.docs.length})</h2>
          <GhostButton onClick={() => manage.setCreating((v) => !v)}>
            {manage.creating ? "Fermer" : "Nouveau modèle"}
          </GhostButton>
          {manage.creating ? (
            <form className={styles.manageForm} onSubmit={addTemplate}>
              <label className={styles.field}>
                Nom
                <input className={styles.fieldInput} value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              <label className={styles.field}>
                Type
                <select className={styles.fieldInput} value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="opening">Ouverture</option>
                  <option value="closing">Fermeture</option>
                </select>
              </label>
              <label className={styles.field}>
                Description
                <input className={styles.fieldInput} value={description} onChange={(e) => setDescription(e.target.value)} />
              </label>
              <div className={styles.manageActions}>
                <button className="btnGold" type="submit" disabled={manage.busyId === "create"}>
                  Créer
                </button>
              </div>
            </form>
          ) : null}
          {templates.docs.length === 0 ? (
            <p className="muted">Aucun modèle. Crée-les ici ou dans l’app iPad.</p>
          ) : (
            <ul className={styles.list}>
              {templates.docs.map((t) => (
                <li key={t.id}>
                  {manage.editingId === t.id ? (
                    <RowActions>
                      <input className={styles.fieldInput} value={editName} onChange={(e) => setEditName(e.target.value)} />
                      <select className={styles.fieldInput} value={editType} onChange={(e) => setEditType(e.target.value)}>
                        <option value="opening">Ouverture</option>
                        <option value="closing">Fermeture</option>
                      </select>
                      <GhostButton onClick={() => void saveTemplate(t.id)}>Sauver</GhostButton>
                      <GhostButton onClick={() => manage.setEditingId(null)}>Annuler</GhostButton>
                    </RowActions>
                  ) : (
                    <>
                      <strong>{asDisplayName(t.name, t.id)}</strong>
                      {asText(t.type, "") ? <span className="muted"> — {asText(t.type)}</span> : null}
                      <RowActions>
                        <GhostButton
                          onClick={() => {
                            manage.setEditingId(t.id);
                            setEditName(asText(t.name, ""));
                            setEditType(asText(t.type, "opening") === "—" ? "opening" : asText(t.type, "opening"));
                          }}
                        >
                          Modifier
                        </GhostButton>
                        <DeleteControl
                          organizationId={organizationId}
                          collectionName="procedureTemplates"
                          id={t.id}
                          label="ce modèle"
                          busy={manage.busy(t.id)}
                          onBusy={manage.setBusyId}
                          onError={manage.setError}
                        />
                      </RowActions>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          <h2 className={styles.h2}>Exécutions</h2>
          {runs.loading ? <p className="muted">Chargement…</p> : null}
          {rows.length === 0 ? (
            <p className="muted">Aucune exécution pour l’instant.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Quand</th>
                    <th>Procédure</th>
                    <th>Progression</th>
                    <th>Statut</th>
                    <th>Signé par</th>
                    <th>Gestion</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{formatDateTime(r.startTime ?? r.date)}</td>
                      <td>
                        {r.procedureTemplateId
                          ? namedFromDocs(templates.docs, r.procedureTemplateId, "Procédure")
                          : "—"}
                      </td>
                      <td>
                        {typeof r.currentStep === "number" && typeof r.totalSteps === "number"
                          ? `${r.currentStep} / ${r.totalSteps}`
                          : "—"}
                      </td>
                      <td>
                        {manage.editingId === `run-${r.id}` ? (
                          <select
                            className={styles.fieldInput}
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value)}
                          >
                            <option value="running">En cours</option>
                            <option value="completed">Terminée</option>
                            <option value="paused">En pause</option>
                            <option value="cancelled">Annulée</option>
                          </select>
                        ) : (
                          statusLabel(r.status, r.isOverdue)
                        )}
                      </td>
                      <td>{asText(r.signedBy)}</td>
                      <td>
                        <RowActions>
                          {manage.editingId === `run-${r.id}` ? (
                            <>
                              <GhostButton onClick={() => void saveRun(r.id)}>Sauver</GhostButton>
                              <GhostButton onClick={() => manage.setEditingId(null)}>Annuler</GhostButton>
                            </>
                          ) : (
                            <GhostButton
                              onClick={() => {
                                manage.setEditingId(`run-${r.id}`);
                                setEditStatus(asText(r.status, "running").toLowerCase() || "running");
                              }}
                            >
                              Modifier
                            </GhostButton>
                          )}
                          <DeleteControl
                            organizationId={organizationId}
                            collectionName="procedureRuns"
                            id={r.id}
                            label="cette exécution"
                            busy={manage.busy(r.id)}
                            onBusy={manage.setBusyId}
                            onError={manage.setError}
                          />
                        </RowActions>
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

function statusLabel(status: unknown, overdue?: boolean) {
  const s = asText(status, "").toLowerCase();
  if (overdue) return <span className={styles.tagBad}>En retard</span>;
  if (s === "completed") return <span className={styles.tagOk}>Terminée</span>;
  if (s === "running" || s === "inprogress") return <span className={styles.tagWarn}>En cours</span>;
  if (s === "paused") return <span className={styles.tagWarn}>En pause</span>;
  if (s === "cancelled") return <span className={styles.tagMuted}>Annulée</span>;
  return asText(status);
}
