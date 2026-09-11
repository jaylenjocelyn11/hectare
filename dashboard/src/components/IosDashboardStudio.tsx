import { useEffect, useMemo, useState } from "react";
import {
  addWidget,
  catalogItem,
  defaultLayout,
  gridRowCount,
  moveWidget,
  remapLayout,
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

type DragState = {
  id: string;
  fromPalette?: IosWidgetType;
  offsetX: number;
  offsetY: number;
};

export function IosDashboardStudio({ layouts, saveState, error, setLayout }: StudioProps) {
  const [device, setDevice] = useState<IosDeviceKind>("ipad");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);

  const layout = layouts[device];
  const selected = layout.widgets.find((widget) => widget.id === selectedId) ?? null;
  const rows = gridRowCount(layout, device === "iphone" ? 12 : 8);
  const usedTypes = new Set(layout.widgets.map((widget) => widget.type));
  const palette = WIDGET_CATALOG.filter((item) => !usedTypes.has(item.type));

  useEffect(() => {
    if (selected && !layout.widgets.some((widget) => widget.id === selected.id)) {
      setSelectedId(null);
    }
  }, [layout.widgets, selected]);

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

  function onCellPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    const grid = event.currentTarget;
    const rect = grid.getBoundingClientRect();
    const colW = rect.width / layout.columns;
    const rowH = rect.height / rows;
    const x = Math.max(0, Math.min(layout.columns - 1, Math.floor((event.clientX - rect.left) / colW)));
    const y = Math.max(0, Math.min(rows - 1, Math.floor((event.clientY - rect.top) / rowH)));
    setHoverCell({ x, y });
  }

  function onGridPointerUp() {
    if (!drag || !hoverCell) {
      setDrag(null);
      setHoverCell(null);
      return;
    }
    if (drag.fromPalette) {
      const withWidget = addWidget(layout, drag.fromPalette);
      const added = withWidget.widgets.find((widget) => widget.type === drag.fromPalette);
      commit(added ? moveWidget(withWidget, added.id, hoverCell.x, hoverCell.y) : withWidget);
      setSelectedId(drag.fromPalette);
    } else {
      commit(moveWidget(layout, drag.id, hoverCell.x, hoverCell.y));
      setSelectedId(drag.id);
    }
    setDrag(null);
    setHoverCell(null);
  }

  return (
    <section className={styles.studio} aria-labelledby="ios-studio-title">
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>Atelier iOS</p>
          <h2 id="ios-studio-title" className={styles.title}>
            Composer l’écran d’accueil
          </h2>
          <p className={styles.lead}>
            Glissez les modules, étirez-les, choisissez iPhone ou iPad. L’équipe verra la même
            composition dans l’app, en direct.
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
          <p className={styles.asideHint}>Glissez un module sur la grille, ou cliquez pour l’ajouter.</p>
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
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", item.type);
                      event.dataTransfer.effectAllowed = "copy";
                      setDrag({ id: item.type, fromPalette: item.type, offsetX: 0, offsetY: 0 });
                    }}
                    onClick={() => {
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
              className={styles.grid}
              style={{
                gridTemplateColumns: `repeat(${layout.columns}, 1fr)`,
                gridTemplateRows: `repeat(${rows}, minmax(52px, 1fr))`,
              }}
              onPointerMove={onCellPointerMove}
              onPointerUp={onGridPointerUp}
              onPointerLeave={() => {
                if (!drag) setHoverCell(null);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                const rect = event.currentTarget.getBoundingClientRect();
                const colW = rect.width / layout.columns;
                const rowH = rect.height / rows;
                setHoverCell({
                  x: Math.max(0, Math.min(layout.columns - 1, Math.floor((event.clientX - rect.left) / colW))),
                  y: Math.max(0, Math.min(rows - 1, Math.floor((event.clientY - rect.top) / rowH))),
                });
              }}
              onDrop={(event) => {
                event.preventDefault();
                const type = event.dataTransfer.getData("text/plain") as IosWidgetType;
                if (!type) return;
                const rect = event.currentTarget.getBoundingClientRect();
                const colW = rect.width / layout.columns;
                const rowH = rect.height / rows;
                const x = Math.max(0, Math.min(layout.columns - 1, Math.floor((event.clientX - rect.left) / colW)));
                const y = Math.max(0, Math.min(rows - 1, Math.floor((event.clientY - rect.top) / rowH)));
                const withWidget = addWidget(layout, type);
                const added = withWidget.widgets.find((widget) => widget.type === type);
                commit(added ? moveWidget(withWidget, added.id, x, y) : withWidget);
                setSelectedId(type);
                setDrag(null);
                setHoverCell(null);
              }}
            >
              {Array.from({ length: layout.columns * rows }, (_, index) => {
                const x = index % layout.columns;
                const y = Math.floor(index / layout.columns);
                const hot = hoverCell?.x === x && hoverCell?.y === y;
                return <span key={`${x}-${y}`} className={hot ? styles.cellHot : styles.cell} />;
              })}
              {layout.widgets.map((widget) => (
                <BoardTile
                  key={widget.id}
                  widget={widget}
                  selected={selected?.id === widget.id}
                  onSelect={() => setSelectedId(widget.id)}
                  onMove={(x, y) => commit(moveWidget(layout, widget.id, x, y))}
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
              onRemove={() => {
                commit(removeWidget(layout, selected.id));
                setSelectedId(null);
              }}
            />
          ) : (
            <p className={styles.asideHint}>
              Cliquez un module sur l’écran pour changer son titre, sa taille ou le retirer.
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
    </section>
  );
}

function BoardTile({
  widget,
  selected,
  onSelect,
  onMove,
  onResize,
}: {
  widget: IosWidget;
  selected: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
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

  return (
    <article
      className={selected ? styles.tileOn : styles.tile}
      style={style}
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).dataset.handle) return;
        onSelect();
      }}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("application/x-widget", widget.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={(event) => {
        const grid = (event.currentTarget.parentElement as HTMLElement | null);
        if (!grid) return;
        const rect = grid.getBoundingClientRect();
        const columns = getComputedStyle(grid).gridTemplateColumns.split(" ").length;
        const rows = getComputedStyle(grid).gridTemplateRows.split(" ").length;
        const colW = rect.width / columns;
        const rowH = rect.height / rows;
        const x = Math.max(0, Math.min(columns - 1, Math.floor((event.clientX - rect.left) / colW)));
        const y = Math.max(0, Math.min(rowsFrom(grid) - 1, Math.floor((event.clientY - rect.top) / rowH)));
        onMove(x, y);
      }}
    >
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
  onRemove,
}: {
  widget: IosWidget;
  columns: number;
  onChange: (patch: Partial<Pick<IosWidget, "title" | "visible" | "w" | "h">>) => void;
  onRemove: () => void;
}) {
  const item = catalogItem(widget.type);
  return (
    <div className={styles.inspectorBody}>
      <p className={styles.inspectTitle}>{item?.title}</p>
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

function columnCount(grid: Element): number {
  return getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length;
}

function rowsFrom(grid: Element): number {
  return getComputedStyle(grid).gridTemplateRows.split(" ").filter(Boolean).length;
}
