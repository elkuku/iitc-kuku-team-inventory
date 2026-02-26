# KuKuTeamInventory Plugin Memory

## Project
IITC plugin for tracking team inventory. Built with iitcpluginkit (TypeScript + Webpack).

## Key Architecture Decisions
- `tsconfig.json` uses `"target": "ES2023"` (changed from ES2017) to support `toSorted()`, `Blob#text()` etc.
- `webpack.config.cjs` overrides css-loader to disable URL resolution (`url: false`) so `/img/ico/...` paths pass through as-is (served by IITC server at runtime)
- Storage key: `plugin-kuku-team-inventory-teams` in localStorage
- Export format: same JSON structure as KuKuInventory (agent, keys, resonators, weapons, mods, cubes, boosts)

## ESLint Rules to Remember
- Use `undefined` not `null` (unicorn/no-null)
- Use `toSorted()` not `sort()` (unicorn/no-array-sort)
- Use `!== -1` not `>= 0` for indexOf (unicorn/consistent-existence-index-check)
- No negated conditions: `x !== y ? a : b` → `x === y ? b : a` (unicorn/no-negated-condition)
- Generic args on constructor: `= new Map<K,V>()` not `: Map<K,V> = new Map()` (@typescript-eslint/consistent-generic-constructors)
- Avoid abbreviated names: `dist` → `distance`, `el` → `element`, `idx` → `index` (unicorn/prevent-abbreviations)

## File Structure
```
src/
  Main.ts                     - Plugin entry, public API for HTML onclick handlers
  Helper/
    Dialog.ts                 - Main dialog (tabs: Teams, Equipment, Keys, Other, Export, Sheets)
    StorageHelper.ts          - localStorage R/W for Team[] data
    ImportHelper.ts           - File import (uses Blob#text())
    InventoryHelper.ts        - Aggregates data across agents
    LayerHelper.ts            - Map markers showing key counts
    SheetsHelper.ts           - Google Sheets push/pull via GIS OAuth2 token flow
    SidebarHelper.ts          - Portal detail sidebar panel
    ExportHelper.ts           - JSON export of all teams
  tpl/
    dialog.hbs                - Main dialog template (team selector bar + jQuery UI tabs)
    _items-image.hbs          - Resonators/weapons/mods with icon CSS classes
    _items-label.hbs          - Cubes/boosts with text labels
    _keys-table.hbs           - Keys table rows (eachInMap for agentCounts)
    _agents-list.hbs          - Agent list table in Teams tab
  styles.css                  - CSS (icon classes reference /img/ico/ server paths)
types/
  Types.ts                    - All interfaces: Team, AgentInventory, KeyInfo, SheetsConfig, etc.
  key-translations.ts         - Human-readable names for item keys
  handlebars.d.ts             - Handlebars type defs (vendored)
  gis.d.ts                    - google.accounts.oauth2 type defs (vendored ambient)
webpack.config.cjs            - Disables CSS URL resolution in webpack
```

## Google Sheets Integration
- localStorage keys: `plugin-kuku-team-inventory-sheets-client-id`, `plugin-kuku-team-inventory-sheets-spreadsheet-id`
- Access token: memory only (never persisted)
- Sheet layout: tab `KuKuTeamInventory`, A1=ISO timestamp, A2=JSON.stringify(teams), majorDimension COLUMNS
- GIS script loaded lazily on first use from `https://accounts.google.com/gsi/client`
- `SheetsHelper` uses callback-based API; Main.ts adds `saveSheetsConfig`, `pushToSheets`, `pullFromSheets` arrow properties

## Reference Plugin
`/home/elkuku/repos/IITC/KuKu/iitc-kuku-inventory` - single-agent inventory plugin
- Templates in `templates/` dir (team inventory uses `src/tpl/`)
- Has local `img/` and `img2/` dirs for bundled images

## Import Format
JSON export from KuKuInventory: `{ agent?, keys[], resonators{}, weapons{}, mods{}, cubes{}, boosts{} }`
Keys already have pre-aggregated `total` per portal (not individual items).
