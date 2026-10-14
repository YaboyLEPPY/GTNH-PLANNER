import type { Base, Zone, ZoneType } from "./world";
export const ZONE_TYPES: ZoneType[] = [
  "machine",
  "multiblock",
  "storage",
  "power",
  "farm",
  "crafting",
  "structure",
];
export const ZONE_COLORS: Record<ZoneType, string> = {
  machine: "#748eab",
  multiblock: "#a09ac6",
  storage: "#bfa570",
  power: "#d9ab71",
  farm: "#77a78a",
  crafting: "#9db6b9",
  structure: "#8d94a6",
};
export function overlaps(
  a: Pick<Zone, "x" | "y" | "width" | "height" | "floor">,
  b: Pick<Zone, "x" | "y" | "width" | "height" | "floor">,
) {
  return (
    a.floor === b.floor &&
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
export function placementIssue(z: Zone, b: Base, allowOverlap = false) {
  if (
    ![z.x, z.y, z.width, z.height, z.floor].every(Number.isInteger) ||
    z.x < 0 ||
    z.y < 0 ||
    z.width < 1 ||
    z.height < 1 ||
    z.x + z.width > b.width ||
    z.y + z.height > b.height ||
    z.floor < 0 ||
    z.floor >= b.floorNames.length
  )
    return "Outside the base boundary or invalid size";
  if (!allowOverlap && b.zones.some((x) => x.id !== z.id && overlaps(x, z)))
    return "Overlaps another zone — move it or enable overlap";
  return "";
}
export function zone(
  type: ZoneType,
  floor: number,
  x: number,
  y: number,
  width = 1,
  height = 1,
): Zone {
  return {
    id: crypto.randomUUID(),
    name: type[0].toUpperCase() + type.slice(1),
    type,
    floor,
    x,
    y,
    width,
    height,
    notes: "",
    machineCount: type === "machine" ? 1 : 0,
    materials: [],
    planned: true,
    energy: "",
    inputs: "",
    outputs: "",
  };
}
export function deleteZone(b: Base, id: string): Base {
  return {
    ...b,
    zones: b.zones.filter((z) => z.id !== id),
    routes: b.routes.filter((r) => r.from !== id && r.to !== id),
  };
}
export function exampleBase(): Base {
  return {
    width: 48,
    height: 48,
    floorNames: [
      "Ore processing underground",
      "Machines below",
      "Kitchen, crafting & storage",
      "Farms above",
    ],
    routes: [],
    zones: [
      {
        ...zone("machine", 0, 5, 5, 16, 12),
        name: "Ore processing",
        notes: "Leave room for dust buffers, washing and future expansion.",
      },
      {
        ...zone("machine", 1, 5, 5, 16, 10),
        name: "LV machine workshop",
        notes:
          "Editable footprint. Choose catalogue machines in the inspector; no bill is guessed.",
      },
      {
        ...zone("power", 1, 29, 5, 10, 10),
        name: "Remote heavy industry",
        notes:
          "Planning suggestion: move polluting equipment away from living space. Distance effectiveness is not simulated.",
      },
      { ...zone("storage", 2, 5, 5, 16, 14), name: "Main storage" },
      { ...zone("crafting", 2, 25, 5, 14, 14), name: "Kitchen & crafting" },
      { ...zone("farm", 3, 5, 5, 18, 18), name: "Tree & crop farms" },
      {
        ...zone("farm", 3, 27, 5, 12, 12),
        name: "Future slime plantation",
        notes: "Optional plan, not a claim about current sapling stock.",
      },
    ],
  };
}
