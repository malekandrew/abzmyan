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

/** Renders and writes .abzmyan/config.yml from config.yml.template. */
export async function writeConfig(projectRoot, { projectCode, mode, createdAt, deployMethod, credentialsFile, agentIds, abzmyanVersion }) {
  const templatePath = path.join(TEMPLATES_DIR, 'config.yml.template');
  let template = await fs.readFile(templatePath, 'utf8');

  const deployBlock =
    deployMethod === 'ftp'
      ? `  method: ftp\n  credentials_file: ${credentialsFile}`
      : `  method: unconfigured`;

  const agentsBlock = agentIds.map((id) => `  - ${id}`).join('\n');

  template = template
    .replace('{{PROJECT_CODE}}', projectCode)
    .replace('{{MODE}}', mode)
    .replace('{{CREATED_AT}}', createdAt)
    .replace('{{DEPLOY_BLOCK}}', deployBlock)
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
