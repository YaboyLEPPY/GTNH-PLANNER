import type { QuestProgress } from "../components/Questbook";
import type { SavedPlan } from "../components/Production";
export interface Resource {
  name: string;
  unit: string;
  desired: number;
  reserved: number;
  notes: string;
  location: string;
  manual?: boolean;
}
export interface Order extends SavedPlan {
  orderId: string;
  status: "open" | "completed";
}
export type ZoneType =
  | "machine"
  | "multiblock"
  | "storage"
  | "power"
  | "farm"
  | "crafting"
  | "structure";
export interface Zone {
  id: string;
  name: string;
  type: ZoneType;
  floor: number;
  x: number;
  y: number;
  width: number;
  height: number;
  notes: string;
  machineCount: number;
  goodsId?: string;
  materials: { id: string; amount: number }[];
  planned: boolean;
  energy: string;
  inputs: string;
  outputs: string;
}
export interface Route {
  id: string;
  name: string;
  type: "item" | "fluid" | "power";
  from: string;
  to: string;
  direction: "forward" | "both";
  goodsId?: string;
  amount: number;
}
export interface Base {
  width: number;
  height: number;
  floorNames: string[];
  zones: Zone[];
  routes: Route[];
}
export interface World {
  schema: 2;
  name: string;
  notes: string;
  stock: Record<string, number>;
  resources: Record<string, Resource>;
  orders: Order[];
  progress: QuestProgress;
  base: Base;
  questTargets: Record<string, { quest: string; id: string; amount: number }>;
}
export const emptyWorld = (): World => ({
  schema: 2,
  name: "My GTNH world",
  notes: "",
  stock: {},
  resources: {},
  orders: [],
  progress: { done: [], pins: [], notes: {} },
  base: {
    width: 48,
    height: 48,
    floorNames: [
      "Underground",
      "Machine floor",
      "Living & storage",
      "Farms above",
    ],
    zones: [],
    routes: [],
  },
  questTargets: {},
});
const KEY = "horizon-foundry-world";
export const backupKey = KEY + "-previous";
const safeKey = (s: string) =>
  typeof s === "string" &&
  !["__proto__", "prototype", "constructor"].includes(s) &&
  s.length < 1000;
const num = (n: unknown) =>
  typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1e12;
