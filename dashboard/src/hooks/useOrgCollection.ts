import { useEffect, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  query,
  type DocumentData,
} from "firebase/firestore";
import { getFirebaseFirestore } from "../lib/firebase";

export type OrgDoc<T> = T & { id: string; linkedId?: string };

/** Listes courtes (équipements, utilisateurs…) : on charge large pour pouvoir retrouver les noms. */
const SMALL_COLLECTIONS = new Set([
  "equipment",
  "equipments",
  "users",
  "procedureTemplates",
  "temperatureSchedules",
  "recipes",
  "inventory",
  "employeeSchedules",
  "locationCategories",
]);

const HEAVY_KEYS = new Set([
  "photos",
  "signatureData",
  "signature",
  "imageData",
  "photo",
  "pin",
  "password",
  "fcmTokens",
  "correctiveActions",
]);

function slim(data: DocumentData): DocumentData {
  const out: DocumentData = {};
  for (const [key, value] of Object.entries(data)) {
    if (HEAVY_KEYS.has(key)) continue;
    if (key === "runSteps" && Array.isArray(value)) {
      out[key] = value.map((step) => {
        if (!step || typeof step !== "object") return step;
        const copy = { ...(step as DocumentData) };
        delete copy.photos;
        delete copy.photo;
        return copy;
      });
      continue;
    }
    out[key] = value;
  }
  return out;
}

/**
 * Écoute une collection sous organizations/{orgId}.
 * On ignore photos/signatures pour ne pas faire planter le navigateur.
 */
export function useOrgCollection<T extends DocumentData>(
  organizationId: string | null,
  collectionName: string
): { docs: OrgDoc<T>[]; loading: boolean; error: string | null } {
  const [docs, setDocs] = useState<OrgDoc<T>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) {
      setDocs([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    let unsub = () => {};
    try {
      const db = getFirebaseFirestore();
      const cap = SMALL_COLLECTIONS.has(collectionName) ? 500 : 80;
      const ref = query(
        collection(db, "organizations", organizationId, collectionName),
        limit(cap)
      );

      unsub = onSnapshot(
        ref,
        (snap) => {
          setError(null);
          setLoading(false);
          setDocs(
            snap.docs.map((d) => {
              const data = slim(d.data()) as T;
              const dataId = (data as { id?: unknown }).id;
              return {
                ...data,
                id: d.id,
                linkedId: typeof dataId === "string" && dataId !== d.id ? dataId : undefined,
              };
            })
          );
        },
        (err) => {
          setLoading(false);
          setError(err.message);
          setDocs([]);
        }
      );
    } catch (e) {
      setLoading(false);
      setError(e instanceof Error ? e.message : "Organisation invalide");
      setDocs([]);
    }

    return () => unsub();
  }, [organizationId, collectionName]);

  return { docs, loading, error };
}
