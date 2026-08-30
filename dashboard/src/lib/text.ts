/** Évite le plantage React (« Objects are not valid as a React child ») si Firestore envoie un objet. */
export function asText(value: unknown, fallback = "—"): string {
  if (value == null) return fallback;
  if (typeof value === "string") return value || fallback;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

export function asOrgId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? null;
}
