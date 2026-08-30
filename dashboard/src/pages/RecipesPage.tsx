import { useOutletContext } from "react-router-dom";
import { useOrgCollection } from "../hooks/useOrgCollection";
import { formatDateTime } from "../lib/dates";
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
  const rows = [...recipes.docs].sort((a, b) =>
    asText(a.name).localeCompare(asText(b.name), "fr")
  );

  return (
    <PageShell errors={[recipes.error]}>
      <h1 className={styles.h1}>Recettes</h1>
      <p className={styles.meta}>Recettes et étapes saisies sur l’iPad.</p>
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
                  <strong>{asText(r.name)}</strong>
                  {r.isActive === false ? (
                    <span className={styles.tagMuted}>Inactive</span>
                  ) : (
                    <span className={styles.tagOk}>Active</span>
                  )}
                </div>
                {asText(r.recipeDescription, "") ? (
                  <p className={styles.wrap}>{asText(r.recipeDescription)}</p>
                ) : null}
                <p className={styles.meta}>
                  {asText(r.createdBy, "")
                    ? `Créée par ${asText(r.createdBy)} · `
                    : null}
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
                          {s.isRequired === false ? (
                            <span className="muted"> (optionnel)</span>
                          ) : null}
                          {asText(s.stepDescription, "") ? (
                            <div className={styles.wrap}>{asText(s.stepDescription)}</div>
                          ) : null}
                          {asNumber(s.temperature) != null
                            ? ` ${asNumber(s.temperature)} °C`
                            : ""}
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
              </article>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
