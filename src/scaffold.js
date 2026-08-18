import fs from 'fs-extra';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { AGENTS, DEFAULT_AGENTS, getAgent, agentCommandsDirSegments } from './agents.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

export function abzmyanDir(projectRoot) {
  return path.join(projectRoot, '.abzmyan');
}

export function indexDir(projectRoot) {
  return path.join(abzmyanDir(projectRoot), 'index');
}

export function ticketsDir(projectRoot) {
  return path.join(abzmyanDir(projectRoot), 'tickets');
}

export function configPath(projectRoot) {
  return path.join(abzmyanDir(projectRoot), 'config.yml');
}

/** Resolves the project-relative commands directory for a given agent and command name. */
export function agentCommandsDir(projectRoot, agent, commandName) {
  return path.join(projectRoot, ...agentCommandsDirSegments(agent, commandName));
}

/** Copies templates/index/*.md into .abzmyan/index/ verbatim. */
export async function copyIndexTemplates(projectRoot) {
  const src = path.join(TEMPLATES_DIR, 'index');
  const dest = indexDir(projectRoot);
  await fs.ensureDir(dest);
  await fs.copy(src, dest);
}

/**
 * Renders templates/commands/*.md through each selected agent's native
 * format and writes them into that agent's commands directory, overwriting
 * any existing files. Returns a per-{agentId, file, change} summary, where
 * change is 'added' | 'updated' | 'unchanged'.
 */
export async function copyCommandTemplates(projectRoot, agentIds) {
  const src = path.join(TEMPLATES_DIR, 'commands');
  const files = (await fs.readdir(src)).filter((f) => f.endsWith('.md'));
  const summary = [];

  for (const agentId of agentIds) {
    const agent = getAgent(agentId);
    for (const file of files) {
      const name = path.basename(file, '.md');
      const rawContent = await fs.readFile(path.join(src, file), 'utf8');
      const rendered = agent.render(name, rawContent);

      const destDir = agentCommandsDir(projectRoot, agent, name);
      const destFile = agent.fileName(name);
      const destPath = path.join(destDir, destFile);
      await fs.ensureDir(destDir);

      const existed = await fs.pathExists(destPath);
      const oldContent = existed ? await fs.readFile(destPath, 'utf8') : null;

      let change;
      if (!existed) {
        change = 'added';
      } else if (oldContent !== rendered) {
        change = 'updated';
      } else {
        change = 'unchanged';
      }

      await fs.writeFile(destPath, rendered, 'utf8');
      summary.push({ agentId, name, file: destFile, change });
    }
  }

  return summary;
}

/**
 * Deletes a single command's rendered file for each given agent — used when a
 * command is removed entirely (as opposed to updated), so it doesn't linger
 * as a stale, non-functional slash command. For agents whose commandsDir is
 * per-command (only Codex CLI's skills/<name>/ layout today), also removes
 * the now-empty per-command directory afterward. Returns a per-{agentId,
 * file, removed} summary, mirroring copyCommandTemplates's shape.
 */
export async function removeCommandFiles(projectRoot, agentIds, name) {
  const summary = [];

  for (const agentId of agentIds) {
    const agent = getAgent(agentId);
    const destDir = agentCommandsDir(projectRoot, agent, name);
    const destFile = agent.fileName(name);
    const destPath = path.join(destDir, destFile);

    const existed = await fs.pathExists(destPath);
    if (existed) {
      await fs.remove(destPath);
    }

    const perCommandDir = typeof agent.commandsDir === 'function';
    if (perCommandDir && (await fs.pathExists(destDir)) && (await fs.readdir(destDir)).length === 0) {
      await fs.remove(destDir);
    }

    summary.push({ agentId, name, file: destFile, removed: existed });
  }

  return summary;
}

/** Renders and writes .abzmyan/config.yml from config.yml.template. */
export async function writeConfig(projectRoot, { projectCode, mode, createdAt, agentIds, abzmyanVersion }) {
  const templatePath = path.join(TEMPLATES_DIR, 'config.yml.template');
  let template = await fs.readFile(templatePath, 'utf8');

  const agentsBlock = agentIds.map((id) => `  - ${id}`).join('\n');

  template = template
    .replace('{{PROJECT_CODE}}', projectCode)
    .replace('{{MODE}}', mode)
    .replace('{{CREATED_AT}}', createdAt)
    .replace('{{AGENTS_BLOCK}}', agentsBlock)
    .replace('{{ABZMYAN_VERSION}}', abzmyanVersion);

  const dest = configPath(projectRoot);
  await fs.writeFile(dest, template, 'utf8');
  return dest;
}

/**
 * Reads the currently-configured agent ids from .abzmyan/config.yml.
 * Projects initialized before agent selection existed have no `agents:` key
 * and are treated as Claude-Code-only.
 */
export async function readAgentsFromConfig(projectRoot) {
  const raw = await fs.readFile(configPath(projectRoot), 'utf8');
  const parsed = YAML.parse(raw) ?? {};
  if (!Array.isArray(parsed.agents) || parsed.agents.length === 0) {
    return [...DEFAULT_AGENTS];
  }
  return parsed.agents;
}

/** Patches .abzmyan/config.yml's `agents:` list in place, preserving everything else. */
export async function writeAgentsToConfig(projectRoot, agentIds) {
  const dest = configPath(projectRoot);
  const raw = await fs.readFile(dest, 'utf8');
  const doc = YAML.parseDocument(raw);
  doc.set('agents', agentIds);
  await fs.writeFile(dest, doc.toString(), 'utf8');
  return dest;
}

