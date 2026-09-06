import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, type DocumentData } from "firebase/firestore";
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

/** L’iPad écrit parfois l’UUID en majuscules, le site en minuscules. */
function userIdVariants(id: string, linkedId?: string): string[] {
  const variants = new Set<string>();
  for (const raw of [id, linkedId]) {
    const value = (raw || "").trim();
    if (!value) continue;
    variants.add(value);
    variants.add(value.toUpperCase());
    variants.add(value.toLowerCase());
  }
  return [...variants];
}

export async function patchUser(
  organizationId: string,
  id: string,
  data: DocumentData,
  linkedId?: string
): Promise<void> {
  const ids = userIdVariants(id, linkedId);
  const existing: string[] = [];
  for (const docId of ids) {
    const snap = await getDoc(orgDoc(organizationId, "users", docId));
    if (snap.exists()) existing.push(docId);
  }
  const targets = existing.length > 0 ? existing : [id];
  await Promise.all(targets.map((docId) => patchOrgDoc(organizationId, "users", docId, data)));
}

export async function removeUser(
  organizationId: string,
  id: string,
  linkedId?: string
): Promise<void> {
  const ids = userIdVariants(id, linkedId);
  const results = await Promise.allSettled(ids.map((docId) => removeOrgDoc(organizationId, "users", docId)));
  if (results.length === 0 || results.every((result) => result.status === "rejected")) {
    const first = results[0];
    throw first && first.status === "rejected" ? first.reason : new Error("Suppression impossible");
  }
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
  if (err instanceof Error && err.message) return err.message;
  return "Enregistrement impossible";
}

function cleanSteps(steps: DocumentData[]): DocumentData[] {
  return JSON.parse(JSON.stringify(steps)) as DocumentData[];
}

/** Crée ou remplace un modèle de procédure avec un document Firestore propre. */
export async function saveProcedureTemplate(
  organizationId: string,
  id: string,
  fields: {
    name: string;
    type: string;
    procedureDescription: string;
    steps: DocumentData[];
    locationCategoryId?: string | null;
  }
): Promise<void> {
  const ref = orgDoc(organizationId, "procedureTemplates", id);
  const snap = await getDoc(ref);
  const prev = snap.exists() ? snap.data() : {};
  const payload: DocumentData = {
    id,
    name: fields.name,
    type: fields.type === "closing" ? "closing" : "opening",
    procedureDescription: fields.procedureDescription,
    steps: cleanSteps(fields.steps),
    estimatedDuration: typeof prev.estimatedDuration === "number" ? prev.estimatedDuration : 0,
    isActive: prev.isActive !== false,
    createdAt: prev.createdAt ?? serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (typeof prev.temperatureScheduleId === "string" && prev.temperatureScheduleId) {
    payload.temperatureScheduleId = prev.temperatureScheduleId;
  }
  const nextLocation =
    fields.locationCategoryId !== undefined
      ? (fields.locationCategoryId ?? "").trim()
      : typeof prev.locationCategoryId === "string"
        ? prev.locationCategoryId
        : "";
  payload.locationCategoryId = nextLocation;
  await setDoc(ref, payload);
}
