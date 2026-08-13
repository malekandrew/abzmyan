# Flow Diagrams

> Maintained by: Archivist agent. Current-state snapshot — edit in place.

## `npx abzmyan init` flow

```mermaid
flowchart TD
    A["npx abzmyan init"] --> B{".abzmyan/ already exists?"}
    B -- yes --> C["Error: already initialized. Run 'update' instead."]
    B -- no --> D["detectDefaultMode(): count files up to depth 3\nto pre-select greenfield/brownfield default"]
    D --> E["Prompt: project code, mode, deploy method\n(+ credentials file path if ftp), confirm"]
    E -- cancelled/declined --> F["Abort. Nothing written."]
    E -- confirmed --> G["ensureDir .abzmyan/"]
    G --> H["copyIndexTemplates()\n-> .abzmyan/index/*.md"]
    H --> I["writeTicketsRegistry()\n-> .abzmyan/tickets/tickets.json"]
    I --> J["writeConfig()\n-> .abzmyan/config.yml"]
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
    B -- yes --> D["For each file in templates/commands/*.md"]
    D --> E{"Exists in .claude/commands/?"}
    E -- no --> F["Copy; mark 'added'"]
    E -- yes, content differs --> G["Copy (overwrite); mark 'updated'"]
    E -- yes, content same --> H["Copy (no-op); mark 'unchanged'"]
    F & G & H --> I["Print added/updated/unchanged summary"]
    I --> J["config.yml, index/*, tickets/* left untouched"]
```

## Per-ticket agent workflow (executes inside Claude Code, not this repo's code)

```mermaid
sequenceDiagram
    participant U as Human
    participant S as /scribe
    participant A as /architect
    participant B as /builder
    participant Ar as /archivist
    participant Sh as /shipper

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
    Ar-->>U: updates index/*.md + history.md (status: documented)
    U->>Sh: /shipper <ID>
    Sh-->>U: FTP deploy (status: shipped)
```

Each arrow above is a manually-triggered, separate Claude Code chat session — there is no auto-chaining; a human reviews output and triggers the next command.

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