/**
 * One-time migration: converts the old single-block deploy.method /
 * deploy.credentials_file config.yml shape into the new deploy.targets map.
 * `method: unconfigured` becomes an empty targets map; `method: ftp` becomes
 * a single target named "default", carrying its credentials_file forward.
 * Returns true if a migration was applied, false if the config was already
 * on the new shape (nothing to do).
 */
export async function migrateDeployConfig(projectRoot) {
  const dest = configPath(projectRoot);
  const raw = await fs.readFile(dest, 'utf8');
  const doc = YAML.parseDocument(raw);

  if (!doc.hasIn(['deploy', 'method'])) {
    return false;
  }

  const method = doc.getIn(['deploy', 'method']);
  const credentialsFile = doc.getIn(['deploy', 'credentials_file']);
  const targets =
    method === 'ftp' ? { default: { method: 'ftp', credentials_file: credentialsFile } } : {};

  doc.set('deploy', { targets });
  await fs.writeFile(dest, doc.toString(), 'utf8');
  return true;
}

/**
 * One-time migration: rewrites any ticket at a retired status (`documented`
 * or `shipped`, from before the Shipper/Deployer agent swap) to `archived`.
 * Returns the number of tickets migrated.
 */
export async function migrateTicketStatuses(projectRoot) {
  const ticketsPath = path.join(ticketsDir(projectRoot), 'tickets.json');
  const raw = await fs.readFile(ticketsPath, 'utf8');
  const data = JSON.parse(raw);
  const now = new Date().toISOString();

  let migrated = 0;
  for (const ticket of data.tickets ?? []) {
    if (ticket.status === 'documented' || ticket.status === 'shipped') {
      ticket.status = 'archived';
      ticket.updated_at = now;
      migrated += 1;
    }
  }

  if (migrated > 0) {
    await fs.writeFile(ticketsPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  }
  return migrated;
}

/** Writes .abzmyan/tickets/tickets.json as an empty registry. */
export async function writeTicketsRegistry(projectRoot) {
  const templatePath = path.join(TEMPLATES_DIR, 'tickets.json.template');
  const dest = path.join(ticketsDir(projectRoot), 'tickets.json');
  await fs.ensureDir(ticketsDir(projectRoot));
  await fs.copy(templatePath, dest);
  return dest;
}

/** Appends a single line (or block) to .abzmyan/index/history.md, separated by a blank line. */
export async function appendHistoryLine(projectRoot, line) {
  const historyPath = path.join(indexDir(projectRoot), 'history.md');
  const existing = (await fs.readFile(historyPath, 'utf8')).replace(/\n+$/, '');
  await fs.writeFile(historyPath, `${existing}\n\n${line}\n`, 'utf8');
}

const MEMORY_BLOCK_START = '<!-- abzmyan:start -->';
const MEMORY_BLOCK_END = '<!-- abzmyan:end -->';

/** Injects/refreshes abzmyan's marked block in a shared file the user may also own, leaving everything outside the markers untouched. */
async function upsertInjectedMemoryFile(destPath, wrappedBlock) {
  const existed = await fs.pathExists(destPath);
  const before = existed ? await fs.readFile(destPath, 'utf8') : '';

  let next;
  if (!existed) {
    next = `${wrappedBlock}\n`;
  } else if (before.includes(MEMORY_BLOCK_START) && before.includes(MEMORY_BLOCK_END)) {
    next = before.replace(
      new RegExp(`${MEMORY_BLOCK_START}[\\s\\S]*?${MEMORY_BLOCK_END}`),
      wrappedBlock
    );
  } else {
    next = `${before.replace(/\n+$/, '')}\n\n${wrappedBlock}\n`;
  }

  const change = !existed ? 'added' : before !== next ? 'updated' : 'unchanged';
  if (change !== 'unchanged') {
    await fs.ensureDir(path.dirname(destPath));
    await fs.writeFile(destPath, next, 'utf8');
  }
  return change;
}

/** Fully (over)writes a dedicated file abzmyan owns outright, e.g. Cursor's project rule file. */
async function writeOwnedMemoryFile(destPath, content) {
  const existed = await fs.pathExists(destPath);
  const before = existed ? await fs.readFile(destPath, 'utf8') : null;
  const change = !existed ? 'added' : before !== content ? 'updated' : 'unchanged';
  if (change !== 'unchanged') {
    await fs.ensureDir(path.dirname(destPath));
    await fs.writeFile(destPath, content, 'utf8');
  }
  return change;
}

/**
 * Writes/refreshes abzmyan's always-loaded project-context block (source of
 * truth pointer + ticket workflow) into each selected agent's ambient memory
 * file (CLAUDE.md, AGENTS.md, a Cursor rule file, ...), so ordinary chat —
 * not just the slash commands — stays aware of the index and the ticket
 * flow. Returns a per-{agentId, file, change} summary like copyCommandTemplates.
 */
export async function writeMemoryFiles(projectRoot, agentIds) {
  const blockTemplatePath = path.join(TEMPLATES_DIR, 'memory-block.md.template');
  const block = (await fs.readFile(blockTemplatePath, 'utf8')).trim();
  const wrappedBlock = `${MEMORY_BLOCK_START}\n${block}\n${MEMORY_BLOCK_END}`;

  const summary = [];
  for (const agentId of agentIds) {
    const agent = getAgent(agentId);
    if (!agent.memoryFile) continue;

    const destPath = path.join(projectRoot, ...agent.memoryFile.path);
    const change =
      agent.memoryFile.mode === 'own'
        ? await writeOwnedMemoryFile(destPath, agent.memoryFile.render(wrappedBlock))
        : await upsertInjectedMemoryFile(destPath, wrappedBlock);

    summary.push({ agentId, file: path.relative(projectRoot, destPath), change });
  }
  return summary;
}

export { AGENTS };
