import { calculate, type Calculation, type BillRow } from "./production";
import type { Goods, Recipe } from "../types";
import type { World, Order } from "./world";
export interface LedgerRow extends BillRow {
  sources: string[];
  reserved: number;
  owned: number;
  name: string;
  unit: string;
  manual: boolean;
}
export interface LedgerResult {
  rows: LedgerRow[];
  warnings: string[];
  orderCalculations: Map<string, Calculation>;
}
export async function buildLedger(
  world: World,
  catalog: Map<string, Goods>,
  getRecipes: (g: Goods) => Promise<Recipe[]>,
  signal?: AbortSignal,
): Promise<LedgerResult> {
  const available: Record<string, number> = { ...world.stock };
  for (const [id, r] of Object.entries(world.resources))
    available[id] = Math.max(0, (available[id] || 0) - r.reserved);
  const rows = new Map<string, LedgerRow>();
  const warnings = new Set<string>(),
    orderCalculations = new Map<string, Calculation>();
  function add(
    id: string,
    n: number,
    used: number,
    missing: number,
    source: string,
    reasons: string[] = [],
  ) {
    let row = rows.get(id);
    if (!row) {
      const g = catalog.get(id),
        r = world.resources[id];
      row = {
        id,
        needed: 0,
        stockUsed: 0,
        missing: 0,
        reasons: [],
        sources: [],
        reserved: r?.reserved || 0,
        owned: world.stock[id] || 0,
        name: r?.name || g?.name || `Unknown: ${id}`,
        unit: r?.unit || g?.unit || "items",
        manual: !!r?.manual,
      };
      rows.set(id, row);
    }
    row.needed += n;
    row.stockUsed += used;
    row.missing += missing;
    row.reasons = [...new Set([...row.reasons, ...reasons])];
    if (source && !row.sources.includes(source)) row.sources.push(source);
  }
  const groups = new Map<string, Order[]>();
  for (const order of world.orders.filter((o) => o.status === "open")) {
    const key = JSON.stringify([order.tier, order.boundary, order.choices]);
    groups.set(key, [...(groups.get(key) || []), order]);
  }
  for (const group of groups.values()) {
    const o = group[0];
    const c = await calculate(
      group.map((p) => ({ id: p.id, amount: p.amount })),
      {
        catalog,
        getRecipes,
        stock: available,
        tier: o.tier,
        boundary: o.boundary,
        choices: o.choices,
        signal,
      },
    );
    for (const [id, n] of Object.entries(c.stockUsed))
      available[id] = Math.max(0, (available[id] || 0) - n);
    for (const r of c.bill)
      add(
        r.id,
        r.needed,
        r.stockUsed,
        r.missing,
        group
          .map((o) => `${o.amount} ${catalog.get(o.id)?.name || o.id}`)
          .join(" + "),
        r.reasons,
      );
    for (const w of c.warnings) warnings.add(w);
    for (const o of group) orderCalculations.set(o.orderId, c);
  }
  // Physical machine costs in planned zones are direct demand, not guessed multiblock bills.
  const direct = new Map<string, { amount: number; sources: string[] }>();
  const demand = (id: string, amount: number, source: string) => {
    const d = direct.get(id) || { amount: 0, sources: [] };
    d.amount += amount;
    d.sources.push(source);
    direct.set(id, d);
  };
  for (const z of world.base.zones.filter((z) => z.planned)) {
    if (z.goodsId) demand(z.goodsId, z.machineCount, `Base: ${z.name}`);
    for (const m of z.materials) demand(m.id, m.amount, `Base: ${z.name}`);
  }
  for (const r of world.base.routes) {
    if (r.goodsId) demand(r.goodsId, r.amount, `Route: ${r.name}`);
  }
  // Quest and manual quantities are desired stock targets: maximum target, not duplicate additions.
  const targets = new Map<string, { amount: number; sources: string[] }>();
  for (const [id, r] of Object.entries(world.resources))
    targets.set(id, {
      amount: r.desired,
      sources: r.desired ? ["Manual gathering target"] : [],
    });
  for (const t of Object.values(world.questTargets)) {
    const current = targets.get(t.id) || { amount: 0, sources: [] };
    current.amount = Math.max(current.amount, t.amount);
    current.sources.push(`Quest: ${t.quest}`);
    targets.set(t.id, current);
  }
  for (const [id, d] of direct) {
    const used = Math.min(d.amount, available[id] || 0);
    available[id] = (available[id] || 0) - used;
    add(id, d.amount, used, d.amount - used, d.sources.join(" · "), [
      "Direct base equipment/material demand",
    ]);
  }
  for (const [id, t] of targets) {
    const covered =
      (rows.get(id)?.needed || 0) +
      world.orders
        .filter((o) => o.status === "open" && o.id === id)
        .reduce((s, o) => s + o.amount, 0);
    const amount = Math.max(0, t.amount - covered);
    const used = Math.min(amount, available[id] || 0);
    available[id] = (available[id] || 0) - used;
    add(id, amount, used, amount - used, t.sources.join(" · "), [
      "Desired shared stock target",
    ]);
  }
  for (const id of Object.keys(world.stock))
    if (!rows.has(id)) add(id, 0, 0, 0, "");
  return {
    rows: [...rows.values()].sort((a, b) => a.name.localeCompare(b.name)),
    warnings: [...warnings],
    orderCalculations,
  };
}
