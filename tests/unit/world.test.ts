import { it, expect } from "vitest";
import {
  emptyWorld,
  validateWorld,
  addPlan,
  completeOrder,
  applyLVProfile,
} from "../../src/domain/world";
import { buildLedger } from "../../src/domain/ledger";
import type { Goods, Recipe } from "../../src/types";
const g = (id: string, name = id): Goods => ({
  id,
  name,
  registry: id,
  mod: "test",
  icon: 0,
  nbt: null,
  kind: "item",
  unit: "items",
  damage: 0,
  shard: "",
  recipes: 1,
});
const r: Recipe = {
  id: "r",
  machine: "Crafting (Shaped)",
  tier: -1,
  voltage: 0,
  ticks: null,
  metadata: [],
  special: 0,
  machines: [],
  inputs: [{ id: "ore", amount: 2, slot: 0, chance: 1 }],
  outputs: [{ id: "target", amount: 1, slot: 0, chance: 1 }],
};
const plan = {
  id: "target",
  amount: 20,
  tier: 0,
  boundary: "ingots" as const,
  choices: { recipes: {}, alternatives: {}, stops: [] },
};
it("round-trips and migrates backups, rejects malformed data and newer versions", () => {
  const w = emptyWorld();
  expect(validateWorld(JSON.parse(JSON.stringify(w)))).toEqual(w);
  expect(validateWorld({ ...w, schema: 1 }).schema).toBe(2);
  for (const v of [
    {},
    { ...w, schema: 99 },
    { ...w, stock: { ore: -1 } },
    { ...w, base: { ...w.base, width: NaN } },
    { ...w, progress: { done: ["constructor"], pins: [], notes: {} } },
  ])
    expect(() => validateWorld(v)).toThrow();
});
it("allocates combined order demand once, respects reservations and overlaps manual/quest targets", async () => {
  let w = addPlan(addPlan(emptyWorld(), plan), plan);
  w.stock.ore = 50;
  w.resources.ore = {
    name: "Iron Ore",
    unit: "items",
    desired: 80,
    reserved: 10,
    notes: "",
    location: "",
  };
  w.questTargets.q = { quest: "Test quest", id: "target", amount: 20 };
  const l = await buildLedger(
    w,
    new Map([g("target"), g("ore", "Iron Ore")].map((x) => [x.id, x])),
    async (x) => (x.id === "target" ? [r] : []),
  );
  const ore = l.rows.find((r) => r.id === "ore")!;
  expect(ore.needed).toBe(80);
  expect(ore.stockUsed).toBe(40);
  expect(ore.missing).toBe(40);
  expect(l.rows.find((r) => r.id === "target")?.missing).toBe(0);
});
it("completion consumes stock, credits output, excludes completed demand and has a recoverable snapshot", async () => {
  const before = addPlan(emptyWorld(), plan);
  before.stock.ore = 40;
  const w = completeOrder(before, before.orders[0].orderId, { ore: 40 });
  expect(before.stock.ore).toBe(40);
  expect(w.stock.ore).toBe(0);
  expect(w.stock.target).toBe(20);
  expect(w.orders[0].status).toBe("completed");
  const l = await buildLedger(
    w,
    new Map([g("target"), g("ore", "Iron Ore")].map((x) => [x.id, x])),
    async (x) => (x.id === "target" ? [r] : []),
  );
  expect(l.rows.find((r) => r.id === "ore")?.needed).toBe(0);
  expect(() => completeOrder(w, w.orders[0].orderId, {})).toThrow();
});
it("historical LV profile does not invent current stock", () => {
  expect(applyLVProfile(emptyWorld()).stock).toEqual({});
});
