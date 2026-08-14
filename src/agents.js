/**
 * Central registry of AI coding agents abzmyan can deliver its 6 command
 * templates to. Each entry knows its own native commands directory, output
 * filename convention, and how to render abzmyan's raw markdown template
 * into that tool's native file format.
 */

/** One-line description per command, used by agents whose native format wants one. */
export const COMMAND_DESCRIPTIONS = {
  'abzmyan-bootstrap': 'One-time (brownfield only) agent that drafts the initial index docs from a scan of your existing codebase.',
  architect: "Turns an approved ticket's requirements into a codebase-grounded plan.",
  archivist: 'Updates the index docs and appends a history.md entry.',
  builder: 'Implements the plan, verifies the build, self-checks acceptance criteria.',
  scribe: 'Turns a free-text idea into a new ticket with requirements.md.',
  shipper: 'Deploys the built app (FTP).',
};

function passthrough(name, content) {
  return content;
}

function renderGithubCopilot(name, content) {
  const description = COMMAND_DESCRIPTIONS[name] ?? '';
  return `---\ndescription: ${description}\n---\n\n${content}`;
}

function renderGeminiCli(name, content) {
  const description = COMMAND_DESCRIPTIONS[name] ?? '';
  return `description = "${description}"\nprompt = '''\n${content}\n'''\n`;
}

function renderCodexSkill(name, content) {
  const description = COMMAND_DESCRIPTIONS[name] ?? '';
  return `---\nname: ${name}\ndescription: ${description}\n---\n\n${content}`;
}

/** Wraps abzmyan's memory block with Cursor project-rule frontmatter for its dedicated .mdc file. */
function renderCursorMemoryFile(block) {
  return `---\ndescription: abzmyan project context (source of truth + ticket workflow)\nalwaysApply: true\n---\n\n${block}\n`;
}

/** DEFAULT_AGENTS is the fallback selection for projects initialized before agent selection existed. */
export const DEFAULT_AGENTS = ['claude-code'];

/**
 * Per-agent config for abzmyan's always-loaded project-context block — the
 * short note (in .abzmyan/index/ + the ticket workflow) written into
 * whichever file that agent auto-loads into every session, distinct from the
 * on-demand commandsDir files above.
 *
 * mode: 'inject'  — shared file the user likely already owns (CLAUDE.md,
 *                    AGENTS.md, ...); abzmyan writes only the marked block,
 *                    leaving the rest of the file untouched.
 * mode: 'own'     — dedicated file abzmyan fully owns (Cursor supports many
 *                    independent rule files, so no injection is needed).
 */
export const AGENTS = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    commandsDir: ['.claude', 'commands'],
    fileName: (name) => `${name}.md`,
    render: passthrough,
    memoryFile: { path: ['CLAUDE.md'], mode: 'inject' },
  },
  {
    id: 'cursor',
    label: 'Cursor',
    commandsDir: ['.cursor', 'commands'],
    fileName: (name) => `${name}.md`,
    render: passthrough,
    memoryFile: { path: ['.cursor', 'rules', 'abzmyan.mdc'], mode: 'own', render: renderCursorMemoryFile },
  },
  {
    id: 'github-copilot',
    label: 'GitHub Copilot',
    commandsDir: ['.github', 'agents'],
    fileName: (name) => `${name}.agent.md`,
    render: renderGithubCopilot,
    memoryFile: { path: ['.github', 'copilot-instructions.md'], mode: 'inject' },
  },
  {
    id: 'codex-cli',
    label: 'OpenAI Codex CLI',
    commandsDir: (name) => ['.codex', 'skills', name],
    fileName: () => 'SKILL.md',
    render: renderCodexSkill,
    memoryFile: { path: ['AGENTS.md'], mode: 'inject' },
  },
  {
    id: 'gemini-cli',
    label: 'Gemini CLI',
    commandsDir: ['.gemini', 'commands'],
    fileName: (name) => `${name}.toml`,
    render: renderGeminiCli,
    memoryFile: { path: ['GEMINI.md'], mode: 'inject' },
  },
];

export function getAgent(id) {
  const agent = AGENTS.find((a) => a.id === id);
  if (!agent) {
    throw new Error(`Unknown agent id: ${id}`);
  }
  return agent;
}

/** Resolves an agent's commands directory (project-relative segments) for a given command name. */
export function agentCommandsDirSegments(agent, name) {
  return typeof agent.commandsDir === 'function' ? agent.commandsDir(name) : agent.commandsDir;
}
