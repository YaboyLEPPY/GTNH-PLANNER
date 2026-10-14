import type { RefObject, PointerEvent, KeyboardEvent } from "react";
import type { Base, Zone, ZoneType } from "../domain/world";
import { ZONE_COLORS } from "../domain/base";
interface CanvasProps {
  b: Base;
  cell: number;
  floor: number;
  grid: boolean;
  viewport: RefObject<HTMLDivElement | null>;
  board: RefObject<HTMLDivElement | null>;
  keyboard: (e: KeyboardEvent) => void;
  down: (e: PointerEvent<HTMLDivElement>, z?: Zone, resize?: boolean) => void;
  moving: (e: PointerEvent<HTMLDivElement>) => void;
  up: () => void;
  cancel: () => void;
  routeSelected: string;
  selected: string;
  routeStart: string;
  brush: ZoneType | "select" | "route";
  addRoute: (from: string, to: string) => void;
  setRouteStart: (s: string) => void;
  setMessage: (s: string) => void;
  setSelected: (s: string) => void;
  setRouteSelected: (s: string) => void;
  preview?: Zone;
  issue: string;
}
export function BaseCanvas({
  b,
  cell,
  floor,
  grid,
  viewport,
  board,
  keyboard,
  down,
  moving,
  up,
  cancel,
  routeSelected,
  selected,
  routeStart,
  brush,
  addRoute,
  setRouteStart,
  setMessage,
  setSelected,
  setRouteSelected,
  preview,
  issue,
}: CanvasProps) {
  return (
    <section>
      <div
        className="base-viewport"
        ref={viewport}
        tabIndex={0}
        aria-label="Base grid. Selected zones move with arrow keys; Delete removes them; Control Z undoes."
        onKeyDown={keyboard}
      >
        <div
          className="base-board"
          ref={board}
          style={{
            width: b.width * cell,
            height: b.height * cell,
            backgroundSize: `${cell}px ${cell}px`,
            backgroundImage: grid ? undefined : "none",
          }}
          onPointerDown={(e) => down(e)}
          onPointerMove={moving}
          onPointerUp={up}
          onPointerCancel={cancel}
        >
          <div className="coord-row" aria-hidden="true">
            {Array.from({ length: Math.ceil(b.width / 4) }, (_, i) => (
              <span key={i} style={{ left: i * 4 * cell }}>
                {i * 4}
              </span>
            ))}
          </div>
          <div className="coord-col" aria-hidden="true">
            {Array.from({ length: Math.ceil(b.height / 4) }, (_, i) => (
              <span key={i} style={{ top: i * 4 * cell }}>
                {i * 4}
              </span>
            ))}
          </div>
          <svg
            width={b.width * cell}
            height={b.height * cell}
            className="base-routes"
            aria-label="Logical item, fluid and power connections"
          >
            <defs>
              <marker
                id="route-arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
              </marker>
            </defs>
            {b.routes.map((r) => {
              const from = b.zones.find((z) => z.id === r.from),
                to = b.zones.find((z) => z.id === r.to);
              if (!from || !to || (from.floor !== floor && to.floor !== floor))
                return null;
              const color =
                r.type === "item"
                  ? "#d9c39a"
                  : r.type === "fluid"
                    ? "#7dc3dc"
                    : "#d5a3d8";
              const a = from.floor === floor ? from : to,
                other = from.floor === floor ? to : from;
              const ax = (a.x + a.width / 2) * cell,
                ay = (a.y + a.height / 2) * cell,
                bx = (other.x + other.width / 2) * cell,
                by = (other.y + other.height / 2) * cell;
              return (
                <g
                  key={r.id}
                  className={r.id === routeSelected ? "selected-route" : ""}
                >
                  <path
                    d={`M ${ax} ${ay} H ${bx} V ${by}`}
                    fill="none"
                    stroke={color}
                    strokeWidth="3"
                    strokeDasharray={
                      r.type === "fluid"
                        ? "6 4"
                        : r.type === "power"
                          ? "2 4"
                          : other.floor !== floor
                            ? "10 6"
                            : undefined
                    }
                    markerEnd="url(#route-arrow)"
                    markerStart={
                      r.direction === "both" ? "url(#route-arrow)" : undefined
                    }
                  />
                  <text x={(ax + bx) / 2} y={ay - 6} fill={color} fontSize="10">
                    {r.type}
                    {other.floor !== floor ? ` → floor ${other.floor}` : ""}
                  </text>
                </g>
              );
            })}
          </svg>
          {b.zones
            .filter((z) => z.floor === floor)
            .map((z) => (
              <div
                key={z.id}
                className={`base-zone ${selected === z.id ? "selected" : ""} ${routeStart === z.id ? "route-start" : ""}`}
                style={{
                  left: z.x * cell,
                  top: z.y * cell,
                  width: z.width * cell,
                  height: z.height * cell,
                  background: `${ZONE_COLORS[z.type]}30`,
                  borderColor: ZONE_COLORS[z.type],
                }}
                onPointerDown={(e) => down(e, z)}
              >
                <button
                  className="zone-label"
                  aria-label={`Select ${z.name} at ${z.x}, ${z.y}`}
                  onClick={() => {
                    if (brush === "route") {
                      if (routeStart) addRoute(routeStart, z.id);
                      else {
                        setRouteStart(z.id);
                        setMessage("Choose destination.");
                      }
                    } else {
                      setSelected(z.id);
                      setRouteSelected("");
                    }
                  }}
                >
                  <span>{z.name}</span>
                  <small>
                    {z.width}×{z.height} · {z.type}
                  </small>
                </button>
                {selected === z.id && (
                  <div
                    className="resize-grip"
                    aria-hidden="true"
                    onPointerDown={(e) => down(e, z, true)}
                  />
                )}
              </div>
            ))}
          {preview && (
            <div
              className={`placement-preview ${issue ? "invalid" : ""}`}
              style={{
                left: preview.x * cell,
                top: preview.y * cell,
                width: preview.width * cell,
                height: preview.height * cell,
              }}
            >
              {preview.width}×{preview.height}
            </div>
          )}
        </div>
      </div>
      <div className="base-overview">
        <svg
          width="120"
          height="120"
          viewBox={`0 0 ${b.width} ${b.height}`}
          role="img"
          aria-label="Current floor overview"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            if (viewport.current) {
              viewport.current.scrollLeft =
                ((e.clientX - r.left) / r.width) * b.width * cell -
                viewport.current.clientWidth / 2;
              viewport.current.scrollTop =
                ((e.clientY - r.top) / r.height) * b.height * cell -
                viewport.current.clientHeight / 2;
            }
          }}
        >
          {b.zones
            .filter((z) => z.floor === floor)
            .map((z) => (
              <rect
                key={z.id}
                x={z.x}
                y={z.y}
                width={z.width}
                height={z.height}
                fill={ZONE_COLORS[z.type]}
              />
            ))}
        </svg>
        <p>
          Floor overview · Click to pan
          <br />
          Move: drag or arrow keys · Resize: corner handle or inspector
          <br />
          Connections are logical plans; validate routing in game.
        </p>
      </div>
    </section>
  );
}
