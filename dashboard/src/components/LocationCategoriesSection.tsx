import { FormEvent, useState } from "react";
import { DeleteControl, GhostButton, RowActions } from "./ManageControls";
import { useOrgCollection } from "../hooks/useOrgCollection";
import { createOrgDoc, patchOrgDoc, writeMessage } from "../lib/orgWrite";
import { asNumber, asText } from "../lib/text";
import styles from "../pages/DashboardPage.module.css";

type LocationCategory = {
  name?: string;
  order?: number;
  isActive?: boolean;
};

type ManageLike = {
  busyId: string | null;
  setBusyId: (id: string | null) => void;
  setError: (msg: string | null) => void;
  setOk: (msg: string | null) => void;
  busy: (id: string) => boolean;
};

export function locationCategoryName(
  categories: { id: string; name?: unknown }[],
  id?: unknown
): string {
  const value = asText(id, "");
  if (!value || value === "—") return "";
  const found = categories.find((c) => c.id.toLowerCase() === value.toLowerCase());
  return found ? asText(found.name, "") : "";
}

export function LocationCategorySelect({
  categories,
  value,
  onChange,
  allowEmpty = true,
}: {
  categories: { id: string; name?: unknown }[];
  value: string;
  onChange: (next: string) => void;
  allowEmpty?: boolean;
}) {
  const list = [...categories].sort((a, b) =>
    asText(a.name).localeCompare(asText(b.name), "fr")
  );
  return (
    <select className={styles.fieldInput} value={value} onChange={(e) => onChange(e.target.value)}>
      {allowEmpty ? <option value="">Aucun lieu</option> : null}
      {list.map((c) => (
        <option key={c.id} value={c.id}>
          {asText(c.name, c.id)}
        </option>
      ))}
    </select>
  );
}

export function LocationCategoriesSection({
  organizationId,
  manage,
}: {
  organizationId: string | null;
  manage: ManageLike;
}) {
  const categories = useOrgCollection<LocationCategory>(organizationId, "locationCategories");
  const [name, setName] = useState("");
  const [editName, setEditName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  async function addCategory(e: FormEvent) {
    e.preventDefault();
    if (!organizationId || !name.trim()) return;
    manage.setBusyId("location");
    try {
      const nextOrder =
        categories.docs.reduce((max, c) => Math.max(max, asNumber(c.order) ?? 0), 0) + 1;
      await createOrgDoc(organizationId, "locationCategories", {
        name: name.trim(),
        order: nextOrder,
        isActive: true,
      });
      setName("");
      manage.setOk("Catégorie de lieu ajoutée.");
    } catch (err) {
      manage.setError(writeMessage(err));
    } finally {
      manage.setBusyId(null);
    }
  }

  const sorted = [...categories.docs]
    .filter((c) => c.isActive !== false)
    .sort((a, b) => {
      const oa = asNumber(a.order) ?? 0;
      const ob = asNumber(b.order) ?? 0;
      if (oa !== ob) return oa - ob;
      return asText(a.name).localeCompare(asText(b.name), "fr");
    });

  return (
    <>
      <h2 className={styles.h2}>Catégories de lieu</h2>
      <p className={styles.meta}>
        Lieux comme Bar ou Cuisine. Les managers les assignent aux équipements et aux procédures.
      </p>
      {organizationId ? (
        <form className={styles.manageForm} onSubmit={addCategory}>
          <label className={styles.field}>
            Nom
            <input
              className={styles.fieldInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Bar, Cuisine"
              required
            />
          </label>
          <div className={styles.manageActions}>
            <button className="btnGold" type="submit" disabled={manage.busyId === "location"}>
              Ajouter
            </button>
          </div>
        </form>
      ) : null}
      {categories.error ? <p className={styles.warn}>{categories.error}</p> : null}
      {sorted.length === 0 ? (
        <p className="muted">Aucune catégorie de lieu.</p>
      ) : (
        <ul className={styles.list}>
          {sorted.map((c) => (
            <li key={c.id}>
              {editingId === c.id ? (
                <form
                  className={styles.manageForm}
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!organizationId || !editName.trim()) return;
                    manage.setBusyId(c.id);
                    try {
                      await patchOrgDoc(organizationId, "locationCategories", c.id, {
                        name: editName.trim(),
                      });
                      setEditingId(null);
                      manage.setOk("Catégorie renommée.");
                    } catch (err) {
                      manage.setError(writeMessage(err));
                    } finally {
                      manage.setBusyId(null);
                    }
                  }}
                >
                  <label className={styles.field}>
                    Nom
                    <input
                      className={styles.fieldInput}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </label>
                  <div className={styles.manageActions}>
                    <button className="btnGold" type="submit" disabled={manage.busy(c.id)}>
                      Sauver
                    </button>
                    <GhostButton onClick={() => setEditingId(null)}>Annuler</GhostButton>
                  </div>
                </form>
              ) : (
                <>
                  <strong>{asText(c.name, c.id)}</strong>
                  {organizationId ? (
                    <RowActions>
                      <GhostButton
                        onClick={() => {
                          setEditName(asText(c.name, ""));
                          setEditingId(c.id);
                        }}
                      >
                        Renommer
                      </GhostButton>
                      <DeleteControl
                        organizationId={organizationId}
                        collectionName="locationCategories"
                        id={c.id}
                        label="cette catégorie"
                        busy={manage.busy(c.id)}
                        onBusy={manage.setBusyId}
                        onError={manage.setError}
                      />
                    </RowActions>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
