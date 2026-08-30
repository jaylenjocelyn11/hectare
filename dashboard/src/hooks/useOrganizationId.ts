import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseFirestore } from "../lib/firebase";
import type { User } from "firebase/auth";

/**
 * Résout l’organisation du compte tableau de bord :
 * 1) document `dashboardUsers/{uid}` champ `organizationId`
 * 2) sinon variable d’environnement `VITE_DEV_ORG_ID` (dev uniquement)
 */
export function useOrganizationId(user: User | null): {
  organizationId: string | null;
  resolving: boolean;
  error: string | null;
} {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setOrganizationId(null);
      setError(null);
      setResolving(false);
      return;
    }

    let cancelled = false;
    setResolving(true);
    setError(null);

    (async () => {
      try {
        const db = getFirebaseFirestore();
        const snap = await getDoc(doc(db, "dashboardUsers", user.uid));
        const fromProfile =
          snap.exists() && typeof snap.data()?.organizationId === "string"
            ? (snap.data()?.organizationId as string)
            : null;
        const fromEnv =
          (import.meta.env.VITE_DEV_ORG_ID as string | undefined)?.trim() || null;

        if (!cancelled) {
          setOrganizationId(fromProfile || fromEnv);
          if (!fromProfile && !fromEnv) {
            setError(
              "Aucune organisation liée : crée un document Firestore dashboardUsers/{tonUid} avec le champ organizationId, ou définis VITE_DEV_ORG_ID dans .env pour le développement."
            );
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Erreur Firestore");
          setOrganizationId(null);
        }
      } finally {
        if (!cancelled) {
          setResolving(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return { organizationId, resolving, error };
}
