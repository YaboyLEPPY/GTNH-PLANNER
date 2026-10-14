# Sources and integrity

Community project; not an official GTNH product.

- Quest source: GTNewHorizons/GT-New-Horizons-Modpack, `27e61fbea6e245df80839885460994aa0ef9da9f`, **2.9.0-beta-3**, CC BY-NC-SA 4.0. Original complete DefaultQuests archive: `public/data/quest-source.tar.gz`. Full typed source facts are retained in each quest detail JSON.
- Midnight theme by **kastaqt**, distributed within the pinned modpack's BetterQuesting resources under its CC BY-NC-SA notice. `public/assets/bq_themes.json` and `midnight_gui.png` are original assets. This UI adapts the theme; it is not a pixel-perfect game reimplementation.
- Recipes, item names, item/fluid icons: ShadowTheAge/gtnh-data, `d200440ea31d0357068a294d7312acf1146de909`, **2.9.0-v7**. This is **not** the beta-3 build. The export has **no license**, includes third-party copyrighted content, and is supplied upstream for noncommercial educational/interoperability use. Generated recipe/catalogue/icon files are downloaded locally and gitignored. No blanket license or permission to redistribute those assets is claimed. Review upstream rights before distribution.
- Binary schema reference: ShadowTheAge/gtnh `src/repository.ts`, MIT. The importer independently decodes schema v7; schema layout attribution remains here. No upstream application code was copied.

Counts are derived from files, not UI constants: 3,810 unique quests; 46 original chapter files plus one generated unassigned view; 3,942 original placements plus 67 generated nodes = 4,009 displayed nodes; 4,317 within-chapter rendered edges, 5,450 internal prerequisite relationships (including cross-chapter), and 3 dangling source prerequisite references. The historical 47-chapter count includes the generated unassigned view; its 4,317 edges are chapter edges, not all dependencies.

Ender IO's intro is `IO, IO, It's Off to EnderIO We Go` in **Tier 2 - MV**. `EnderIO Lights` is in **Building Better Bases**; additional Ender IO item references exist throughout the book. The snapshot declares one ordered flat chapter menu, no separate Ender IO book/category hierarchy. Hardcore End(er) Expansion is separate content from another mod. The planner preserves the source's real chapter order and uses a search shortcut rather than fabricating an Ender IO menu.

The recipe catalogue has 52,287 goods and 221,760 recipes, with 52,287 verified atlas positions, rather than the previous prototype's 5,575 mapped icon paths. Unknown quest identities, custom NBT that cannot be matched exactly, and missing prerequisite links are retained explicitly; see the generated `public/data/integrity.json` report. No guessed item icons or recipes are substituted.
