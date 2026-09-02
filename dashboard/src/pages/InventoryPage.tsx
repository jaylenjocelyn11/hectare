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
import { inventoryCategoryLabel } from "../lib/labels";
import { createOrgDoc, patchOrgDoc, writeMessage } from "../lib/orgWrite";
import { asNumber, asText } from "../lib/text";
import type { OrgContext } from "./orgContext";
import { PageShell } from "./PageShell";
import styles from "./DashboardPage.module.css";

type InventoryItem = {
  name?: string;
  itemDescription?: string;
  category?: string;
  quantity?: number;
  unit?: string;
  minStockLevel?: number;
  location?: string;
  supplier?: string;
  expiryDate?: unknown;
  isActive?: boolean;
};

function isLowStock(item: InventoryItem): boolean {
  const qty = asNumber(item.quantity);
  const min = asNumber(item.minStockLevel);
  if (qty == null || min == null) return false;
  return qty <= min;
}

function isExpired(item: InventoryItem): boolean {
  const d = asDate(item.expiryDate);
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

export function InventoryPage() {
  const { organizationId } = useOutletContext<OrgContext>();
  const inventory = useOrgCollection<InventoryItem>(organizationId, "inventory");
  const manage = useManageState();
  const [name, setName] = useState("");
  const [qty, setQty] = useState("0");
  const [unit, setUnit] = useState("u");
  const [category, setCategory] = useState("ingredients");
  const [minStock, setMinStock] = useState("");
  const [location, setLocation] = useState("");
  const [editQty, setEditQty] = useState("");
  const [editName, setEditName] = useState("");
  const [editMin, setEditMin] = useState("");

  const rows = [...inventory.docs].sort((a, b) =>
    asText(a.name).localeCompare(asText(b.name), "fr")
  );
  const low = rows.filter(isLowStock).length;

  async function addItem(e: FormEvent) {
    e.preventDefault();
    if (!organizationId || !name.trim()) return;
    manage.setBusyId("create");
    try {
      await createOrgDoc(organizationId, "inventory", {
        name: name.trim(),
        category,
        quantity: Number(qty) || 0,
        unit: unit.trim() || "u",
        minStockLevel: minStock === "" ? null : Number(minStock),
        location: location.trim(),
        isActive: true,
        createdBy: "Tableau de bord",
      });
      setName("");
      setQty("0");
      setLocation("");
      setMinStock("");
      manage.setCreating(false);
      manage.setOk("Article ajouté à l’inventaire.");
    } catch (err) {
      manage.setError(writeMessage(err));
    } finally {
      manage.setBusyId(null);
    }
  }

  async function saveItem(id: string) {
    if (!organizationId) return;
    manage.setBusyId(id);
    try {
      await patchOrgDoc(organizationId, "inventory", id, {
        name: editName.trim(),
        quantity: Number(editQty) || 0,
        minStockLevel: editMin === "" ? null : Number(editMin),
      });
      manage.setEditingId(null);
      manage.setOk("Article mis à jour.");
    } catch (err) {
      manage.setError(writeMessage(err));
    } finally {
      manage.setBusyId(null);
    }
  }

  return (
    <PageShell errors={[inventory.error]}>
      <h1 className={styles.h1}>Inventaire</h1>
      <p className={styles.meta}>
        Stocks saisis sur l’iPad. {low} article{low === 1 ? "" : "s"} sous le seuil.
      </p>
      <GhostButton onClick={() => manage.setCreating((v) => !v)}>
        {manage.creating ? "Fermer" : "Ajouter un article"}
      </GhostButton>
      <ManageNotice error={manage.error} ok={manage.ok} />
      {manage.creating ? (
        <form className={styles.manageForm} onSubmit={addItem}>
          <label className={styles.field}>
            Nom
            <input className={styles.fieldInput} value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className={styles.field}>
            Catégorie
            <select className={styles.fieldInput} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="ingredients">Ingrédients</option>
              <option value="packaging">Emballages</option>
              <option value="cleaning">Nettoyage</option>
              <option value="equipment">Équipement</option>
              <option value="other">Autre</option>
            </select>
          </label>
          <label className={styles.field}>
            Quantité
            <input className={styles.fieldInput} value={qty} onChange={(e) => setQty(e.target.value)} />
          </label>
          <label className={styles.field}>
            Unité
            <input className={styles.fieldInput} value={unit} onChange={(e) => setUnit(e.target.value)} />
          </label>
          <label className={styles.field}>
            Seuil min.
            <input className={styles.fieldInput} value={minStock} onChange={(e) => setMinStock(e.target.value)} />
          </label>
          <label className={styles.field}>
            Lieu
            <input className={styles.fieldInput} value={location} onChange={(e) => setLocation(e.target.value)} />
          </label>
          <div className={styles.manageActions}>
            <button className="btnGold" type="submit" disabled={manage.busyId === "create"}>
              Ajouter
            </button>
          </div>
        </form>
      ) : null}
      {inventory.loading ? <p className="muted">Chargement…</p> : null}
      {rows.length === 0 ? (
        <p className="muted">Aucun article d’inventaire.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Article</th>
                <th>Catégorie</th>
                <th>Quantité</th>
                <th>Lieu</th>
                <th>Fournisseur</th>
                <th>Péremption</th>
                <th>Statut</th>
                <th>Gestion</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id}>
                  <td className={styles.wrap}>
                    {manage.editingId === item.id ? (
                      <input className={styles.fieldInput} value={editName} onChange={(e) => setEditName(e.target.value)} />
                    ) : (
                      <>
                        {asText(item.name)}
                        {asText(item.itemDescription, "") ? (
                          <div className="muted">{asText(item.itemDescription)}</div>
                        ) : null}
                      </>
                    )}
                  </td>
                  <td>{inventoryCategoryLabel(item.category)}</td>
                  <td>
                    {manage.editingId === item.id ? (
                      <>
                        <input className={styles.fieldInput} value={editQty} onChange={(e) => setEditQty(e.target.value)} />
                        <input
                          className={styles.fieldInput}
                          placeholder="min."
                          value={editMin}
                          onChange={(e) => setEditMin(e.target.value)}
                        />
                      </>
                    ) : (
                      <>
                        {asNumber(item.quantity) ?? "—"} {asText(item.unit, "")}
                        {asNumber(item.minStockLevel) != null ? ` (min. ${asNumber(item.minStockLevel)})` : ""}
                      </>
                    )}
                  </td>
                  <td>{asText(item.location)}</td>
                  <td>{asText(item.supplier)}</td>
                  <td>{formatDateTime(item.expiryDate)}</td>
                  <td>
                    {item.isActive === false ? (
                      <span className={styles.tagMuted}>Inactif</span>
                    ) : isExpired(item) ? (
                      <span className={styles.tagBad}>Périmé</span>
                    ) : isLowStock(item) ? (
                      <span className={styles.tagWarn}>Stock bas</span>
                    ) : (
                      <span className={styles.tagOk}>OK</span>
                    )}
                  </td>
                  <td>
                    {organizationId ? (
                      <RowActions>
                        {manage.editingId === item.id ? (
                          <>
                            <GhostButton onClick={() => void saveItem(item.id)}>Sauver</GhostButton>
                            <GhostButton onClick={() => manage.setEditingId(null)}>Annuler</GhostButton>
                          </>
                        ) : (
                          <GhostButton
                            onClick={() => {
                              manage.setEditingId(item.id);
                              setEditName(asText(item.name, ""));
                              setEditQty(String(asNumber(item.quantity) ?? 0));
                              setEditMin(asNumber(item.minStockLevel) == null ? "" : String(asNumber(item.minStockLevel)));
                            }}
                          >
                            Modifier
                          </GhostButton>
                        )}
                        <DeleteControl
                          organizationId={organizationId}
                          collectionName="inventory"
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
    </PageShell>
  );
}
