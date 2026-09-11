export const IOS_LAYOUT_COLLECTION = "iosDashboardLayouts";
export const IOS_LAYOUT_VERSION = 1;

export type IosDeviceKind = "iphone" | "ipad";

export type IosWidgetType =
  | "greeting"
  | "metrics"
  | "timeClock"
  | "equipment"
  | "procedures"
  | "notes"
  | "temperatureOverview"
  | "procedureStatus"
  | "inventoryAlerts"
  | "complianceScore"
  | "temperatureTrends"
  | "procedurePerformance";

export type IosWidget = {
  id: string;
  type: IosWidgetType;
  title: string;
  visible: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type IosDashboardLayout = {
  id: IosDeviceKind;
  version: number;
  columns: number;
  widgets: IosWidget[];
};

export type WidgetCatalogItem = {
  type: IosWidgetType;
  title: string;
  blurb: string;
  accent: string;
  defaultH: number;
};

export const DEVICE_COLUMNS: Record<IosDeviceKind, number> = {
  iphone: 2,
  ipad: 4,
};

export const WIDGET_CATALOG: WidgetCatalogItem[] = [
  {
    type: "greeting",
    title: "Salutation",
    blurb: "Accueil et date du jour",
    accent: "#c9b37a",
    defaultH: 1,
  },
  {
    type: "metrics",
    title: "Indicateurs",
    blurb: "Relevés, procédures, conformité",
    accent: "#7a9c9c",
    defaultH: 2,
  },
  {
    type: "timeClock",
    title: "Pointage",
    blurb: "Entrée et sortie de l’équipe",
    accent: "#8cb8a8",
    defaultH: 2,
  },
  {
    type: "equipment",
    title: "Équipements",
    blurb: "Derniers relevés par appareil",
    accent: "#4a9bd4",
    defaultH: 2,
  },
  {
    type: "procedures",
    title: "Procédures",
    blurb: "Ouverture et fermeture du jour",
    accent: "#5cbf70",
    defaultH: 2,
  },
  {
    type: "notes",
    title: "Notes",
    blurb: "Messages de l’équipe",
    accent: "#d4b46a",
    defaultH: 2,
  },
  {
    type: "temperatureOverview",
    title: "Températures",
    blurb: "Volume et hors-plage",
    accent: "#4a9bd4",
    defaultH: 2,
  },
  {
    type: "procedureStatus",
    title: "Statut procédures",
    blurb: "Terminées, en cours, retard",
    accent: "#5cbf70",
    defaultH: 2,
  },
  {
    type: "inventoryAlerts",
    title: "Alertes inventaire",
    blurb: "Péremption et stock bas",
    accent: "#e0a33a",
    defaultH: 2,
  },
  {
    type: "complianceScore",
    title: "Conformité HACCP",
    blurb: "Score global du site",
    accent: "#5cbf70",
    defaultH: 2,
  },
  {
    type: "temperatureTrends",
    title: "Tendances",
    blurb: "Moyennes AM et PM",
    accent: "#6a8888",
    defaultH: 2,
  },
  {
    type: "procedurePerformance",
    title: "Performance",
    blurb: "Réussite et durée moyenne",
    accent: "#8cb8a8",
    defaultH: 2,
  },
];

const CATALOG_MAP = new Map(WIDGET_CATALOG.map((item) => [item.type, item]));

export function catalogItem(type: string): WidgetCatalogItem | undefined {
  return CATALOG_MAP.get(type as IosWidgetType);
}

export function isWidgetType(value: string): value is IosWidgetType {
  return CATALOG_MAP.has(value as IosWidgetType);
}

export function widgetTitle(type: IosWidgetType, override?: string): string {
  const trimmed = override?.trim();
  if (trimmed) return trimmed;
  return catalogItem(type)?.title ?? type;
}

export function defaultLayout(device: IosDeviceKind): IosDashboardLayout {
  const columns = DEVICE_COLUMNS[device];
  const full = columns;
  const half = Math.max(1, Math.floor(columns / 2));
  const widgets: IosWidget[] =
    device === "iphone"
      ? [
          place("greeting", 0, 0, full, 1),
          place("metrics", 0, 1, full, 2),
          place("timeClock", 0, 3, full, 2),
          place("equipment", 0, 5, full, 2),
          place("procedures", 0, 7, full, 2),
          place("notes", 0, 9, full, 2),
        ]
      : [
          place("greeting", 0, 0, full, 1),
          place("metrics", 0, 1, full, 2),
          place("timeClock", 0, 3, half, 2),
          place("equipment", half, 3, half, 2),
          place("procedures", 0, 5, half, 2),
          place("notes", half, 5, half, 2),
        ];
  return { id: device, version: IOS_LAYOUT_VERSION, columns, widgets };
}

function place(type: IosWidgetType, x: number, y: number, w: number, h: number): IosWidget {
  return {
    id: type,
    type,
    title: "",
    visible: true,
    x,
    y,
    w,
    h,
  };
}

export function cloneLayout(layout: IosDashboardLayout): IosDashboardLayout {
  return {
    ...layout,
    widgets: layout.widgets.map((widget) => ({ ...widget })),
  };
}

export function normalizeLayout(raw: unknown, device: IosDeviceKind): IosDashboardLayout {
  const fallback = defaultLayout(device);
  if (!raw || typeof raw !== "object") return fallback;
  const rec = raw as Record<string, unknown>;
  const columns = DEVICE_COLUMNS[device];
  const widgets = Array.isArray(rec.widgets)
    ? rec.widgets.flatMap((item, index) => parseWidget(item, index, columns))
    : fallback.widgets;
  const unique: IosWidget[] = [];
  const seen = new Set<string>();
  for (const widget of widgets) {
    if (seen.has(widget.type)) continue;
    seen.add(widget.type);
    unique.push(clampWidget(widget, columns));
  }
  const resolved = unique.length > 0 ? unique : fallback.widgets;
  return {
    id: device,
    version: IOS_LAYOUT_VERSION,
    columns,
    widgets: resolveCollisions(resolved, columns),
  };
}

function parseWidget(item: unknown, index: number, columns: number): IosWidget[] {
  if (!item || typeof item !== "object") return [];
  const rec = item as Record<string, unknown>;
  const type = typeof rec.type === "string" ? rec.type : "";
  if (!isWidgetType(type)) return [];
  const id = typeof rec.id === "string" && rec.id.trim() ? rec.id : type;
  const x = asInt(rec.x, 0);
  const y = asInt(rec.y, index);
  const w = asInt(rec.w, columns);
  const h = asInt(rec.h, catalogItem(type)?.defaultH ?? 2);
  return [
    {
      id,
      type,
      title: typeof rec.title === "string" ? rec.title : "",
      visible: rec.visible !== false,
      x,
      y,
      w,
      h,
    },
  ];
}

function asInt(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

export function clampWidget(widget: IosWidget, columns: number): IosWidget {
  const w = Math.min(columns, Math.max(1, widget.w));
  const h = Math.min(6, Math.max(1, widget.h));
  const x = Math.min(Math.max(0, widget.x), columns - w);
  const y = Math.max(0, widget.y);
  return { ...widget, x, y, w, h };
}

export function occupies(widget: IosWidget, col: number, row: number): boolean {
  return (
    widget.visible &&
    col >= widget.x &&
    col < widget.x + widget.w &&
    row >= widget.y &&
    row < widget.y + widget.h
  );
}

export function layoutsOverlap(a: IosWidget, b: IosWidget): boolean {
  if (a.id === b.id || !a.visible || !b.visible) return false;
  const xOverlap = a.x < b.x + b.w && a.x + a.w > b.x;
  const yOverlap = a.y < b.y + b.h && a.y + a.h > b.y;
  return xOverlap && yOverlap;
}

export function canPlace(
  widgets: IosWidget[],
  candidate: IosWidget,
  columns: number
): boolean {
  const next = clampWidget(candidate, columns);
  return widgets.every((widget) => !layoutsOverlap(widget, next));
}

export function firstFreeSlot(
  widgets: IosWidget[],
  type: IosWidgetType,
  columns: number,
  w = columns,
  h = catalogItem(type)?.defaultH ?? 2
): { x: number; y: number } {
  const width = Math.min(columns, Math.max(1, w));
  const height = Math.min(6, Math.max(1, h));
  for (let y = 0; y < 24; y += 1) {
    for (let x = 0; x <= columns - width; x += 1) {
      const trial: IosWidget = {
        id: `__trial_${type}`,
        type,
        title: "",
        visible: true,
        x,
        y,
        w: width,
        h: height,
      };
      if (canPlace(widgets, trial, columns)) return { x, y };
    }
  }
  const maxY = widgets.reduce((max, widget) => Math.max(max, widget.y + widget.h), 0);
  return { x: 0, y: maxY };
}

export function resolveCollisions(widgets: IosWidget[], columns: number, keepOrder = false): IosWidget[] {
  const placed: IosWidget[] = [];
  const sorted = keepOrder ? widgets : [...widgets].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const widget of sorted) {
    const clamped = clampWidget(widget, columns);
    if (!clamped.visible || canPlace(placed, clamped, columns)) {
      placed.push(clamped);
      continue;
    }
    const slot = firstFreeSlot(placed, clamped.type, columns, clamped.w, clamped.h);
    placed.push({ ...clamped, ...slot });
  }
  return placed;
}

function pinWidget(layout: IosDashboardLayout, id: string, next: IosWidget): IosDashboardLayout {
  const pinned = clampWidget(next, layout.columns);
  const others = layout.widgets.filter((widget) => widget.id !== id);
  return {
    ...layout,
    widgets: resolveCollisions([pinned, ...others], layout.columns, true),
  };
}

export function moveWidget(
  layout: IosDashboardLayout,
  id: string,
  x: number,
  y: number
): IosDashboardLayout {
  const current = layout.widgets.find((widget) => widget.id === id);
  if (!current) return layout;
  return pinWidget(layout, id, { ...current, x, y });
}

export function resizeWidget(
  layout: IosDashboardLayout,
  id: string,
  w: number,
  h: number
): IosDashboardLayout {
  const current = layout.widgets.find((widget) => widget.id === id);
  if (!current) return layout;
  return pinWidget(layout, id, { ...current, w, h });
}

export function updateWidget(
  layout: IosDashboardLayout,
  id: string,
  patch: Partial<Pick<IosWidget, "title" | "visible" | "w" | "h" | "x" | "y">>
): IosDashboardLayout {
  const current = layout.widgets.find((widget) => widget.id === id);
  if (!current) return layout;
  return pinWidget(layout, id, { ...current, ...patch });
}

export function removeWidget(layout: IosDashboardLayout, id: string): IosDashboardLayout {
  return { ...layout, widgets: layout.widgets.filter((widget) => widget.id !== id) };
}

export function addWidget(layout: IosDashboardLayout, type: IosWidgetType): IosDashboardLayout {
  if (layout.widgets.some((widget) => widget.type === type)) {
    return updateWidget(layout, layout.widgets.find((widget) => widget.type === type)!.id, {
      visible: true,
    });
  }
  const item = catalogItem(type);
  const w = type === "greeting" || type === "metrics" ? layout.columns : Math.min(2, layout.columns);
  const h = item?.defaultH ?? 2;
  const slot = firstFreeSlot(layout.widgets, type, layout.columns, w, h);
  const widget: IosWidget = {
    id: type,
    type,
    title: "",
    visible: true,
    x: slot.x,
    y: slot.y,
    w,
    h,
  };
  return {
    ...layout,
    widgets: resolveCollisions([...layout.widgets, widget], layout.columns),
  };
}

export function remapLayout(source: IosDashboardLayout, device: IosDeviceKind): IosDashboardLayout {
  const columns = DEVICE_COLUMNS[device];
  const scale = columns / source.columns;
  const widgets = source.widgets.map((widget) =>
    clampWidget(
      {
        ...widget,
        w: Math.max(1, Math.round(widget.w * scale)),
        x: Math.round(widget.x * scale),
      },
      columns
    )
  );
  return {
    id: device,
    version: IOS_LAYOUT_VERSION,
    columns,
    widgets: resolveCollisions(widgets, columns),
  };
}

export function gridRowCount(layout: IosDashboardLayout, minRows = 8): number {
  const max = layout.widgets.reduce((max, widget) => Math.max(max, widget.y + widget.h), 0);
  return Math.max(minRows, max + 2);
}

export function layoutToPayload(layout: IosDashboardLayout): Record<string, unknown> {
  return {
    id: layout.id,
    version: IOS_LAYOUT_VERSION,
    columns: layout.columns,
    widgets: layout.widgets.map((widget) => ({
      id: widget.id,
      type: widget.type,
      title: widget.title,
      visible: widget.visible,
      x: widget.x,
      y: widget.y,
      w: widget.w,
      h: widget.h,
    })),
  };
}
