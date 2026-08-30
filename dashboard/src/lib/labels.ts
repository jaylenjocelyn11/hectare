import { asText } from "./text";

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
