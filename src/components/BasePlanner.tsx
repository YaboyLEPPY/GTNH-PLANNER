import { BaseCanvas } from "./BaseCanvas";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Grid3X3,
  MousePointer2,
  ZoomIn,
  ZoomOut,
  Move,
  RotateCcw,
  RotateCw,
  Copy,
  Trash2,
  Plus,
  Maximize,
  GitBranch,
} from "lucide-react";
import type { Base, World, Zone, ZoneType, Route } from "../domain/world";
import {
  ZONE_TYPES,
  ZONE_COLORS,
  zone,
  placementIssue,
  deleteZone,
  exampleBase,
} from "../domain/base";
import { ZoneInspector, RouteInspector } from "./BaseInspectors";
import type { Goods } from "../types";
import { getCatalog } from "../data";
import { Icon, ErrorBox } from "./Common";
type Drag = {
  mode: "place" | "move" | "resize" | "pan";
  startX: number;
  startY: number;
  original?: Zone;
  left?: number;
  top?: number;
  clientX?: number;
  clientY?: number;
};
export function BasePlanner({
  world,
  update,
}: {
  world: World;
  update: (w: World) => void;
}) {
  const b = world.base;
  const [floor, setFloor] = useState(1),
    [brush, setBrush] = useState<ZoneType | "select" | "route">("select"),
    [routeType, setRouteType] = useState<Route["type"]>("item"),
    [routeStart, setRouteStart] = useState(""),
    [selected, setSelected] = useState(""),
    [routeSelected, setRouteSelected] = useState(""),
    [zoom, setZoom] = useState(0.9),
    [grid, setGrid] = useState(true),
    [snap, setSnap] = useState(1),
    [overlap, setOverlap] = useState(false),
    [preview, setPreview] = useState<Zone>(),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [history, setHistory] = useState<Base[]>([]),
    [redo, setRedo] = useState<Base[]>([]),
    [x, setX] = useState(0),
    [y, setY] = useState(0),
    [w, setW] = useState(3),
    [h, setH] = useState(3),
    [size, setSize] = useState({ width: b.width, height: b.height }),
    [catalog, setCatalog] = useState<Goods[]>();
  const viewport = useRef<HTMLDivElement>(null),
    board = useRef<HTMLDivElement>(null),
    drag = useRef<Drag | null>(null),
    previewRef = useRef<Zone | undefined>(undefined);
  const cell = 20 * zoom;
  const map = useMemo(() => new Map(catalog?.map((g) => [g.id, g])), [catalog]);
  useEffect(() => {
    getCatalog()
      .then(setCatalog)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (floor >= b.floorNames.length) setFloor(b.floorNames.length - 1);
  }, [b.floorNames, floor]);
  const selection = b.zones.find((z) => z.id === selected),
    route = b.routes.find((r) => r.id === routeSelected);
  const selectedZone =
    selection && selection.floor === floor ? selection : undefined;
  function commit(next: Base) {
    setHistory((a) => [...a.slice(-49), b]);
    setRedo([]);
    update({ ...world, base: next });
    setError("");
  }
  function undo() {
    if (!history.length) return;
    const prev = history.at(-1)!;
    setRedo((a) => [...a, b]);
    setHistory((a) => a.slice(0, -1));
    update({ ...world, base: prev });
    setMessage("Undid base edit.");
  }
  function doRedo() {
    if (!redo.length) return;
    const next = redo.at(-1)!;
    setHistory((a) => [...a, b]);
    setRedo((a) => a.slice(0, -1));
    update({ ...world, base: next });
    setMessage("Redid base edit.");
  }
  function coords(e: { clientX: number; clientY: number }) {
    const r = board.current!.getBoundingClientRect();
    return {
      x: Math.floor((e.clientX - r.left) / cell / snap) * snap,
      y: Math.floor((e.clientY - r.top) / cell / snap) * snap,
    };
  }
  function show(z?: Zone) {
    previewRef.current = z;
    setPreview(z);
  }
  function apply(z: Zone) {
    const issue = placementIssue(z, b, overlap);
    if (issue) {
      setMessage(issue + ". Nothing was moved or placed.");
      return;
    }
    commit({
      ...b,
      zones: b.zones.some((n) => n.id === z.id)
        ? b.zones.map((n) => (n.id === z.id ? z : n))
        : [...b.zones, z],
    });
    setSelected(z.id);
    setMessage(
      `${z.name} saved at (${z.x}, ${z.y}) on ${b.floorNames[z.floor]}.`,
    );
  }
  function addRoute(from: string, to: string) {
    if (from === to) {
      setMessage("Choose a different endpoint.");
      return;
    }
    const a = b.zones.find((z) => z.id === from)!,
      z = b.zones.find((z) => z.id === to)!;
    const r: Route = {
      id: crypto.randomUUID(),
      name: `${routeType} connection`,
      type: routeType,
      from,
      to,
      direction: "forward",
      amount: Math.abs(a.x - z.x) + Math.abs(a.y - z.y) + 1,
    };
    commit({ ...b, routes: [...b.routes, r] });
    setRouteSelected(r.id);
    setSelected("");
    setRouteStart("");
    setMessage(
      "Logical connection added. Physical pipe/cable compatibility is not validated.",
    );
  }
  function down(
    e: React.PointerEvent<HTMLDivElement>,
    original?: Zone,
    resize = false,
  ) {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (brush === "route" && original) return;
    const c = coords(e);
    if (original) {
      setSelected(original.id);
      setRouteSelected("");
      drag.current = {
        mode: resize ? "resize" : "move",
        startX: c.x,
        startY: c.y,
        original,
      };
      show(original);
    } else if (brush === "select" || brush === "route") {
      if (!viewport.current) return;
      drag.current = {
        mode: "pan",
        startX: c.x,
        startY: c.y,
        left: viewport.current.scrollLeft,
        top: viewport.current.scrollTop,
        clientX: e.clientX,
        clientY: e.clientY,
      };
      setSelected("");
      setRouteSelected("");
    } else {
      drag.current = { mode: "place", startX: c.x, startY: c.y };
      show(zone(brush, floor, c.x, c.y, w, h));
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function moving(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    if (d.mode === "pan") {
      if (viewport.current) {
        viewport.current.scrollLeft = d.left! - e.clientX + d.clientX!;
        viewport.current.scrollTop = d.top! - e.clientY + d.clientY!;
      }
      return;
    }
    const c = coords(e);
    if (d.mode === "place") {
      const z = previewRef.current!;
      const moved = c.x !== d.startX || c.y !== d.startY;
      show({
        ...z,
        x: Math.min(c.x, d.startX),
        y: Math.min(c.y, d.startY),
        width: moved ? Math.abs(c.x - d.startX) + snap : w,
        height: moved ? Math.abs(c.y - d.startY) + snap : h,
      });
    } else if (d.original) {
      const z = d.original;
      show(
        d.mode === "move"
          ? { ...z, x: z.x + c.x - d.startX, y: z.y + c.y - d.startY }
          : {
              ...z,
              width: Math.max(1, c.x - z.x + snap),
              height: Math.max(1, c.y - z.y + snap),
            },
      );
    }
  }
  function up() {
    const d = drag.current;
    drag.current = null;
    if (d && d.mode !== "pan" && previewRef.current) {
      const z = previewRef.current;
      if (d.mode !== "move" || z.x !== d.original?.x || z.y !== d.original?.y)
        apply(z);
    }
    show(undefined);
  }
  function duplicate() {
    if (!selectedZone) return;
    for (let y = selectedZone.y; y < b.height; y++)
      for (let x = selectedZone.x; x < b.width; x++) {
        const z = {
          ...selectedZone,
          id: crypto.randomUUID(),
          name: selectedZone.name + " copy",
          x,
          y,
          materials: selectedZone.materials.map((m) => ({ ...m })),
        };
        if (!placementIssue(z, b, false)) {
          apply(z);
          return;
        }
      }
    setMessage(
      "No free footprint was found. Adjust the base size or move the original.",
    );
  }
  function keyboard(e: React.KeyboardEvent) {
    if ((e.target as HTMLElement).closest("input,select,textarea,button"))
      return;
    if (e.ctrlKey || e.metaKey) {
      if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? doRedo() : undo();
      }
      return;
    }
    if (selectedZone) {
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-snap, 0],
        ArrowRight: [snap, 0],
        ArrowUp: [0, -snap],
        ArrowDown: [0, snap],
      };
      if (moves[e.key]) {
        e.preventDefault();
        apply({
          ...selectedZone,
          x: selectedZone.x + moves[e.key][0],
          y: selectedZone.y + moves[e.key][1],
        });
      } else if (e.key === "Delete") {
        e.preventDefault();
        commit(deleteZone(b, selectedZone.id));
        setSelected("");
      }
    }
  }
  const issue = preview ? placementIssue(preview, b, overlap) : "";
  return (
    <div>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MAKE ROOM FOR WHAT COMES NEXT</div>
          <h1>
            Base <span>planner</span>
          </h1>
          <p>
            Choose a type, drag a footprint, then refine it. One cell = one
            block.
          </p>
        </div>
        <Grid3X3 size={36} color="#8e9bbf" />
      </div>
      <div className="base-toolbar">
        <div className="toolbar">
          <button
            className={brush === "select" ? "active" : ""}
            onClick={() => {
              setBrush("select");
              setSelected("");
              setRouteSelected("");
              setRouteStart("");
            }}
          >
            <MousePointer2 size={16} />
            Select / pan
          </button>
          {ZONE_TYPES.map((t) => (
            <button
              key={t}
              className={brush === t ? "active" : ""}
              style={{
                borderBottomColor: ZONE_COLORS[t],
                borderBottomWidth: 3,
              }}
              onClick={() => {
                setBrush(t);
                setSelected("");
                setRouteSelected("");
                setRouteStart("");
              }}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
          <button
            className={brush === "route" ? "active" : ""}
            onClick={() => {
              setBrush("route");
              setRouteStart("");
              setMessage("Click a source zone, then a destination.");
            }}
          >
            <GitBranch size={16} />
            Connect
          </button>
        </div>
        <div className="toolbar">
          <label>
            Floor{" "}
            <select
              aria-label="Base floor"
              value={floor}
              onChange={(e) => {
                setFloor(Number(e.target.value));
                setRouteSelected("");
                setSelected("");
                setRouteStart("");
              }}
            >
              {b.floorNames.map((n, i) => (
                <option key={i} value={i}>
                  {i}: {n}
                </option>
              ))}
            </select>
          </label>
          <button
            aria-label="Base zoom out"
            onClick={() => setZoom((z) => Math.max(0.25, z - 0.15))}
          >
            <ZoomOut size={15} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            aria-label="Base zoom in"
            onClick={() => setZoom((z) => Math.min(2, z + 0.15))}
          >
            <ZoomIn size={15} />
          </button>
          <button
            onClick={() => {
              if (viewport.current)
                setZoom(
                  Math.max(
                    0.25,
                    Math.min(1, viewport.current.clientWidth / (b.width * 20)),
                  ),
                );
            }}
          >
            <Maximize size={15} />
            Fit width
          </button>
          <button onClick={undo} disabled={!history.length}>
            <RotateCcw size={15} />
            Undo base edit
          </button>
          <button onClick={doRedo} disabled={!redo.length}>
            <RotateCw size={15} />
            Redo
          </button>
        </div>
        <div className="toolbar">
          <label>
            <input
              type="checkbox"
              checked={grid}
              onChange={(e) => setGrid(e.target.checked)}
            />{" "}
            Grid
          </label>
          <label>
            Snap{" "}
            <select
              aria-label="Snap blocks"
              value={snap}
              onChange={(e) => setSnap(Number(e.target.value))}
            >
              <option value={1}>1 block</option>
              <option value={2}>2 blocks</option>
              <option value={4}>4 blocks</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={overlap}
              onChange={(e) => setOverlap(e.target.checked)}
            />
            Allow zone overlap
          </label>
          {brush === "route" && (
            <label>
              Route type{" "}
              <select
                aria-label="Connection type"
                value={routeType}
                onChange={(e) => setRouteType(e.target.value as Route["type"])}
              >
                <option>item</option>
                <option>fluid</option>
                <option>power</option>
              </select>
            </label>
          )}
          <span className="tag">
            {b.width} × {b.height} blocks ·{" "}
            {b.zones.filter((z) => z.floor === floor).length} zones
          </span>
        </div>
      </div>
      <div className="base-status" role="status">
        {issue ||
          message ||
          "Select a brush to draw, or select a zone to move it. Empty space pans in Select mode."}
      </div>
      {error && <ErrorBox message={error} />}
      <div className="base-layout">
        <BaseCanvas
          b={b}
          cell={cell}
          floor={floor}
          grid={grid}
          viewport={viewport}
          board={board}
          keyboard={keyboard}
          down={down}
          moving={moving}
          up={up}
          cancel={() => {
            drag.current = null;
            show(undefined);
            setMessage("Placement cancelled.");
          }}
          routeSelected={routeSelected}
          selected={selected}
          routeStart={routeStart}
          brush={brush}
          addRoute={addRoute}
          setRouteStart={setRouteStart}
          setMessage={setMessage}
          setSelected={setSelected}
          setRouteSelected={setRouteSelected}
          preview={preview}
          issue={issue}
        />
        <aside className="base-inspector panel">
          <h2>
            {selectedZone
              ? "Zone inspector"
              : route
                ? "Connection inspector"
                : "Placement & layout"}
          </h2>
          {selectedZone ? (
            <ZoneInspector
              key={selectedZone.id}
              z={selectedZone}
              base={b}
              catalog={map}
              save={apply}
              duplicate={duplicate}
              remove={() => {
                commit(deleteZone(b, selectedZone.id));
                setSelected("");
              }}
            />
          ) : route ? (
            <RouteInspector
              route={route}
              base={b}
              catalog={map}
              save={(r) =>
                commit({
                  ...b,
                  routes: b.routes.map((x) => (x.id === r.id ? r : x)),
                })
              }
              remove={() => {
                commit({
                  ...b,
                  routes: b.routes.filter((x) => x.id !== route.id),
                });
                setRouteSelected("");
              }}
            />
          ) : (
            <>
              <p style={{ marginTop: 10 }}>
                Choose a type above and drag on the grid. For keyboard or
                precise placement, use these block coordinates.
              </p>
              <div className="form-row" style={{ marginTop: 15 }}>
                {[
                  ["X", x, setX],
                  ["Y", y, setY],
                  ["Width", w, setW],
                  ["Height", h, setH],
                ].map(([label, value, set]) => (
                  <label key={String(label)}>
                    {String(label)}
                    <input
                      type="number"
                      aria-label={`Placement ${label}`}
                      min={label === "X" || label === "Y" ? 0 : 1}
                      value={Number(value)}
                      onChange={(e) =>
                        (set as (n: number) => void)(Number(e.target.value))
                      }
                    />
                  </label>
                ))}
              </div>
              <button
                className="primary"
                style={{ marginTop: 15 }}
                disabled={brush === "select" || brush === "route"}
                onClick={() =>
                  apply(zone(brush as ZoneType, floor, x, y, w, h))
                }
              >
                <Plus size={15} />
                Place selected type at coordinates
              </button>
              <div className="notice">
                Each footprint is a planning zone. Link actual catalogue
                machines or materials in its inspector to create a bill.
              </div>
              <details>
                <summary>Base size & floors</summary>
                <div className="form-row" style={{ marginTop: 12 }}>
                  <label>
                    Base width
                    <input
                      aria-label="Base width"
                      type="number"
                      min={8}
                      max={128}
                      value={size.width}
                      onChange={(e) =>
                        setSize({ ...size, width: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label>
                    Base height
                    <input
                      aria-label="Base height"
                      type="number"
                      min={8}
                      max={128}
                      value={size.height}
                      onChange={(e) =>
                        setSize({ ...size, height: Number(e.target.value) })
                      }
                    />
                  </label>
                </div>
                <button
                  onClick={() => {
                    const next = { ...b, ...size };
                    if (
                      ![size.width, size.height].every(
                        (n) => Number.isInteger(n) && n >= 8 && n <= 128,
                      ) ||
                      b.zones.some((z) => placementIssue(z, next, true))
                    ) {
                      setMessage(
                        "Size must be 8–128 blocks and keep every existing zone in bounds.",
                      );
                      return;
                    }
                    commit(next);
                  }}
                >
                  Apply base size
                </button>
                {b.floorNames.map((name, i) => (
                  <label className="stacked" key={i}>
                    Floor {i}
                    <input
                      aria-label={`Floor ${i} name`}
                      value={name}
                      onChange={(e) =>
                        commit({
                          ...b,
                          floorNames: b.floorNames.map((n, j) =>
                            j === i ? e.target.value : n,
                          ),
                        })
                      }
                    />
                  </label>
                ))}
                <button
                  disabled={b.floorNames.length >= 16}
                  onClick={() =>
                    commit({
                      ...b,
                      floorNames: [
                        ...b.floorNames,
                        `Floor ${b.floorNames.length}`,
                      ],
                    })
                  }
                >
                  Add floor
                </button>
                <button
                  disabled={
                    b.floorNames.length <= 1 ||
                    b.zones.some((z) => z.floor === b.floorNames.length - 1)
                  }
                  onClick={() =>
                    commit({ ...b, floorNames: b.floorNames.slice(0, -1) })
                  }
                >
                  Remove empty top floor
                </button>
              </details>
              <details>
                <summary>Optional four-floor 48×48 example</summary>
                <p>
                  Farms above, kitchen/storage in the middle, machines below and
                  ore processing underground. Editable zones; no invented stock
                  or material bill.
                </p>
                <button
                  onClick={() => {
                    if (b.zones.length) {
                      setMessage(
                        "Template only loads into an empty base. Export your world, then delete zones or start a new world.",
                      );
                      return;
                    }
                    commit(exampleBase());
                    setFloor(1);
                    setSize({ width: 48, height: 48 });
                  }}
                >
                  Load example into empty base
                </button>
              </details>
            </>
          )}
          {b.routes.length > 0 && (
            <>
              <h3>Connections</h3>
              {b.routes.map((r) => (
                <button
                  key={r.id}
                  className="prereq"
                  onClick={() => {
                    setRouteSelected(r.id);
                    setSelected("");
                  }}
                >
                  {r.type === "item" ? "▸" : r.type === "fluid" ? "≈" : "ϟ"}{" "}
                  {r.name} ({r.type})
                </button>
              ))}
            </>
          )}
          <h3>Floor objects</h3>
          <div className="floor-objects">
            {b.zones
              .filter((z) => z.floor === floor)
              .map((z) => (
                <button
                  key={z.id}
                  className="prereq"
                  onClick={() => {
                    setSelected(z.id);
                    setRouteSelected("");
                  }}
                >
                  <Move size={13} />
                  {z.name} ({z.x}, {z.y})
                </button>
              ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
