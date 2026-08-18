# History

> Maintained by: Archivist agent (and init script for the initialization entry).
> APPEND-ONLY. Never edit or delete previous entries. Newest entries at the bottom.

## Log

[2026-08-12T16:50:19.019Z] abzmyan initialized. Mode: brownfield. Project code: ABZ.

[2026-08-12T16:52:14.000Z] Bootstrapper drafted initial index docs from existing codebase. Recommend human review.

### ABZ-002: Replace Shipper with a flexible, multi-target Deployer agent and rename `documented` status to `archived` — 2026-08-18
Retired the per-ticket `shipped` status and the FTP-only Shipper agent, since real deploys are batched across many tickets rather than triggered once per ticket. Archivist's terminal status is now `archived` (the per-ticket lifecycle is `draft → ready → planned → implemented → archived`), and deploying moved to a new ticket-agnostic Deployer agent (`/deployer [target-name]`) that supports multiple named deploy targets, each backed by a self-written playbook produced through an open-ended, method-agnostic interview rather than a hardcoded FTP flow. `npx abzmyan update` now also runs two one-time, idempotent migrations (retired ticket statuses; the old single-block `deploy.method` config shape → the new `deploy.targets` map) and deletes Shipper's command file per configured agent. Notable decisions made along the way: dropped the deploy-method question from `npx abzmyan init` entirely in favor of Deployer's own first-run interview; added the config-shape migration even though it wasn't explicitly requested, to avoid silently breaking existing FTP-configured projects; and chose to delete Shipper's command file outright via `update` rather than leaving it stale, since a lingering non-functional `/shipper` command would reference a status that no longer exists.
