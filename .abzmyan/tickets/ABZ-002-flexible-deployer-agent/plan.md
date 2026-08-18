# Implementation Plan: ABZ-002

## Summary
Remove the `shipped` status and the FTP-only Shipper agent from the per-ticket workflow, rename Archivist's terminal status from `documented` to `archived`, and replace Shipper with a new ticket-agnostic **Deployer** agent that supports multiple named deploy targets, each backed by a self-written playbook (`.abzmyan/deploy/<target>.md`) produced by an open-ended, method-agnostic interview rather than a hardcoded FTP flow. Because `templates/commands/*.md` is copied verbatim by `copyCommandTemplates()` (it iterates whatever `.md` files exist — no per-file registration needed beyond `COMMAND_DESCRIPTIONS`), adding/removing an agent is mostly a matter of adding/removing template files and updating the docs and JS that reference them by name. This repo dogfoods itself (`.claude/commands/*.md` are copies of `templates/commands/*.md`), so the last implementation step is refreshing those copies in place.

## Files to create/modify

- `templates/commands/shipper.md` — delete.
- `templates/commands/deployer.md` — new. Replaces Shipper. See step-by-step approach below for required behavior/structure.
- `templates/commands/archivist.md` — step 4: set ticket status to `archived` instead of `documented`; step 5's log line updates to match (`Status: archived.`).
- `templates/commands/abzmyan-express.md` — every mention of `documented` → `archived` (the "Scope" line, the Archivist stage description, the "When you're done" section); every mention of `/shipper <TICKET-ID>` → `/deployer` (no ticket ID — Express's own stopping point doesn't change, it still never deploys, just update the pointer to the new command's calling convention).
- `templates/config.yml.template` — drop the `{{DEPLOY_BLOCK}}` placeholder; hardcode:
  ```
  deploy:
    targets: {}
  ```
  (Deploy is no longer configured at `init` time — see Open questions/risks below.)
- `templates/memory-block.md.template` — the "Don't invoke `/scribe`, `/architect`, `/builder`, `/archivist`, `/shipper`, or `/abzmyan-express`..." sentence: replace `/shipper` with `/deployer`.
- `src/agents.js` — `COMMAND_DESCRIPTIONS`: remove the `shipper` key, add a `deployer` key (e.g. `'Ticket-agnostic agent that deploys the current project state, guided by a self-written per-target playbook.'`).
- `src/scaffold.js` — `writeConfig()`: remove the `deployMethod`/`credentialsFile` params and the `deployBlock` conditional construction; the function no longer needs to build that block since `config.yml.template` now hardcodes `deploy:\n  targets: {}` directly.
- `src/commands/init.js` — remove the `deployMethod` (`select`) and `credentialsFile` (conditional `text`) prompts entirely; remove those two fields from the `writeConfig(...)` call.
- `src/commands/update.js` — add a one-time migration step (see step-by-step approach below): rewrite any ticket in `tickets.json` at status `documented` or `shipped` to `archived`; migrate any existing `config.yml` single-block deploy config (`method`/`credentials_file`) into the new `deploy.targets` map shape; and, for every currently-configured agent, delete the old `shipper` command file (Shipper is being removed entirely, not deprecated-in-place). Print a short summary of what was migrated/removed, same style as the existing added/updated/unchanged summaries.
- `src/scaffold.js` — add a small `removeCommandFiles(projectRoot, agentIds, name)` helper alongside `copyCommandTemplates`, reusing the same `agentCommandsDir`/`fileName` path resolution, that deletes the given command's file for each agent and — for agents whose `commandsDir` is a function of the command name (currently only Codex CLI, one directory per skill) — also removes the now-empty per-command directory afterward. Returns a per-{agentId, file, removed} summary, mirroring `copyCommandTemplates`'s shape.
- `README.md` — agent table (Shipper row → Deployer row, with its own "Sets status to" column reading something like "— (ticket-agnostic)"; Archivist row's "Sets status to" → `documented`... `archived`), status lifecycle diagram (drop `→ shipped`), "A typical ticket" walkthrough (drop the `/shipper` step from the per-ticket sequence; add a short note that deploying is a separate, batched, ticket-agnostic step via `/deployer`), the "two agents that aren't part of the standard flow" section (add Deployer alongside Bootstrapper, with a one-line description), and the "Notes on scope" bullet "No deploy method other than FTP for now" (remove — no longer true).
- `package.json` — `description` field lists "Scribe, Architect, Builder, Archivist, Shipper"; update to "...Archivist, Deployer".
- `.claude/commands/deployer.md` (added), `.claude/commands/shipper.md` (deleted), `.claude/commands/archivist.md`, `.claude/commands/abzmyan-express.md` — this repo's own dogfooded copies. After editing the `templates/commands/*.md` sources, run `npx abzmyan update` from the repo root (against itself) to regenerate these — with the new deletion logic above, `shipper.md` is removed automatically, not by hand. This is both the correct mechanism and a functional smoke test that `update` still works end-to-end, including both migration steps (this repo's own `tickets.json` has no `documented`/`shipped` tickets yet, but its `config.yml` has `deploy.method: unconfigured`, exercising the config-migration path) and the new shipper-removal step.
- **Not touched by this ticket's implementation**: `.abzmyan/index/*.md` (architecture.md, tech-stack.md, domain-model.md, api-index.md, flow-diagrams.md). These describe current state and are the Archivist's responsibility to reconcile — Builder should leave them stale/as-is; `/archivist ABZ-002` will update them after this ticket is implemented. `CHANGELOG.md` is also out of scope (semantic-release generated, not hand-edited).

## Step-by-step approach

1. **Status lifecycle rename.** Edit `templates/commands/archivist.md` and `templates/commands/abzmyan-express.md` per the file list above. Grep the whole repo for the literal strings `documented` and `shipped` afterward to make sure no reference was missed (expect remaining hits only in `CHANGELOG.md`/git history, which are correctly left alone).

2. **Write `templates/commands/deployer.md`.** Follow the structural conventions of the existing agent prompts (`# <Name>` heading, role/context paragraph, `Precondition:` line, `## Bootstrap`, `## Your task`, ending with a `Stop.` line) but adapt them to a ticket-agnostic agent:
   - `Precondition: none.` No ticket ID argument — invoked as `/deployer` (default/only target) or `/deployer <target-name>` (specific target).
   - **Bootstrap**: read `.abzmyan/config.yml` (stop if missing, same as other agents); parse an optional target-name argument.
   - **Target resolution**:
     - If a target name was given: look it up under `deploy.targets` in `config.yml`. If found, this is an existing target — go to "subsequent run" behavior. If not found, this is a new target — go to "first run" behavior, using the given name.
     - If no target name was given: look at how many targets exist under `deploy.targets`. Zero → first run, and ask for a target name as part of the interview. Exactly one → treat it as the resolved target, subsequent-run behavior. More than one → list the configured target names and ask the user which one to run; do not guess.
   - **First run for a target** (open-ended interview, general across all changes described in this ticket):
     - Before asking anything, check whether `config.yml` already has a `deploy.targets.<target-name>` entry with a `method`/`credentials_file` (this happens for a target produced by the `update` migration described below, e.g. `default` from an old FTP setup) — if so, open the interview by confirming that existing method/credentials still apply and validating them, rather than asking the user to re-enter details they already had working. Only fall through to the full open-ended questioning below for whatever isn't already known.
     - Ask the user, conversationally, how deployment works for this project — do not lead with an FTP-specific question or any fixed method list. Keep asking follow-ups branching on their answers until the method, required credentials/access, environment-specific config-file handling (deploy as-is / leave alone on the server / template), and file include/exclude rules are all understood. If the user hands over an existing deployment-process document instead, read it, ask only about gaps/ambiguities it leaves, and use it as the basis for the playbook instead of a blank interview.
     - Once a method and credentials are understood, and only if the method admits a safe, side-effect-free validation (e.g. FTP/SFTP: connect and do a read-only directory listing or stat of the remote path; an API-based method: a read-only auth/identity check; a method with no such check, e.g. a webhook or opening a PR — skip validation and say so explicitly rather than faking a check): perform that check before writing anything to disk. On failure, report what failed and ask for corrected details — do not persist unvalidated config.
     - Once validated (or validation was skipped because none applies), write two files:
       - `.abzmyan/deploy/<target>.md` — the playbook: concrete, project-specific, step-by-step instructions covering (in order) a build step if one applies, file include/exclude rules, environment-config-file handling, the transport/execution step itself, a verification step, and how success/failure should be reported. Never embed secret values — reference the credentials file by path only.
       - Patch `.abzmyan/config.yml`: add an entry under `deploy.targets.<target-name>` with `method` (a short free-text label, not a fixed enum — e.g. `ftp`, `webhook`, `github-pr`, `custom-script`) and `credentials_file` (path, omitted if the method needs none). Read the full file and write the full file back, same convention other agents already use for `tickets.json`.
       - Create `.abzmyan/deploy/<target>.log.md` if it doesn't exist, and append `[<ISO timestamp>] Target "<target>" configured.` (mirrors the append-only `log.md` convention ticket folders already use).
     - Report the finished playbook to the user; do not deploy on this same run unless they explicitly ask you to continue.
   - **Subsequent run for an existing target**: read `.abzmyan/deploy/<target>.md` and the credentials file it references; follow the playbook's steps mechanically, without re-interviewing. If the playbook file is missing despite a config entry existing (inconsistent state), say so and fall back to first-run behavior for that target rather than failing silently. If the user's message explicitly asks to reconfigure this target, also fall back to first-run behavior (overwriting the existing playbook once the new interview completes).
   - After a deploy attempt (first run continuing straight through, or a subsequent run), append `[<ISO timestamp>] Deployed. <brief result>.` (or `Deploy failed: <brief reason>.`) to `.abzmyan/deploy/<target>.log.md`.
   - `Stop. Do not invoke any other agent.` — same as Shipper today; Deployer never touches ticket status or `tickets.json` at all.

3. **Config template and scaffolding.** Update `templates/config.yml.template`, `src/scaffold.js`'s `writeConfig()`, and `src/commands/init.js` per the file list above, so a freshly-initialized project starts with `deploy:\n  targets: {}` and no deploy-related prompts during `init`.

4. **Migration logic in `src/commands/update.js`.** Add a step (run unconditionally, alongside the existing template-refresh step) that:
   - Reads `.abzmyan/tickets/tickets.json` in full; for every ticket with `status` of `documented` or `shipped`, set `status: 'archived'` and refresh `updated_at`. Write the full file back only if at least one ticket changed. Print how many tickets were migrated (or nothing if zero).
   - Reads `.abzmyan/config.yml`; if it still has the old single-block shape (`deploy.method` present, i.e. not already using `deploy.targets`), convert it: `method: unconfigured` → `deploy:\n  targets: {}`; `method: ftp` (with `credentials_file`) → wrap it as a single target named `default` (`deploy.targets.default.method: ftp`, carrying over `credentials_file`). Use the `yaml` package's `parseDocument`/`.set()` pattern already established by `writeAgentsToConfig()` so unrelated keys/comments are preserved. Print a short note when this migration ran. (This produces a `deploy.targets.default` entry with no playbook yet on disk — by design, see the "check for pre-existing method/credentials_file" step under Deployer's first-run behavior above, which is exactly what turns this into a one-time confirm-and-validate instead of a from-scratch interview.)
   - Calls the new `removeCommandFiles(projectRoot, currentAgentIds, 'shipper')` helper (added to `scaffold.js` per the file list above) to delete the old Shipper command file for every currently-configured agent, since `shipper` is being removed entirely rather than left in place. Print what was removed, same style as the added/updated/unchanged summary already printed for the template refresh. This runs unconditionally too — it's a no-op once a project's `shipper` file is already gone.