function record(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function text(v: unknown, max = 100000): v is string {
  return typeof v === "string" && v.length <= max;
}
function quantityMap(v: unknown): v is Record<string, number> {
  return record(v) && Object.entries(v).every(([k, n]) => safeKey(k) && num(n));
}
export function validateWorld(input: unknown): World {
  let v = input;
  if (record(v) && v.schema === 1) {
    v = {
      ...emptyWorld(),
      ...v,
      schema: 2,
      questTargets: v.questTargets || {},
    };
  }
  if (!record(v) || v.schema !== 2)
    throw new Error(
      "Unsupported backup version. Expected a Horizon Foundry schema 1 or 2 backup.",
    );
  if (
    !text(v.name, 200) ||
    !text(v.notes) ||
    !quantityMap(v.stock) ||
    !record(v.resources) ||
    !Array.isArray(v.orders) ||
    !record(v.progress) ||
    !record(v.base) ||
    !record(v.questTargets)
  )
    throw new Error("Backup has missing or invalid world fields.");
  if (
    Object.keys(v.stock).length > 100000 ||
    Object.keys(v.resources).length > 100000 ||
    v.orders.length > 10000
  )
    throw new Error("Backup exceeds supported limits.");
  for (const [k, r] of Object.entries(v.resources)) {
    if (
      !safeKey(k) ||
      !record(r) ||
      !text(r.name, 500) ||
      !text(r.unit, 30) ||
      !num(r.desired) ||
      !num(r.reserved) ||
      !text(r.notes) ||
      !text(r.location, 500)
    )
      throw new Error("Invalid resource entry.");
  }
  const p = v.progress;
  if (
    !Array.isArray(p.done) ||
    !Array.isArray(p.pins) ||
    !p.done.every(safeKey) ||
    !p.pins.every(safeKey) ||
    !record(p.notes) ||
    !Object.entries(p.notes).every(([k, n]) => safeKey(k) && text(n))
  )
    throw new Error("Invalid quest progress.");
  for (const o of v.orders) {
    if (
      !record(o) ||
      !safeKey(o.orderId as string) ||
      !safeKey(o.id as string) ||
      !num(o.amount) ||
      o.amount === 0 ||
      !Number.isInteger(o.tier) ||
      Number(o.tier) < -1 ||
      Number(o.tier) > 13 ||
      !["gathered", "ingots", "components"].includes(String(o.boundary)) ||
      !["open", "completed"].includes(String(o.status)) ||
      !record(o.choices)
    )
      throw new Error("Invalid production order.");
    const c = o.choices;
    if (
      c.availableMachines !== undefined &&
      (!Array.isArray(c.availableMachines) ||
        !c.availableMachines.every((m) => text(m, 500)))
    )
      throw new Error("Invalid machine availability filter.");
    if (
      !record(c.recipes) ||
      !record(c.alternatives) ||
      !Array.isArray(c.stops) ||
      !c.stops.every(safeKey) ||
      ![...Object.entries(c.recipes), ...Object.entries(c.alternatives)].every(
        ([k, x]) => safeKey(k) && safeKey(x as string),
      )
    )
      throw new Error("Invalid recipe choices.");
  }
  if (new Set(v.orders.map((o: Order) => o.orderId)).size !== v.orders.length)
    throw new Error("Duplicate production order IDs.");
  for (const [k, t] of Object.entries(v.questTargets)) {
    if (
      !safeKey(k) ||
      !record(t) ||
      !text(t.quest, 500) ||
      !safeKey(t.id as string) ||
      !num(t.amount)
    )
      throw new Error("Invalid quest target.");
  }
  const b = v.base;
  if (
    !Number.isInteger(b.width) ||
    !Number.isInteger(b.height) ||
    Number(b.width) < 8 ||
    Number(b.width) > 128 ||
    Number(b.height) < 8 ||
    Number(b.height) > 128 ||
    !Array.isArray(b.floorNames) ||
    b.floorNames.length < 1 ||
    b.floorNames.length > 16 ||
    !b.floorNames.every((n) => text(n, 100)) ||
    !Array.isArray(b.zones) ||
    b.zones.length > 5000 ||
    !Array.isArray(b.routes) ||
    b.routes.length > 10000
  )
    throw new Error("Invalid base dimensions or floors.");
  const zoneIds = new Set<string>();
  for (const z of b.zones) {
    if (
      !record(z) ||
      !safeKey(z.id as string) ||
      zoneIds.has(z.id as string) ||
      !text(z.name, 500) ||
      ![
        "machine",
        "multiblock",
        "storage",
        "power",
        "farm",
        "crafting",
        "structure",
      ].includes(String(z.type)) ||
      !["x", "y", "width", "height", "floor", "machineCount"].every(
        (k) => Number.isInteger(z[k]) && num(z[k]),
      ) ||
      Number(z.width) < 1 ||
      Number(z.height) < 1 ||
      Number(z.x) + Number(z.width) > Number(b.width) ||
      Number(z.y) + Number(z.height) > Number(b.height) ||
      Number(z.floor) >= b.floorNames.length ||
      !text(z.notes) ||
      !text(z.energy, 500) ||
      !text(z.inputs, 10000) ||
      !text(z.outputs, 10000) ||
      typeof z.planned !== "boolean" ||
      !Array.isArray(z.materials) ||
      !z.materials.every(
        (m) => record(m) && safeKey(m.id as string) && num(m.amount),
      )
    )
      throw new Error("Invalid base zone.");
    zoneIds.add(z.id as string);
  }
  const routes = new Set<string>();
  for (const r of b.routes) {
    if (
      !record(r) ||
      !safeKey(r.id as string) ||
      routes.has(r.id as string) ||
      !text(r.name, 500) ||
      !zoneIds.has(r.from as string) ||
      !zoneIds.has(r.to as string) ||
      !["item", "fluid", "power"].includes(String(r.type)) ||
      !["forward", "both"].includes(String(r.direction)) ||
      !num(r.amount)
    )
      throw new Error("Invalid base connection.");
    routes.add(r.id as string);
  }
  return JSON.parse(JSON.stringify(v)) as World;
}
export function readWorld(): { world: World; error?: string; raw?: string } {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch (e) {
    return {
      world: emptyWorld(),
      error: `Browser storage is unavailable: ${(e as Error).message}. You can still plan and export an in-memory world.`,
    };
  }

  if (!raw) {
    const w = emptyWorld();
    try {
      const legacy = JSON.parse(localStorage.getItem("hf-quests") || "null");
      if (legacy)
        w.progress = validateWorld({ ...w, progress: legacy }).progress;
    } catch {
      /* Keep legacy data untouched. */
    }
    return { world: w };
  }
  try {
    return { world: validateWorld(JSON.parse(raw)) };
  } catch (e) {
    return { world: emptyWorld(), error: (e as Error).message, raw };
  }
}
export function writeWorld(w: World) {
  const serialized = JSON.stringify(w);
  const previous = localStorage.getItem(KEY);
  if (previous !== serialized) {
    if (previous) localStorage.setItem(backupKey, previous);
    localStorage.setItem(KEY, serialized);
  }
}
export function addPlan(w: World, p: SavedPlan): World {
  return {
    ...w,
    orders: [
      ...w.orders,
      { ...p, orderId: crypto.randomUUID(), status: "open" },
    ],
  };
}
export function completeOrder(
  w: World,
  orderId: string,
  used: Record<string, number>,
  surplus: Record<string, number> = {},
): World {
  const order = w.orders.find((o) => o.orderId === orderId);
  if (!order || order.status !== "open")
    throw new Error("Order is no longer open.");
  const stock = { ...w.stock };
  for (const [id, n] of Object.entries(used)) {
    if ((stock[id] || 0) < n)
      throw new Error("Stock changed; recalculate before completing.");
    stock[id] = (stock[id] || 0) - n;
  }
  for (const [id, n] of Object.entries(surplus))
    stock[id] = (stock[id] || 0) + n;
  stock[order.id] = (stock[order.id] || 0) + order.amount;
  return {
    ...w,
    stock,
    orders: w.orders.map((o) =>
      o.orderId === orderId ? { ...o, status: "completed" } : o,
    ),
  };
}
export function applyLVProfile(w: World): World {
  return {
    ...w,
    name: "Lachy's LV start",
    notes:
      "Editable historical notes: reached LV with steam turbine, wiremill, polarizer and bender. Four coke ovens and four Brick Blast Furnaces; relocate polluting industry. Previously mined sulfur, pyrite and sphalerite in a Nether sulfur vein. Plan a slime plantation after recovering three slime saplings. Historical quantities are not inventory.",
    base: {
      ...w.base,
      floorNames: [
        "Ore processing underground",
        "Machines below",
        "Kitchen, crafting & storage",
        "Farms above",
      ],
    },
  };
}
