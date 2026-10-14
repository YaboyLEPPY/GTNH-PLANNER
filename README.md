# Horizon Foundry — practical GTNH planner

A local-first community companion for GT New Horizons: the complete official questbook, a quantity-first recipe calculator, shared gathering/stock ledger and editable multi-floor base planner. No account or hosted service is required. **Not an official GTNH product.**

## Use it while playing

1. Open Questbook and choose a real chapter, or search descriptions/items/rewards. “Find Ender IO” opens source matches; its introductory quest is in **Tier 2 – MV**. Nodes retain original coordinates, sizes and dependencies. The focus selector is a readable alternative to picking a small node.
2. Open a quest to read every task, reward and prerequisite. Pin it, mark personal progress and save notes. Plan an item directly, or link its gathering target.
3. In Production, choose an item/fluid and quantity, available voltage tier and gathering boundary. Optionally enable the strict machine-ownership filter and add recipe types you can run. Calculate, inspect recipe routes/ore alternatives and recalculate after changing choices. Try **20 Electronic Circuits**. Save an order for shared demand, or copy its bill into overlapping manual gathering targets.
4. In Materials, enter owned quantities, keep reserved stock aside, and gather missing resources. Multiple open orders share stock. Complete a build explicitly after crafting: inputs are deducted, output credited, and Undo restores the previous transaction.
5. In Base planner, select a machine/storage/farm/etc. brush, drag a footprint, or place by coordinates. Select to move, resize, rotate, duplicate or delete. Change floors; connect zones for items/fluids/power. Link real catalogue equipment or verified material quantities and Save zone changes to include them in gathering demand. Connections are logical plans, not guarantees of physical GTNH validity.
6. Export a portable world backup from World & backup. Profile, stock, progress and layouts are stored in this browser/device. Optional LV historical notes and a 48×48 example are opt-in; they never seed historical stock.

## Install and run

Node **22.12+** (validated with 24.19), Python **3.10+**, and Pillow are needed. Allow HTTPS access to `registry.npmjs.org`, `pypi.org`, `files.pythonhosted.org` and `codeload.github.com`. No credentials are required for these public sources.

```sh
npm ci
python3 -m venv .venv
.venv/bin/python -m pip install -r scripts/requirements.txt
.venv/bin/python scripts/import_data.py
npm run dev
```

Data import downloads pinned archives, preserves the complete quest source, resolves verified names/icons and produces lazy compressed chapter/search/catalogue data and per-product recipe shards. The full recipe/icon export has no redistribution license, so these generated files are **gitignored** and reproduced locally. The importer needs a few minutes and approximately 2 GB free space including sources/build output. Re-running reuses source downloads and regenerates outputs.

```sh
npm run data:verify
npm test
npm run build
npm run test:browser
npm run preview
```

Browser tests use `/usr/bin/chromium` by default. On another machine, set `CHROMIUM_PATH` to a system Chromium or install Playwright Chromium with `npx playwright install chromium` (omit `CHROMIUM_PATH` if `/usr/bin/chromium` does not exist). Tests cover real production builds. `npm run dev` is for development; `npm run preview` serves `dist` for local verification.

## Sources, correctness and limits

- Quests: **2.9.0-beta-3**, modpack commit `27e61fbea6e245df80839885460994aa0ef9da9f`, CC BY-NC-SA 4.0. Midnight by **kastaqt**. All **3,810 quests**, **46 source chapters + unassigned view**, **4,009 displayed nodes**, and **4,317 chapter edges** reconcile against files. The source also has cross-chapter prerequisites and three dangling references.
- Recipes/names/icons: **2.9.0-v7**, ShadowTheAge export commit `d200440ea31d0357068a294d7312acf1146de909`: **52,287 goods, 221,760 recipes**. This is **not an exact beta-3 match**. The upstream export has **no license** and includes copyrighted mod/Minecraft content; we claim no blanket redistribution rights.
- The 20-circuit crafting fixture is calculated from source: 40 Resistors, 20 Steel Casings, 40 Vacuum Tubes, 20 Circuit Boards, 60 1x Red Alloy Cables. Those values are a regression test, not hardcoded UI totals. The current export's stable recipe identity replaces historical numeric ID references.
- Quantity calculations round batches, aggregate repeated inputs, reuse primary surplus, detect cycles and account for stock/catalysts. Unavailable/unsupported recipes stay visible as unresolved resources. Chance-only output and by-product reuse are not silently assumed. The optional machine whitelist limits recipe types. Ownership details, research, durability and special conditions still need in-game NEI review. Routes are transparent heuristics, not optimal solutions.
- Base bills use linked equipment and entered materials. Automatic multiblock casing counts, factory throughput, power-network simulation, pollution and farm yields are not implemented. Unknown NBT/item/task facts remain inspectable instead of receiving invented labels.
- Autosave is localStorage schema 2, with a previous-save recovery slot. Imports validate first, migrate schema 1, and reject malformed/newer data without replacing the world. Undo/redo history lasts the current session; export backups are the portable recovery path.
- The service worker caches the app shell and visited content in production. Offline browsing/calculation requires that content to have been loaded before. Unvisited data needs the local server. No telemetry or remote runtime service.

See [source/license manifest](docs/SOURCES.md), [architecture and calculation contracts](docs/ARCHITECTURE.md), [independent design review](docs/DESIGN-REVIEW.md), and [validation/performance results](docs/VALIDATION.md). Full source facts: `public/data/integrity.json` and `public/data/quest-source.tar.gz`.

## Self-hosting

`npm run build` creates a static `dist/` site. Serve it at the origin root over HTTPS (or local loopback); ensure the host serves `.json.gz` as gzip binary **without** adding another compression layer. The loader also accepts HTTP `Content-Encoding: gzip` when a host explicitly serves these files that way. Enable normal compression for JS/CSS. Increase the service-worker cache version when changing the data/app. No deployment or publication is performed by this repository.

**Review upstream asset rights before distributing a build**: generated recipe data/icons are included in your local build but are not covered by the questbook's CC license. Local/private use is the intended workflow.
