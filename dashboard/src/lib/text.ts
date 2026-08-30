const UUID_RE =
  /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

const CODE_RE =
  /Optional\(|Hectare\.|Equipment\(|CorrectiveAction|persistentModelID|_\$backingData|"correctiveActions"|temperatureUnit|Objects are not valid/;

function looksLikeCode(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (CODE_RE.test(t)) return true;
  if ((t.startsWith("{") || t.startsWith("[")) && t.length > 24) return true;
  if (t.length > 180 && (t.includes("{") || t.includes("function"))) return true;
  return false;
}

function nameInDump(text: string): string | null {
  const swift = text.match(/\bname:\s*"([^"]{1,80})"/);
  if (swift?.[1]) return swift[1];
  const json = text.match(/"name"\s*:\s*"([^"]{1,80})"/);
  if (json?.[1]) return json[1];
  return null;
}

function fromJsonBlob(text: string): string | null {
  const t = text.trim();
  if (!(t.startsWith("{") || t.startsWith("["))) return null;
  try {
    return extractHuman(JSON.parse(t), 0);
  } catch {
    return nameInDump(t);
  }
}

function extractHuman(value: unknown, depth: number): string | null {
  if (value == null || depth > 4) return null;
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return null;
    if (looksLikeCode(t)) return fromJsonBlob(t) ?? nameInDump(t);
    return t;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => extractHuman(item, depth + 1))
      .filter((s): s is string => !!s);
    return parts.length ? parts.join(", ") : null;
  }
  if (typeof value === "object") {
    const rec = value as Record<string, unknown>;
    for (const key of ["name", "displayName", "title", "label", "stringValue", "text", "rawValue"]) {
      const inner = extractHuman(rec[key], depth + 1);
      if (inner) return inner;
    }
  }
  return null;
}

/** Texte lisible uniquement — jamais un dump JSON / Swift / objet Firestore. */
export function asText(value: unknown, fallback = "—"): string {
  return extractHuman(value, 0) ?? fallback;
}

export function asDisplayName(value: unknown, fallback = "—"): string {
  const s = asText(value, "");
  if (!s) return fallback;
  const onlyUuid = s.replace(UUID_RE, "").trim() === "" && UUID_RE.test(s);
  if (onlyUuid) return fallback;
  return s;
}

function compactId(value: string): string {
  return value.trim().toLowerCase().replace(/[{}]/g, "");
}

function idsEqual(a: string, b: string): boolean {
  const na = compactId(a);
  const nb = compactId(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return na.replace(/-/g, "") === nb.replace(/-/g, "");
}

export function asId(value: unknown): string | undefined {
  if (typeof value === "string") {
    const uuid = value.match(UUID_RE);
    if (uuid) return uuid[0];
    const t = value.trim();
    if (t && t.length <= 80 && !looksLikeCode(t)) return t;
    return undefined;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const rec = value as Record<string, unknown>;
    return asId(rec.id) ?? asId(rec.equipmentId);
  }
  return undefined;
}

export function namedFromDocs(
  docs: Array<{ id: string; name?: unknown; linkedId?: string }>,
  idValue: unknown,
  fallback: string
): string {
  const id = asId(idValue);
  if (id) {
    const doc = docs.find(
      (d) => idsEqual(d.id, id) || (d.linkedId ? idsEqual(d.linkedId, id) : false)
    );
    const named = asDisplayName(doc?.name, "");
    if (named) return named;
  }
  return fallback;
}

export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function asOrgId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? null;
}

export function isInternalEquipmentType(value: unknown): boolean {
  const t = asText(value, "").toLowerCase();
  return !t || t === "temperature" || t === "temp";
}
