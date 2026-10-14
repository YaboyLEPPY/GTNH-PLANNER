# Horizon Foundry — GTNH Planner

A private, local-first community companion for GT New Horizons. Built from the complete pinned official questbook, with original chapter positions, full task/reward facts, searchable content, and locally stored progress.

## Development

Node 22+ and Python 3.10+ with Pillow are required.

```sh
npm ci
python -m pip install -r scripts/requirements.txt
npm run data:import
npm run dev
```

The importer downloads the two pinned source archives over verified HTTPS and generates lazy chapter, quest, search, catalogue, icon and per-product recipe files. Original quest data is retained. Recipe data and icons remain local generated files because the upstream export has no redistribution license. The initial chapter screen loads neither the recipe database nor the full search index.

```sh
npm run data:verify
npm run build
npm run test:browser
```

Browser tests currently use system Chromium at `/usr/bin/chromium`. See [sources and licenses](docs/SOURCES.md) for version mismatch, counts, source limitations, and attribution. Nothing is published or deployed by these commands.
