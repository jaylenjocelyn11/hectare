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
import styles from "./IosDashboardStudio.module.css";

type StudioProps = {
  layouts: ReturnType<typeof useIosDashboardLayout>["layouts"];
  saveState: ReturnType<typeof useIosDashboardLayout>["saveState"];
  error: string | null;
  setLayout: ReturnType<typeof useIosDashboardLayout>["setLayout"];
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

export function IosDashboardStudio({ layouts, saveState, error, setLayout }: StudioProps) {
  const [device, setDevice] = useState<IosDeviceKind>("ipad");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragSession | null>(null);
  const [dropCell, setDropCell] = useState<{ x: number; y: number } | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

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
  const swapTarget = dropCell
    ? layout.widgets.find(
        (widget) => widget.id !== drag?.id && occupies(widget, dropCell.x, dropCell.y)
      )
    : undefined;

  useEffect(() => {
    if (selected && !layout.widgets.some((widget) => widget.id === selected.id)) {
      setSelectedId(null);
    }
  }, [layout.widgets, selected]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const session = dragRef.current;
      if (!session) return;
      const next = { ...session, pointerX: event.clientX, pointerY: event.clientY };
      dragRef.current = next;
      setDrag(next);
      const currentLayout = layoutRef.current;
      const cell = cellFromPoint(
        gridRef.current,
        event.clientX,
        event.clientY,
        currentLayout.columns,
        rowsRef.current
      );
      if (!cell) return;
      setDropCell({
        x: Math.max(0, cell.x - session.grabCol),
        y: Math.max(0, cell.y - session.grabRow),
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
        setLayout(device, added ? relocateWidget(withWidget, added.id, x, y) : withWidget);
        setSelectedId(session.fromPalette);
        return;
      }
      const current = currentLayout.widgets.find((widget) => widget.id === session.id);
      if (current && current.x === x && current.y === y) return;
      setLayout(device, relocateWidget(currentLayout, session.id, x, y));
      setSelectedId(session.id);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [device, setLayout]);

  const saveLabel =
    saveState === "saving"
      ? "Envoi vers l’iPhone et l’iPad…"
      : saveState === "saved"
        ? "Synchronisé avec l’app"
        : saveState === "error"
          ? "Enregistrement impossible"
          : "Les changements partent tout seuls";

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

  return (
    <section className={styles.studio} aria-labelledby="ios-studio-title">
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>Atelier iOS</p>
          <h2 id="ios-studio-title" className={styles.title}>
            Composer l’écran d’accueil
          </h2>
          <p className={styles.lead}>
            Attrapez un module et déposez-le sur un autre pour échanger leur rang, ou sur une case
            libre pour le déplacer. L’app iPhone et iPad suit en direct.
          </p>
        </div>
        <div className={styles.heroMeta}>
          <div className={styles.deviceSwitch} role="tablist" aria-label="Appareil">
            <button
              type="button"
              role="tab"
              aria-selected={device === "iphone"}
              className={device === "iphone" ? styles.deviceOn : styles.deviceOff}
              onClick={() => setDevice("iphone")}
            >
              iPhone
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={device === "ipad"}
              className={device === "ipad" ? styles.deviceOn : styles.deviceOff}
              onClick={() => setDevice("ipad")}
            >
              iPad
            </button>
          </div>
          <p className={saveState === "error" ? styles.saveBad : styles.saveOk}>{saveLabel}</p>
        </div>
      </header>

      {error ? <p className={styles.warn}>{error}</p> : null}

      <div className={styles.workspace}>
        <aside className={styles.palette}>
          <p className={styles.asideLabel}>Modules</p>
          <p className={styles.asideHint}>Glissez un module sur l’écran, ou cliquez pour l’ajouter.</p>
          <ul className={styles.paletteList}>
            {palette.length === 0 ? (
              <li className={styles.emptyPalette}>Tous les modules sont déjà sur l’écran.</li>
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
                      const next = addWidget(layout, item.type);
                      commit(next);
                      setSelectedId(item.type);
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
                if (!window.confirm("Revenir à la composition d’origine pour cet appareil ?")) return;
                commit(defaultLayout(device));
                setSelectedId(null);
              }}
            >
              Réinitialiser {device === "iphone" ? "l’iPhone" : "l’iPad"}
            </button>
            <button
              type="button"
              className={styles.ghost}
              onClick={() => {
                const other: IosDeviceKind = device === "iphone" ? "ipad" : "iphone";
                setLayout(device, remapLayout(layouts[other], device));
              }}
            >
              Copier depuis {device === "iphone" ? "l’iPad" : "l’iPhone"}
            </button>
          </div>
        </aside>

        <div className={`${styles.stage} ${device === "iphone" ? styles.stagePhone : styles.stagePad}`}>
          <div className={styles.bezel} data-device={device}>
            <div className={styles.notch} aria-hidden="true" />
            <div
              ref={gridRef}
              className={`${styles.grid} ${drag ? styles.gridDragging : ""}`}
              style={{
                gridTemplateColumns: `repeat(${layout.columns}, 1fr)`,
                gridTemplateRows: `repeat(${rows}, minmax(52px, 1fr))`,
              }}
            >
              {Array.from({ length: layout.columns * rows }, (_, index) => {
                const x = index % layout.columns;
                const y = Math.floor(index / layout.columns);
                const hot = dropCell?.x === x && dropCell?.y === y && !swapTarget;
                return <span key={`${x}-${y}`} className={hot ? styles.cellHot : styles.cell} />;
              })}
              {layout.widgets.map((widget) => (
                <BoardTile
                  key={widget.id}
                  widget={widget}
                  selected={selected?.id === widget.id}
                  dragging={drag?.id === widget.id}
                  swapTarget={swapTarget?.id === widget.id}
                  onSelect={() => setSelectedId(widget.id)}
                  onPointerDown={(event) => startTileDrag(event, widget)}
                  onResize={(w, h) => commit(resizeWidget(layout, widget.id, w, h))}
                />
              ))}
            </div>
          </div>
        </div>

        <aside className={styles.inspector}>
          <p className={styles.asideLabel}>Module choisi</p>
          {selected ? (
            <Inspector
              widget={selected}
              columns={layout.columns}
              onChange={(patch) => commit(updateWidget(layout, selected.id, patch))}
              onNudge={(dir) => commit(nudgeRank(layout, selected.id, dir))}
              onRemove={() => {
                commit(removeWidget(layout, selected.id));
                setSelectedId(null);
              }}
            />
          ) : (
            <p className={styles.asideHint}>
              Glissez un module sur un autre pour inverser leur place. Cliquez-en un pour le
              renommer, le redimensionner ou le retirer.
            </p>
          )}
          <ol className={styles.legend}>
            {layout.widgets
              .slice()
              .sort((a, b) => a.y - b.y || a.x - b.x)
              .map((widget) => (
                <li key={widget.id}>
                  <button
                    type="button"
                    className={selected?.id === widget.id ? styles.legendOn : styles.legendOff}
                    onClick={() => setSelectedId(widget.id)}
                  >
                    <span>{widgetTitle(widget.type, widget.title)}</span>
                    <span>
                      col {widget.x + 1} · rang {widget.y + 1}
                    </span>
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
            left: drag.pointerX + 12,
            top: drag.pointerY + 12,
            ["--accent" as string]: ghostItem.accent,
          }}
        >
          <strong>{ghostItem.title}</strong>
          <span>{swapTarget ? "Relâcher pour échanger" : "Relâcher pour placer"}</span>
        </div>
      ) : null}
    </section>
  );
}

function BoardTile({
  widget,
  selected,
  dragging,
  swapTarget,
  onSelect,
  onPointerDown,
  onResize,
}: {
  widget: IosWidget;
  selected: boolean;
  dragging: boolean;
  swapTarget: boolean;
  onSelect: () => void;
  onPointerDown: (event: React.PointerEvent) => void;
  onResize: (w: number, h: number) => void;
}) {
  const item = catalogItem(widget.type);
  const title = widgetTitle(widget.type, widget.title);
  const [resizing, setResizing] = useState<"w" | "h" | null>(null);

  const style = useMemo(
    () =>
      ({
        gridColumn: `${widget.x + 1} / span ${widget.w}`,
        gridRow: `${widget.y + 1} / span ${widget.h}`,
        ["--accent" as string]: item?.accent ?? "#7a9c9c",
        opacity: widget.visible ? 1 : 0.42,
      }) as React.CSSProperties,
    [item?.accent, widget]
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
      <p className={styles.tileKicker}>{item?.blurb}</p>
      <h3>{title}</h3>
      {!widget.visible ? <p className={styles.hiddenTag}>Masqué dans l’app</p> : null}
      <button
        type="button"
        className={styles.handleE}
        data-handle="w"
        aria-label="Étirer en largeur"
        onPointerDown={(event) => {
          event.stopPropagation();
          setResizing("w");
          const grid = event.currentTarget.closest(`.${styles.grid}`);
          if (!grid) return;
          const onMovePtr = (ev: PointerEvent) => {
            const rect = grid.getBoundingClientRect();
            const colW = rect.width / columnCount(grid);
            const nextW = Math.max(1, Math.round((ev.clientX - rect.left) / colW) - widget.x);
            onResize(nextW, widget.h);
          };
          const onUp = () => {
            window.removeEventListener("pointermove", onMovePtr);
            window.removeEventListener("pointerup", onUp);
            setResizing(null);
          };
          window.addEventListener("pointermove", onMovePtr);
          window.addEventListener("pointerup", onUp);
        }}
      />
      <button
        type="button"
        className={styles.handleS}
        data-handle="h"
        aria-label="Étirer en hauteur"
        onPointerDown={(event) => {
          event.stopPropagation();
          setResizing("h");
          const grid = event.currentTarget.closest(`.${styles.grid}`);
          if (!grid) return;
          const onMovePtr = (ev: PointerEvent) => {
            const rect = grid.getBoundingClientRect();
            const rowH = rect.height / rowsFrom(grid);
            const nextH = Math.max(1, Math.round((ev.clientY - rect.top) / rowH) - widget.y);
            onResize(widget.w, nextH);
          };
          const onUp = () => {
            window.removeEventListener("pointermove", onMovePtr);
            window.removeEventListener("pointerup", onUp);
            setResizing(null);
          };
          window.addEventListener("pointermove", onMovePtr);
          window.addEventListener("pointerup", onUp);
        }}
      />
      {resizing ? <span className={styles.resizeHint}>{resizing === "w" ? "Largeur" : "Hauteur"}</span> : null}
    </article>
  );
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
        <button type="button" className={styles.ghost} onClick={() => onNudge(-1)}>
          Monter
        </button>
        <button type="button" className={styles.ghost} onClick={() => onNudge(1)}>
          Descendre
        </button>
      </div>
      <label className={styles.field}>
        Intitulé dans l’app
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
        Visible sur l’appareil
      </label>
      <label className={styles.field}>
        Largeur ({widget.w} / {columns})
        <input
          type="range"
          min={1}
          max={columns}
          value={widget.w}
          onChange={(event) => onChange({ w: Number(event.target.value) })}
        />
      </label>
      <label className={styles.field}>
        Hauteur ({widget.h})
        <input
          type="range"
          min={1}
          max={4}
          value={widget.h}
          onChange={(event) => onChange({ h: Number(event.target.value) })}
        />
      </label>
      <button type="button" className={styles.danger} onClick={onRemove}>
        Retirer de l’écran
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
  return getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length;
}

function rowsFrom(grid: Element): number {
  return getComputedStyle(grid).gridTemplateRows.split(" ").filter(Boolean).length;
}
