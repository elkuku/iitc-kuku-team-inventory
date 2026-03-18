# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **IITC (Ingress Intel Total Conversion) plugin** named "KuKuTeamInventory" — a browser plugin that displays team inventory information in the Ingress Intel map. It is built using the [IITC Plugin Kit](https://github.com/McBen/IITCPluginKit) (`iitcpluginkit`).

## Commands

```bash
yarn install          # Install dependencies
yarn build            # Build dev version (alias for build:dev)
yarn build:dev        # Development build → dist/
yarn build:prod       # Production build → dist/
yarn start            # Start file server (for local testing)
yarn autobuild        # Watch mode: auto-rebuild on file changes

# Unit / component tests (Vitest)
yarn test             # Run all unit tests once
yarn test:watch       # Watch mode
yarn test:coverage    # With v8 coverage report
yarn test:browser     # Browser screenshot tests via Vitest + Playwright

# End-to-end tests (Playwright — real IITC environment)
yarn test:e2e         # Run e2e tests against baseline screenshots
yarn test:e2e:update  # Re-capture baseline screenshots
```

The build output goes to `dist/`. The CI pipeline also produces `build/dev/` and `build/release/` directories (git-ignored).

## Architecture

The plugin follows the IITC Plugin Kit structure:

- **`plugin.json`** — Plugin metadata (name, id, description, entry point, download URL). The entry point is `src/Main.ts`. The `name` and `description` fields are used by the CI to generate the GitHub Pages site.
- **`src/Main.ts`** — Plugin entry point. Implements `Plugin.Class`, registers with `Plugin.Register()`, adds a toolbox button via `IITC.toolbox.addButton()`, and opens a jQuery UI dialog.
- **`src/Helper/Dialog.ts`** — Wraps IITC's jQuery dialog system. Depends on `window.plugin.HelperHandlebars` (a separate IITC helper plugin) for Handlebars template rendering.
- **`src/tpl/dialog.hbs`** — Handlebars template for the dialog HTML.
- **`src/styles.css`** — Plugin CSS, loaded via `require()` in `Main.ts`.
- **`types/Types.ts`** — Global type augmentations: declares `window.plugin.HelperHandlebars` and the `HelperHandlebars` interface.
- **`types/handlebars.d.ts`** — Handlebars type definitions (vendored from DefinitelyTyped).

### CI / GitHub Pages

On every push, GitHub Actions (`.github/workflows/build.yml`) builds the HEAD as dev and the latest git tag as release, then generates a GitHub Pages site from `.github/page/index.html` (a template with `{{PLACEHOLDER}}` tokens). Releases are published by creating git tags.

## Testing

### Unit tests — Vitest (`src/**/*.spec.ts`)

Each Helper class has a co-located `.spec.ts` file. Tests run in Node (no browser). Coverage is measured over `src/Helper/**/*.ts`.

### Browser screenshot tests — Vitest + Playwright (`src/screenshots.browser.spec.ts`)

Renders the dialog template in a real Chromium browser (headless, via `@vitest/browser-playwright`). Handlebars helpers and sample data are wired up directly — no IITC runtime needed.

Config: `vitest.browser.config.ts`

### End-to-end tests — Playwright (`e2e/tests/team-inventory.spec.ts`)

Runs the **built plugin** (`dist/iitc_plugin_KuKuTeamInventory.dev.user.js`) inside a real IITC environment served by a local Express mock server. Full-page baseline screenshots are stored in `e2e/screenshots/`.

Config: `playwright.e2e.config.ts`

**Prerequisites:** The IITC core build must exist at `../iitc-kuku-plugin-tester/iitc/total-conversion-build.js` (sibling repo). The plugin must be built (`yarn build`) before running e2e tests.

#### E2E directory layout

```
e2e/
├── server/
│   ├── package.json          # { "type": "commonjs" } — overrides root ESM for ts-node
│   ├── tsconfig.json         # CommonJS tsconfig used by ts-node
│   ├── start.cjs             # CJS launcher (sets TS_NODE_PROJECT, starts server)
│   ├── index.ts              # Express app; also serves /libs/handlebars.min.js
│   ├── routes/
│   │   ├── intel-page.ts     # Builds mock IITC HTML; inlines plugins before IITC script
│   │   └── api.ts            # Mock /r/* Ingress API endpoints
│   └── fixtures/             # player.json, entities.json, gameScore.json
├── plugins/
│   ├── helper-handlebars.js  # Mock window.plugin.HelperHandlebars (wraps Handlebars UMD)
│   └── test-plugin.js        # Sets [data-iitc-fully-loaded] when IITC boots
├── tests/
│   ├── helpers/iitc-page.ts  # setupIITCRoutes(), suppressIITCDialogs()
│   └── team-inventory.spec.ts # 10 tests × full-page screenshots
└── screenshots/              # Baseline PNGs (committed; updated with test:e2e:update)
```

#### Plugin load order (during IITC boot)

Plugins are inlined in the mock page **before** the IITC script, so they push `setup()` onto `window.bootPlugins` and IITC calls them in order:

1. `helper-handlebars.js` — sets up `window.plugin.HelperHandlebars` using `window.Handlebars` (loaded in `<head>`)
2. `test-plugin.js` — registers the `iitcLoaded` hook that sets `[data-iitc-fully-loaded="true"]`
3. `iitc_plugin_KuKuTeamInventory.dev.user.js` — full plugin initialisation, toolbox button added

Tests wait on `[data-iitc-fully-loaded="true"]` before interacting with the page.

## ESLint Rules (notable)

- Arrow functions enforced (`prefer-arrow-functions/prefer-arrow-functions`)
- File names must be `PascalCase` (enforced by `unicorn/filename-case`), except `*.d.ts`, `index.ts`, `API*`, `*.schema.ts`, `*.spec.ts`
- No underscore-prefixed identifiers (`no-underscore-dangle`)
- TypeScript strict mode is on; see `tsconfig.json` for exact flags
- Short variable names `str`, `num`, `i`, `j`, `args` are allowed (unicorn abbreviation exceptions)
