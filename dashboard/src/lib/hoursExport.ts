import { asDate } from "./dates";
import { userRoleLabel } from "./labels";
import { asText } from "./text";

export type HoursPunch = {
  id: string;
  userId?: string;
  userName?: string;
  clockInAt?: unknown;
  clockOutAt?: unknown;
  note?: string;
  source?: string;
};

export type HoursEmployee = {
  id: string;
  name?: string;
  role?: string;
  isActive?: boolean;
};

export type HoursPeriod = "today" | "week" | "month" | "all";

type PunchRow = {
  id: string;
  userId: string;
  employee: string;
  role: string;
  date: string;
  weekday: string;
  weekLabel: string;
  clockIn: string;
  clockOut: string;
  durationLabel: string;
  hours: number;
  minutes: number;
  status: string;
  source: string;
  note: string;
  open: boolean;
};

type EmployeeSummary = {
  userId: string;
  employee: string;
  role: string;
  active: string;
  punches: number;
  open: number;
  minutes: number;
  hours: number;
  durationLabel: string;
  averageLabel: string;
  firstPunch: string;
  lastPunch: string;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function stamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function startOfDay(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function mondayOf(date: Date): Date {
  const d = startOfDay(date);
  const weekday = d.getDay();
  d.setDate(d.getDate() + (weekday === 0 ? -6 : 1 - weekday));
  return d;
}

function periodStart(period: HoursPeriod): Date | null {
  if (period === "all") return null;
  const d = startOfDay();
  if (period === "week") d.setDate(d.getDate() - 6);
  if (period === "month") d.setDate(d.getDate() - 29);
  return d;
}

export function hoursPeriodLabel(period: HoursPeriod): string {
  if (period === "today") return "Aujourd’hui";
  if (period === "week") return "7 derniers jours";
  if (period === "month") return "30 derniers jours";
  return "Toute la période disponible";
}

export function punchInPeriod(punch: HoursPunch, period: HoursPeriod): boolean {
  const clockIn = asDate(punch.clockInAt);
  if (!clockIn) return false;
  const start = periodStart(period);
  if (!start) return true;
  return clockIn.getTime() >= start.getTime();
}

function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (!hours) return `${minutes} min`;
  if (!minutes) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

function decimalHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

function sourceLabel(value: unknown): string {
  const s = asText(value, "").toLowerCase();
  if (s === "web") return "Tableau de bord";
  if (s === "ipad" || s === "ios" || s === "kiosk") return "iPad";
  return asText(value, "—");
}

function weekLabel(date: Date): string {
  const start = mondayOf(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${start.toLocaleDateString("fr-CA")} → ${end.toLocaleDateString("fr-CA")}`;
}

function punchMinutes(punch: HoursPunch, now = new Date()): number {
  const clockIn = asDate(punch.clockInAt);
  if (!clockIn) return 0;
  const clockOut = asDate(punch.clockOutAt) ?? now;
  return Math.max(0, Math.round((clockOut.getTime() - clockIn.getTime()) / 60000));
}

function employeeName(users: HoursEmployee[], punch: HoursPunch): { id: string; name: string; role: string; active: boolean } {
  const id = asText(punch.userId, "").toLowerCase();
  const user = users.find((u) => u.id.toLowerCase() === id);
  return {
    id: punch.userId || user?.id || asText(punch.userName, punch.id),
    name: asText(user?.name, "") || asText(punch.userName, "Employé"),
    role: userRoleLabel(user?.role || "employee"),
    active: user ? user.isActive !== false : true,
  };
}

export function buildHoursReport(
  punches: HoursPunch[],
  employees: HoursEmployee[],
  period: HoursPeriod
): { details: PunchRow[]; summaries: EmployeeSummary[]; totalMinutes: number } {
  const now = new Date();
  const filtered = punches.filter((p) => punchInPeriod(p, period));
  const details: PunchRow[] = filtered
    .map((punch) => {
      const clockIn = asDate(punch.clockInAt);
      const clockOut = asDate(punch.clockOutAt);
      const open = !clockOut;
      const minutes = punchMinutes(punch, now);
      const who = employeeName(employees, punch);
      return {
        id: punch.id,
        userId: who.id,
        employee: who.name,
        role: who.role,
        date: clockIn?.toLocaleDateString("fr-CA") ?? "—",
        weekday: clockIn
          ? clockIn.toLocaleDateString("fr-CA", { weekday: "long" })
          : "—",
        weekLabel: clockIn ? weekLabel(clockIn) : "—",
        clockIn: clockIn?.toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" }) ?? "—",
        clockOut: open
          ? "En poste"
          : clockOut?.toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" }) ?? "—",
        durationLabel: formatMinutes(minutes),
        hours: decimalHours(minutes),
        minutes,
        status: open ? "En poste" : "Terminé",
        source: sourceLabel(punch.source),
        note: typeof punch.note === "string" ? punch.note : "",
        open,
      };
    })
    .sort((a, b) => a.employee.localeCompare(b.employee, "fr") || a.clockIn.localeCompare(b.clockIn, "fr"));

  const byUser = new Map<string, EmployeeSummary>();
  for (const user of employees.filter((u) => u.isActive !== false)) {
    byUser.set(user.id.toLowerCase(), {
      userId: user.id,
      employee: asText(user.name, "Employé"),
      role: userRoleLabel(user.role),
      active: "Actif",
      punches: 0,
      open: 0,
      minutes: 0,
      hours: 0,
      durationLabel: "0 min",
      averageLabel: "—",
      firstPunch: "—",
      lastPunch: "—",
    });
  }

  for (const row of details) {
    const key = row.userId.toLowerCase();
    const current = byUser.get(key) ?? {
      userId: row.userId,
      employee: row.employee,
      role: row.role,
      active: "Hors liste",
      punches: 0,
      open: 0,
      minutes: 0,
      hours: 0,
      durationLabel: "0 min",
      averageLabel: "—",
      firstPunch: "—",
      lastPunch: "—",
    };
    current.punches += 1;
    current.open += row.open ? 1 : 0;
    current.minutes += row.minutes;
    if (current.firstPunch === "—" || row.clockIn < current.firstPunch) current.firstPunch = row.clockIn;
    if (current.lastPunch === "—" || row.clockIn > current.lastPunch) current.lastPunch = row.clockIn;
    byUser.set(key, current);
  }

  const summaries = [...byUser.values()]
    .map((row) => ({
      ...row,
      hours: decimalHours(row.minutes),
      durationLabel: formatMinutes(row.minutes),
      averageLabel: row.punches ? formatMinutes(Math.round(row.minutes / row.punches)) : "—",
    }))
    .sort((a, b) => a.employee.localeCompare(b.employee, "fr"));

  const totalMinutes = summaries.reduce((sum, row) => sum + row.minutes, 0);
  return { details, summaries, totalMinutes };
}

function cells(values: string[]): string {
  return values
    .map((value, col) => `<Cell ss:Index="${col + 1}"><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`)
    .join("");
}

function sheet(name: string, rows: string[][]): string {
  return `<Worksheet ss:Name="${escapeXml(name)}">
  <Table>
   ${rows.map((line) => `<Row>${cells(line)}</Row>`).join("\n   ")}
  </Table>
 </Worksheet>`;
}

export function exportHoursExcel(
  punches: HoursPunch[],
  employees: HoursEmployee[],
  organizationLabel: string,
  period: HoursPeriod
) {
  const { details, summaries, totalMinutes } = buildHoursReport(punches, employees, period);
  const generated = new Date().toLocaleString("fr-CA");
  const periodLabel = hoursPeriodLabel(period);

  const dayMap = new Map<string, { date: string; employee: string; minutes: number; punches: number }>();
  const weekMap = new Map<string, { week: string; employee: string; minutes: number; punches: number }>();
  for (const row of details) {
    const dayKeyName = `${row.date}|${row.employee}`;
    const day = dayMap.get(dayKeyName) ?? { date: row.date, employee: row.employee, minutes: 0, punches: 0 };
    day.minutes += row.minutes;
    day.punches += 1;
    dayMap.set(dayKeyName, day);
    const weekKeyName = `${row.weekLabel}|${row.employee}`;
    const week = weekMap.get(weekKeyName) ?? {
      week: row.weekLabel,
      employee: row.employee,
      minutes: 0,
      punches: 0,
    };
    week.minutes += row.minutes;
    week.punches += 1;
    weekMap.set(weekKeyName, week);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 ${sheet("Infos", [
   ["Rapport d’heures — Rustiq"],
   ["Organisation", organizationLabel],
   ["Période", periodLabel],
   ["Généré le", generated],
   ["Employés inclus", String(summaries.length)],
   ["Pointages", String(details.length)],
   ["Heures totales (équipe)", formatMinutes(totalMinutes)],
   ["Heures décimales", String(decimalHours(totalMinutes))],
   ["Pointages en cours", String(details.filter((r) => r.open).length)],
 ])}
 ${sheet("Synthese", [
   [
     "Employé",
     "Rôle",
     "Statut",
     "Nb pointages",
     "En poste",
     "Heures (h min)",
     "Heures décimales",
     "Moyenne / quart",
     "Premier pointage",
     "Dernier pointage",
   ],
   ...summaries.map((row) => [
     row.employee,
     row.role,
     row.active,
     String(row.punches),
     String(row.open),
     row.durationLabel,
     String(row.hours),
     row.averageLabel,
     row.firstPunch,
     row.lastPunch,
   ]),
   [],
   ["Total équipe", "", "", String(details.length), String(details.filter((r) => r.open).length), formatMinutes(totalMinutes), String(decimalHours(totalMinutes)), "", "", ""],
 ])}
 ${sheet("Pointages", [
   [
     "Employé",
     "Rôle",
     "Date",
     "Jour",
     "Arrivée",
     "Départ",
     "Durée",
     "Heures décimales",
     "Statut",
     "Source",
     "Note",
     "ID",
   ],
   ...details.map((row) => [
     row.employee,
     row.role,
     row.date,
     row.weekday,
     row.clockIn,
     row.clockOut,
     row.durationLabel,
     String(row.hours),
     row.status,
     row.source,
     row.note,
     row.id,
   ]),
 ])}
 ${sheet("Par jour", [
   ["Date", "Employé", "Nb quarts", "Durée", "Heures décimales"],
   ...[...dayMap.values()]
     .sort((a, b) => a.date.localeCompare(b.date) || a.employee.localeCompare(b.employee, "fr"))
     .map((row) => [row.date, row.employee, String(row.punches), formatMinutes(row.minutes), String(decimalHours(row.minutes))]),
 ])}
 ${sheet("Par semaine", [
   ["Semaine (lun. → dim.)", "Employé", "Nb quarts", "Durée", "Heures décimales"],
   ...[...weekMap.values()]
     .sort((a, b) => a.week.localeCompare(b.week) || a.employee.localeCompare(b.employee, "fr"))
     .map((row) => [row.week, row.employee, String(row.punches), formatMinutes(row.minutes), String(decimalHours(row.minutes))]),
 ])}
</Workbook>`;

  downloadBlob(
    new Blob(["\uFEFF" + xml], { type: "application/vnd.ms-excel;charset=utf-8" }),
    `heures-${stamp()}.xls`
  );
}

async function loadLogo(): Promise<HTMLImageElement | null> {
  const src = `${import.meta.env.BASE_URL}rustiq-logo.png`;
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("logo"));
      img.src = src;
    });
    return img;
  } catch {
    return null;
  }
}

