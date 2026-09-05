import { asDisplayName, asNumber } from "./text";

export type EquipmentFields = {
  name?: unknown;
  type?: unknown;
  kind?: unknown;
  isActive?: boolean;
  minTemperature?: unknown;
  maxTemperature?: unknown;
  locationCategoryId?: unknown;
};

export type EquipmentDoc = EquipmentFields & { id: string; linkedId?: string };

export function equipmentNameKey(name: unknown): string {
  return asDisplayName(name, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function score(doc: EquipmentDoc, fromCanonical: boolean): number {
  let s = 0;
  if (fromCanonical) s += 100;
  if (equipmentNameKey(doc.name)) s += 40;
  if (doc.isActive !== false) s += 10;
  if (asNumber(doc.minTemperature) != null && asNumber(doc.maxTemperature) != null) s += 5;
  return s;
}

/**
 * L’iPad écrit dans `equipment`. Une ancienne collection `equipments` existe encore
 * avec les mêmes frigos sous d’autres UUID. On garde une fiche par nom.
 */
export function mergeEquipmentCatalog(
  canonical: EquipmentDoc[],
  legacy: EquipmentDoc[]
): { list: EquipmentDoc[]; lookup: EquipmentDoc[] } {
  const canonicalIds = new Set(canonical.map((d) => d.id.toLowerCase()));
  const byId = new Map<string, EquipmentDoc>();

  for (const doc of [...legacy, ...canonical]) {
    const key = doc.id.toLowerCase();
    const prev = byId.get(key);
    if (!prev || canonicalIds.has(key)) byId.set(key, doc);
  }

  const lookup = [...byId.values()];
  const byName = new Map<string, EquipmentDoc>();

  for (const doc of lookup) {
    const nameKey = equipmentNameKey(doc.name);
    if (!nameKey) continue;
    const prev = byName.get(nameKey);
    const fromCanonical = canonicalIds.has(doc.id.toLowerCase());
    if (!prev || score(doc, fromCanonical) > score(prev, canonicalIds.has(prev.id.toLowerCase()))) {
      byName.set(nameKey, doc);
    }
  }

  return { list: [...byName.values()], lookup };
}
