export const WEEKDAYS = [
  { key: "monday", short: "Lun", label: "Lundi" },
  { key: "tuesday", short: "Mar", label: "Mardi" },
  { key: "wednesday", short: "Mer", label: "Mercredi" },
  { key: "thursday", short: "Jeu", label: "Jeudi" },
  { key: "friday", short: "Ven", label: "Vendredi" },
  { key: "saturday", short: "Sam", label: "Samedi" },
  { key: "sunday", short: "Dim", label: "Dimanche" },
] as const;

export type WeekdayKey = (typeof WEEKDAYS)[number]["key"];

export type ShiftDraft = {
  off: boolean;
  start: string;
  end: string;
  note: string;
};

export type WeekScheduleDraft = {
  userId: string;
  userName: string;
  weekStart: string;
  days: Record<WeekdayKey, ShiftDraft>;
  note: string;
};

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function emptyShift(): ShiftDraft {
  return { off: true, start: "09:00", end: "17:00", note: "" };
}

export function workingShift(start = "09:00", end = "17:00"): ShiftDraft {
  return { off: false, start, end, note: "" };
}

export function emptyDays(): Record<WeekdayKey, ShiftDraft> {
  return {
    monday: emptyShift(),
    tuesday: emptyShift(),
    wednesday: emptyShift(),
    thursday: emptyShift(),
    friday: emptyShift(),
    saturday: emptyShift(),
    sunday: emptyShift(),
  };
}

export function mondayOf(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function formatWeekStart(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseWeekStart(weekStart: string): Date {
  const [y, m, d] = weekStart.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addWeeks(weekStart: string, weeks: number): string {
  const d = parseWeekStart(weekStart);
  d.setDate(d.getDate() + weeks * 7);
  return formatWeekStart(d);
}

export function formatWeekRange(weekStart: string): string {
  const start = parseWeekStart(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short" });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

export function scheduleDocumentId(userId: string, weekStart: string): string {
  return `${userId}_${weekStart}`;
}

export function parseShift(value: unknown): ShiftDraft {
  if (!value || typeof value !== "object") return emptyShift();
  const rec = value as Record<string, unknown>;
  const start = typeof rec.start === "string" && TIME_RE.test(rec.start) ? rec.start : "09:00";
  const end = typeof rec.end === "string" && TIME_RE.test(rec.end) ? rec.end : "17:00";
  const note = typeof rec.note === "string" ? rec.note : "";
  const off = rec.off === true || rec.isOff === true || (!rec.start && !rec.end);
  return { off, start, end, note };
}

export function parseDays(value: unknown): Record<WeekdayKey, ShiftDraft> {
  const days = emptyDays();
  if (!value || typeof value !== "object") return days;
  const rec = value as Record<string, unknown>;
  for (const day of WEEKDAYS) {
    days[day.key] = parseShift(rec[day.key]);
  }
  return days;
}

export function shiftHours(shift: ShiftDraft): number {
  if (shift.off) return 0;
  const [sh, sm] = shift.start.split(":").map(Number);
  const [eh, em] = shift.end.split(":").map(Number);
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes <= 0) minutes += 24 * 60;
  return minutes / 60;
}

export function weekHours(days: Record<WeekdayKey, ShiftDraft>): number {
  return WEEKDAYS.reduce((sum, day) => sum + shiftHours(days[day.key]), 0);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + days);
  return next;
}

export function weekdayKeyFromDate(date = new Date()): WeekdayKey {
  return WEEKDAYS[(date.getDay() + 6) % 7].key;
}

export function formatLongDay(date: Date): string {
  const raw = new Intl.DateTimeFormat("fr-CA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
