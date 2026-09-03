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
import { createOrgDoc, newOrgId, patchOrgDoc, writeMessage } from "../lib/orgWrite";
import { asDisplayName, asNumber, asText, namedFromDocs } from "../lib/text";
import type { OrgContext } from "./orgContext";
import styles from "./DashboardPage.module.css";

type ProcedureStep = {
  id?: string;
  title?: string;
  description?: string;
  text?: string;
  isRequired?: boolean;
  photoRequired?: boolean;
  estimatedTime?: number;
  order?: number;
};

type ProcedureTemplate = {
  name?: string;
  type?: string;
  procedureDescription?: string;
  isActive?: boolean;
  steps?: ProcedureStep[];
};

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

type DraftStep = {
  key: string;
  id: string;
  title: string;
  text: string;
  photoRequired: boolean;
};

function newDraftStep(order: number, existing?: ProcedureStep): DraftStep {
  const text = asText(existing?.text, "");
  const description = asText(existing?.description, "");
  const titleRaw = asText(existing?.title, "");
  const existingId = asText(existing?.id, "");
  return {
    key: existingId || crypto.randomUUID(),
    id: existingId || newOrgId(),
    title: titleRaw || `Étape ${order}`,
    text: text || description,
    photoRequired: existing?.photoRequired === true,
  };
}

function draftsFromTemplate(steps: unknown): DraftStep[] {
  if (!Array.isArray(steps) || steps.length === 0) return [newDraftStep(1)];
  return [...steps]
    .filter((s): s is ProcedureStep => !!s && typeof s === "object")
    .sort((a, b) => (asNumber(a.order) ?? 0) - (asNumber(b.order) ?? 0))
    .map((s, i) => newDraftStep(i + 1, s));
}

function payloadSteps(drafts: DraftStep[]) {
  return drafts
    .map((s, i) => ({
      ...s,
      text: s.text.trim(),
      title: s.title.trim() || `Étape ${i + 1}`,
    }))
    .filter((s) => s.text)
    .map((s, i) => ({
      id: s.id,
      title: s.title || `Étape ${i + 1}`,
      description: s.text,
      text: s.text,
      isRequired: true,
      photoRequired: s.photoRequired,
      estimatedTime: 0,
      order: i + 1,
    }));
}