5. **Refresh this repo's own dogfooded copies.** Run `npx abzmyan update` from the repo root (or `node bin/abzmyan.js update`) so `.claude/commands/*.md` picks up the new `deployer.md` / updated `archivist.md` / updated `abzmyan-express.md`, and — via the new `removeCommandFiles` step — `.claude/commands/shipper.md` is deleted automatically, not by hand.
   - Also confirm this repo's own `.abzmyan/config.yml` (currently `deploy.method: unconfigured`) gets correctly migrated to `deploy.targets: {}` by the new `update` logic.

6. **Sanity-check the CLI still works.** No test framework exists (`npm test` is a no-op), so verification is manual: run `node bin/abzmyan.js update` in this repo (covered by step 5) and, separately, run `node bin/abzmyan.js init` in a scratch temp directory to confirm the trimmed-down prompt flow (no deploy-method question) still scaffolds a valid `config.yml` with `deploy:\n  targets: {}`, valid `templates/commands/*.md` copies (including `deployer.md`, no `shipper.md`), and a valid memory-block injection.

7. **Update `README.md` and `package.json` description** per the file list above.

8. Self-check every acceptance criterion in `requirements.md` before finishing (see Definition of done).

## New dependencies
None. Everything needed (YAML read/write, file I/O) already exists via `fs-extra` and `yaml`, both already dependencies. Deployer's FTP/webhook/etc. connectivity checks happen at chat-agent runtime (the AI agent's own tool use), not via new packages added to this npm package.

