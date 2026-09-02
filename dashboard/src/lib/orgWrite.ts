import { deleteDoc, doc, serverTimestamp, setDoc, type DocumentData } from "firebase/firestore";
import { getFirebaseFirestore } from "./firebase";

export function newOrgId(): string {
  return crypto.randomUUID().toUpperCase();
}

export function orgDoc(organizationId: string, collectionName: string, id: string) {
  return doc(getFirebaseFirestore(), "organizations", organizationId, collectionName, id);
}

export async function createOrgDoc(
  organizationId: string,
  collectionName: string,
  data: DocumentData,
  id = newOrgId()
): Promise<string> {
  await setDoc(orgDoc(organizationId, collectionName, id), {
    ...data,
    id,
    createdAt: data.createdAt ?? serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return id;
}

export async function patchOrgDoc(
  organizationId: string,
  collectionName: string,
  id: string,
  data: DocumentData
): Promise<void> {
  await setDoc(
    orgDoc(organizationId, collectionName, id),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function removeOrgDoc(
  organizationId: string,
  collectionName: string,
  id: string
): Promise<void> {
  await deleteDoc(orgDoc(organizationId, collectionName, id));
}

/** L’iPad écrit `equipment` ; une ancienne collection `equipments` existe encore. */
export async function removeEquipment(organizationId: string, id: string): Promise<void> {
  const results = await Promise.allSettled([
    removeOrgDoc(organizationId, "equipment", id),
    removeOrgDoc(organizationId, "equipments", id),
  ]);
  if (results.every((r) => r.status === "rejected")) {
    const first = results[0];
    throw first.status === "rejected" ? first.reason : new Error("Suppression impossible");
  }
}

export async function patchEquipment(
  organizationId: string,
  id: string,
  data: DocumentData
): Promise<void> {
  try {
    await patchOrgDoc(organizationId, "equipment", id, data);
  } catch {
    await patchOrgDoc(organizationId, "equipments", id, data);
  }
}

export function writeMessage(err: unknown): string {
  if (err && typeof err === "object" && "code" in err && String((err as { code: string }).code) === "permission-denied") {
    return "Firestore refuse l’écriture. Vérifie les règles de la base hectarecafe.";
  }
  return err instanceof Error ? err.message : "Enregistrement impossible";
}
