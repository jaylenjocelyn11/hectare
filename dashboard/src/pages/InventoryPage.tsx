import { useOutletContext } from "react-router-dom";
import { useOrgCollection } from "../hooks/useOrgCollection";
import { asDate, formatDateTime } from "../lib/dates";
import { inventoryCategoryLabel } from "../lib/labels";
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
  const rows = [...inventory.docs].sort((a, b) =>
    asText(a.name).localeCompare(asText(b.name), "fr")
  );
  const low = rows.filter(isLowStock).length;

  return (
    <PageShell errors={[inventory.error]}>
      <h1 className={styles.h1}>Inventaire</h1>
      <p className={styles.meta}>Stocks saisis sur l’iPad. {low} article{low === 1 ? "" : "s"} sous le seuil.</p>
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
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id}>
                  <td className={styles.wrap}>
                    {asText(item.name)}
                    {asText(item.itemDescription, "") ? (
                      <div className="muted">{asText(item.itemDescription)}</div>
                    ) : null}
                  </td>
                  <td>{inventoryCategoryLabel(item.category)}</td>
                  <td>
                    {asNumber(item.quantity) ?? "—"} {asText(item.unit, "")}
                    {asNumber(item.minStockLevel) != null
                      ? ` (min. ${asNumber(item.minStockLevel)})`
                      : ""}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
