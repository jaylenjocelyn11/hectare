import { asDate } from "./dates";
import { asNumber, asText } from "./text";

export type LossExportRow = {
  id: string;
  articleName?: string;
  articleKind?: string;
  quantity?: number;
  unit?: string;
  costPerUnit?: number;
  totalCost?: number;
  reason?: string;
  recordedBy?: string;
  createdAt?: unknown;
};

export function articleKindLabel(value: unknown): string {
  switch (asText(value, "").toLowerCase()) {
    case "complete":
      return "Article complet";
    case "raw":
      return "Article brut";
    default:
      return asText(value);
  }
}

export function money(value: unknown): string {
  const n = asNumber(value);
  if (n == null) return "—";
  return n.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
}

export function quantityLabel(row: LossExportRow): string {
  const qty = asNumber(row.quantity);
  const unit = asText(row.unit, "");
  if (qty == null) return "—";
  return unit ? `${qty} ${unit}` : String(qty);
}

function stamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
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

export function exportLossesExcel(rows: LossExportRow[], organizationLabel: string) {
  const headers = [
    "Date",
    "Article",
    "Type",
    "Quantité",
    "Unité",
    "Coût unitaire",
    "Coût total",
    "Motif",
    "Saisi par",
  ];
  const body = rows.map((row) => [
    asDate(row.createdAt)?.toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" }) ?? "—",
    asText(row.articleName),
    articleKindLabel(row.articleKind),
    asNumber(row.quantity) == null ? "—" : String(asNumber(row.quantity)),
    asText(row.unit, ""),
    asNumber(row.costPerUnit) == null ? "—" : String(asNumber(row.costPerUnit)),
    asNumber(row.totalCost) == null ? "—" : String(asNumber(row.totalCost)),
    asText(row.reason, ""),
    asText(row.recordedBy),
  ]);
  const total = rows.reduce((sum, row) => sum + (asNumber(row.totalCost) ?? 0), 0);
  const cells = (values: string[]) =>
    values
      .map(
        (value, col) =>
          `<Cell ss:Index="${col + 1}"><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`
      )
      .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Pertes">
  <Table>
   <Row><Cell><Data ss:Type="String">${escapeXml(`Pertes — ${organizationLabel}`)}</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">${escapeXml(`Exporté le ${new Date().toLocaleString("fr-CA")}`)}</Data></Cell></Row>
   <Row></Row>
   <Row>${cells(headers)}</Row>
   ${body.map((line) => `<Row>${cells(line)}</Row>`).join("\n   ")}
   <Row></Row>
   <Row>${cells(["Total", "", "", "", "", "", String(total), "", ""])}</Row>
  </Table>
 </Worksheet>
</Workbook>`;

  downloadBlob(
    new Blob(["\uFEFF" + xml], { type: "application/vnd.ms-excel;charset=utf-8" }),
    `pertes-${stamp()}.xls`
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
  for (let i = 0; i < pageCount; i++) {
    pageIds.push(3 + i * 3);
  }
  add(
    `2 0 obj\n<< /Type /Pages /Count ${pageCount} /Kids [${pageIds.map((n) => `${n} 0 R`).join(" ")}] >>\nendobj\n`
  );

  for (let i = 0; i < pageCount; i++) {
    const jpeg = jpegs[i] ?? { bytes: new Uint8Array(), width: 1, height: 1 };
    const pageId = 3 + i * 3;
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const stream = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im${i} Do Q\n`;
    add(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents ${contentId} 0 R /Resources << /XObject << /Im${i} ${imageId} 0 R >> >> >>\nendobj\n`
    );
    add(
      `${contentId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`
    );
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

export async function exportLossesPdf(rows: LossExportRow[], organizationLabel: string) {
  const logo = await loadLogo();
  const width = 1224;
  const height = 1584;
  const margin = 48;
  const rowH = 36;
  const headerH = 140;
  const cols = [
    { label: "Date", w: 140 },
    { label: "Article", w: 200 },
    { label: "Type", w: 110 },
    { label: "Qté", w: 70 },
    { label: "Unité", w: 70 },
    { label: "Coût unit.", w: 110 },
    { label: "Total", w: 110 },
    { label: "Motif", w: 190 },
    { label: "Saisi par", w: 128 },
  ];
  const tableTop = headerH + 24;
  const usable = height - tableTop - 70;
  const rowsPerPage = Math.max(1, Math.floor(usable / rowH) - 1);
  const pages = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  const total = rows.reduce((sum, row) => sum + (asNumber(row.totalCost) ?? 0), 0);
  const jpegs: { bytes: Uint8Array; width: number; height: number }[] = [];

  for (let page = 0; page < pages; page++) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("PDF impossible à générer");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

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
    ctx.fillText("Rapport de pertes", width - margin, 64);
    ctx.font = "400 18px Outfit, sans-serif";
    ctx.fillStyle = "#506868";
    ctx.fillText(organizationLabel, width - margin, 92);
    ctx.fillStyle = "#666666";
    ctx.fillText(new Date().toLocaleString("fr-CA"), width - margin, 116);
    ctx.textAlign = "left";

    let x = margin;
    let y = tableTop;
    ctx.fillStyle = "#506868";
    ctx.fillRect(margin, y, width - margin * 2, rowH);
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 16px Outfit, sans-serif";
    for (const col of cols) {
      ctx.fillText(col.label, x + 8, y + 24);
      x += col.w;
    }
    y += rowH;

    const slice = rows.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
    ctx.font = "400 15px Outfit, sans-serif";
    for (const row of slice) {
      const values = [
        asDate(row.createdAt)?.toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" }) ?? "—",
        asText(row.articleName),
        articleKindLabel(row.articleKind),
        asNumber(row.quantity) == null ? "—" : String(asNumber(row.quantity)),
        asText(row.unit, ""),
        money(row.costPerUnit),
        money(row.totalCost),
        asText(row.reason, "") || "—",
        asText(row.recordedBy),
      ];
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
        ctx.fillText(value, x + 8, y + 24);
        ctx.restore();
        x += cols[i].w;
      });
      y += rowH;
    }

    ctx.font = "600 18px Outfit, sans-serif";
    ctx.fillStyle = "#506868";
    ctx.textAlign = "left";
    ctx.fillText(`Nombre de pertes : ${rows.length}`, margin, height - 36);
    ctx.textAlign = "right";
    ctx.fillText(`Coût total : ${money(total)}`, width - margin, height - 36);
    ctx.textAlign = "left";
    ctx.textAlign = "center";
    ctx.font = "400 14px Outfit, sans-serif";
    ctx.fillStyle = "#888888";
    ctx.fillText(`Page ${page + 1} / ${pages}`, width / 2, height - 36);
    ctx.textAlign = "left";

    jpegs.push({ bytes: jpegFromCanvas(canvas), width, height });
  }

  downloadBlob(pdfFromJpegs(jpegs), `pertes-${stamp()}.pdf`);
}
