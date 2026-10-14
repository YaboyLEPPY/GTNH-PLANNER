import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  calculate,
  type CalcOptions,
  type Choices,
} from "../../src/domain/production";
import type { Goods, Recipe } from "../../src/types";
const goods = (id: string, name = id): Goods => ({
  id,
  name,
  mod: "test",
  registry: id,
  icon: 0,
  nbt: null,
  kind: "item",
  unit: "items",
  damage: 0,
  shard: "",
  recipes: 1,
});
const recipe = (
  id: string,
  input: string,
  amount: number,
  output: string,
  out = 1,
): Recipe => ({
  id,
  machine: "Crafting (Shaped)",
  inputs: [{ id: input, amount, chance: 1, slot: 0 }],
  outputs: [{ id: output, amount: out, chance: 1, slot: 0 }],
  tier: -1,
  voltage: 0,
  ticks: null,
  metadata: [],
  special: 0,
  machines: [],
});
function options(
  gs: Goods[],
  rs: Recipe[],
  patch: Partial<CalcOptions> = {},
): CalcOptions {
  return {
    catalog: new Map(gs.map((g) => [g.id, g])),
    getRecipes: async (g) =>
      rs.filter((r) => r.outputs.some((x) => x.id === g.id)),
    stock: {},
    choices: { recipes: {}, alternatives: {}, stops: [] },
    tier: 1,
    boundary: "gathered",
    ...patch,
  };
}
describe("quantity planning", () => {
  it.each([1, 20, 21])(
    "rounds batches and preserves %i targets",
    async (qty) => {
      const c = await calculate(
        [{ id: "target", amount: qty }],
        options(
          [goods("target"), goods("ore", "Iron Ore")],
          [recipe("r", "ore", 3, "target", 2)],
        ),
      );
      expect(c.roots[0].batches).toBe(Math.ceil(qty / 2));
      expect(c.bill[0].needed).toBe(Math.ceil(qty / 2) * 3);
      expect(c.roots[0].surplus).toBe(Math.ceil(qty / 2) * 2 - qty);
    },
  );
  it("aggregates repeated inputs, shares surplus, and allocates stock once across targets", async () => {
    const rs = [
      recipe("r", "ore", 1, "part", 4),
      {
        ...recipe("t", "part", 2, "target"),
        inputs: [
          { id: "part", amount: 2, chance: 1, slot: 0 },
          { id: "part", amount: 1, chance: 1, slot: 1 },
        ],
      },
    ];
    const c = await calculate(
      [
        { id: "target", amount: 1 },
        { id: "target", amount: 1 },
      ],
      options([goods("target"), goods("part"), goods("ore", "Iron Ore")], rs, {
        stock: { ore: 1 },
      }),
    );
    expect(c.bill.find((r) => r.id === "ore")).toMatchObject({
      needed: 2,
      stockUsed: 1,
      missing: 1,
    });
    expect(c.stockUsed.ore).toBe(1);
    expect(c.surplus.part).toBe(2);
  });
  it("detects recursive loops and unavailable tier without hiding requirements", async () => {
    const gs = [goods("a"), goods("b")];
    const rs = [recipe("ab", "b", 1, "a"), recipe("ba", "a", 1, "b")];
    const c = await calculate([{ id: "a", amount: 2 }], options(gs, rs));
    expect(c.warnings.some((w) => w.includes("Cycle"))).toBe(true);
    expect(c.bill[0].missing).toBe(2);
    const d = await calculate(
      [{ id: "a", amount: 1 }],
      options(gs, [{ ...rs[0], tier: 3 }]),
    );
    expect(d.bill[0].reasons[0]).toContain("tier");
  });
  it("separates catalysts, ore alternatives, fluid mB and probabilistic by-products", async () => {
    const rs = [
      {
        ...recipe("r", "ore", 1, "target"),
        inputs: [
          { id: "tool", amount: 0, chance: 1, slot: 0 },
          {
            id: "oreDict",
            amount: 2,
            chance: 1,
            slot: 1,
            alternatives: ["ore", "other"],
          },
          { id: "water", amount: 144, chance: 1, slot: 2 },
        ],
        outputs: [
          { id: "target", amount: 1, chance: 1, slot: 0 },
          { id: "other", amount: 1, chance: 0.5, slot: 1 },
        ],
      },
    ];
    const gs = [
      goods("target"),
      goods("tool"),
      goods("ore", "Iron Ore"),
      goods("other", "Gold Ore"),
      { ...goods("water", "Water"), kind: "fluid" as const, unit: "mB" },
    ];
    const choices: Choices = {
      recipes: {},
      alternatives: { "r:1": "other" },
      stops: [],
    };
    const c = await calculate(
      [{ id: "target", amount: 20 }],
      options(gs, rs, { choices }),
    );
    expect(c.catalysts.tool).toBe(1);
    expect(c.bill.find((r) => r.id === "water")?.needed).toBe(2880);
    expect(c.bill.find((r) => r.id === "other")?.needed).toBe(40);
    expect(c.bill.find((r) => r.id === "ore")).toBeUndefined();
    expect(c.warnings.join(" ")).toContain("Probabilistic");
  });
  it("never promotes a chance-only output into a guaranteed bill", async () => {
    const c = await calculate(
      [{ id: "a", amount: 1 }],
      options(
        [goods("a"), goods("ore", "Iron Ore")],
        [
          {
            ...recipe("r", "ore", 1, "a"),
            outputs: [{ id: "a", amount: 1, chance: 0.5, slot: 0 }],
          },
        ],
      ),
    );
    expect(c.bill[0].missing).toBe(1);
    expect(c.steps).toBe(0);
  });
  it("checks the actual pinned Electronic Circuit route, not a hardcoded UI bill", async () => {
    const catalog = JSON.parse(
      readFileSync("public/data/catalog.json", "utf8"),
    ) as Goods[];
    const target = catalog.find((g) => g.id === "i:IC2:itemPartCircuit:0")!;
    const rs = JSON.parse(
      readFileSync(
        `public/data/recipes/${target.shard.slice(0, 2)}/${target.shard}.json`,
        "utf8",
      ),
    ) as Recipe[];
    const c = await calculate(
      [{ id: target.id, amount: 20 }],
      options(catalog, rs, { boundary: "components" }),
    );
    const inputs = new Map(
      c.roots[0].children.map((n) => [
        catalog.find((g) => g.id === n.id)!.name,
        n.needed,
      ]),
    );
    expect(c.roots[0].recipe?.machine).toBe("Crafting (Shaped)");
    expect(inputs.get("Resistor")).toBe(40);
    expect(inputs.get("Steel Casing")).toBe(20);
    expect(inputs.get("Vacuum Tube")).toBe(40);
    expect(inputs.get("Circuit Board")).toBe(20);
    expect(inputs.get("1x Red Alloy Cable")).toBe(60);
  });
});
