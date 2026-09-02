import { FormEvent, useState } from "react";
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
import { createOrgDoc, patchOrgDoc, writeMessage } from "../lib/orgWrite";
import { asNumber, asText, namedFromDocs } from "../lib/text";
import type { OrgContext } from "./orgContext";
import styles from "./DashboardPage.module.css";

type TempReading = {
  temperature?: number;
  timestamp?: unknown;
  date?: unknown;
  equipmentId?: string;
  isOutOfRange?: boolean;
  timePeriod?: string;
  isCorrectiveActionCompleted?: boolean;
};

function rangeFlag(
  equipmentId: string,
  temperature: number,
  list: { id: string; minTemperature?: unknown; maxTemperature?: unknown }[]
) {
  const eq = list.find((e) => e.id === equipmentId);
  const min = asNumber(eq?.minTemperature);
  const max = asNumber(eq?.maxTemperature);
  if (min == null || max == null) return false;
  return temperature < min || temperature > max;
}

export function TemperaturesPage() {
  const { organizationId, resolving, error: orgError } = useOutletContext<OrgContext>();
  const equipment = useEquipment(organizationId);
  const readings = useOrgCollection<TempReading>(organizationId, "tempReadings");
  const [onlyOutOfRange, setOnlyOutOfRange] = useState(false);
  const manage = useManageState();
  const [temp, setTemp] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [period, setPeriod] = useState("AM");
  const [editTemp, setEditTemp] = useState("");
  const [editPeriod, setEditPeriod] = useState("AM");
  const [editCorrective, setEditCorrective] = useState(false);

  const rows = [...readings.docs]
    .filter((r) => (onlyOutOfRange ? r.isOutOfRange : true))
    .sort((a, b) => {
      const da = asDate(a.timestamp) ?? asDate(a.date);
      const db = asDate(b.timestamp) ?? asDate(b.date);
      return (db?.getTime() ?? 0) - (da?.getTime() ?? 0);
    });

  async function addReading(e: FormEvent) {
    e.preventDefault();
    if (!organizationId) return;
    const temperature = Number(temp.replace(",", "."));
    if (!Number.isFinite(temperature) || !equipmentId) {
      manage.setError("Indique un équipement et une température.");
      return;
    }
    manage.setBusyId("create");
    manage.setError(null);
    try {
      const now = new Date();
      await createOrgDoc(organizationId, "tempReadings", {
        temperature,
        timestamp: now,
        date: now,
        equipmentId,
        timePeriod: period,
        isOutOfRange: rangeFlag(equipmentId, temperature, equipment.list),
        isCorrectiveActionCompleted: false,
      });
      setTemp("");
      manage.setOk("Relevé enregistré. Il apparaît aussi sur l’iPad.");
      manage.setCreating(false);
    } catch (err) {
      manage.setError(writeMessage(err));
    } finally {
      manage.setBusyId(null);
    }
  }

  async function saveEdit(id: string, current: TempReading) {
    if (!organizationId) return;
    const temperature = Number(editTemp.replace(",", "."));
    if (!Number.isFinite(temperature)) {
      manage.setError("Température invalide.");
      return;
    }
    manage.setBusyId(id);
    manage.setError(null);
    try {
      const eqId = typeof current.equipmentId === "string" ? current.equipmentId : "";
      await patchOrgDoc(organizationId, "tempReadings", id, {
        temperature,
        timePeriod: editPeriod,
        isOutOfRange: rangeFlag(eqId, temperature, equipment.list),
        isCorrectiveActionCompleted: editCorrective,
      });
      manage.setEditingId(null);
      manage.setOk("Relevé mis à jour.");
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
      {equipment.error || readings.error ? (
        <p className={styles.warn}>{equipment.error || readings.error}</p>
      ) : null}

      {!resolving && organizationId ? (
        <>
          <h1 className={styles.h1}>Registre des températures</h1>
          <p className={styles.meta}>
            Tous les relevés enregistrés sur l’iPad. La liste se met à jour en direct.
          </p>

          <label className={styles.filter}>
            <input
              type="checkbox"
              checked={onlyOutOfRange}
              onChange={(e) => setOnlyOutOfRange(e.target.checked)}
            />
            Afficher seulement les relevés hors plage
          </label>

          <GhostButton onClick={() => manage.setCreating((v) => !v)}>
            {manage.creating ? "Fermer" : "Ajouter un relevé"}
          </GhostButton>
          <ManageNotice error={manage.error} ok={manage.ok} />

          {manage.creating ? (
            <form className={styles.manageForm} onSubmit={addReading}>
              <label className={styles.field}>
                Équipement
                <select
                  className={styles.fieldInput}
                  value={equipmentId}
                  onChange={(e) => setEquipmentId(e.target.value)}
                  required
                >
                  <option value="">Choisir…</option>
                  {equipment.list.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {asText(eq.name)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                Température (°C)
                <input
                  className={styles.fieldInput}
                  value={temp}
                  onChange={(e) => setTemp(e.target.value)}
                  inputMode="decimal"
                  required
                />
              </label>
              <label className={styles.field}>
                Période
                <select className={styles.fieldInput} value={period} onChange={(e) => setPeriod(e.target.value)}>
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </label>
              <div className={styles.manageActions}>
                <button className="btnGold" type="submit" disabled={manage.busyId === "create"}>
                  Enregistrer
                </button>
              </div>
            </form>
          ) : null}

          {readings.loading ? <p className="muted">Chargement…</p> : null}

          {rows.length === 0 ? (
            <p className="muted">Aucun relevé à afficher.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Quand</th>
                    <th>Équipement</th>
                    <th>Température</th>
                    <th>AM / PM</th>
                    <th>Statut</th>
                    <th>Action corrective</th>
                    <th>Gestion</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{formatDateTime(r.timestamp ?? r.date)}</td>
                      <td>{namedFromDocs(equipment.lookup, r.equipmentId, "—")}</td>
                      <td>
                        {manage.editingId === r.id ? (
                          <input
                            className={styles.fieldInput}
                            value={editTemp}
                            onChange={(e) => setEditTemp(e.target.value)}
                          />
                        ) : typeof r.temperature === "number" ? (
                          `${r.temperature} °C`
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {manage.editingId === r.id ? (
                          <select
                            className={styles.fieldInput}
                            value={editPeriod}
                            onChange={(e) => setEditPeriod(e.target.value)}
                          >
                            <option value="AM">AM</option>
                            <option value="PM">PM</option>
                          </select>
                        ) : (
                          asText(r.timePeriod)
                        )}
                      </td>
                      <td>
                        {r.isOutOfRange ? (
                          <span className={styles.tagBad}>Hors plage</span>
                        ) : (
                          <span className={styles.tagOk}>OK</span>
                        )}
                      </td>
                      <td>
                        {manage.editingId === r.id ? (
                          <label className={styles.checkInline}>
                            <input
                              type="checkbox"
                              checked={editCorrective}
                              onChange={(e) => setEditCorrective(e.target.checked)}
                            />
                            Faite
                          </label>
                        ) : r.isOutOfRange ? (
                          r.isCorrectiveActionCompleted ? (
                            "Faite"
                          ) : (
                            "À faire"
                          )
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <RowActions>
                          {manage.editingId === r.id ? (
                            <>
                              <GhostButton disabled={manage.busy(r.id)} onClick={() => void saveEdit(r.id, r)}>
                                Sauver
                              </GhostButton>
                              <GhostButton onClick={() => manage.setEditingId(null)}>Annuler</GhostButton>
                            </>
                          ) : (
                            <GhostButton
                              onClick={() => {
                                manage.setEditingId(r.id);
                                setEditTemp(String(r.temperature ?? ""));
                                const p = asText(r.timePeriod, "AM");
                                setEditPeriod(p === "—" ? "AM" : p);
                                setEditCorrective(!!r.isCorrectiveActionCompleted);
                              }}
                            >
                              Modifier
                            </GhostButton>
                          )}
                          <DeleteControl
                            organizationId={organizationId}
                            collectionName="tempReadings"
                            id={r.id}
                            label="ce relevé"
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