## Edge cases considered
- Zero deploy targets configured, bare `/deployer` → first-run interview, asks for a target name as part of it.
- Exactly one target configured, bare `/deployer` → resolves to it directly, no ambiguity.
- Multiple targets configured, bare `/deployer` → lists them, asks which one, does not guess.
- `/deployer <name>` where `<name>` isn't yet configured → treated as a new target, first-run interview under that name.
- A playbook file exists on disk but its `config.yml` target entry was removed (or never existed) → config.yml's `deploy.targets` map is the source of truth for "is this target configured," not the mere presence of a playbook file; treat as inconsistent state and fall back to first-run rather than trusting a stray file.
- Credentials file referenced by a playbook is missing at deploy time → stop and clearly state the expected file path/contents, same behavior Shipper has today for its FTP env file.
- Method with no safe read-only validation (webhook, PR-based flow) → explicitly skip the check and say so, rather than fabricating a fake test or blocking the interview on an impossible validation.
- Running `npx abzmyan update` on a project that has already been migrated (no `documented`/`shipped` tickets left, `config.yml` already using `deploy.targets`, `shipper` command file already gone) → all three migration/removal steps are no-ops; safe to run repeatedly, consistent with `update`'s existing idempotency guarantee.
- A target produced by the config migration (`deploy.targets.default`, from an old FTP setup) has a config entry but no playbook yet — Deployer's own "playbook missing despite config entry" fallback (above) turns this into a first run automatically; the added "check for pre-existing method/credentials_file" step means that first run is a quick confirm-and-validate instead of a full re-interview, so an existing working FTP setup isn't degraded by the migration.
- Consumer projects on an older `abzmyan` version that never run `npx abzmyan update` after upgrading will keep their old `shipper.md` and `documented`/`shipped` vocabulary indefinitely — expected and consistent with how `update`-gated changes have always worked in this tool (see `README.md`'s existing description of `update`'s role).

