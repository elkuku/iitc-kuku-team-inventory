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
```

The build output goes to `dist/`. The CI pipeline also produces `build/dev/` and `build/release/` directories (git-ignored).

There is no test runner configured in this project.

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

## ESLint Rules (notable)

- Arrow functions enforced (`prefer-arrow-functions/prefer-arrow-functions`)
- File names must be `PascalCase` (enforced by `unicorn/filename-case`), except `*.d.ts`, `index.ts`, `API*`, `*.schema.ts`, `*.spec.ts`
- No underscore-prefixed identifiers (`no-underscore-dangle`)
- TypeScript strict mode is on; see `tsconfig.json` for exact flags
- Short variable names `str`, `num`, `i`, `j`, `args` are allowed (unicorn abbreviation exceptions)
