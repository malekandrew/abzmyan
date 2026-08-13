# Domain Model

> Maintained by: Archivist agent. Current-state snapshot — edit in place.

## Entities
This project's "domain" is the abzmyan workflow's own file-based data model — the objects it scaffolds and manipulates in a consumer project, not a database schema.

- **Config** (`.abzmyan/config.yml`, rendered from `templates/config.yml.template`) — one per project. Fields: `project_code` (2-5 uppercase letters), `mode` (`greenfield` | `brownfield`), `created_at` (ISO timestamp), `deploy.method` (`ftp` | `unconfigured`) with `deploy.credentials_file` when `ftp`, `abzmyan_version`.
- **Ticket** (entries in `.abzmyan/tickets/tickets.json`, an array under a `"tickets"` key) — the core unit of work. Fields observed in the Scribe agent's contract: `id` (`<project_code>-<zero-padded 3-digit number>`, e.g. `ABZ-001`), `slug` (kebab-case), `title`, `status`, `created_at`, `updated_at`. Each ticket also owns a folder `.abzmyan/tickets/<id>-<slug>/` containing `requirements.md`, `plan.md` (once planned), `log.md` (append-only per-agent activity log), and optionally `ui-guide/` (Figma notes or screenshot descriptions).
- **Index docs** (`.abzmyan/index/*.md`) — six maintained Markdown documents describing current-state architecture, tech stack, domain model, API surface, flow diagrams, and an append-only history log. Not a data entity in the traditional sense, but a first-class "thing the system maintains."
- **Agent (command template)** (`templates/commands/*.md`, copied to `.claude/commands/*.md`) — a Markdown prompt file defining one Claude Code slash command's behavior. Six exist: `scribe`, `architect`, `builder`, `archivist`, `shipper`, and `abzmyan-bootstrap` (this one).

## Business rules
- A ticket's `status` moves through a fixed lifecycle: `draft → ready → planned → implemented → documented → shipped`. The `draft → ready` transition is the only one requiring explicit human confirmation; every other transition is set automatically by the agent that completes that stage.
- Each stage agent enforces a precondition on the ticket's current status before acting, and refuses to run otherwise: Architect requires `ready`, Builder requires `planned`, Archivist requires `implemented`, Shipper requires `documented`.
- `tickets.json` must always be read and rewritten in full (never patched partially) when an agent updates a ticket, per the agent prompt instructions.
- `history.md` is append-only — agents must never edit or delete prior entries, only add new ones at the bottom.
- Index docs (`architecture.md`, `tech-stack.md`, `domain-model.md`, `api-index.md`, `flow-diagrams.md`) describe current state only and are edited in place (overwritten), in contrast to `history.md`.
- `npx abzmyan init` refuses to run if `.abzmyan/` already exists in the target directory, preventing accidental re-scaffolding/data loss; `npx abzmyan update` conversely refuses to run if `.abzmyan/` does *not* exist yet.
- Deploy is currently FTP-only; any other requested deploy method is explicitly out of scope per the Shipper agent's contract.