## Definition of done
Mirrors the acceptance criteria in `requirements.md`, made concrete:
- [ ] `templates/commands/shipper.md` is gone; `templates/commands/deployer.md` exists with the interview/playbook behavior described above.
- [ ] `templates/commands/archivist.md` sets status `archived`; `templates/commands/abzmyan-express.md` says `archived` everywhere it used to say `documented`, and points to `/deployer` (no ticket ID) instead of `/shipper <TICKET-ID>`.
- [ ] `templates/config.yml.template` has no `{{DEPLOY_BLOCK}}` placeholder; a freshly-scaffolded project's `config.yml` has `deploy:\n  targets: {}` and no deploy-method question was asked during `init`.
- [ ] `templates/memory-block.md.template` says `/deployer`, not `/shipper`.
- [ ] `src/agents.js`'s `COMMAND_DESCRIPTIONS` has a `deployer` entry, no `shipper` entry.
- [ ] `src/scaffold.js` / `src/commands/init.js` no longer reference `deployMethod`/`credentialsFile`.
- [ ] `src/commands/update.js` migrates `documented`/`shipped` → `archived` in `tickets.json`, migrates the old single-block `deploy.method` shape → `deploy.targets` in `config.yml`, and deletes the old `shipper` command file for every configured agent (via `removeCommandFiles`) — all three idempotently, with a printed summary.
- [ ] `README.md` reflects the new lifecycle (no `shipped`), the Deployer agent (grouped with Bootstrapper, not the per-ticket table... actually still worth a row/mention — see plan above), and drops the FTP-only scope note. `package.json`'s description says Deployer, not Shipper.
- [ ] This repo's own `.claude/commands/` reflects all of the above (via `npx abzmyan update`, which deletes `shipper.md` automatically), and `.abzmyan/config.yml` here has been migrated to `deploy:\n  targets: {}`.
- [ ] `node bin/abzmyan.js init` in a scratch directory still completes successfully end-to-end with the trimmed prompt flow.

## Open questions / risks
None outstanding. Three items were flagged here during planning and resolved directly with the user (see `log.md`):
1. The deploy-method question is fully removed from `npx abzmyan init` — all deploy setup now happens on Deployer's first run.
2. The `deploy.method` → `deploy.targets` config migration is confirmed and scoped to avoid breaking existing FTP installs (see the "check for pre-existing method/credentials_file" step under Deployer's first-run behavior, and the corresponding edge case above).
3. `shipper` is being removed entirely, not left in place: `npx abzmyan update` now deletes the old Shipper command file for every configured agent via the new `removeCommandFiles` helper, in the same run that adds Deployer's files — scoped specifically to the `shipper` → `deployer` transition, not a general-purpose stale-file cleanup mechanism.
