/** Firestore envoie souvent une « horloge » (Timestamp). On la convertit en Date JS. */
export function asDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const fn = (value as { toDate?: () => Date }).toDate;
    if (typeof fn === "function") {
      const d = fn();
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function formatDateTime(value: unknown): string {
  const d = asDate(value);
  if (!d) return "—";
  return d.toLocaleString("fr-CA", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
