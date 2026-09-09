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
import {
  articleKindLabel,
  exportLossesExcel,
  exportLossesPdf,
  money,
  quantityLabel,
  type LossExportRow,
} from "../lib/lossExport";
import { createOrgDoc, patchOrgDoc, writeMessage } from "../lib/orgWrite";
import { asNumber, asText } from "../lib/text";
import type { OrgContext } from "./orgContext";
import { PageShell } from "./PageShell";
import styles from "./DashboardPage.module.css";

type CatalogArticle = {
  name?: string;
  kind?: string;
  cost?: number;
  unit?: string;
  isActive?: boolean;
};

type InventoryLoss = LossExportRow;

export function LossesPage() {
  const { organizationId, dashboard, slug } = useOutletContext<OrgContext>();
  const articles = useOrgCollection<CatalogArticle>(organizationId, "inventoryArticles");
  const losses = useOrgCollection<InventoryLoss>(organizationId, "inventoryLosses");
  const manage = useManageState();
  const [name, setName] = useState("");
  const [kind, setKind] = useState("complete");
  const [cost, setCost] = useState("");
  const [unit, setUnit] = useState("u");
  const [editName, setEditName] = useState("");
  const [editKind, setEditKind] = useState("complete");
  const [editCost, setEditCost] = useState("");
  const [editUnit, setEditUnit] = useState("u");
  const orgLabel = dashboard?.name || slug || "Organisation";

  const articleRows = [...articles.docs].sort((a, b) =>
    asText(a.name).localeCompare(asText(b.name), "fr")
  );
  const orderedLosses = [...losses.docs].sort((a, b) => {
    const ta = asDate(a.createdAt)?.getTime() ?? 0;
    const tb = asDate(b.createdAt)?.getTime() ?? 0;
    return tb - ta;
  });
  const totalCost = orderedLosses.reduce((sum, row) => sum + (asNumber(row.totalCost) ?? 0), 0);

  async function addArticle(e: FormEvent) {
    e.preventDefault();
    if (!organizationId || !name.trim()) return;
    const parsedCost = Number(cost.replace(",", "."));
    if (!Number.isFinite(parsedCost) || parsedCost < 0) {
      manage.setError("Indique un coût valide.");
      return;
    }
    manage.setBusyId("create");
    try {
      await createOrgDoc(organizationId, "inventoryArticles", {
        name: name.trim(),
        kind: kind === "raw" ? "raw" : "complete",
        cost: parsedCost,
        unit: unit.trim() || "u",
        isActive: true,
        createdBy: "Tableau de bord",
      });
      setName("");
      setCost("");
      setUnit("u");
      manage.setCreating(false);
      manage.setOk("Article tarifé ajouté.");
    } catch (err) {
      manage.setError(writeMessage(err));
    } finally {
      manage.setBusyId(null);
    }
  }

  async function saveArticle(id: string) {
    if (!organizationId) return;
    const parsedCost = Number(editCost.replace(",", "."));
    if (!Number.isFinite(parsedCost) || parsedCost < 0) {
      manage.setError("Indique un coût valide.");
      return;
    }
    manage.setBusyId(id);
    try {
      await patchOrgDoc(organizationId, "inventoryArticles", id, {
        name: editName.trim(),
        kind: editKind === "raw" ? "raw" : "complete",
        cost: parsedCost,
        unit: editUnit.trim() || "u",
      });
      manage.setEditingId(null);
      manage.setOk("Article mis à jour.");
    } catch (err) {
      manage.setError(writeMessage(err));
    } finally {
      manage.setBusyId(null);
    }
  }

  async function handlePdf() {
    manage.setBusyId("pdf");
    try {
      await exportLossesPdf(orderedLosses, orgLabel);
      manage.setOk("PDF téléchargé.");
    } catch (err) {
      manage.setError(writeMessage(err));
    } finally {
      manage.setBusyId(null);
    }
  }

  return (
    <PageShell errors={[articles.error, losses.error]}>
      <h1 className={styles.h1}>Pertes</h1>
      <p className={styles.meta}>
        Catalogue d’articles complets et bruts (avec coût) pour les saisies de pertes sur iPad.
      </p>

      <div className={styles.kpis}>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Articles tarifés</span>
          <span className={styles.kpiValue}>{articleRows.length}</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Pertes</span>
          <span className={styles.kpiValue}>{orderedLosses.length}</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Coût total</span>
          <span className={styles.kpiValue}>{money(totalCost)}</span>
        </div>
      </div>

      <h2 className={styles.h2}>Articles</h2>
      <GhostButton onClick={() => manage.setCreating((v) => !v)}>
        {manage.creating ? "Fermer" : "Ajouter un article"}
      </GhostButton>
      <ManageNotice error={manage.error} ok={manage.ok} />
      {manage.creating ? (
        <form className={styles.manageForm} onSubmit={addArticle}>
          <label className={styles.field}>
            Nom
            <input className={styles.fieldInput} value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className={styles.field}>
            Type
            <select className={styles.fieldInput} value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="complete">Article complet</option>
              <option value="raw">Article brut</option>
            </select>
          </label>
          <label className={styles.field}>
            Coût
            <input className={styles.fieldInput} value={cost} onChange={(e) => setCost(e.target.value)} required />
          </label>
          <label className={styles.field}>
            Unité
            <input className={styles.fieldInput} value={unit} onChange={(e) => setUnit(e.target.value)} />
          </label>
          <div className={styles.manageActions}>
            <button className="btnGold" type="submit" disabled={manage.busyId === "create"}>
              Ajouter
            </button>
          </div>
        </form>
      ) : null}
      {articles.loading ? <p className="muted">Chargement…</p> : null}
      {articleRows.length === 0 ? (
        <p className="muted">Aucun article tarifé. Ajoutez des articles complets et bruts pour que l’équipe puisse saisir des pertes.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Article</th>
                <th>Type</th>
                <th>Coût</th>
                <th>Unité</th>
                <th>Gestion</th>
              </tr>
            </thead>
            <tbody>
              {articleRows.map((item) => (
                <tr key={item.id}>
                  <td className={styles.wrap}>
                    {manage.editingId === item.id ? (
                      <input className={styles.fieldInput} value={editName} onChange={(e) => setEditName(e.target.value)} />
                    ) : (
                      asText(item.name)
                    )}
                  </td>
                  <td>
                    {manage.editingId === item.id ? (
                      <select className={styles.fieldInput} value={editKind} onChange={(e) => setEditKind(e.target.value)}>
                        <option value="complete">Article complet</option>
                        <option value="raw">Article brut</option>
                      </select>
                    ) : (
                      articleKindLabel(item.kind)
                    )}
                  </td>
                  <td>
                    {manage.editingId === item.id ? (
                      <input className={styles.fieldInput} value={editCost} onChange={(e) => setEditCost(e.target.value)} />
                    ) : (
                      money(item.cost)
                    )}
                  </td>
                  <td>
                    {manage.editingId === item.id ? (
                      <input className={styles.fieldInput} value={editUnit} onChange={(e) => setEditUnit(e.target.value)} />
                    ) : (
                      asText(item.unit, "u")
                    )}
                  </td>
                  <td>
                    {organizationId ? (
                      <RowActions>
                        {manage.editingId === item.id ? (
                          <>
                            <GhostButton onClick={() => void saveArticle(item.id)}>Sauver</GhostButton>
                            <GhostButton onClick={() => manage.setEditingId(null)}>Annuler</GhostButton>
                          </>
                        ) : (
                          <GhostButton
                            onClick={() => {
                              manage.setEditingId(item.id);
                              setEditName(asText(item.name, ""));
                              setEditKind(asText(item.kind, "complete") === "raw" ? "raw" : "complete");
                              setEditCost(String(asNumber(item.cost) ?? 0));
                              setEditUnit(asText(item.unit, "u"));
                            }}
                          >
                            Modifier
                          </GhostButton>
                        )}
                        <DeleteControl
                          organizationId={organizationId}
                          collectionName="inventoryArticles"
                          id={item.id}
                          label="cet article"
                          busy={manage.busy(item.id)}
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

      <h2 className={styles.h2}>Pertes enregistrées</h2>
      <div className={styles.manageActions}>
        <GhostButton onClick={() => exportLossesExcel(orderedLosses, orgLabel)} disabled={orderedLosses.length === 0}>
          Exporter Excel
        </GhostButton>
        <GhostButton onClick={() => void handlePdf()} disabled={orderedLosses.length === 0 || manage.busyId === "pdf"}>
          {manage.busyId === "pdf" ? "PDF…" : "Exporter PDF"}
        </GhostButton>
      </div>
      {losses.loading ? <p className="muted">Chargement…</p> : null}
      {orderedLosses.length === 0 ? (
        <p className="muted">Aucune perte saisie sur iPad pour le moment.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Article</th>
                <th>Type</th>
                <th>Quantité</th>
                <th>Coût unitaire</th>
                <th>Total</th>
                <th>Motif</th>
                <th>Saisi par</th>
                <th>Gestion</th>
              </tr>
            </thead>
            <tbody>
              {orderedLosses.map((row) => (
                <tr key={row.id}>
                  <td>{formatDateTime(row.createdAt)}</td>
                  <td className={styles.wrap}>{asText(row.articleName)}</td>
                  <td>{articleKindLabel(row.articleKind)}</td>
                  <td>{quantityLabel(row)}</td>
                  <td>{money(row.costPerUnit)}</td>
                  <td>{money(row.totalCost)}</td>
                  <td className={styles.wrap}>{asText(row.reason, "") || "—"}</td>
                  <td>{asText(row.recordedBy)}</td>
                  <td>
                    {organizationId ? (
                      <RowActions>
                        <DeleteControl
                          organizationId={organizationId}
                          collectionName="inventoryLosses"
                          id={row.id}
                          label="cette perte"
                          busy={manage.busy(row.id)}
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
    </PageShell>
  );
}
