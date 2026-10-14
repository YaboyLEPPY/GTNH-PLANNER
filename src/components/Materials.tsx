import { useEffect, useMemo, useState } from "react";
import { Package, Plus, RotateCcw, Check, Trash2 } from "lucide-react";
import type { Goods } from "../types";
import { getCatalog, getRecipes, format } from "../data";
import { CatalogPicker } from "./Production";
import { Icon, ErrorBox, Empty } from "./Common";
import { buildLedger, type LedgerResult } from "../domain/ledger";
import { calculate } from "../domain/production";
import {
  completeOrder,
  type World,
  type Resource,
  type Order,
} from "../domain/world";
const defaultResource = (g?: Goods): Resource => ({
  name: g?.name || "Manual resource",
  unit: g?.unit || "items",
  desired: 0,
  reserved: 0,
  notes: "",
  location: "",
});
export function Materials({
  world,
  update,
  undo,
  canUndo,
}: {
  world: World;
  update: (w: World) => void;
  undo: () => void;
  canUndo: boolean;
}) {
  const [catalog, setCatalog] = useState<Goods[]>(),
    [ledger, setLedger] = useState<LedgerResult>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(""),
    [manual, setManual] = useState(""),
    [unit, setUnit] = useState("items"),
    [status, setStatus] = useState(""),
    [completing, setCompleting] = useState("");
  const map = useMemo(() => new Map(catalog?.map((g) => [g.id, g])), [catalog]);
  useEffect(() => {
    getCatalog()
      .then(setCatalog)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!catalog) return;
    const ac = new AbortController();
    setBusy(true);
    setError("");
    buildLedger(world, map, getRecipes, ac.signal)
      .then((l) => {
        if (!ac.signal.aborted) setLedger(l);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!ac.signal.aborted) setBusy(false);
      });
    return () => ac.abort();
  }, [world, map, catalog]);
  const add = (g: Goods) => {
    if (!world.resources[g.id])
      update({
        ...world,
        resources: { ...world.resources, [g.id]: defaultResource(g) },
      });
  };
  function edit(id: string, patch: Partial<Resource>) {
    const r = world.resources[id] || defaultResource(map.get(id));
    update({
      ...world,
      resources: { ...world.resources, [id]: { ...r, ...patch } },
    });
  }
  function owned(id: string, n: number) {
    if (Number.isFinite(n) && n >= 0)
      update({ ...world, stock: { ...world.stock, [id]: n } });
  }
  async function finish(o: Order) {
    setCompleting(o.orderId);
    setStatus("");
    try {
      const stock = { ...world.stock };
      for (const [id, r] of Object.entries(world.resources))
        stock[id] = Math.max(0, (stock[id] || 0) - r.reserved);
      const c = await calculate([{ id: o.id, amount: o.amount }], {
        catalog: map,
        getRecipes,
        stock,
        tier: o.tier,
        boundary: o.boundary,
        choices: o.choices,
      });
      const missing = c.bill.filter((r) => r.missing > 0);
      const tools = Object.entries(c.catalysts).filter(
        ([id, n]) => (stock[id] || 0) < n,
      );
      if (missing.length || tools.length) {
        setStatus(
          `Build not completed: gather ${missing.length} missing resources and supply ${tools.length} reusable tools first. Stock was not changed.`,
        );
        return;
      }
      update(completeOrder(world, o.orderId, c.stockUsed, c.surplus));
      setStatus(
        "Build completed: consumed allocated stock and added the output plus deterministic primary surplus. Undo is available.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCompleting("");
    }
  }
  const rows = ledger?.rows.filter((r) =>
    `${r.name} ${r.id} ${world.resources[r.id]?.notes || ""} ${world.resources[r.id]?.location || ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div>
      <div className="page-heading">
        <div>
          <div className="eyebrow">TAKE THIS LIST INTO YOUR WORLD</div>
          <h1>
            Materials <span>& gathering</span>
          </h1>
          <p>One stock ledger for quests, production and your base.</p>
        </div>
        <Package size={36} color="#8e9bbf" />
      </div>
      <div className="toolbar" style={{ marginBottom: 16 }}>
        <button onClick={undo} disabled={!canUndo}>
          <RotateCcw size={15} />
          Undo last action
        </button>
        <span role="status">{busy ? "Recomputing shared demand…" : ""}</span>
      </div>
      {status && (
        <div className="notice" role="status">
          {status}
        </div>
      )}
      {error && <ErrorBox message={error} />}
      <div className="columns">
        <section className="panel">
          <h2>Add a tracked resource</h2>
          <div style={{ marginTop: 14 }}>
            <CatalogPicker
              select={add}
              placeholder="Add an item or fluid to stock…"
            />
          </div>
          <details>
            <summary>Missing from the catalogue? Add a manual resource</summary>
            <div className="form-row" style={{ marginTop: 12 }}>
              <label>
                Resource name
                <input
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  aria-label="Manual resource name"
                />
              </label>
              <label>
                Unit
                <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                  <option>items</option>
                  <option>mB</option>
                  <option>blocks</option>
                </select>
              </label>
              <button
                onClick={() => {
                  if (!manual.trim()) return;
                  const id = `manual:${crypto.randomUUID()}`;
                  update({
                    ...world,
                    resources: {
                      ...world.resources,
                      [id]: {
                        ...defaultResource(),
                        name: manual.trim(),
                        unit,
                        manual: true,
                      },
                    },
                  });
                  setManual("");
                }}
              >
                <Plus size={15} />
                Add manual
              </button>
            </div>
          </details>
        </section>
        <aside className="panel">
          <h2>Stock, targets & reservations</h2>
          <p style={{ marginTop: 12 }}>
            “Owned” is what you have now. “Reserved” is stock you keep aside.
            Missing demand is calculated after reservations and all open orders.
          </p>
          <div className="notice">
            Manual and quest targets describe desired stock. They overlap
            existing demand rather than adding it twice. Planned base equipment
            is a separate physical demand.
          </div>
        </aside>
      </div>
      <section className="panel" style={{ marginTop: 20 }}>
        <div className="split-heading">
          <h2>Gathering ledger</h2>
          <input
            aria-label="Search resource ledger"
            placeholder="Filter resources or vein notes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {rows?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Resource / sources</th>
                  <th>Owned</th>
                  <th>Target</th>
                  <th>Reserved</th>
                  <th>Open need</th>
                  <th>Missing</th>
                  <th>Quick add</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="item-row">
                        <Icon goods={map.get(r.id)} />
                        <span>
                          <strong>{r.name}</strong>
                          <small>
                            {r.unit}
                            {r.manual ? " · User entered" : ""}
                          </small>
                        </span>
                      </div>
                      <details>
                        <summary>Sources, notes & location</summary>
                        <p>{r.sources.join(" · ") || "Tracked stock"}</p>
                        <label className="stacked">
                          Location / vein
                          <input
                            aria-label={`Location for ${r.name}`}
                            value={world.resources[r.id]?.location || ""}
                            onChange={(e) =>
                              edit(r.id, { location: e.target.value })
                            }
                          />
                        </label>
                        <label className="stacked">
                          Notes
                          <textarea
                            aria-label={`Notes for ${r.name}`}
                            value={world.resources[r.id]?.notes || ""}
                            onChange={(e) =>
                              edit(r.id, { notes: e.target.value })
                            }
                          />
                        </label>
                        <p>{r.reasons.join(" · ")}</p>
                      </details>
                    </td>
                    <td>
                      <input
                        aria-label={`Owned ${r.name}`}
                        type="number"
                        min={0}
                        step={r.unit === "items" ? 1 : "any"}
                        value={world.stock[r.id] || 0}
                        onChange={(e) => owned(r.id, Number(e.target.value))}
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`Target ${r.name}`}
                        type="number"
                        min={0}
                        value={world.resources[r.id]?.desired || 0}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (n >= 0) edit(r.id, { desired: n });
                        }}
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`Reserved ${r.name}`}
                        type="number"
                        min={0}
                        value={world.resources[r.id]?.reserved || 0}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (n >= 0) edit(r.id, { reserved: n });
                        }}
                      />
                    </td>
                    <td>{format(r.needed)}</td>
                    <td className={r.missing ? "missing" : "good"}>
                      {format(r.missing)}
                    </td>
                    <td>
                      <button
                        aria-label={`Gather ${r.name}`}
                        onClick={() =>
                          owned(
                            r.id,
                            (world.stock[r.id] || 0) +
                              (r.unit === "mB" ? 1000 : 64),
                          )
                        }
                      >
                        +{r.unit === "mB" ? "1,000" : "64"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Your gathering list starts here">
            Save a production order, link a quest target, plan base equipment,
            or add your stock above.
          </Empty>
        )}
      </section>
      <section className="panel" style={{ marginTop: 20 }}>
        <div className="section-heading" style={{ marginTop: 0 }}>
          <h2>Production orders</h2>
          <span>
            {world.orders.filter((o) => o.status === "open").length} open
          </span>
        </div>
        {world.orders.length ? (
          world.orders.map((o) => (
            <div className="order" key={o.orderId}>
              <div className="toolbar">
                <div className="item-row">
                  <Icon goods={map.get(o.id)} />
                  <span>
                    <strong>
                      {format(o.amount)} {map.get(o.id)?.name || o.id}
                    </strong>
                    <small>
                      {o.status === "completed"
                        ? "✓ Completed — excluded from demand"
                        : o.source || "Open manufacturing order"}
                    </small>
                  </span>
                </div>
                <div className="toolbar">
                  {o.status === "open" && (
                    <button
                      className="primary"
                      disabled={!!completing || busy}
                      onClick={() => void finish(o)}
                    >
                      <Check size={15} />
                      {completing === o.orderId
                        ? "Checking stock…"
                        : "Complete build"}
                    </button>
                  )}
                  <button
                    aria-label={`Delete order ${o.amount} ${map.get(o.id)?.name || o.id}`}
                    onClick={() =>
                      update({
                        ...world,
                        orders: world.orders.filter(
                          (x) => x.orderId !== o.orderId,
                        ),
                      })
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <small>
                Completion deducts actual required stock and credits the output.
                Gather first; tools must be present. Undo restores the previous
                state.
              </small>
            </div>
          ))
        ) : (
          <p>No saved orders. Start with an output in Production.</p>
        )}
        {Object.keys(world.questTargets).length > 0 && (
          <>
            <h3>Quest gathering targets</h3>
            {Object.entries(world.questTargets).map(([key, t]) => (
              <div className="order" key={key}>
                <div className="toolbar">
                  <span>
                    {t.quest}: {t.amount} {map.get(t.id)?.name || t.id}
                  </span>
                  <button
                    onClick={() => {
                      const targets = { ...world.questTargets };
                      delete targets[key];
                      update({ ...world, questTargets: targets });
                    }}
                  >
                    Remove target
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </section>
      {ledger?.warnings.length && (
        <details>
          <summary>Recipe calculation caveats for open orders</summary>
          <ul>
            {ledger.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
