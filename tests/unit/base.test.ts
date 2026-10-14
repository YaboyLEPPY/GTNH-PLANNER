import { it, expect } from "vitest";
import {
  zone,
  placementIssue,
  deleteZone,
  exampleBase,
} from "../../src/domain/base";
import { emptyWorld, validateWorld } from "../../src/domain/world";
it("validates bounds, collisions, floors, movement and resizing", () => {
  const b = emptyWorld().base,
    z = zone("machine", 1, 2, 2, 4, 3);
  b.zones = [z];
  expect(placementIssue({ ...z, id: "other", x: 3 }, b)).toContain("Overlaps");
  expect(placementIssue({ ...z, id: "other", floor: 2 }, b)).toBe("");
  expect(placementIssue({ ...z, x: 47 }, b)).toContain("boundary");
  expect(placementIssue({ ...z, width: 0 }, b)).toContain("boundary");
  expect(placementIssue({ ...z, x: 10 }, b)).toBe("");
});
it("deletion removes dangling routes and example remains editable validated data", () => {
  const b = exampleBase();
  b.routes = [
    {
      id: "r",
      name: "Power",
      type: "power",
      from: b.zones[0].id,
      to: b.zones[1].id,
      direction: "forward",
      amount: 4,
    },
  ];
  expect(deleteZone(b, b.zones[0].id).routes.length).toBe(0);
  expect(validateWorld({ ...emptyWorld(), base: b }).base.zones.length).toBe(7);
});
