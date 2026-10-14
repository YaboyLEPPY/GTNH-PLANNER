# Architecture and calculation contracts

React + TypeScript + Vite; no account, backend, analytics, remote font or runtime third-party request. SVG/positioned DOM handles source-layout quest graphs and block-layout bases. The largest chapters remain practical without a canvas dependency; source nodes stay keyboard-addressable. Chapter-fit, zoom, pan and a readable focus selector complement the original dense layout.

- `scripts/import_data.py`: pinned upstream archives, BetterQuesting typed-key normalization and exact 128-bit IDs, binary schema-v7 decoding, full source preservation, identity matching, sprite extraction, compressed navigation/search/catalogue, per-product recipe shards, integrity report.
- `src/data.ts`: deduplicated lazy requests, compressed JSON decoding, source item names, recipe shard loading. No bulk recipe JSON in the initial JS bundle.
- `src/domain/quests.ts`, `formatting.ts`: source AND/OR/XOR prerequisite rules and safe Minecraft emphasis.
- `src/domain/production.ts`: pure async quantity calculator with injected catalogue/recipe provider, batch rounding, repeated-input aggregation, stock allocation, deterministic primary surplus, per-item routes and ore alternatives, boundaries, cycles, depth/node limits, cancellation, catalysts and explicit unresolved bills.
- `src/domain/ledger.ts`: combines orders with compatible recipe settings, then allocates remaining stock to direct base costs and desired targets. Stock is never counted twice. Reservations reduce available stock. Quest/manual targets are maxima against existing demand, not duplicate additions. Planned production outputs cover matching quest targets.
- `src/domain/world.ts`: schema-2 world, validated imports, schema-1 migration, localStorage autosave and previous-save recovery, non-mutating completion transactions, optional historical LV notes.
- `src/domain/base.ts`: floor-aware geometry, bounds/collision rules, deletion of dangling connections and optional editable example.
- `src/components`: separate questbook, production, ledger, profile/backup, base controller, grid rendering and inspectors. Planner sections are code-split.
- `public/sw.js`: same-origin cache of application shell and visited files. Previously visited content works offline. Unvisited chapters/recipes still need the local server/network; this is not a promise that all game data is precached.

## Route calculation limits

The heuristic favors ordinary crafting, penalizes likely recycling, and excludes direct self-consumption by default. It is not a global optimal-route solver. Recipe changes are applied after pressing Calculate again. Routes are selected per item identity; the same intermediate uses the same selected route throughout a plan. Ore alternatives are selected per recipe input slot.

The source export uses **LV = tier 0**, not ULV = 0. Steam/manual-only is the user option -1. Voltage eligibility is checked through MAX. An optional strict whitelist also checks source recipe-machine types; the player must explicitly declare those types. Research, multiblock capability and dimension constraints are not automatically established by those checks. Exported special metadata remains visible for NEI review. Tools/catalysts are represented by zero-count inputs, required once and not consumed; durability and replacement are unmodelled.

A recipe must guarantee the selected output. Chance-only production is unresolved; expected-value math is never presented as guaranteed materials. Secondary products are displayed but not credited, making the bill conservative. Compatible primary-output surplus is reused within a combined calculation. Orders with different route/tier/boundary settings are calculated separately, share stock, and do not reuse surplus across those groups.

“Complete build” requires sufficient unreserved stock and reusable catalysts. It deducts the calculator's allocated inputs, credits requested output and deterministic primary surplus, and excludes that order from open demand. It does not credit probabilistic or secondary products. This is a manual transaction after actually building in game. Undo stores up to 50 snapshots in the current session. Base undo/redo likewise lasts this editor session; the layout itself persists.

Base footprints and connections express planning intent. Catalogue equipment and user-entered material quantities create direct demand; footprint size does not invent a casing bill. Cross-floor connections are labelled. Physical connectivity, transfer capacity, pollution simulation and automatic farm yields are not validated.

Unmatched registry/metadata combinations, custom NBT without an exact safe mapping, and dangling prerequisites are explicitly retained. This export is not perfect data coverage for all task semantics. Every complete raw quest remains inspectable, and the original archive preserves exact long integer source values.
