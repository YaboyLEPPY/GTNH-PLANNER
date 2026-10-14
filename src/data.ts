import type { Goods, Recipe } from "./types";
const cache = new Map<string, Promise<unknown>>();
async function fetchData(path: string) {
  const compressed =
    (path === "catalog.json" ||
      path === "search.json" ||
      path === "index.json" ||
      path.startsWith("chapters/")) &&
    typeof DecompressionStream !== "undefined";
  const r = await fetch(`/data/${path}${compressed ? ".gz" : ""}`);
  if (!r.ok)
    throw new Error(
      `Could not load ${path} (${r.status}). Run npm run data:import if data is missing.`,
    );
  if (compressed && !r.headers.get("content-encoding")) {
    if (!r.body) throw new Error("Empty compressed response.");
    return new Response(
      r.body.pipeThrough(new DecompressionStream("gzip")),
    ).json();
  }
  return r.json();
}
export function load<T>(path: string): Promise<T> {
  if (!cache.has(path))
    cache.set(
      path,
      fetchData(path).catch((e) => {
        cache.delete(path);
        throw e;
      }),
    );
  return cache.get(path) as Promise<T>;
}
let catalog: Promise<Goods[]> | undefined;
export function getCatalog() {
  return (catalog ??= load<Goods[]>("catalog.json")
    .then((items) => items.map((g) => ({ ...g, name: plain(g.name) })))
    .catch((e) => {
      catalog = undefined;
      throw e;
    }));
}
export async function getRecipes(g: Goods) {
  return g.recipes
    ? load<Recipe[]>(`recipes/${g.shard.slice(0, 2)}/${g.shard}.json`)
    : [];
}
export function decodeEntities(s: string) {
  return s.replace(/&(?:quot|apos|amp|lt|gt|#x[0-9a-f]+|#[0-9]+);/gi, (e) => {
    const named: Record<string, string> = {
      "&quot;": '"',
      "&apos;": "'",
      "&amp;": "&",
      "&lt;": "<",
      "&gt;": ">",
    };
    if (named[e]) return named[e];
    const n = e.startsWith("&#x")
      ? parseInt(e.slice(3, -1), 16)
      : parseInt(e.slice(2, -1), 10);
    return Number.isFinite(n) && n >= 0 && n <= 0x10ffff
      ? String.fromCodePoint(n)
      : e;
  });
}
export const plain = (s: string) => decodeEntities(s.replace(/§./g, ""));
export function format(n: number) {
  return Number.isInteger(n)
    ? n.toLocaleString()
    : n.toLocaleString(undefined, { maximumFractionDigits: 3 });
}
