# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An interactive **world map of global energy projects** (全球能源项目世界地图). A zoomable Leaflet
tile map plots ~1800 energy projects worldwide, filterable by category, region, status, and year,
with live KPIs, a category bar chart, a top-projects list, project detail cards, an investment
heatmap mode, and "🆕 last 12 months" highlighting. The UI is in Chinese.

**Pure frontend, zero build.** Plain `HTML + CSS + vanilla JS`, no package manager, no bundler,
no transpile step. Everything (map library + data) is local except map tiles, which load from
Esri/OSM over the network.

## Running & verifying

There is no build, test, or lint tooling. To see changes:

- Simplest: open `index.html` directly in a browser (Chrome/Edge recommended).
- Local server (optional, Windows/PowerShell): `powershell -ExecutionPolicy Bypass -File serve.ps1 -Port 4173`, then open `http://localhost:4173/`.
- On Linux/macOS any static server works, e.g. `python3 -m http.server 4173`.

Map tiles require network access; project markers and all logic work offline. After editing,
verify in a browser — there is no build step.

**Automated checks** (zero-dep, also wired into CI via `.github/workflows/validate.yml` on push/PR):

- `node scripts/validate-data.js` — after editing any `js/data*.js`. Loads the data in
  `index.html`'s real `<script>` order and checks required fields, enum validity
  (`cat`/`region`/`status`), coordinate ↔ region consistency (catches sign errors like positive
  longitude in the Americas), duplicate `name`s (which `app.js` silently drops) and `id`s,
  per-file id-range overlaps, and orphan `ENERGY_PROGRESS` entries. Non-zero exit on any ERROR;
  warnings don't fail.
- `node scripts/test-units.js` — after editing `js/util.js`. Asserts `parseCapacity`,
  `classifySub` (matcher order/catch-all), and `wgs2gcj`/`outOfChina` behave as expected.

## Architecture

Two layers loaded as ordinary `<script>` tags in `index.html` (order is load-bearing):

1. **Vendored libraries** (`lib/`): `leaflet.js`, `leaflet.markercluster.js`, `leaflet-heat.js`
   plus their CSS and marker images. Do not edit these.
2. **Data files** (`js/data*.js`, `js/progress.js`): each attaches data to globals on `window`.
3. **`js/util.js`**: DOM-free pure logic shared by the app and the unit tests — `SUB_DEFS` +
   `classifySub`, `parseCapacity`, and the WGS-84→GCJ-02 conversion (`wgs2gcj`/`outOfChina`).
   Dual-export: attaches `window.ENERGY_UTIL` in the browser, `module.exports` under Node (so
   `scripts/test-units.js` can `require` it). Must load **before** `app.js`.
4. **`js/app.js`**: the application/UI logic — map setup, basemap switching, filtering,
   stats, detail cards, heatmap, mobile drawers. Runs inside one IIFE; pulls the pure helpers
   from `window.ENERGY_UTIL`.

### Data globals and merge model

- `js/data.js` defines `window.ENERGY = { META, CATEGORIES, REGIONS, STATUS, PROJECTS }` — the
  core curated projects plus all the shared config (categories, regions, statuses, update dates).
- `js/data-extra.js` defines `window.ENERGY_EXTRA = [ ... ]` (the bulk-research projects).
- **Every other regional data file** (`data-brazil.js`, `data-mideast.js`, `data-russia-ca.js`,
  `data-clients.js`, `data-brazil-future.js`, `data-saudi-future.js`, `data-seasia.js`,
  `data-africa.js`) **appends** via `window.ENERGY_EXTRA = (window.ENERGY_EXTRA || []).concat([ ... ])`.
  They must load *after* `data-extra.js` and *before* `app.js`.
- `js/progress.js` defines `window.ENERGY_PROGRESS = { <id>: "<latest progress text>" }`, merged
  into projects by `id`.
- In `app.js`, `PROJECTS` = `ENERGY.PROJECTS.concat(ENERGY_EXTRA)`, **deduplicated by `name`**
  (first occurrence wins; later duplicates are silently dropped). Progress text is attached by `id`,
  and a `sub` (subcategory) is computed per project via `classifySub`.

When adding a new data file: add its `<script>` to `index.html` in the right position **and** use
the `.concat()` append pattern so you don't clobber earlier data. Each file owns a distinct `id`
range (noted in its header comment) to keep progress mapping and dedup stable.

### Subcategory auto-classification (`SUB_DEFS` in `js/util.js`)

Subcategories are **not stored** on projects — they are derived. `SUB_DEFS` maps each category to
an *ordered* list of subcategory rules matched against the project's `name/en/cap/desc` (some use a
custom `fn` matching `owner`, `region`, etc.). `classifySub` returns the first matching rule's key;
the **last entry in each list has no rule and is the catch-all bucket**. Order matters — more
specific rules must come before broader ones. New projects are categorized automatically with no
manual tagging. To change subcategories, edit `SUB_DEFS` in `js/util.js` (labels, `zh`/`en`
keywords, or order); `scripts/test-units.js` has assertions guarding the matcher order.

### Coordinate handling

Project `coord` is always `[lng, lat]` in **WGS-84**. `toLatLng()` returns Leaflet's `[lat, lng]`.
`js/util.js` contains a full WGS-84→GCJ-02 conversion (`wgs2gcj`, applied only when a basemap's
`crs` is `gcj02`). The two active basemaps (`dark` Esri, `osm`) are both WGS-84, so no shift is
currently applied — but keep coordinates in WGS-84 so the conversion stays correct if a Chinese
basemap is re-added.

### Categories drive the UI

