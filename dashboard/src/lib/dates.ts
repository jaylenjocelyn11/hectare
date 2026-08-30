/** Firestore envoie souvent une « horloge » (Timestamp). On la convertit en Date JS. */

function fromMillis(ms: number): Date | null {
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

function numericField(obj: object, keys: string[]): number | null {
  for (const key of keys) {
    if (!(key in obj)) continue;
    const n = (obj as Record<string, unknown>)[key];
    if (typeof n === "number" && Number.isFinite(n)) return n;
  }
  return null;
}

export function asDate(value: unknown): Date | null {
  if (value == null) return null;
  try {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === "string" || typeof value === "number") {
      return fromMillis(typeof value === "number" ? value : Date.parse(value));
    }

    if (typeof value !== "object") return null;

    const rec = value as Record<string, unknown>;

    // Appeler toDate() comme méthode (avec this), sinon Firestore plante :
    // "Cannot read properties of undefined (reading 'toMillis')"
    if (typeof rec.toDate === "function") {
      const d = rec.toDate();
      if (d instanceof Date && !Number.isNaN(d.getTime())) return d;
    }

    const seconds = numericField(rec, ["seconds", "_seconds"]);
    if (seconds != null) {
      const nanos = numericField(rec, ["nanoseconds", "_nanoseconds"]) ?? 0;
      return fromMillis(seconds * 1000 + nanos / 1e6);
    }

    return null;
  } catch {
    return null;
  }
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
