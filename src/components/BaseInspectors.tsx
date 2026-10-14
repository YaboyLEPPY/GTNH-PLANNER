import { useEffect, useState } from "react";
import { Copy, RotateCw, Trash2 } from "lucide-react";
import type { Zone, ZoneType, Base, Route } from "../domain/world";
import type { Goods } from "../types";
import { ZONE_TYPES } from "../domain/base";
import { CatalogPicker } from "./Production";
import { Icon } from "./Common";
export function ZoneInspector({
  z,
  base,
  catalog,
  save,
  duplicate,
  remove,
}: {
  z: Zone;
  base: Base;
  catalog: Map<string, Goods>;
  save: (z: Zone) => void;
  duplicate: () => void;
  remove: () => void;
}) {
  const [d, setD] = useState(z);
  useEffect(() => setD(z), [z]);
  const edit = (patch: Partial<Zone>) => setD({ ...d, ...patch });
  return (
    <>
      <label className="stacked">
        Name
        <input
          aria-label="Zone name"
          value={d.name}
          onChange={(e) => edit({ name: e.target.value })}
        />
      </label>
      <div className="form-row">
        <label>
          Type
          <select
            value={d.type}
            onChange={(e) => edit({ type: e.target.value as ZoneType })}
          >
            {ZONE_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          Floor
          <select
            aria-label="Zone floor"
            value={d.floor}
            onChange={(e) => edit({ floor: Number(e.target.value) })}
          >
            {base.floorNames.map((n, i) => (
              <option key={i} value={i}>
                {i}: {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="form-row" style={{ marginTop: 12 }}>
        {["x", "y", "width", "height", "machineCount"].map((k) => (
          <label key={k}>
            {k === "machineCount" ? "Machine count" : k}
            <input
              aria-label={`Zone ${k}`}
              type="number"
              min={k === "width" || k === "height" ? 1 : 0}
              value={d[k as keyof Zone] as number}
              onChange={(e) => edit({ [k]: Number(e.target.value) })}
            />
          </label>
        ))}
      </div>
      <label className="stacked">
        Notes
        <textarea
          aria-label="Zone notes"
          value={d.notes}
          onChange={(e) => edit({ notes: e.target.value })}
        />
      </label>
      <label className="stacked">
        Energy / tier notes
        <input
          value={d.energy}
          onChange={(e) => edit({ energy: e.target.value })}
        />
      </label>
      <label className="stacked">
        Inputs
        <input
          value={d.inputs}
          onChange={(e) => edit({ inputs: e.target.value })}
        />
      </label>
      <label className="stacked">
        Outputs
        <input
          value={d.outputs}
          onChange={(e) => edit({ outputs: e.target.value })}
        />
      </label>
      <label className="toolbar">
        <input
          type="checkbox"
          checked={d.planned}
          onChange={(e) => edit({ planned: e.target.checked })}
        />{" "}
        Include in gathering demand
      </label>
      <h3>Actual equipment</h3>
      <CatalogPicker
        placeholder="Link a machine or storage item…"
        select={(g) =>
          edit({ goodsId: g.id, machineCount: Math.max(1, d.machineCount) })
        }
      />
      {d.goodsId && (
        <div className="item-row">
          <Icon goods={catalog.get(d.goodsId)} />
          <span>
            {catalog.get(d.goodsId)?.name || d.goodsId}
            <small>{d.machineCount} units</small>
          </span>
          <button onClick={() => edit({ goodsId: undefined })}>Unlink</button>
        </div>
      )}
      <h3>Additional material bill</h3>
      <p style={{ fontSize: 11 }}>
        Enter verified quantities. Footprints do not imply multiblock casing
        costs.
      </p>
      <CatalogPicker
        placeholder="Add material to this zone…"
        select={(g) =>
          edit({
            materials: d.materials.some((m) => m.id === g.id)
              ? d.materials
              : [...d.materials, { id: g.id, amount: 1 }],
          })
        }
      />
      {d.materials.map((m) => (
        <div className="item-row" key={m.id}>
          <Icon goods={catalog.get(m.id)} />
          <span>{catalog.get(m.id)?.name || m.id}</span>
          <input
            aria-label={`Zone material ${catalog.get(m.id)?.name || m.id}`}
            type="number"
            min={0}
            value={m.amount}
            onChange={(e) =>
              edit({
                materials: d.materials.map((x) =>
                  x.id === m.id
                    ? { ...x, amount: Math.max(0, Number(e.target.value)) }
                    : x,
                ),
              })
            }
          />
          <button
            aria-label={`Remove zone material ${m.id}`}
            onClick={() =>
              edit({ materials: d.materials.filter((x) => x.id !== m.id) })
            }
          >
            ×
          </button>
        </div>
      ))}
      <div className="toolbar" style={{ marginTop: 20 }}>
        <button
          className="primary"
          onClick={() => {
            if (
              !Number.isInteger(d.machineCount) ||
              d.machineCount < 0 ||
              d.materials.some(
                (m) => !Number.isFinite(m.amount) || m.amount < 0,
              )
            )
              return;
            save(d);
          }}
        >
          Save zone changes
        </button>
        <button
          aria-label="Rotate selected zone"
          onClick={() => {
            const next = { ...d, width: d.height, height: d.width };
            setD(next);
            save(next);
          }}
        >
          <RotateCw size={15} />
        </button>
        <button aria-label="Duplicate selected zone" onClick={duplicate}>
          <Copy size={15} />
        </button>
        <button
          aria-label="Delete selected zone"
          className="danger"
          onClick={remove}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </>
  );
}
export function RouteInspector({
  route,
  base,
  catalog,
  save,
  remove,
}: {
  route: Route;
  base: Base;
  catalog: Map<string, Goods>;
  save: (r: Route) => void;
  remove: () => void;
}) {
  const [d, setD] = useState(route);
  useEffect(() => setD(route), [route]);
  return (
    <>
      <label className="stacked">
        Connection name
        <input
          aria-label="Connection name"
          value={d.name}
          onChange={(e) => setD({ ...d, name: e.target.value })}
        />
      </label>
      <label className="stacked">
        Type
        <select
          aria-label="Route type"
          value={d.type}
          onChange={(e) =>
            setD({ ...d, type: e.target.value as Route["type"] })
          }
        >
          <option>item</option>
          <option>fluid</option>
          <option>power</option>
        </select>
      </label>
      {["from", "to"].map((k) => (
        <label className="stacked" key={k}>
          {k === "from" ? "Source" : "Destination"}
          <select
            aria-label={`Connection ${k}`}
            value={d[k as "from" | "to"]}
            onChange={(e) => setD({ ...d, [k]: e.target.value })}
          >
            {base.zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name} · floor {z.floor}
              </option>
            ))}
          </select>
        </label>
      ))}
      <label className="stacked">
        Direction
        <select
          value={d.direction}
          onChange={(e) =>
            setD({ ...d, direction: e.target.value as Route["direction"] })
          }
        >
          <option value="forward">Source → destination</option>
          <option value="both">Both directions</option>
        </select>
      </label>
      <CatalogPicker
        placeholder="Link pipe or cable material…"
        select={(g) => setD({ ...d, goodsId: g.id })}
      />
      {d.goodsId && (
        <div className="item-row">
          <Icon goods={catalog.get(d.goodsId)} />
          <span>{catalog.get(d.goodsId)?.name || d.goodsId}</span>
          <button onClick={() => setD({ ...d, goodsId: undefined })}>
            Unlink
          </button>
        </div>
      )}
      <label className="stacked">
        Material quantity (editable estimate)
        <input
          aria-label="Route material quantity"
          type="number"
          min={0}
          value={d.amount}
          onChange={(e) => setD({ ...d, amount: Number(e.target.value) })}
        />
      </label>
      <p className="notice">
        Routes show planning intent and floor transitions. Actual GTNH
        pipe/cable connectivity, capacity and compatibility must be checked in
        game.
      </p>
      <div className="toolbar">
        <button
          className="primary"
          onClick={() => {
            if (d.from !== d.to && d.amount >= 0 && Number.isFinite(d.amount))
              save(d);
          }}
        >
          Save connection
        </button>
        <button className="danger" onClick={remove}>
          Delete connection
        </button>
      </div>
    </>
  );
}
