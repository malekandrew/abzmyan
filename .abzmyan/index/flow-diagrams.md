# Flow Diagrams

> Maintained by: Archivist agent. Current-state snapshot — edit in place.

## `npx abzmyan init` flow

```mermaid
flowchart TD
    A["npx abzmyan init"] --> B{".abzmyan/ already exists?"}
    B -- yes --> C["Error: already initialized. Run 'update' instead."]
    B -- no --> D["detectDefaultMode(): count files up to depth 3\nto pre-select greenfield/brownfield default"]
    D --> E["Prompt: project code, mode,\nAI agent(s), confirm"]
    E -- cancelled/declined --> F["Abort. Nothing written."]
    E -- confirmed --> G["ensureDir .abzmyan/"]
    G --> H["copyIndexTemplates()\n-> .abzmyan/index/*.md"]
    H --> I["writeTicketsRegistry()\n-> .abzmyan/tickets/tickets.json"]
    I --> J["writeConfig()\n-> .abzmyan/config.yml\n(deploy.targets: {})"]
    J --> K["copyCommandTemplates()\n-> .claude/commands/*.md"]
    K --> L["appendHistoryLine(): init entry"]
    L --> M{mode?}
    M -- brownfield --> N["Print: run /abzmyan-bootstrap next"]
    M -- greenfield --> O["Print: run /scribe next"]
```

## `npx abzmyan update` flow

```mermaid
flowchart TD
    A["npx abzmyan update"] --> B{".abzmyan/ exists?"}
    B -- no --> C["Error: run init first"]
    B -- yes --> D["copyCommandTemplates()\nfor each configured agent"]
    D --> E["removeCommandFiles(..., 'shipper')\ndeletes retired command file per agent\n(+ its now-empty per-command dir, e.g. Codex CLI)"]
    E --> F["writeMemoryFiles()\nrefresh injected/owned memory-file blocks"]
    F --> G["migrateTicketStatuses()\ndocumented/shipped -> archived in tickets.json\n(no-op once none remain)"]
    G --> H["migrateDeployConfig()\nold deploy.method shape -> deploy.targets map\n(no-op once already migrated)"]
    H --> I["Print refreshed/removed/migrated summary"]
    I --> J["index/* left untouched\n(config.yml, tickets.json now touched\nonly by the idempotent migrations above)"]
    J --> K["Prompt: add/change configured AI agent(s)?"]
```

## Per-ticket agent workflow (executes inside Claude Code, not this repo's code)

```mermaid
sequenceDiagram
    participant U as Human
    participant S as /scribe
    participant A as /architect
    participant B as /builder
    participant Ar as /archivist

    U->>S: /scribe "idea"
    S-->>U: requirements.md (status: draft)
    U->>U: review, manually set status: ready
    U->>A: /architect <ID>
    A-->>U: plan.md (status: planned)
    U->>U: review plan
    U->>B: /builder <ID>
    B-->>U: implementation + build check (status: implemented)
    U->>U: review diff
    U->>Ar: /archivist <ID>
    Ar-->>U: updates index/*.md + history.md (status: archived, terminal)
```

Each arrow above is a manually-triggered, separate Claude Code chat session — there is no auto-chaining; a human reviews output and triggers the next command. Deploying isn't part of this per-ticket sequence at all — it's a separate, ticket-agnostic `/deployer` run (see below), typically triggered once for a batch of several archived tickets rather than once per ticket.

## Bootstrapper flow (this agent, brownfield-only, one-time)

```mermaid
flowchart TD
    A["/abzmyan-bootstrap"] --> B{"mode in config.yml?"}
    B -- greenfield --> C["Tell user: not needed, stop"]
    B -- brownfield --> D["Scan codebase: structure, stack,\nroutes, entities, patterns, tooling"]
    D --> E["Draft architecture.md, tech-stack.md,\ndomain-model.md, api-index.md,\nflow-diagrams.md"]
    E --> F["Overwrite placeholder content\nin .abzmyan/index/*.md"]
    F --> G["Append history.md entry"]
    G --> H["Tell user: AI-drafted, review before relying on it"]
```

## Deployer flow (ticket-agnostic — no ticket ID, no status precondition)

```mermaid
flowchart TD
    A["/deployer [target-name]"] --> B{"target name given?"}
    B -- yes, exists in deploy.targets --> C["Deploying an existing target"]
    B -- yes, not yet configured --> D["Setting up a new target"]
    B -- no --> E{"how many targets configured?"}
    E -- zero --> D
    E -- exactly one --> C
    E -- more than one --> F["List target names, ask which one"]
    F --> C

    D --> G{"config.yml already has\nmethod/credentials_file\nfor this target? (e.g. from\nupdate's config migration)"}
    G -- yes --> H["Confirm + validate\nexisting method/credentials"]
    G -- no --> I["Open-ended interview: method,\ncredentials, env-config handling,\ninclude/exclude rules\n(or ingest an existing deploy doc)"]
    H --> I
    I --> J{"safe read-only\nvalidation possible\nfor this method?"}
    J -- yes --> K["Validate; on failure,\nask for corrected details"]
    J -- no, e.g. webhook/PR --> L["Skip validation, say so explicitly"]
    K --> M["Write .abzmyan/deploy/TARGET.md (playbook)"]
    L --> M
    M --> N["Patch config.yml:\ndeploy.targets.TARGET = {method, credentials_file}"]
    N --> O["Create/append .abzmyan/deploy/TARGET.log.md:\n'Target configured'"]
    O --> P["Show playbook to user;\ndo not deploy unless asked to continue"]

    C --> Q["Read .abzmyan/deploy/TARGET.md\n+ its credentials file"]
    Q --> R{"playbook missing, or\nuser asked to reconfigure?"}
    R -- yes --> D
    R -- no --> S["Follow playbook steps\nmechanically, no re-interview"]
    S --> T["Append result to\n.abzmyan/deploy/TARGET.log.md"]
```
