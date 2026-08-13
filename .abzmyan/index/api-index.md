# API Index

> Maintained by: Archivist agent. Current-state snapshot — edit in place.

## Endpoints
This project has no HTTP API — it is a local CLI tool with no server component. The closest analog is its CLI subcommand surface, dispatched in `bin/abzmyan.js`:

| Command | Purpose | "Request" (args/prompts) | "Response" (side effects / output) |
|---|---|---|---|
| `npx abzmyan init` | One-time scaffold of abzmyan into the current project. Refuses to run if `.abzmyan/` already exists. | Interactive prompts: project code (2-5 uppercase letters), greenfield/brownfield mode (default suggested by `detectDefaultMode`), deploy method (`ftp` or unconfigured), and FTP credentials file path if `ftp` chosen; final confirm. | Creates `.abzmyan/config.yml`, `.abzmyan/index/*.md` (from templates), `.abzmyan/tickets/tickets.json` (empty), `.claude/commands/*.md`; appends the init line to `history.md`; prints a "run `/abzmyan-bootstrap`" hint for brownfield or a "run `/scribe`" hint for greenfield. |
| `npx abzmyan update` | Refresh agent command templates without touching user data. Refuses to run if `.abzmyan/` does not exist. | None (no prompts). | Overwrites `.claude/commands/*.md` from `templates/commands/*.md`; prints a per-file added/updated/unchanged summary; leaves `config.yml`, `index/*`, and `tickets/*` untouched. |
| `npx abzmyan` / `-h` / `--help` | Print usage. | None. | Prints help text to stdout. |
| any other value | Unknown command. | — | Prints error + help text; sets non-zero exit code. |

One layer up, the six Markdown files in `templates/commands/` (copied to a consumer project's `.claude/commands/`) define the "real" interface of the product — Claude Code slash commands invoked by a human inside a chat session, not by this repo's code:

| Slash command | Precondition | Effect |
|---|---|---|
| `/scribe "<idea>"` | none | Creates a new ticket (`requirements.md`), status `draft`. |
| `/architect <TICKET-ID>` | ticket status `ready` | Writes `plan.md`, status → `planned`. |
| `/builder <TICKET-ID>` | ticket status `planned` | Implements the plan, status → `implemented`. |
| `/archivist <TICKET-ID>` | ticket status `implemented` | Updates index docs + `history.md`, status → `documented`. |
| `/shipper <TICKET-ID>` | ticket status `documented` | Deploys via FTP, status → `shipped`. |
| `/abzmyan-bootstrap` | brownfield mode, run once | Drafts initial index docs from the existing codebase (this document included). |
