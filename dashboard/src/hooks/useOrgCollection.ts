import { useEffect, useState } from "react";
import { collection, onSnapshot, type DocumentData } from "firebase/firestore";
import { getFirebaseFirestore } from "../lib/firebase";

export type OrgDoc<T> = T & { id: string };

/**
 * Écoute une « tiroir » (collection) sous organizations/{orgId}.
 * Dès qu’un iPad écrit dans Firestore, cette liste se met à jour toute seule.
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
    const db = getFirebaseFirestore();
    const ref = collection(db, "organizations", organizationId, collectionName);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        setError(null);
        setLoading(false);
        setDocs(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }))
        );
      },
      (err) => {
        setLoading(false);
        setError(err.message);
        setDocs([]);
      }
    );

    return () => unsub();
  }, [organizationId, collectionName]);

  return { docs, loading, error };
}
