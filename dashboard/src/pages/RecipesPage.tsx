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
import { formatDateTime } from "../lib/dates";
import { createOrgDoc, patchOrgDoc, writeMessage } from "../lib/orgWrite";
import { asNumber, asText } from "../lib/text";
import type { OrgContext } from "./orgContext";
import { PageShell } from "./PageShell";
import styles from "./DashboardPage.module.css";

type RecipeStep = {
  title?: string;
  stepDescription?: string;
  order?: number;
  estimatedDuration?: number;
  temperature?: number;
  isRequired?: boolean;
};

type Recipe = {
  name?: string;
  recipeDescription?: string;
  createdBy?: string;
  isActive?: boolean;
  createdAt?: unknown;
  steps?: RecipeStep[];
};

function sortedSteps(steps: unknown): RecipeStep[] {
  if (!Array.isArray(steps)) return [];
  return [...steps]
    .filter((s): s is RecipeStep => !!s && typeof s === "object")
    .sort((a, b) => (asNumber(a.order) ?? 0) - (asNumber(b.order) ?? 0));
}

export function RecipesPage() {
  const { organizationId } = useOutletContext<OrgContext>();
  const recipes = useOrgCollection<Recipe>(organizationId, "recipes");
  const manage = useManageState();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editActive, setEditActive] = useState(true);

  const rows = [...recipes.docs].sort((a, b) =>
    asText(a.name).localeCompare(asText(b.name), "fr")
  );

  async function addRecipe(e: FormEvent) {
    e.preventDefault();
    if (!organizationId || !name.trim()) return;
    manage.setBusyId("create");
    try {
      await createOrgDoc(organizationId, "recipes", {
        name: name.trim(),
        recipeDescription: description.trim(),
        createdBy: "Tableau de bord",
        isActive: true,
        steps: [],
      });
      setName("");
      setDescription("");
      manage.setCreating(false);
      manage.setOk("Recette créée.");
    } catch (err) {
      manage.setError(writeMessage(err));
    } finally {
      manage.setBusyId(null);
    }
  }

  async function saveRecipe(id: string) {
    if (!organizationId) return;
    manage.setBusyId(id);
    try {
      await patchOrgDoc(organizationId, "recipes", id, {
        name: editName.trim(),
        recipeDescription: editDescription.trim(),
        isActive: editActive,
      });
      manage.setEditingId(null);
      manage.setOk("Recette mise à jour.");
    } catch (err) {
      manage.setError(writeMessage(err));
    } finally {
      manage.setBusyId(null);
    }
  }

  return (
    <PageShell errors={[recipes.error]}>
      <h1 className={styles.h1}>Recettes</h1>
      <p className={styles.meta}>Recettes et étapes saisies sur l’iPad.</p>
      <GhostButton onClick={() => manage.setCreating((v) => !v)}>
        {manage.creating ? "Fermer" : "Nouvelle recette"}
      </GhostButton>
      <ManageNotice error={manage.error} ok={manage.ok} />
      {manage.creating ? (
        <form className={styles.manageForm} onSubmit={addRecipe}>
          <label className={styles.field}>
            Nom
            <input className={styles.fieldInput} value={name} onChange={(e) => setName(e.target.value)} required />
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
      {recipes.loading ? <p className="muted">Chargement…</p> : null}
      {rows.length === 0 ? (
        <p className="muted">Aucune recette pour l’instant.</p>
      ) : (
        <div className={styles.stack}>
          {rows.map((r) => {
            const steps = sortedSteps(r.steps);
            return (
              <article key={r.id} className={styles.card}>
                <div className={styles.cardHead}>
                  {manage.editingId === r.id ? (
                    <input className={styles.fieldInput} value={editName} onChange={(e) => setEditName(e.target.value)} />
                  ) : (
                    <strong>{asText(r.name)}</strong>
                  )}
                  {r.isActive === false ? (
                    <span className={styles.tagMuted}>Inactive</span>
                  ) : (
                    <span className={styles.tagOk}>Active</span>
                  )}
                </div>
                {manage.editingId === r.id ? (
                  <>
                    <label className={styles.field}>
                      Description
                      <input
                        className={styles.fieldInput}
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                      />
                    </label>
                    <label className={styles.checkInline}>
                      <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
                      Active
                    </label>
                  </>
                ) : (
                  <>
                    {asText(r.recipeDescription, "") ? (
                      <p className={styles.wrap}>{asText(r.recipeDescription)}</p>
                    ) : null}
                    <p className={styles.meta}>
                      {asText(r.createdBy, "") ? `Créée par ${asText(r.createdBy)} · ` : null}
                      {formatDateTime(r.createdAt)} · {steps.length} étape
                      {steps.length === 1 ? "" : "s"}
                    </p>
                    {steps.length > 0 ? (
                      <details>
                        <summary>Voir les étapes</summary>
                        <ol className={styles.list}>
                          {steps.map((s, i) => (
                            <li key={`${r.id}-step-${i}`}>
                              <strong>{asText(s.title)}</strong>
                              {s.isRequired === false ? <span className="muted"> (optionnel)</span> : null}
                              {asText(s.stepDescription, "") ? (
                                <div className={styles.wrap}>{asText(s.stepDescription)}</div>
                              ) : null}
                              {asNumber(s.temperature) != null ? ` ${asNumber(s.temperature)} °C` : ""}
                              {asNumber(s.estimatedDuration) != null
                                ? ` · ${asNumber(s.estimatedDuration)} min`
                                : ""}
                            </li>
                          ))}
                        </ol>
                      </details>
                    ) : (
                      <p className="muted">Pas d’étapes.</p>
                    )}
                  </>
                )}
                {organizationId ? (
                  <RowActions>
                    {manage.editingId === r.id ? (
                      <>
                        <GhostButton onClick={() => void saveRecipe(r.id)}>Sauver</GhostButton>
                        <GhostButton onClick={() => manage.setEditingId(null)}>Annuler</GhostButton>
                      </>
                    ) : (
                      <GhostButton
                        onClick={() => {
                          manage.setEditingId(r.id);
                          setEditName(asText(r.name, ""));
                          setEditDescription(asText(r.recipeDescription, "") === "—" ? "" : asText(r.recipeDescription, ""));
                          setEditActive(r.isActive !== false);
                        }}
                      >
                        Modifier
                      </GhostButton>
                    )}
                    <DeleteControl
                      organizationId={organizationId}
                      collectionName="recipes"
                      id={r.id}
                      label="cette recette"
                      busy={manage.busy(r.id)}
                      onBusy={manage.setBusyId}
                      onError={manage.setError}
                    />
                  </RowActions>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
