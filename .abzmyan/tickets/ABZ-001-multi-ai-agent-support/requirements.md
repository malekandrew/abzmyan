# ABZ-001: Support multiple AI coding agents (not just Claude Code)

## Context
abzmyan currently only supports Claude Code: `init` scaffolds slash commands into `.claude/commands/` and the docs describe abzmyan as a Claude Code workflow. To broaden adoption, abzmyan should let a user choose which AI coding agent(s) they use it with, including multiple at once, and keep each selected agent's command files in sync going forward.

## User story
As an abzmyan user, I want to choose which AI coding agent(s) I use abzmyan with during `init` (and change that selection later), so that I can use abzmyan's spec-driven workflow regardless of which AI tool(s) I actually work in, including more than one at the same time.

## Acceptance criteria
- [ ] `npx abzmyan init` presents a multi-select prompt letting the user choose one or more AI agents from: Claude Code, Cursor, GitHub Copilot, OpenAI Codex CLI, and Gemini CLI. At least one must be selected to proceed.
- [ ] For each selected agent, `init` writes abzmyan's 6 agent commands (Scribe, Architect, Builder, Archivist, Shipper, abzmyan-bootstrap) into that tool's native custom-command/prompt directory, using that tool's current documented file location and format.
- [ ] The set of selected agents is persisted in `.abzmyan/config.yml` so later commands know which tool directories to maintain.
- [ ] `npx abzmyan update` refreshes the command files for every agent currently configured for the project (matching current template content), same as it does today for `.claude/commands/`.
- [ ] `npx abzmyan update` also offers the user the option to add or change selected agents (multi-select, pre-populated with the currently configured selection); confirming writes command files for any newly-added agents and updates `.abzmyan/config.yml` accordingly.
- [ ] Running `update` on a project that was initialized before this change (no agent selection recorded in `config.yml`) treats it as Claude-Code-only by default, still offers the agent-selection prompt described above, and does not remove or break the existing `.claude/commands/` setup.
- [ ] Only agents with a real native custom-command/prompt mechanism are offered as choices — no generic manual-copy-paste fallback folder for unsupported tools.
- [ ] `README.md` is updated to describe abzmyan as supporting Claude Code plus the newly added agents: installation/workflow sections and the scaffolded file-tree example reflect per-agent command directories, and no wording implies Claude Code exclusivity.
- [ ] `package.json` `description` and `keywords` are updated to mention the newly supported AI agents, not just Claude Code.
- [ ] Any other repository docs or template wording that states or implies "Claude Code only" is reviewed and updated for consistency.
- [ ] Existing behavior for users who select only Claude Code (file locations, command content, workflow, ticket status lifecycle) is unchanged.

## UI Guide
None provided.

## Out of scope
- AI agents beyond Cursor, GitHub Copilot, OpenAI Codex CLI, Gemini CLI, and Claude Code (e.g. Windsurf, Aider) — can be considered in a future ticket.
- A generic/manual fallback mechanism for tools without a native custom-command mechanism.
- Changes to the core 5-agent workflow logic, ticket status lifecycle, or the substantive content/instructions of each command — this ticket is about *where* and *in what format* those commands are delivered per tool, not what they say.
- Auto-detecting which AI tools are already in use in a project (e.g. scanning for an existing `.cursor/` directory) to pre-select agents — the user chooses explicitly via the prompt.

## Open questions
- The exact native custom-command/prompt directory and file format for Cursor, GitHub Copilot, OpenAI Codex CLI, and Gemini CLI should be verified against each tool's current documentation at implementation time, since these conventions can change.
