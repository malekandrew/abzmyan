# Tech Stack

> Maintained by: Archivist agent. Current-state snapshot — edit in place.

## Languages & frameworks
- **Node.js** (`"engines": { "node": ">=18" }`), ES modules throughout (`"type": "module"` in `package.json`; all source files use `import`/`export`, not CommonJS).
- No frontend framework, no server framework — this is a CLI-only package. No TypeScript; plain JavaScript (`.js` files, no build/transpile step).
- Distributed via npm as `abzmyan`, invoked with `npx abzmyan <command>`.

## Key dependencies
- **`prompts`** (`^2.4.2`) — interactive CLI prompts used in `src/commands/init.js` for project code / mode / deploy method questions.
- **`fs-extra`** (`^11.2.0`) — filesystem helpers (`ensureDir`, `copy`, `pathExists`, etc.) used throughout `src/scaffold.js` and the command modules in place of raw `node:fs`.
- No other runtime dependencies. No test framework is configured (`npm test` currently just echoes a no-op and exits 0 — see `package.json`).

## Build & run commands
- `npx abzmyan init` — scaffold abzmyan into the current project (interactive).
- `npx abzmyan update` — refresh `.claude/commands/*` agent templates in place.
- `npm test` — placeholder only (`echo "no automated tests" && exit 0`); no real test suite exists yet.
- No build/compile step — `bin/abzmyan.js` is run directly by Node via the `bin` field in `package.json`.
- CI/publish: `.github/workflows/publish.yml` runs on GitHub Release (or manual dispatch), does `npm ci` → `npm test` → `npm publish --provenance --access public` on Node 20.

## Conventions
- Source under `src/`, CLI entry under `bin/`, scaffold payload (everything copied into consumer projects) under `templates/`.
- `src/commands/*.js` holds one file per CLI subcommand (`init.js`, `update.js`); `src/scaffold.js` and `src/detect.js` hold shared logic reused across subcommands.
- Path-building helpers (`abzmyanDir`, `commandsDir`, `indexDir`, `ticketsDir`) are centralized in `scaffold.js` rather than inlined, so the on-disk layout of a scaffolded project (`.abzmyan/config.yml`, `.abzmyan/index/`, `.abzmyan/tickets/`, `.claude/commands/`) has one source of truth.
- Templates use `{{UPPER_SNAKE_CASE}}` placeholder tokens (e.g. `{{PROJECT_CODE}}`, `{{MODE}}`) replaced via literal string `.replace()` calls, not a templating library.
- JSDoc-style one-line comments above exported functions in `scaffold.js` and `detect.js` explain intent/non-obvious behavior (e.g. the note on `detectDefaultMode` never deciding on its own).
- The agent prompt files (`templates/commands/*.md`) are the actual behavioral spec for the 5-agent + Bootstrapper workflow; changes to workflow behavior are made there, not in JS source.
