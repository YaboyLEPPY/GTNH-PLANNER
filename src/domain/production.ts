import type { Goods, Recipe, RecipeIO } from "../types";
export const TIERS = [
  "LV",
  "MV",
  "HV",
  "EV",
  "IV",
  "LuV",
  "ZPM",
  "UV",
  "UHV",
  "UEV",
  "UIV",
  "UMV",
  "UXV",
  "MAX",
];
export interface Target {
  id: string;
  amount: number;
  label?: string;
}
export interface Choices {
  availableMachines?: string[];
  recipes: Record<string, string>;
  alternatives: Record<string, string>;
  stops: string[];
}
export interface CalcOptions {
  tier: number;
  boundary: "gathered" | "ingots" | "components";
  choices: Choices;
  stock: Record<string, number>;
  getRecipes: (g: Goods) => Promise<Recipe[]>;
  catalog: Map<string, Goods>;
  maxDepth?: number;
  maxNodes?: number;
  signal?: AbortSignal;
}
export interface BillRow {
  id: string;
  needed: number;
  stockUsed: number;
  missing: number;
  reasons: string[];
}
export interface ProductionStep {
  id: string;
  needed: number;
  fromStock: number;
  fromSurplus: number;
  batches: number;
  output: number;
  surplus: number;
  recipe?: Recipe;
  routes: Recipe[];
  children: ProductionStep[];
  reason?: string;
  byproducts: RecipeIO[];
  catalysts: string[];
  alternatives: { key: string; selected: string; options: string[] }[];
}
export interface Calculation {
  roots: ProductionStep[];
  bill: BillRow[];
  stockUsed: Record<string, number>;
  surplus: Record<string, number>;
  catalysts: Record<string, number>;
  warnings: string[];
  steps: number;
  intermediates: Record<string, number>;
}
const gathered =
  /\b(ore|ores|log|logs|coal|charcoal|sapling|seeds?|sand|clay|gravel|flint|cobblestone|stone|dirt|netherrack|water|lava|air)\b/i;
