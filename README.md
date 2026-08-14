# abzmyan

[![npm version](https://img.shields.io/npm/v/abzmyan.svg)](https://www.npmjs.com/package/abzmyan)

**abzmyan** — Agent Built, Zero Missteps, Yours to Approve, Next. — is a lightweight, spec-driven-development workflow for your AI coding agent(s) of choice — [Claude Code](https://claude.com/claude-code), [Cursor](https://cursor.com), [GitHub Copilot](https://github.com/features/copilot), [OpenAI Codex CLI](https://github.com/openai/codex), and [Gemini CLI](https://github.com/google-gemini/gemini-cli) — built around one core idea: **a maintained set of index docs (the "index") is the single source of truth for a project's architecture, domain model, API surface, and history.**

It's a 5-agent workflow, distributed as an npx-installable CLI. Each agent is triggered manually, one at a time, in a separate/clean chat thread in your AI coding agent of choice — there is no autonomous end-to-end flow, and no auto-chaining between stages. You review the output of each stage before moving to the next.

Built for personal, single-developer projects. No team collaboration, permissions, or concurrent-editing support. No automated testing/QA step and no deployment rollback — both are intentionally out of scope for now.

## Install

Inside the root of a project you want to use abzmyan on:

```sh
npx abzmyan init
```

This will ask you a few questions — project code, greenfield vs. brownfield, deploy method, and which AI coding agent(s) you use (multi-select: Claude Code, Cursor, GitHub Copilot, OpenAI Codex CLI, Gemini CLI — pick one or more) — and scaffold:

```
.abzmyan/
  config.yml              ← records your selected agent(s) under `agents:`
  index/                 ← architecture.md, domain-model.md, api-index.md, tech-stack.md, flow-diagrams.md, history.md
  tickets/
    tickets.json
```

Plus, for each AI agent you selected, its native commands directory with the 6 commands below:

| Agent | Commands directory |
|---|---|
| Claude Code | `.claude/commands/*.md` |
| Cursor | `.cursor/commands/*.md` |
| GitHub Copilot | `.github/agents/*.agent.md` |
| OpenAI Codex CLI | `.codex/skills/<name>/SKILL.md` |
| Gemini CLI | `.gemini/commands/*.toml` |

`init` also writes a short project-context block — pointing to `.abzmyan/index/` as the source of truth and naming the ticket workflow — into each selected agent's always-loaded memory file, so ordinary chat (not just the slash commands) stays aware of it:

| Agent | Memory file | How it's written |
|---|---|---|
| Claude Code | `CLAUDE.md` | block inserted between `<!-- abzmyan:start -->`/`<!-- abzmyan:end -->` markers; rest of the file is left alone |
| Cursor | `.cursor/rules/abzmyan.mdc` | dedicated always-apply rule file, fully owned by abzmyan |
| GitHub Copilot | `.github/copilot-instructions.md` | marker block, as above |
| OpenAI Codex CLI | `AGENTS.md` | marker block, as above |
| Gemini CLI | `GEMINI.md` | marker block, as above |

If the shared file already exists (e.g. you have your own `CLAUDE.md`), only the marked block is touched — your own content is preserved.

If you're adding abzmyan to an existing (brownfield) codebase, run `/abzmyan-bootstrap` (or the equivalent invocation for your agent) right after `init` to have an agent draft your index docs from a scan of the existing code. Review its output before trusting it.

To pull in updates to the agent command files later (without touching your config, index docs, or tickets), run:

```sh
npx abzmyan update
```

`update` also refreshes command files and the project-context block for every AI agent currently configured for the project, and offers a prompt to add or change which agent(s) abzmyan writes commands for. This is how projects set up with an older version of abzmyan (from before this block existed) pick it up — just run `npx abzmyan update`.

## The workflow

Five agents, each invoked via your AI agent's native custom-command mechanism (e.g. a Claude Code/Cursor/Gemini CLI slash command, or a GitHub Copilot custom agent selected from the chat mode dropdown), each doing exactly one job and then stopping for human review:

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
- No web UI or dashboard — this is CLI + markdown files + your AI coding agent's native commands only
- No agent auto-chains into the next one; every stage waits for a human to trigger the next command

## License

MIT
