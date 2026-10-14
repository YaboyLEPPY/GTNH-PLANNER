import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Anvil, Plus, RotateCcw, Copy, Download } from "lucide-react";
import { getCatalog, getRecipes, format, load } from "../data";
import type { Goods, SourceItem } from "../types";
import {
  calculate,
  TIERS,
  type Calculation,
  type Choices,
  type ProductionStep,
  type CalcOptions,
} from "../domain/production";
import { Icon, ErrorBox, Empty } from "./Common";
export interface ProductionDraft {
  id: string;
  amount: number;
  source?: string;
}
export interface SavedPlan {
  id: string;
  amount: number;
  source?: string;
  tier: number;
  boundary: CalcOptions["boundary"];
  choices: Choices;
}
export function CatalogPicker({
  select,
  placeholder = "Find an item or fluid…",
}: {
  select: (g: Goods) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(""),
    [catalog, setCatalog] = useState<Goods[]>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function search(s: string) {
    setQuery(s);
    if (!catalog && s) {
      setBusy(true);
      try {
        setCatalog(await getCatalog());
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    }
  }
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const results = useMemo(
    () =>
      query.trim()
        ? catalog
            ?.filter((g) =>
              terms.every((t) => `${g.name} ${g.id}`.toLowerCase().includes(t)),
            )
            .sort((a, b) =>
              a.name.toLowerCase() === query.toLowerCase()
                ? -1
                : b.name.toLowerCase() === query.toLowerCase()
                  ? 1
                  : a.name.length - b.name.length,
            )
            .slice(0, 60)
        : [],
    [catalog, query],
  );
  return (
    <div>
      <label className="search">
        <Search size={17} />
        <input
          aria-label={placeholder}
          placeholder={placeholder}
          value={query}
          onChange={(e) => void search(e.target.value)}
        />
        {query && <button onClick={() => setQuery("")}>Clear</button>}
      </label>
      {busy && <p>Loading the item catalogue…</p>}
      {error && <ErrorBox message={error} />}
      <div className={query ? "catalog-results" : ""}>
        {results?.map((g) => (
          <button
            key={g.id}
            onClick={() => {
              select(g);
              setQuery("");
            }}
          >
            <Icon goods={g} />
            <span>
              {g.name}
              <small>
                {g.mod} · {g.kind === "fluid" ? "mB" : `${g.damage} metadata`} ·{" "}
                {g.recipes} recipes{g.nbt ? " · NBT-specific" : ""}
              </small>
            </span>
          </button>
        ))}
        {query && results?.length === 0 && !busy && (
          <p className="notice">
            No verified catalogue match. Add a manual resource in Materials.
          </p>
        )}
      </div>
    </div>
  );
}
export function Production({
  draft,
  stock,
  onSave,
  onGather,
}: {
  draft: ProductionDraft | null;
  stock: Record<string, number>;
  onSave: (p: SavedPlan) => void;
  onGather: (
    bill: { id: string; amount: number; name: string; unit: string }[],
  ) => void;
}) {
  const [catalog, setCatalog] = useState<Goods[]>(),
    [machines, setMachines] = useState<string[]>([]),
    [machineToAdd, setMachineToAdd] = useState("");
  const [target, setTarget] = useState<Goods>(),
    [quantity, setQuantity] = useState(draft?.amount || 20),
    [tier, setTier] = useState(0),
    [boundary, setBoundary] = useState<CalcOptions["boundary"]>("ingots"),
    [choices, setChoices] = useState<Choices>({
      recipes: {},
      alternatives: {},
      stops: [],
    }),
    [calc, setCalc] = useState<Calculation>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const controller = useRef<AbortController | null>(null);
  const map = useMemo(() => new Map(catalog?.map((g) => [g.id, g])), [catalog]);
  useEffect(() => {
    load<string[]>("machines.json")
      .then(setMachines)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    getCatalog()
      .then((c) => {
        setCatalog(c);
        if (draft) setTarget(c.find((g) => g.id === draft.id));
      })
      .catch((e) => setError(e.message));
  }, [draft]);
  useEffect(() => {
    controller.current?.abort();
    setBusy(false);
    setCalc(undefined);
    setMessage("");
  }, [target, quantity, tier, boundary, choices, stock]);
  useEffect(() => () => controller.current?.abort(), []);
  async function run() {
    if (!target) return;
    controller.current?.abort();
    const ac = new AbortController();
    controller.current = ac;
    setBusy(true);
    setError("");
    try {
      const result = await calculate([{ id: target.id, amount: quantity }], {
        tier,
        boundary,
        choices,
        stock,
        getRecipes,
        catalog: map,
        signal: ac.signal,
      });
      if (!ac.signal.aborted) setCalc(result);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      if (controller.current === ac) setBusy(false);
    }
  }
  function choose(id: string, rid: string) {
    setChoices((c) => ({ ...c, recipes: { ...c.recipes, [id]: rid } }));
  }
  const csv = () =>
    `Item,Unit,Needed,Allocated stock,Missing\n${calc?.bill.map((r) => `"${(map.get(r.id)?.name || r.id).replaceAll('"', '""')}",${map.get(r.id)?.unit || "items"},${r.needed},${r.stockUsed},${r.missing}`).join("\n")}`;
  return (
    <div>
      <div className="page-heading">
        <div>
          <div className="eyebrow">FROM AN IDEA TO A STACK OF PARTS</div>
          <h1>
            Production <span>planner</span>
          </h1>
          <p>Choose an output. Set the quantity. See what you actually need.</p>
        </div>
        <Anvil size={36} color="#8e9bbf" />
      </div>
      <div className="columns">
        <section className="panel">
          <h2>What are you making?</h2>
          <p style={{ margin: "8px 0 18px" }}>
            Search all {catalog?.length.toLocaleString() || "…"} source items
            and fluids.
          </p>
          <CatalogPicker
            select={(g) => {
              setTarget(g);
              setChoices({ recipes: {}, alternatives: {}, stops: [] });
            }}
          />
          {!target && (
            <button
              disabled={!catalog}
              style={{ marginTop: 14 }}
              onClick={() => {
                setTarget(
                  catalog?.find((g) => g.id === "i:IC2:itemPartCircuit:0"),
                );
                setQuantity(20);
              }}
            >
              Try 20 Electronic Circuits →
            </button>
          )}
          {target && (
            <>
              <div className="item-row" style={{ margin: "15px 0" }}>
                <Icon goods={target} size={48} />
                <span>
                  <strong>{target.name}</strong>
                  <small>
                    {target.id}
                    {draft?.source && ` · From ${draft.source}`}
                  </small>
                </span>
              </div>
              <div className="form-row">
                <label>
                  Quantity ({target.unit})
                  <input
                    aria-label="Target quantity"
                    type="number"
                    min="1"
                    step={target.kind === "item" ? 1 : "any"}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                  />
                </label>
                <label>
                  Available voltage tier
                  <select
                    aria-label="Available voltage tier"
                    value={tier}
                    onChange={(e) => setTier(Number(e.target.value))}
                  >
                    <option value={-1}>Steam / manual only</option>
                    {TIERS.map((t, i) => (
                      <option key={t} value={i}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Stop expanding at
                  <select
                    aria-label="Gathering boundary"
                    value={boundary}
                    onChange={(e) =>
                      setBoundary(e.target.value as typeof boundary)
                    }
                  >
                    <option value="gathered">Gathered resources</option>
                    <option value="ingots">
                      Ingots, dusts & gathered resources
                    </option>
                    <option value="components">
                      Components & gathered resources
                    </option>
                  </select>
                </label>
              </div>
              <details>
                <summary>Machine ownership (optional strict filter)</summary>
                <label className="toolbar" style={{ margin: "12px 0" }}>
                  <input
                    type="checkbox"
                    checked={choices.availableMachines !== undefined}
                    onChange={(e) =>
                      setChoices((c) => ({
                        ...c,
                        availableMachines: e.target.checked
                          ? ["Crafting (Shaped)", "Crafting (Shapeless)"]
                          : undefined,
                      }))
                    }
                  />
                  Only use recipe types I can run
                </label>
                {choices.availableMachines && (
                  <>
                    <div className="toolbar">
                      <select
                        className="machine-choice"
                        aria-label="Available machine recipe type"
                        value={machineToAdd}
                        onChange={(e) => setMachineToAdd(e.target.value)}
                      >
                        <option value="">
                          Choose a source machine / recipe type…
                        </option>
                        {machines.map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          if (machineToAdd)
                            setChoices((c) => ({
                              ...c,
                              availableMachines: [
                                ...new Set([
                                  ...(c.availableMachines || []),
                                  machineToAdd,
                                ]),
                              ],
                            }));
                        }}
                      >
                        Add machine type
                      </button>
                    </div>
                    <div className="toolbar" style={{ marginTop: 10 }}>
                      {choices.availableMachines.map((m) => (
                        <button
                          key={m}
                          aria-label={`Remove available ${m}`}
                          onClick={() =>
                            setChoices((c) => ({
                              ...c,
                              availableMachines: c.availableMachines?.filter(
                                (x) => x !== m,
                              ),
                            }))
                          }
                        >
                          {m} ×
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <p style={{ marginTop: 10, fontSize: 11 }}>
                  With this enabled, unavailable machine recipes remain
                  unresolved. Tier, research and special-condition checks still
                  apply.
                </p>
              </details>
              <div className="toolbar" style={{ marginTop: 20 }}>
                <button
                  className="primary"
                  onClick={() => void run()}
                  disabled={busy}
                >
                  {busy ? "Calculating…" : "Calculate materials"}
                </button>
                {busy && (
                  <button
                    onClick={() => {
                      controller.current?.abort();
                      setBusy(false);
                    }}
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={() =>
                    setChoices({ recipes: {}, alternatives: {}, stops: [] })
                  }
                >
                  <RotateCcw size={15} />
                  Reset choices
                </button>
              </div>
            </>
          )}
        </section>
        <aside className="panel">
          <div className="eyebrow">A PLAN YOU CAN CHECK IN NEI</div>
          <h2>Know your route</h2>
          <p style={{ marginTop: 12 }}>
            Recipes come from <strong>GTNH 2.9.0-v7</strong>. Quests use{" "}
            <strong>2.9.0-beta-3</strong>. Verify recipe details against your
            installed pack.
          </p>
          <p style={{ marginTop: 12 }}>
            The default route prefers ordinary crafting and avoids direct
            recycling. It is a transparent heuristic, not an optimized factory
            solver.
          </p>
          <p style={{ marginTop: 12 }}>
            Voltage is checked. Machine ownership, research, dimensions and
            special conditions need your review. Fluids use mB.
          </p>
          <div className="notice">
            Shared stock is allocated once across the calculation. No stock is
            deducted until you explicitly complete a saved production order.
          </div>
        </aside>
      </div>
      {error && <ErrorBox message={error} />}
      <div role="status">{message && <p className="notice">{message}</p>}</div>
      {calc && target && (
        <>
          <div className="metric-row">
            <div className="metric">
              <strong>{format(quantity)}</strong>
              <small>{target.name}</small>
            </div>
            <div className="metric">
              <strong>{calc.steps}</strong>
              <small>recipe steps · sequential batch plan</small>
            </div>
            <div className="metric">
              <strong>{calc.bill.filter((r) => r.missing > 0).length}</strong>
              <small>different resources to gather</small>
            </div>
            <div className="metric">
              <strong>{format(calc.roots[0].surplus)}</strong>
              <small>primary-output surplus</small>
            </div>
          </div>
          <section className="panel">
            <div className="split-heading">
              <h2>Gathering bill</h2>
              <div className="toolbar">
                <button
                  onClick={() => {
                    onSave({
                      id: target.id,
                      amount: quantity,
                      source: draft?.source,
                      tier,
                      boundary,
                      choices,
                    });
                    setMessage(
                      "Production order saved. Open Materials to see combined demand and complete the build.",
                    );
                  }}
                >
                  <Plus size={14} />
                  Save order
                </button>
                <button
                  onClick={() => {
                    onGather(
                      calc.bill
                        .filter((r) => r.missing > 0)
                        .map((r) => ({
                          id: r.id,
                          amount: r.missing,
                          name: map.get(r.id)?.name || `Unknown: ${r.id}`,
                          unit: map.get(r.id)?.unit || "items",
                        })),
                    );
                    setMessage(
                      "Copied as manual gathering targets. If this is already a saved order, use its shared demand instead to avoid duplicate targets.",
                    );
                  }}
                >
                  Copy bill to manual targets
                </button>
                <button
                  aria-label="Copy bill"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(csv())
                      .then(() => setMessage("Bill copied."))
                      .catch(() =>
                        setMessage("Clipboard unavailable; use Download CSV."),
                      )
                  }
                >
                  <Copy size={15} />
                </button>
                <button
                  aria-label="Download bill CSV"
                  onClick={() =>
                    download(csv(), "gtnh-materials.csv", "text/csv")
                  }
                >
                  <Download size={15} />
                </button>
              </div>
            </div>
            <p style={{ marginTop: 8, fontSize: 12 }}>
              Needed / allocated / missing reflect this plan. Save an order for
              the combined ledger shared with other projects.
            </p>
            <BillTable calc={calc} catalog={map} />
            {calc.warnings.length > 0 && (
              <div className="notice">
                <strong>Read before gathering</strong>
                <ul>
                  {calc.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            {Object.keys(calc.catalysts).length > 0 && (
              <>
                <h3>Reusable tools & catalysts</h3>
                {Object.entries(calc.catalysts).map(([id, n]) => (
                  <div className="item-row" key={id}>
                    <Icon goods={map.get(id)} />
                    <span>
                      {map.get(id)?.name || `Unknown tool: ${id}`}
                      <small>{n} required; not consumed in this model</small>
                    </span>
                  </div>
                ))}
              </>
            )}
          </section>
          <section className="panel" style={{ marginTop: 20 }}>
            <h2>Recursive production tree</h2>
            <p style={{ fontSize: 12, marginTop: 8 }}>
              Change a recipe or material alternative, then calculate again.
              Stop at any intermediate you already plan to supply.
            </p>
            {calc.roots.map((n, i) => (
              <Step
                key={i}
                node={n}
                catalog={map}
                choose={choose}
                choice={choices}
                setChoices={setChoices}
                root
              />
            ))}
          </section>
        </>
      )}
      {!calc && !busy && (
        <div style={{ marginTop: 24 }}>
          <Empty title="A quantity, not a guess">
            Your bill will show batch rounding, intermediates, route choices,
            surplus and any unresolved requirements.
          </Empty>
        </div>
      )}
    </div>
  );
}
export function BillTable({
  calc,
  catalog,
}: {
  calc: Calculation;
  catalog: Map<string, Goods>;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Resource</th>
            <th>Need</th>
            <th>Allocated stock</th>
            <th>Missing</th>
            <th>Why this boundary?</th>
          </tr>
        </thead>
        <tbody>
          {calc.bill.map((r) => (
            <tr key={r.id}>
              <td>
                <div className="item-row">
                  <Icon goods={catalog.get(r.id)} />
                  <span>
                    {catalog.get(r.id)?.name || `Unknown: ${r.id}`}
                    <small>{catalog.get(r.id)?.unit || "items"}</small>
                  </span>
                </div>
              </td>
              <td>{format(r.needed)}</td>
              <td>{format(r.stockUsed)}</td>
              <td className={r.missing ? "missing" : "good"}>
                {format(r.missing)}
              </td>
              <td>{r.reasons.join(" · ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Step({
  node: n,
  catalog,
  choose,
  choice,
  setChoices,
  root = false,
}: {
  node: ProductionStep;
  catalog: Map<string, Goods>;
  choose: (id: string, r: string) => void;
  choice: Choices;
  setChoices: (c: Choices) => void;
  root?: boolean;
}) {
  const g = catalog.get(n.id);
  return (
    <div className="recipe-step">
      <details open={root}>
        <summary>
          <Icon goods={g} size={24} />
          <strong>
            {format(n.needed)} {g?.kind === "fluid" ? "mB of " : ""}
            {g?.name || `Unknown: ${n.id}`}
          </strong>
          <span className="tag">
            {n.recipe ? `${n.batches} batches` : n.reason || "Supplied"}
          </span>
        </summary>
        <p>
          {n.fromStock > 0 && `${format(n.fromStock)} from stock. `}
          {n.fromSurplus > 0 && `${format(n.fromSurplus)} reused surplus. `}
          {n.recipe &&
            `${n.output} ${g?.unit || "items"} produced; ${n.surplus} ${g?.unit || "items"} surplus. ${n.recipe.machine} · ${n.recipe.tier < 0 ? "Manual" : TIERS[n.recipe.tier] || n.recipe.tier} · ${n.recipe.voltage} EU/t · ${n.recipe.ticks === null ? "time not exported" : `${n.recipe.ticks / 20} seconds / batch`}.`}
        </p>
        {n.routes.length > 0 && (
          <label className="stacked">
            Recipe route
            <select
              aria-label={`Recipe for ${g?.name}`}
              value={choice.recipes[n.id] || n.recipe?.id || ""}
              onChange={(e) => choose(n.id, e.target.value)}
            >
              {!n.recipe && <option value="">Choose a valid route</option>}
              {n.routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.machine} · {r.tier < 0 ? "Manual" : TIERS[r.tier]} ·{" "}
                  {r.outputs.find((x) => x.id === n.id)?.amount} output ·{" "}
                  {r.inputs
                    .filter((x) => x.amount > 0)
                    .slice(0, 3)
                    .map(
                      (x) =>
                        `${x.amount}× ${catalog.get(x.id)?.name || (x.alternatives ? catalog.get(x.alternatives[0])?.name : "Unknown ingredient") || x.id}`,
                    )
                    .join(" + ")}
                  {r.inputs.filter((x) => x.amount > 0).length > 3
                    ? " + …"
                    : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        {n.alternatives.map((a) => (
          <label className="stacked" key={a.key}>
            Ore-dictionary alternative
            <select
              aria-label="Ore-dictionary alternative"
              value={a.selected}
              onChange={(e) =>
                setChoices({
                  ...choice,
                  alternatives: {
                    ...choice.alternatives,
                    [a.key]: e.target.value,
                  },
                })
              }
            >
              {a.options.map((id) => (
                <option value={id} key={id}>
                  {catalog.get(id)?.name || id}
                </option>
              ))}
            </select>
          </label>
        ))}
        {!root && (
          <button
            style={{ fontSize: 11, minHeight: 30 }}
            onClick={() =>
              setChoices({
                ...choice,
                stops: choice.stops.includes(n.id)
                  ? choice.stops.filter((x) => x !== n.id)
                  : [...choice.stops, n.id],
              })
            }
          >
            {choice.stops.includes(n.id)
              ? "Expand this resource"
              : "Supply this directly / stop here"}
          </button>
        )}
        {n.catalysts.map((id) => (
          <p key={id}>Reusable: {catalog.get(id)?.name || id}</p>
        ))}
        {n.byproducts.length > 0 && (
          <p>
            By-products (not credited):{" "}
            {n.byproducts
              .map(
                (x) =>
                  `${format(x.amount)} ${catalog.get(x.id)?.kind === "fluid" ? "mB " : ""}${catalog.get(x.id)?.name || x.id}${x.chance < 1 ? ` (${x.chance * 100}% chance)` : ""}`,
              )
              .join(", ")}
          </p>
        )}
        {n.recipe && (
          <details>
            <summary>Source recipe / special conditions</summary>
            <pre>{JSON.stringify(n.recipe, null, 2)}</pre>
          </details>
        )}
        {n.children.map((c, i) => (
          <Step
            key={i}
            node={c}
            catalog={catalog}
            choose={choose}
            choice={choice}
            setChoices={setChoices}
          />
        ))}
      </details>
    </div>
  );
}
export function download(
  text: string,
  name: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function itemToDraft(
  item: SourceItem,
  source: string,
): ProductionDraft | null {
  return item.resolved
    ? {
        id: item.resolved.id,
        amount: Number(item.Count ?? item.Amount ?? 1),
        source,
      }
    : null;
}
