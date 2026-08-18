# ABZ-002: Replace Shipper with a flexible, multi-target Deployer agent and rename `documented` status to `archived`

## Context
The current Shipper agent is tied to the per-ticket lifecycle (requires status `documented`, sets status `shipped`) and only supports FTP. In practice, deploys are batched across many tickets rather than triggered once per ticket, so the per-ticket `shipped` transition doesn't match real usage and the FTP-only assumption is too narrow. Separately, the Archivist agent currently sets status `documented`, which doesn't read as consistently paired with its own name the way Architect→`planned` and Builder→`implemented` do.

## User story
As the maintainer of a project using abzmyan, I want deploys decoupled from the per-ticket status lifecycle and driven by a flexible, self-documenting playbook per deploy target, so that I can batch deploys across multiple tickets and use whatever deploy mechanism actually fits each target instead of being locked into an FTP-only, one-shot-per-ticket flow.

## Acceptance criteria
- [ ] The per-ticket status lifecycle becomes `draft → ready → planned → implemented → archived`; `shipped` is removed from the lifecycle entirely.
- [ ] Archivist sets ticket status to `archived` instead of `documented` (command file, README, memory-block template, and any other doc referencing the old value are all updated accordingly).
- [ ] The Shipper agent/command is removed and replaced by a new Deployer agent/command, decoupled from the per-ticket flow — no ticket ID argument, no ticket-status precondition — grouped alongside Bootstrapper in docs as a non-per-ticket-flow agent.
- [ ] Deployer supports multiple named deploy targets: `/deployer` operates on the default/only target (or, if multiple targets are configured and none is named, lists the configured targets and asks which one to run rather than guessing); `/deployer <target-name>` operates on a specific named target. Each target has its own persisted playbook and credentials reference.
- [ ] First run for a given target (no playbook exists yet for it): Deployer holds an open-ended, conversational interview — not hardcoded to FTP or any specific method — branching on the user's answers until it understands the deploy method itself, credentials/access needed, environment-specific config-file handling (deploy as-is / leave alone on the server / template), and file include/exclude rules for what gets published.
- [ ] If the user supplies an existing deployment-process document during the interview, Deployer ingests it, asks clarifying questions only for gaps or ambiguity, and rewrites it into the structured playbook rather than starting from a blank interview.
- [ ] Wherever the chosen method allows a safe, side-effect-free validation of access/credentials, Deployer performs that check before persisting any config (e.g. for FTP: connect and do a read-only list/stat of the remote path, never an upload) and loops back to ask for corrected details on failure rather than silently persisting bad config. Methods with no side-effect-free check (e.g. a webhook or PR-based flow) skip this step — the rule is general, not FTP-specific.
- [ ] Once understood, Deployer writes a per-target playbook file with concrete, step-by-step, project-specific instructions: build step (if any), file include/exclude rules, environment-config handling, the transport/execution step itself, a verification step, and how to report success/failure. Secrets are never embedded in the playbook — it references a credentials file by path, reusing the existing credentials-env-file pattern (one per target).
- [ ] Subsequent runs for a target with an existing playbook: Deployer reads the playbook and its referenced credentials file and follows it mechanically, without re-interviewing, unless the playbook is missing or the user explicitly asks to reconfigure that target.
- [ ] `npx abzmyan update` performs a one-time migration on an existing project's `tickets.json`: any ticket at `documented` or `shipped` is rewritten to `archived`.
- [ ] `config.yml`'s `deploy` block is generalized to describe one or more named targets and each target's method/credentials-file reference, rather than a single FTP-only block.
- [ ] README (agent table, status lifecycle diagram, "typical ticket" walkthrough, and the "no deploy method other than FTP for now" scope note), `templates/memory-block.md.template`, and the `/abzmyan-express` command/skill wording are all updated to reflect the new lifecycle, the Deployer agent replacing Shipper, multi-target support, and the removal of the FTP-only constraint. Express's own stopping point is unchanged — it still stops at the ticket's terminal per-ticket status (`archived`) and never deploys.
- [ ] `src/agents.js`, `src/scaffold.js`, `src/commands/init.js`, and `src/commands/update.js` are updated to scaffold/refresh the new Deployer command file (in place of Shipper's) across all supported AI agent command formats (Claude Code, Cursor, GitHub Copilot, OpenAI Codex CLI, Gemini CLI), and to run the status migration described above.

## UI Guide
None provided.

## Out of scope
- Deployment rollback, backup, or versioning (unchanged from current scope).
- Automatic selection of a "default" target beyond simple single-target convenience — if genuinely ambiguous, Deployer asks rather than guessing.
- Any change to Scribe, Architect, or Builder agents' own behavior beyond the status-lifecycle wording.
- Retroactive rewriting of `CHANGELOG.md` or past release notes.

## Open questions
None outstanding.
