import { useEffect, useMemo, useRef, useState } from "react";
import {
  addWidget,
  catalogItem,
  defaultLayout,
  gridRowCount,
  nudgeRank,
  occupies,
  remapLayout,
  relocateWidget,
  removeWidget,
  resizeWidget,
  updateWidget,
  widgetTitle,
  WIDGET_CATALOG,
  type IosDashboardLayout,
  type IosDeviceKind,
  type IosWidget,
  type IosWidgetType,
} from "../lib/iosDashboardLayout";
import type { useIosDashboardLayout } from "../hooks/useIosDashboardLayout";
import { IosNativeWidget, type IosLiveSnapshot } from "./IosNativeWidgets";
import styles from "./IosDashboardStudio.module.css";

type StudioProps = {
  layouts: ReturnType<typeof useIosDashboardLayout>["layouts"];
  saveState: ReturnType<typeof useIosDashboardLayout>["saveState"];
  error: string | null;
  setLayout: ReturnType<typeof useIosDashboardLayout>["setLayout"];
  live?: IosLiveSnapshot;
};

type DragSession = {
  id: string;
  fromPalette?: IosWidgetType;
  grabCol: number;
  grabRow: number;
  originX: number;
  originY: number;
  pointerX: number;
  pointerY: number;
};

export function IosDashboardStudio({ layouts, saveState, error, setLayout, live }: StudioProps) {
  const [device, setDevice] = useState<IosDeviceKind>("ipad");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragSession | null>(null);
  const [dropCell, setDropCell] = useState<{ x: number; y: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef(0);

  const layout = layouts[device];
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const dragRef = useRef<DragSession | null>(null);
  const selected = layout.widgets.find((widget) => widget.id === selectedId) ?? null;
  const rows = gridRowCount(layout, device === "iphone" ? 12 : 8);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const usedTypes = new Set(layout.widgets.map((widget) => widget.type));
  const palette = WIDGET_CATALOG.filter((item) => !usedTypes.has(item.type));

  const preview = useMemo(() => {
    if (!drag || !dropCell) return layout;
    if (drag.fromPalette) {
      const withWidget = addWidget(layout, drag.fromPalette);
      const added = withWidget.widgets.find((widget) => widget.type === drag.fromPalette);
      return added ? relocateWidget(withWidget, added.id, dropCell.x, dropCell.y) : withWidget;
    }
    return relocateWidget(layout, drag.id, dropCell.x, dropCell.y);
  }, [drag, dropCell, layout]);

  const swapTarget = dropCell
    ? layout.widgets.find(
        (widget) => widget.id !== drag?.id && occupies(widget, dropCell.x, dropCell.y)
      )
    : undefined;

  const heldName = drag
    ? widgetTitle(
        (drag.fromPalette ?? layout.widgets.find((widget) => widget.id === drag.id)?.type) || "notes",
        layout.widgets.find((widget) => widget.id === drag.id)?.title
      )
    : "";

  useEffect(() => {
    if (selected && !layout.widgets.some((widget) => widget.id === selected.id)) {
      setSelectedId(null);
    }
  }, [layout.widgets, selected]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const session = dragRef.current;
      if (!session) return;
      session.pointerX = event.clientX;
      session.pointerY = event.clientY;
      if (rafRef.current) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = 0;
        const live = dragRef.current;
        if (!live) return;
        setDrag({ ...live });
        const currentLayout = layoutRef.current;
        const cell = cellFromPoint(
          gridRef.current,
          live.pointerX,
          live.pointerY,
          currentLayout.columns,
          rowsRef.current
        );
        if (!cell) return;
        setDropCell({
          x: Math.max(0, cell.x - live.grabCol),
          y: Math.max(0, cell.y - live.grabRow),
        });
      });
    };
    const onUp = (event: PointerEvent) => {
      const session = dragRef.current;
      if (!session) return;
      const currentLayout = layoutRef.current;
      const cell = cellFromPoint(
        gridRef.current,
        event.clientX,
        event.clientY,
        currentLayout.columns,
        rowsRef.current
      );
      dragRef.current = null;
      setDrag(null);
      setDropCell(null);
      if (!cell) return;
      if (Math.hypot(event.clientX - session.originX, event.clientY - session.originY) < 12) return;
      const x = Math.max(0, cell.x - session.grabCol);
      const y = Math.max(0, cell.y - session.grabRow);
      if (session.fromPalette) {
        const withWidget = addWidget(currentLayout, session.fromPalette);
        const added = withWidget.widgets.find((widget) => widget.type === session.fromPalette);
        const next = added ? relocateWidget(withWidget, added.id, x, y) : withWidget;
        setLayout(device, next);
        setSelectedId(session.fromPalette);
        setToast("La nouvelle carte est sur l’écran.");
        return;
      }
      const current = currentLayout.widgets.find((widget) => widget.id === session.id);
      if (current && current.x === x && current.y === y) return;
      const hit = currentLayout.widgets.find(
        (widget) => widget.id !== session.id && occupies(widget, x, y)
      );
      setLayout(device, relocateWidget(currentLayout, session.id, x, y));
      setSelectedId(session.id);
      if (hit && current) {
        setToast(
          `${widgetTitle(current.type, current.title)} et ${widgetTitle(hit.type, hit.title)} ont échangé leur place.`
        );
      } else {
        setToast("La carte a changé de place.");
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, [device, setLayout]);

  const saveLabel =
    saveState === "saving"
      ? "On enregistre…"
      : saveState === "saved"
        ? "C’est enregistré. Les tablettes vont suivre."
        : saveState === "error"
          ? "L’enregistrement n’a pas marché. Réessayez."
          : "Rien à faire : ça s’enregistre tout seul.";

  function commit(next: IosDashboardLayout) {
    setLayout(device, next);
  }

  function startTileDrag(event: React.PointerEvent, widget: IosWidget) {
    if ((event.target as HTMLElement).dataset.handle) return;
    event.preventDefault();
    setSelectedId(widget.id);
    const cell = cellFromPoint(gridRef.current, event.clientX, event.clientY, layout.columns, rows);
    const session: DragSession = {
      id: widget.id,
      grabCol: cell ? Math.max(0, cell.x - widget.x) : 0,
      grabRow: cell ? Math.max(0, cell.y - widget.y) : 0,
      originX: event.clientX,
      originY: event.clientY,
      pointerX: event.clientX,
      pointerY: event.clientY,
    };
    dragRef.current = session;
    setDrag(session);
    setDropCell({ x: widget.x, y: widget.y });
  }

  function startPaletteDrag(event: React.PointerEvent, type: IosWidgetType) {
    const session: DragSession = {
      id: type,
      fromPalette: type,
      grabCol: 0,
      grabRow: 0,
      originX: event.clientX,
      originY: event.clientY,
      pointerX: event.clientX,
      pointerY: event.clientY,
    };
    dragRef.current = session;
    setDrag(session);
    setDropCell(null);
  }

  const ghostItem = drag
    ? catalogItem(drag.fromPalette ?? layout.widgets.find((widget) => widget.id === drag.id)?.type ?? "metrics")
    : null;
  const ordered = preview.widgets.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  const coach = drag
    ? swapTarget
      ? `Relâchez : « ${heldName} » prendra la place de « ${widgetTitle(swapTarget.type, swapTarget.title)} ».`
      : `Glissez encore, puis relâchez pour poser « ${heldName} ».`
    : selected
      ? `Carte choisie : ${widgetTitle(selected.type, selected.title)}. Montez-la, descendez-la, ou glissez-la.`
      : "Posez le doigt sur une carte, gardez-le appuyé, puis glissez-la sur une autre.";

  return (
    <section className={styles.studio} aria-labelledby="ios-studio-title">
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>Écran d’accueil</p>
          <h2 id="ios-studio-title" className={styles.title}>
            Ranger les cartes du téléphone
          </h2>
          <p className={styles.lead}>
            Comme des photos sur une table : on en prend une, on la pose ailleurs. L’iPad et
            l’iPhone montrent ensuite le même ordre.
          </p>
        </div>
        <div className={styles.heroMeta}>
          <p className={styles.deviceLabel}>Quel appareil voulez-vous ranger ?</p>
          <div className={styles.deviceSwitch} role="tablist" aria-label="Appareil">
            <button
              type="button"
              role="tab"
              aria-selected={device === "iphone"}
              className={device === "iphone" ? styles.deviceOn : styles.deviceOff}
              onClick={() => setDevice("iphone")}
            >
              Le téléphone
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={device === "ipad"}
              className={device === "ipad" ? styles.deviceOn : styles.deviceOff}
              onClick={() => setDevice("ipad")}
            >
              La tablette
            </button>
          </div>
          <p className={saveState === "error" ? styles.saveBad : styles.saveOk}>{saveLabel}</p>
        </div>
      </header>

      <ol className={styles.steps}>
        <li>
          <strong>1</strong>
          Choisissez téléphone ou tablette
        </li>
        <li>
          <strong>2</strong>
          Posez le doigt sur une carte
        </li>
        <li>
          <strong>3</strong>
          Glissez-la, puis relâchez
        </li>
      </ol>

      {error ? <p className={styles.warn}>{error}</p> : null}

      <div className={styles.workspace}>
        <aside className={styles.palette}>
          <p className={styles.asideLabel}>Cartes à ajouter</p>
          <p className={styles.asideHint}>Appuyez sur une carte pour la faire apparaître à l’écran.</p>
          <ul className={styles.paletteList}>
            {palette.length === 0 ? (
              <li className={styles.emptyPalette}>Toutes les cartes sont déjà sur l’écran.</li>
            ) : (
              palette.map((item) => (
                <li key={item.type}>
                  <button
                    type="button"
                    className={styles.paletteCard}
                    style={{ ["--accent" as string]: item.accent }}
                    onPointerDown={(event) => startPaletteDrag(event, item.type)}
                    onClick={() => {
                      if (dragRef.current) return;
                      commit(addWidget(layout, item.type));
                      setSelectedId(item.type);
                      setToast(`${item.title} a été ajoutée.`);
                    }}
                  >
                    <span className={styles.swatch} />
                    <span>
                      <strong>{item.title}</strong>
                      <span>{item.blurb}</span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
          <div className={styles.asideActions}>
            <button
              type="button"
              className={styles.ghost}
              onClick={() => {
                if (!window.confirm("Remettre l’écran comme au début, pour cet appareil ?")) return;
                commit(defaultLayout(device));
                setSelectedId(null);
                setToast("L’écran est revenu comme au début.");
              }}
            >
              Recommencer
            </button>
            <button
              type="button"
              className={styles.ghost}
              onClick={() => {
                const other: IosDeviceKind = device === "iphone" ? "ipad" : "iphone";
                setLayout(device, remapLayout(layouts[other], device));
                setToast(
                  device === "iphone"
                    ? "Le téléphone a maintenant le même rangement que la tablette."
                    : "La tablette a maintenant le même rangement que le téléphone."
                );
              }}
            >
              Copier l’autre écran
            </button>
          </div>
        </aside>

        <div className={`${styles.stage} ${device === "iphone" ? styles.stagePhone : styles.stagePad}`}>
          <p className={drag ? styles.coachLive : styles.coach}>{coach}</p>
          <div className={styles.deviceFrame}>
            <div className={styles.canvas} data-device={device}>
              <div
                ref={gridRef}
                className={`${styles.grid} ${drag ? styles.gridDragging : ""}`}
                style={{ ["--cols" as string]: String(preview.columns), ["--rows" as string]: String(rows) }}
              >
                {preview.widgets.map((widget) => (
                    <BoardTile
                      key={widget.id}
                      widget={widget}
                      columns={preview.columns}
                      rows={rows}
                      selected={selected?.id === widget.id}
                      dragging={drag?.id === widget.id || drag?.fromPalette === widget.type}
                      swapTarget={swapTarget?.id === widget.id}
                      live={live}
                      onSelect={() => setSelectedId(widget.id)}
                    onPointerDown={(event) => {
                      const source = layout.widgets.find((item) => item.id === widget.id);
                      if (source) startTileDrag(event, source);
                    }}
                    onResize={(w, h) => commit(resizeWidget(layout, widget.id, w, h))}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <aside className={styles.inspector}>
          <p className={styles.asideLabel}>La carte choisie</p>
          {selected ? (
            <Inspector
              widget={selected}
              columns={layout.columns}
              onChange={(patch) => commit(updateWidget(layout, selected.id, patch))}
              onNudge={(dir) => {
                commit(nudgeRank(layout, selected.id, dir));
                setToast(dir < 0 ? "La carte est montée." : "La carte est descendue.");
              }}
              onRemove={() => {
                if (!window.confirm("Enlever cette carte de l’écran ?")) return;
                commit(removeWidget(layout, selected.id));
                setSelectedId(null);
                setToast("La carte a été enlevée.");
              }}
            />
          ) : (
            <p className={styles.asideHint}>
              Appuyez sur une carte à l’écran. Ensuite vous pourrez la monter, la descendre, ou
              changer son nom.
            </p>
          )}
          <p className={styles.orderTitle}>Ordre sur l’écran</p>
          <ol className={styles.legend}>
            {ordered.map((widget, index) => (
              <li key={widget.id}>
                <button
                  type="button"
                  className={selected?.id === widget.id ? styles.legendOn : styles.legendOff}
                  onClick={() => setSelectedId(widget.id)}
                >
                  <span className={styles.orderNum}>{index + 1}</span>
                  <span>{widgetTitle(widget.type, widget.title)}</span>
                </button>
              </li>
            ))}
          </ol>
        </aside>
      </div>

      {drag && ghostItem ? (
        <div
          className={styles.dragGhost}
          style={{
            left: drag.pointerX,
            top: drag.pointerY,
            ["--accent" as string]: ghostItem.accent,
          }}
        >
          <strong>{ghostItem.title}</strong>
          <span>{swapTarget ? "Relâchez pour échanger" : "Relâchez pour poser ici"}</span>
        </div>
      ) : null}

      {toast ? <p className={styles.toast}>{toast}</p> : null}
    </section>
  );
}

function BoardTile({
  widget,
  columns,
  rows,
  selected,
  dragging,
  swapTarget,
  live,
  onSelect,
  onPointerDown,
  onResize,
}: {
  widget: IosWidget;
  columns: number;
  rows: number;
  selected: boolean;
  dragging: boolean;
  swapTarget: boolean;
  live?: IosLiveSnapshot;
  onSelect: () => void;
  onPointerDown: (event: React.PointerEvent) => void;
  onResize: (w: number, h: number) => void;
}) {
  const title = widgetTitle(widget.type, widget.title);

  const style = useMemo(
    () =>
      ({
        left: `${(widget.x / columns) * 100}%`,
        top: `${(widget.y / rows) * 100}%`,
        width: `${(widget.w / columns) * 100}%`,
        height: `${(widget.h / rows) * 100}%`,
        opacity: widget.visible ? 1 : 0.55,
        zIndex: dragging ? 1 : swapTarget ? 4 : selected ? 3 : 2,
      }) as React.CSSProperties,
    [columns, dragging, rows, selected, swapTarget, widget]
  );

  const className = [
    selected ? styles.tileOn : styles.tile,
    dragging ? styles.tileDragging : "",
    swapTarget ? styles.tileSwap : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={className} style={style} onPointerDown={onPointerDown} onClick={onSelect}>
      <div className={styles.face}>
        <IosNativeWidget type={widget.type} title={title} live={live} phone={columns === 2} />
        {!widget.visible ? <p className={styles.hiddenTag}>Cachée sur le téléphone</p> : null}
      </div>
      <button
        type="button"
        className={styles.handleE}
        data-handle="w"
        aria-label="Rendre plus large"
        onPointerDown={(event) => beginResize(event, "w", widget, onResize)}
      />
      <button
        type="button"
        className={styles.handleS}
        data-handle="h"
        aria-label="Rendre plus haute"
        onPointerDown={(event) => beginResize(event, "h", widget, onResize)}
      />
    </article>
  );
}

function beginResize(
  event: React.PointerEvent,
  axis: "w" | "h",
  widget: IosWidget,
  onResize: (w: number, h: number) => void
) {
  event.stopPropagation();
  const grid = (event.currentTarget.closest(`.${styles.grid}`) as HTMLElement | null);
  if (!grid) return;
  const onMovePtr = (ev: PointerEvent) => {
    const rect = grid.getBoundingClientRect();
    if (axis === "w") {
      const colW = rect.width / columnCount(grid);
      onResize(Math.max(1, Math.round((ev.clientX - rect.left) / colW) - widget.x), widget.h);
    } else {
      const rowH = rect.height / rowsFrom(grid);
      onResize(widget.w, Math.max(1, Math.round((ev.clientY - rect.top) / rowH) - widget.y));
    }
  };
  const onUp = () => {
    window.removeEventListener("pointermove", onMovePtr);
    window.removeEventListener("pointerup", onUp);
  };
  window.addEventListener("pointermove", onMovePtr);
  window.addEventListener("pointerup", onUp);
}

function Inspector({
  widget,
  columns,
  onChange,
  onNudge,
  onRemove,
}: {
  widget: IosWidget;
  columns: number;
  onChange: (patch: Partial<Pick<IosWidget, "title" | "visible" | "w" | "h">>) => void;
  onNudge: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const item = catalogItem(widget.type);
  return (
    <div className={styles.inspectorBody}>
      <p className={styles.inspectTitle}>{item?.title}</p>
      <div className={styles.rankRow}>
        <button type="button" className={styles.rankBtn} onClick={() => onNudge(-1)}>
          Plus haut
        </button>
        <button type="button" className={styles.rankBtn} onClick={() => onNudge(1)}>
          Plus bas
        </button>
      </div>
      <label className={styles.field}>
        Nom sur l’écran
        <input
          className={styles.input}
          value={widget.title}
          placeholder={item?.title}
          onChange={(event) => onChange({ title: event.target.value })}
        />
      </label>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={widget.visible}
          onChange={(event) => onChange({ visible: event.target.checked })}
        />
        Montrer cette carte
      </label>
      <label className={styles.field}>
        Largeur
        <input
          type="range"
          min={1}
          max={columns}
          value={widget.w}
          onChange={(event) => onChange({ w: Number(event.target.value) })}
        />
      </label>
      <label className={styles.field}>
        Hauteur
        <input
          type="range"
          min={1}
          max={4}
          value={widget.h}
          onChange={(event) => onChange({ h: Number(event.target.value) })}
        />
      </label>
      <button type="button" className={styles.danger} onClick={onRemove}>
        Enlever cette carte
      </button>
    </div>
  );
}

function cellFromPoint(
  grid: HTMLElement | null,
  clientX: number,
  clientY: number,
  columns: number,
  rows: number
): { x: number; y: number } | null {
  if (!grid) return null;
  const rect = grid.getBoundingClientRect();
  if (clientX < rect.left - 24 || clientX > rect.right + 24 || clientY < rect.top - 24 || clientY > rect.bottom + 24) {
    return null;
  }
  const x = Math.max(0, Math.min(columns - 1, Math.floor(((clientX - rect.left) / rect.width) * columns)));
  const y = Math.max(0, Math.min(rows - 1, Math.floor(((clientY - rect.top) / rect.height) * rows)));
  return { x, y };
}

function columnCount(grid: Element): number {
  const cols = Number.parseInt(getComputedStyle(grid).getPropertyValue("--cols") || "4", 10);
  return Number.isFinite(cols) && cols > 0 ? cols : 4;
}

function rowsFrom(grid: Element): number {
  const rows = Number.parseInt(getComputedStyle(grid).getPropertyValue("--rows") || "8", 10);
  return Number.isFinite(rows) && rows > 0 ? rows : 8;
}