function TemplateStepsEditor({
  steps,
  onChange,
}: {
  steps: DraftStep[];
  onChange: (next: DraftStep[]) => void;
}) {
  function update(key: string, patch: Partial<DraftStep>) {
    onChange(steps.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function move(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= steps.length) return;
    const copy = [...steps];
    const [item] = copy.splice(index, 1);
    copy.splice(next, 0, item);
    onChange(copy.map((s, i) => ({ ...s, title: s.title.trim() ? s.title : `Étape ${i + 1}` })));
  }

  return (
    <div className={styles.stepEditor}>
      <p className={styles.hint}>
        Ajoute autant d’étapes que besoin. L’iPad les reprend au prochain sync ({steps.length} dans le
        formulaire).
      </p>
      {steps.map((step, index) => (
        <div key={step.key} className={styles.stepCard}>
          <div className={styles.stepCardTop}>
            <strong>Étape {index + 1}</strong>
            <RowActions>
              <GhostButton onClick={() => move(index, -1)} disabled={index === 0}>
                Monter
              </GhostButton>
              <GhostButton onClick={() => move(index, 1)} disabled={index === steps.length - 1}>
                Descendre
              </GhostButton>
              <GhostButton
                onClick={() =>
                  onChange(steps.length === 1 ? [newDraftStep(1)] : steps.filter((s) => s.key !== step.key))
                }
              >
                Retirer
              </GhostButton>
            </RowActions>
          </div>
          <label className={styles.field}>
            Titre
            <input
              className={styles.fieldInput}
              value={step.title}
              onChange={(e) => update(step.key, { title: e.target.value })}
              placeholder={`Étape ${index + 1}`}
            />
          </label>
          <label className={styles.field}>
            Description de l’étape
            <textarea
              className={styles.fieldTextarea}
              value={step.text}
              onChange={(e) => update(step.key, { text: e.target.value })}
              placeholder="Ex. Vérifier la température du frigo"
              rows={3}
            />
          </label>
          <label className={styles.checkInline}>
            <input
              type="checkbox"
              checked={step.photoRequired}
              onChange={(e) => update(step.key, { photoRequired: e.target.checked })}
            />
            Photo requise
          </label>
        </div>
      ))}
      <GhostButton onClick={() => onChange([...steps, newDraftStep(steps.length + 1)])}>
        Ajouter une étape
      </GhostButton>
    </div>
  );
}

export function ProceduresPage() {
  const { organizationId, resolving, error: orgError } = useOutletContext<OrgContext>();
  const templates = useOrgCollection<ProcedureTemplate>(organizationId, "procedureTemplates");
  const runs = useOrgCollection<ProcedureRun>(organizationId, "procedureRuns");
  const manage = useManageState();
  const [name, setName] = useState("");
  const [type, setType] = useState("opening");
  const [description, setDescription] = useState("");
  const [createSteps, setCreateSteps] = useState<DraftStep[]>(() => [newDraftStep(1)]);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("opening");
  const [editDescription, setEditDescription] = useState("");
  const [editSteps, setEditSteps] = useState<DraftStep[]>([]);
  const [editStatus, setEditStatus] = useState("completed");

  const rows = [...runs.docs].sort((a, b) => {
    const da = asDate(a.startTime) ?? asDate(a.date);
    const db = asDate(b.startTime) ?? asDate(b.date);
    return (db?.getTime() ?? 0) - (da?.getTime() ?? 0);
  });

  async function addTemplate(e: FormEvent) {
    e.preventDefault();
    if (!organizationId || !name.trim()) return;
    const steps = payloadSteps(createSteps);
    if (steps.length === 0) {
      manage.setError("Ajoute au moins une étape avec une description.");
      return;
    }
    manage.setBusyId("create");
    manage.setError(null);
    try {
      await createOrgDoc(organizationId, "procedureTemplates", {
        name: name.trim(),
        type,
        procedureDescription: description.trim() || `Procédure ${type === "closing" ? "fermeture" : "ouverture"}`,
        steps,
        estimatedDuration: 0,
        isActive: true,
      });
      setName("");
      setDescription("");
      setCreateSteps([newDraftStep(1)]);
      manage.setCreating(false);
      manage.setOk("Modèle créé avec ses étapes. L’iPad le verra au prochain sync.");
    } catch (err) {
      manage.setError(writeMessage(err));
    } finally {
      manage.setBusyId(null);
    }
  }

  async function saveTemplate(id: string) {
    if (!organizationId) return;
    const steps = payloadSteps(editSteps);
    if (steps.length === 0) {
      manage.setError("Ajoute au moins une étape avec une description.");
      return;
    }
    manage.setBusyId(id);
    try {
      await patchOrgDoc(organizationId, "procedureTemplates", id, {
        name: editName.trim(),
        type: editType,
        procedureDescription: editDescription.trim(),
        steps,
      });
      manage.setEditingId(null);
      manage.setOk("Modèle et étapes mis à jour.");
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
          <GhostButton
            onClick={() => {
              manage.setCreating((v) => {
                if (!v) setCreateSteps([newDraftStep(1)]);
                return !v;
              });
              manage.setEditingId(null);
            }}
          >
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
              <TemplateStepsEditor steps={createSteps} onChange={setCreateSteps} />
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
              {templates.docs.map((t) => {
                const listed = draftsFromTemplate(t.steps).filter((s) => s.text);
                return (
                  <li key={t.id}>
                    {manage.editingId === t.id ? (
                      <form
                        className={styles.manageForm}
                        onSubmit={(e) => {
                          e.preventDefault();
                          void saveTemplate(t.id);
                        }}
                      >
                        <label className={styles.field}>
                          Nom
                          <input
                            className={styles.fieldInput}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            required
                          />
                        </label>
                        <label className={styles.field}>
                          Type
                          <select
                            className={styles.fieldInput}
                            value={editType}
                            onChange={(e) => setEditType(e.target.value)}
                          >
                            <option value="opening">Ouverture</option>
                            <option value="closing">Fermeture</option>
                          </select>
                        </label>
                        <label className={styles.field}>
                          Description
                          <input
                            className={styles.fieldInput}
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                          />
                        </label>
                        <TemplateStepsEditor steps={editSteps} onChange={setEditSteps} />
                        <div className={styles.manageActions}>
                          <button className="btnGold" type="submit" disabled={manage.busy(t.id)}>
                            Sauver
                          </button>
                          <GhostButton onClick={() => manage.setEditingId(null)}>
                            Annuler
                          </GhostButton>
                        </div>
                      </form>
                    ) : (
                      <>
                        <strong>{asDisplayName(t.name, t.id)}</strong>
                        {asText(t.type, "") ? <span className="muted"> — {asText(t.type)}</span> : null}
                        <span className="muted">
                          {" "}
                          · {listed.length} étape{listed.length === 1 ? "" : "s"}
                        </span>
                        {listed.length > 0 ? (
                          <ol className={styles.stepPreview}>
                            {listed.map((s) => (
                              <li key={s.key}>
                                {s.title}
                                {s.photoRequired ? <span className="muted"> (photo)</span> : null}
                                {s.text ? <div className={styles.wrap}>{s.text}</div> : null}
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p className="muted">Pas d’étapes — clique Modifier pour en ajouter.</p>
                        )}
                        <RowActions>
                          <GhostButton
                            onClick={() => {
                              manage.setCreating(false);
                              manage.setEditingId(t.id);
                              setEditName(asText(t.name, ""));
                              setEditType(asText(t.type, "opening") === "—" ? "opening" : asText(t.type, "opening"));
                              setEditDescription(
                                asText(t.procedureDescription, "") === "—" ? "" : asText(t.procedureDescription, "")
                              );
                              setEditSteps(draftsFromTemplate(t.steps));
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
                );
              })}
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
                              <GhostButton onClick={() => void manage.setEditingId(null)}>Annuler</GhostButton>
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