function jpegFromCanvas(canvas: HTMLCanvasElement): Uint8Array {
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const binary = atob(dataUrl.split(",")[1] ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function pdfFromJpegs(jpegs: { bytes: Uint8Array; width: number; height: number }[]): Blob {
  const pageW = 612;
  const pageH = 792;
  const encoder = new TextEncoder();
  const objects: Uint8Array[] = [];

  function add(data: string | Uint8Array): number {
    objects.push(typeof data === "string" ? encoder.encode(data) : data);
    return objects.length;
  }

  add("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  const pageCount = Math.max(1, jpegs.length);
  const pageIds: number[] = [];
  for (let i = 0; i < pageCount; i++) pageIds.push(3 + i * 3);
  add(`2 0 obj\n<< /Type /Pages /Count ${pageCount} /Kids [${pageIds.map((n) => `${n} 0 R`).join(" ")}] >>\nendobj\n`);

  for (let i = 0; i < pageCount; i++) {
    const jpeg = jpegs[i] ?? { bytes: new Uint8Array(), width: 1, height: 1 };
    const pageId = 3 + i * 3;
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const stream = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im${i} Do Q\n`;
    add(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents ${contentId} 0 R /Resources << /XObject << /Im${i} ${imageId} 0 R >> >> >>\nendobj\n`
    );
    add(`${contentId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`);
    add(
      concatBytes([
        encoder.encode(
          `${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${jpeg.width} /Height ${jpeg.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.bytes.length} >>\nstream\n`
        ),
        jpeg.bytes,
        encoder.encode("\nendstream\nendobj\n"),
      ])
    );
  }

  const header = encoder.encode("%PDF-1.4\n");
  const parts: Uint8Array[] = [header];
  const offsets = [0];
  let cursor = header.length;
  for (const obj of objects) {
    offsets.push(cursor);
    parts.push(obj);
    cursor += obj.length;
  }
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let n = 1; n <= objects.length; n++) {
    xref += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${cursor}\n%%EOF\n`;
  parts.push(encoder.encode(xref));
  return new Blob([concatBytes(parts)], { type: "application/pdf" });
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement | null,
  width: number,
  margin: number,
  organizationLabel: string,
  subtitle: string,
  periodLabel: string
) {
  ctx.fillStyle = "#ffffff";
  if (logo) {
    const logoH = 72;
    const logoW = (logo.width / logo.height) * logoH;
    ctx.drawImage(logo, margin, 36, logoW, logoH);
  } else {
    ctx.fillStyle = "#506868";
    ctx.font = "700 36px Outfit, sans-serif";
    ctx.fillText("Rustiq", margin, 80);
  }
  ctx.fillStyle = "#1a1a1a";
  ctx.font = "700 34px 'Cormorant Garamond', serif";
  ctx.textAlign = "right";
  ctx.fillText(subtitle, width - margin, 64);
  ctx.font = "400 18px Outfit, sans-serif";
  ctx.fillStyle = "#506868";
  ctx.fillText(organizationLabel, width - margin, 92);
  ctx.fillStyle = "#666666";
  ctx.fillText(periodLabel, width - margin, 116);
  ctx.fillText(new Date().toLocaleString("fr-CA"), width - margin, 140);
  ctx.textAlign = "left";
}

function drawTablePage(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  margin: number,
  cols: { label: string; w: number }[],
  rows: string[][],
  footerLeft: string,
  footerRight: string,
  pageLabel: string
) {
  const rowH = 34;
  const tableTop = 168;
  let x = margin;
  let y = tableTop;
  ctx.fillStyle = "#506868";
  ctx.fillRect(margin, y, width - margin * 2, rowH);
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 15px Outfit, sans-serif";
  for (const col of cols) {
    ctx.fillText(col.label, x + 8, y + 22);
    x += col.w;
  }
  y += rowH;
  ctx.font = "400 14px Outfit, sans-serif";
  for (const values of rows) {
    ctx.fillStyle = y % (rowH * 2) === 0 ? "#f6f8f8" : "#ffffff";
    ctx.fillRect(margin, y, width - margin * 2, rowH);
    ctx.strokeStyle = "#e4ecec";
    ctx.beginPath();
    ctx.moveTo(margin, y + rowH);
    ctx.lineTo(width - margin, y + rowH);
    ctx.stroke();
    ctx.fillStyle = "#222222";
    x = margin;
    values.forEach((value, i) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 6, y, cols[i].w - 12, rowH);
      ctx.clip();
      ctx.fillText(value, x + 8, y + 22);
      ctx.restore();
      x += cols[i].w;
    });
    y += rowH;
  }
  ctx.font = "600 16px Outfit, sans-serif";
  ctx.fillStyle = "#506868";
  ctx.textAlign = "left";
  ctx.fillText(footerLeft, margin, height - 36);
  ctx.textAlign = "right";
  ctx.fillText(footerRight, width - margin, height - 36);
  ctx.textAlign = "center";
  ctx.font = "400 14px Outfit, sans-serif";
  ctx.fillStyle = "#888888";
  ctx.fillText(pageLabel, width / 2, height - 36);
  ctx.textAlign = "left";
}

export async function exportHoursPdf(
  punches: HoursPunch[],
  employees: HoursEmployee[],
  organizationLabel: string,
  period: HoursPeriod
) {
  const logo = await loadLogo();
  const { details, summaries, totalMinutes } = buildHoursReport(punches, employees, period);
  const width = 1224;
  const height = 1584;
  const margin = 48;
  const rowH = 34;
  const usable = height - 168 - 70;
  const rowsPerPage = Math.max(1, Math.floor(usable / rowH) - 1);
  const jpegs: { bytes: Uint8Array; width: number; height: number }[] = [];
  const periodLabel = hoursPeriodLabel(period);

  const summaryCols = [
    { label: "Employé", w: 250 },
    { label: "Rôle", w: 120 },
    { label: "Pointages", w: 100 },
    { label: "Heures", w: 140 },
    { label: "Décimal", w: 100 },
    { label: "Moyenne", w: 140 },
    { label: "Dernier pointage", w: 278 },
  ];
  const detailCols = [
    { label: "Date", w: 120 },
    { label: "Employé", w: 190 },
    { label: "Arrivée", w: 170 },
    { label: "Départ", w: 170 },
    { label: "Durée", w: 100 },
    { label: "Statut", w: 100 },
    { label: "Source", w: 130 },
    { label: "Note", w: 148 },
  ];

  const summaryPages = Math.max(1, Math.ceil(summaries.length / rowsPerPage));
  const detailPages = Math.max(1, Math.ceil(details.length / rowsPerPage));
  const totalPages = summaryPages + detailPages;

  for (let page = 0; page < summaryPages; page++) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("PDF impossible à générer");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    drawHeader(ctx, logo, width, margin, organizationLabel, "Rapport d’heures", periodLabel);
    const slice = summaries.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
    drawTablePage(
      ctx,
      width,
      height,
      margin,
      summaryCols,
      slice.map((row) => [
        row.employee,
        row.role,
        String(row.punches),
        row.durationLabel,
        String(row.hours),
        row.averageLabel,
        row.lastPunch,
      ]),
      `Équipe : ${summaries.length} employé(s) · ${details.length} pointage(s)`,
      `Total : ${formatMinutes(totalMinutes)}`,
      `Synthèse ${page + 1} / ${summaryPages} · Page ${page + 1} / ${totalPages}`
    );
    jpegs.push({ bytes: jpegFromCanvas(canvas), width, height });
  }

  for (let page = 0; page < detailPages; page++) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("PDF impossible à générer");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    drawHeader(ctx, logo, width, margin, organizationLabel, "Détail des pointages", periodLabel);
    const slice = details.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
    drawTablePage(
      ctx,
      width,
      height,
      margin,
      detailCols,
      slice.map((row) => [
        row.date,
        row.employee,
        row.clockIn,
        row.clockOut,
        row.durationLabel,
        row.status,
        row.source,
        row.note || "—",
      ]),
      `Pointages ${page * rowsPerPage + 1}–${Math.min(details.length, (page + 1) * rowsPerPage)} sur ${details.length}`,
      `Total : ${formatMinutes(totalMinutes)}`,
      `Détail ${page + 1} / ${detailPages} · Page ${summaryPages + page + 1} / ${totalPages}`
    );
    jpegs.push({ bytes: jpegFromCanvas(canvas), width, height });
  }

  downloadBlob(pdfFromJpegs(jpegs), `heures-${stamp()}.pdf`);
}