export function isBoundary(g: Goods, b: CalcOptions["boundary"]) {
  return (
    gathered.test(g.name) ||
    (b === "ingots" && /\b(ingot|dust|gem)\b/i.test(g.name)) ||
    (b === "components" &&
      /\b(ingot|dust|gem|plate|wire|cable|rod|screw|bolt|foil|casing|board|resistor|tube)\b/i.test(
        g.name,
      ))
  );
}
function score(r: Recipe, id: string) {
  let s = r.tier < 0 ? 0 : 15 + r.tier * 3;
  if (/Crafting \(Shaped\)/.test(r.machine)) s -= 5;
  if (/unpack|recycl|disassembl|canner|arc furnace|extractor/i.test(r.machine))
    s += 60;
  if (r.inputs.some((x) => x.id === id || x.alternatives?.includes(id)))
    s += 1000;
  if (
    r.inputs.some((x) =>
      /sensor|card|integrated_circuit/.test(x.id.toLowerCase()),
    )
  )
    s += 80;
  s += r.inputs.length * 0.05;
  return s;
}
export async function calculate(
  targets: Target[],
  o: CalcOptions,
): Promise<Calculation> {
  const stock = { ...o.stock },
    surplus: Record<string, number> = {},
    used: Record<string, number> = {},
    tools: Record<string, number> = {},
    bill = new Map<string, BillRow>(),
    warnings = new Set<string>(),
    intermediates: Record<string, number> = {};
  let nodes = 0,
    steps = 0;
  function add(
    id: string,
    needed: number,
    stockUsed: number,
    missing: number,
    reason?: string,
  ) {
    let row = bill.get(id);
    if (!row) {
      row = { id, needed: 0, stockUsed: 0, missing: 0, reasons: [] };
      bill.set(id, row);
    }
    row.needed += needed;
    row.stockUsed += stockUsed;
    row.missing += missing;
    if (reason && !row.reasons.includes(reason)) row.reasons.push(reason);
  }
  async function expand(
    id: string,
    quantity: number,
    path: string[],
    root = false,
  ): Promise<ProductionStep> {
    if (o.signal?.aborted)
      throw new DOMException("Calculation cancelled", "AbortError");
    const needed = quantity;
    const fromStock = root
      ? 0
      : Math.min(quantity, Math.max(0, stock[id] || 0));
    stock[id] = (stock[id] || 0) - fromStock;
    quantity -= fromStock;
    used[id] = (used[id] || 0) + fromStock;
    const fromSurplus = Math.min(quantity, Math.max(0, surplus[id] || 0));
    surplus[id] = (surplus[id] || 0) - fromSurplus;
    quantity -= fromSurplus;
    const node: ProductionStep = {
      id,
      needed,
      fromStock,
      fromSurplus,
      batches: 0,
      output: 0,
      surplus: 0,
      routes: [],
      children: [],
      byproducts: [],
      catalysts: [],
      alternatives: [],
    };
    if (fromStock)
      add(id, fromStock, fromStock, 0, "Allocated from shared stock");
    if (quantity <= 0) return node;
    const g = o.catalog.get(id);
    let reason: string | undefined;
    if (!g) reason = "Unknown source identity";
    else if (o.choices.stops.includes(id)) reason = "Your stopping point";
    else if (!root && isBoundary(g, o.boundary)) reason = "Gathering boundary";
    else if (path.includes(id))
      reason = "Cycle detected — supply this resource directly";
    else if (path.length >= (o.maxDepth ?? 18))
      reason = "Depth limit — unresolved";
    else if (++nodes > (o.maxNodes ?? 2500))
      reason = "Expansion limit — unresolved";
    if (reason) {
      node.reason = reason;
      add(id, quantity, 0, quantity, reason);
      if (!["Gathering boundary", "Your stopping point"].includes(reason))
        warnings.add(reason);
      return node;
    }
    const all = await o.getRecipes(g!);
    const routes = all
      .filter(
        (r) =>
          r.tier <= o.tier &&
          (!o.choices.availableMachines ||
            o.choices.availableMachines.includes(r.machine)) &&
          r.outputs.some((x) => x.id === id && x.amount > 0 && x.chance === 1),
      )
      .sort((a, b) => score(a, id) - score(b, id));
    node.routes = routes;
    const chosen = o.choices.recipes[id];
    const r = chosen
      ? routes.find((r) => r.id === chosen)
      : routes.find(
          (r) =>
            !r.inputs.some((x) => x.id === id || x.alternatives?.includes(id)),
        );
    if (!r) {
      node.reason = chosen
        ? "Chosen recipe unavailable at this tier/machine selection"
        : all.length
          ? "No deterministic recipe available with this tier/machine selection"
          : "No recipe — gather or add a manual requirement";
      add(id, quantity, 0, quantity, node.reason);
      warnings.add(node.reason);
      return node;
    }
    node.recipe = r;
    const output = r.outputs
      .filter((x) => x.id === id && x.chance === 1)
      .reduce((s, x) => s + x.amount, 0);
    node.batches = Math.ceil(quantity / output);
    node.output = output * node.batches;
    node.surplus = node.output - quantity;
    surplus[id] = (surplus[id] || 0) + node.surplus;
    steps++;
    intermediates[id] = (intermediates[id] || 0) + node.output;
    if (r.metadata.length || r.special)
      warnings.add(
        "Some recipes have special conditions (heat, research, cleanroom or other metadata). Check the displayed source rules in NEI.",
      );
    if (r.outputs.some((x) => x.chance < 1))
      warnings.add(
        "Probabilistic by-products are displayed but never credited toward demand.",
      );
    node.byproducts = r.outputs
      .filter((x) => x.id !== id)
      .map((x) => ({ ...x, amount: x.amount * node.batches }));
    // Only same-output deterministic surplus is reused. Co-products need explicit joint scheduling.
    if (node.byproducts.length)
      warnings.add(
        "By-products are shown but not reused; the bill is conservative.",
      );
    const grouped = new Map<string, number>();
    for (const input of r.inputs) {
      let child = input.id;
      if (input.alternatives) {
        const key = `${r.id}:${input.slot}`;
        const preferred = o.choices.alternatives[key];
        child =
          preferred && input.alternatives.includes(preferred)
            ? preferred
            : (input.alternatives.find((x) => !path.includes(x) && x !== id) ??
              input.alternatives[0] ??
              input.id);
        node.alternatives.push({
          key,
          selected: child,
          options: input.alternatives,
        });
      }
      if (input.amount === 0) {
        tools[child] = Math.max(tools[child] || 0, 1);
        node.catalysts.push(child);
        warnings.add(
          "Zero-count tools/catalysts are reusable. Tool durability and replacement are not modelled.",
        );
        continue;
      }
      if (input.amount < 0) {
        warnings.add("Unsupported negative input amount");
        node.reason = "Unsupported input; verify source";
        add(
          child,
          Math.abs(input.amount) * node.batches,
          0,
          Math.abs(input.amount) * node.batches,
          "Unsupported negative amount",
        );
        continue;
      }
      grouped.set(
        child,
        (grouped.get(child) || 0) + input.amount * node.batches,
      );
    }
    for (const [child, amount] of grouped)
      node.children.push(await expand(child, amount, [...path, id]));
    return node;
  }
  const roots: ProductionStep[] = [];
  for (const t of targets) {
    if (!Number.isFinite(t.amount) || t.amount <= 0)
      throw new Error("Target quantity must be a positive finite number.");
    const g = o.catalog.get(t.id);
    if (g?.kind === "item" && !Number.isInteger(t.amount))
      throw new Error("Item quantities must be whole numbers.");
    roots.push(await expand(t.id, t.amount, [], true));
  }
  return {
    roots,
    bill: [...bill.values()].sort((a, b) => a.id.localeCompare(b.id)),
    stockUsed: Object.fromEntries(
      Object.entries(used).filter(([, n]) => n > 0),
    ),
    surplus: Object.fromEntries(
      Object.entries(surplus).filter(([, n]) => n > 0),
    ),
    catalysts: tools,
    warnings: [...warnings],
    steps,
    intermediates,
  };
}