`CATEGORIES` in `data.js` (key → `{name, short, color, icon}`) is the single source for the legend,
filters, marker colors, cluster colors, and stat bars. Adding a category there makes it flow through
the whole UI automatically — but you must also add a matching `SUB_DEFS[<key>]` entry in `js/util.js`,
or that category's projects get no subcategory chips.

### Render pipeline

`render()` → `filtered()` (applies category/subcategory/region/status/year/search/recent filters) →
`updateMap` + `updateStats` + `updateList`. Markers go into a `markerClusterGroup`; `route`
polylines ("flowlines" for grids/HSR/pipelines) are always shown and never clustered. Heatmap mode
(`state.heat`) hides markers and renders a `√inv`-weighted `L.heatLayer` instead. A debug handle is
exposed at `window.__APP__`.

Year filtering is an interval `[state.minYear, state.maxYear]` driven by a dual-handle range slider
(bounds set dynamically from data min/max year) plus presets (全部 / 🆕近一年 / 未来管线2027+) and a
▶ timeline play (cumulative reveal: advances `maxYear` MIN→MAX on a timer, sets `state.playYear` to
pulse that year's new projects and show a big year ticker; any manual year interaction calls `pausePlay`).
Category/region toggles are centralized in `toggleCat`/`toggleRegion` (+ `syncCatUI`) and shared by
the left filter chips, the on-map category legend (`#cat-legend`), and the right-panel stat bars /
region cells (click-to-filter, two-way). Filter state round-trips through the URL hash via
`stateToHash`/`applyHash` (only non-default fields encoded) — the 🔗 share button copies the link and
`applyHash`+`applyUIFromState` restore it on load; `applyUIFromState` is the single place that syncs
every toggle's visual from `state` (also used by reset). ⤓ export dumps `filtered()` to a BOM-prefixed CSV.

### Derived capacity & metrics

`parseCapacity(cap)` (in `js/util.js`) turns the free-text `cap` into structured numbers attached to each
project at build time: `capMW` (electrical power), `capMWh` (storage energy), `capKm` (line/route length), `capKbd`
(oil 万桶/日), `capWty` (mass 万吨/年) — `null` when not parseable. It takes the first match per unit,
sums `A+B` lists, multiplies `N×M`, and uses lookaheads so `MW`/`GW` don't swallow `MWh`/`GWh`.
These power the right-panel **硬指标** block (`updateCapStats`, sums per the current filter) and a
**weight toggle** (`state.weight` `inv`|`cap`): marker size (`sizeFn(weightVal(p))`) and the heatmap
weight both switch between investment and `capMW`. The TOP list sorts by `state.sort` (`inv`|`cap`).
Two correctness rules in `updateStats`: investment + 硬指标 totals exclude `cat==='client'` (the 国际大客户
cross-view double-counts physical projects) unless client is the only selected category; and money is
shown in a unified USD form via `usd(p)`/`fmtInv` (from the numeric `inv`, 亿美元) **everywhere** —
tooltips, list, KPIs, country panel, and the detail card all lead with USD; the original-currency
`invText` survives only as a dimmed 原币种 note in the detail card and as a separate CSV column.

`showCountry(country)` (opened from the detail card's clickable 国家 link) renders a centered modal
dashboard for one country — KPIs, per-category bars, status split, year-distribution sparkline, and a
clickable TOP list — computed over **all** `PROJECTS` in that country (independent of the active filter);
its 投资/装机 totals apply the same client-exclusion rule.

## Project data conventions

A project object (see `data.js` header comment for the full field reference):

```js
{
  id, name, en, country,
  region,            // one of REGIONS: 中国/亚洲/中东/欧洲/北美/南美/非洲/大洋洲
  cat,               // one of CATEGORIES keys: renewable/grid/storage/ci/datacenter/transport/petro/mining/client
  coord: [lng, lat], // WGS-84
  cap, inv, invText, // inv is a number in 亿美元 (100M USD) used for sizing/stats; invText is display string
  status,            // 规划 / 在建 / 投运
  year,              // milestone year (drives the year slider)
  updated,           // 'YYYY-MM'; >= META.recentSince ⇒ flagged 🆕 (near-term)
  owner, flagship,   // flagship:true adds a pulsing marker
  desc, detail,      // desc = short tooltip/list text; detail = full paragraph in the detail card
  route,             // optional [[lng,lat], ...] connector line
}
```

- **Inclusion threshold**: projects with investment > 50M RMB (~$7M).
- **New project**: copy an entry, edit fields, set `updated` to the current month → it appears and is auto-flagged 🆕.
- **Changed project**: update `status`/`cap`/`inv`/`desc`/`detail` and bump `updated`.
- **"Recent" window**: controlled by `META.recentSince` (currently `'2025-06'`); `META.lastUpdated`
  (`'2026-06'`) is shown in the header. Bump both when refreshing the dataset.
- The category key `client` (国际大客户) groups overseas projects of 14 Chinese companies by `owner`
  (see the `SUB_DEFS.client` `fn` matchers).

## Data-refresh workflow

The maintainer triggers refreshes by asking (in Chinese) "刷新能源地图数据" / "刷新最新进展". The
expected response: web-search recent global energy project activity above the inclusion threshold,
add new projects (with full `detail`), update changed projects' `status`/`cap`/`inv`/`updated`,
extend `js/progress.js` by `id`, and set `META.lastUpdated` to the current month. All content is in
Simplified Chinese, UTF-8 — match the existing tone and field style. A new regional batch goes in its
own `js/data-*.js` with a distinct id range (append via `.concat`, register in `index.html`). Always
finish by running `node scripts/validate-data.js` and confirming a clean exit before committing.
