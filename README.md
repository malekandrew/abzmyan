# abzmyan

[![npm version](https://img.shields.io/npm/v/abzmyan.svg)](https://www.npmjs.com/package/abzmyan)

**abzmyan** — Agent Built, Zero Missteps, Yours to Approve, Next. — is a lightweight, spec-driven-development workflow for [Claude Code](https://claude.com/claude-code), built around one core idea: **a maintained set of index docs (the "index") is the single source of truth for a project's architecture, domain model, API surface, and history.**

It's a 5-agent workflow, distributed as an npx-installable CLI. Each agent is triggered manually, one at a time, in a separate/clean Claude Code chat thread — there is no autonomous end-to-end flow, and no auto-chaining between stages. You review the output of each stage before moving to the next.

Built for personal, single-developer projects. No team collaboration, permissions, or concurrent-editing support. No automated testing/QA step and no deployment rollback — both are intentionally out of scope for now.

## Install

Inside the root of a project you want to use abzmyan on:

```sh
npx abzmyan init
```

This will ask you a few questions (project code, greenfield vs. brownfield, deploy method) and scaffold:

```
.abzmyan/
  config.yml
  index/                 ← architecture.md, domain-model.md, api-index.md, tech-stack.md, flow-diagrams.md, history.md
  tickets/
    tickets.json
.claude/
  commands/               ← the 6 slash commands below
```

If you're adding abzmyan to an existing (brownfield) codebase, run `/abzmyan-bootstrap` inside Claude Code right after `init` to have an agent draft your index docs from a scan of the existing code. Review its output before trusting it.

To pull in updates to the agent command files later (without touching your config, index docs, or tickets), run:

```sh
npx abzmyan update
```

## The workflow

Five agents, each a Claude Code slash command, each doing exactly one job and then stopping for human review:

| Agent | Command | Does | Sets status to |
|---|---|---|---|
| **Scribe** | `/scribe "<free text idea>"` | Turns a free-text idea into a new ticket with `requirements.md` | `draft` |
| **Architect** | `/architect <TICKET-ID>` | Turns approved requirements into a codebase-grounded `plan.md` | `planned` |
| **Builder** | `/builder <TICKET-ID>` | Implements the plan, verifies the build, self-checks acceptance criteria | `implemented` |
| **Archivist** | `/archivist <TICKET-ID>` | Updates the index docs and appends a `history.md` entry | `documented` |
| **Shipper** | `/shipper <TICKET-ID>` | Deploys the built app (FTP) | `shipped` |

Plus one setup-time agent that isn't part of the per-ticket flow:

- **Bootstrapper** — `/abzmyan-bootstrap` — one-time (brownfield only) agent that drafts the initial index docs from a scan of your existing codebase.

### Status lifecycle

```
draft → ready → planned → implemented → documented → shipped
```

- **`draft` → `ready` is a manual, human-only transition.** No agent will ever set a ticket to `ready` on its own. After Scribe writes `requirements.md`, you review it, and only once you're satisfied do you flip the ticket to `ready` (by hand in `tickets.json`, or by telling Scribe to do it in that same session) — that's your explicit "go ahead" signal before any planning or code gets written.
- Every other transition is set automatically by the agent that just finished its job.
- Each agent checks the ticket's current status before doing anything and refuses to run if the precondition isn't met:
  - Architect requires `ready`
  - Builder requires `planned`
  - Archivist requires `implemented`
  - Shipper requires `documented`

### A typical ticket

```sh
/scribe "Add a CSV export button to the reports page"
#   → creates .abzmyan/tickets/XTG-001-csv-export-reports/requirements.md, status: draft
#   → you review it, then set status to ready

/architect XTG-001
#   → reads requirements.md + the index + the real code, writes plan.md, status: planned
#   → you review the plan

/builder XTG-001
#   → implements the plan, verifies the build, status: implemented
#   → you review the diff

/archivist XTG-001
#   → updates architecture.md / domain-model.md / api-index.md / etc. and appends to history.md
#   → status: documented

/shipper XTG-001
#   → deploys via FTP, status: shipped
```

Nothing here chains automatically — each command does its one job, writes its files, and stops.

## Notes on scope

Deliberately not built (see the spec for the full rationale):

- No automated testing / QA agent
- No deployment rollback, backups, or versioning
- No multi-user / concurrent-access handling
- No deploy method other than FTP for now
- No web UI or dashboard — this is CLI + markdown files + Claude Code slash commands only
- No agent auto-chains into the next one; every stage waits for a human to trigger the next command

## License

MIT
