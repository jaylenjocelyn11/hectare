import { asText, isInternalEquipmentType } from "./text";

export function inventoryCategoryLabel(value: unknown): string {
  switch (asText(value, "").toLowerCase()) {
    case "ingredients":
      return "Ingrédients";
    case "packaging":
      return "Emballages";
    case "cleaning":
      return "Nettoyage";
    case "equipment":
      return "Équipement";
    case "other":
      return "Autre";
    default:
      return asText(value);
  }
}

export function userRoleLabel(value: unknown): string {
  switch (asText(value, "").toLowerCase()) {
    case "manager":
      return "Manager";
    case "employee":
      return "Employé";
    default:
      return asText(value);
  }
}

export function noteCategoryLabel(value: unknown): string {
  switch (asText(value, "").toLowerCase()) {
    case "general":
      return "Général";
    case "maintenance":
      return "Maintenance";
    case "inventory":
      return "Inventaire";
    case "procedure":
      return "Procédure";
    case "temperature":
      return "Température";
    case "other":
      return "Autre";
    default:
      return asText(value);
  }
}

export function scheduleTypeLabel(value: unknown): string {
  switch (asText(value, "").toLowerCase()) {
    case "morning":
      return "Matin";
    case "afternoon":
      return "Après-midi";
    case "evening":
      return "Soir";
    default:
      return asText(value);
  }
}

export function equipmentKindLabel(value: unknown): string {
  switch (asText(value, "").toLowerCase()) {
    case "cold":
      return "Froid";
    case "hot":
      return "Chaud";
    case "ambient":
      return "Ambiance";
    case "freezer":
      return "Congélateur";
    case "refrigerator":
      return "Réfrigérateur";
    default:
      return asText(value, "");
  }
}

export function equipmentTypeLabel(type: unknown, kind: unknown): string {
  const kindLabel = equipmentKindLabel(kind);
  if (isInternalEquipmentType(type)) return kindLabel || "—";
  const typeLabel = asText(type, "");
  if (kindLabel && kindLabel !== typeLabel) return `${typeLabel} · ${kindLabel}`;
  return typeLabel || "—";
}
