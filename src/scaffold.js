import fs from 'fs-extra';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

export function abzmyanDir(projectRoot) {
  return path.join(projectRoot, '.abzmyan');
}

export function commandsDir(projectRoot) {
  return path.join(projectRoot, '.claude', 'commands');
}

export function indexDir(projectRoot) {
  return path.join(abzmyanDir(projectRoot), 'index');
}

export function ticketsDir(projectRoot) {
  return path.join(abzmyanDir(projectRoot), 'tickets');
}

/** Copies templates/index/*.md into .abzmyan/index/ verbatim. */
export async function copyIndexTemplates(projectRoot) {
  const src = path.join(TEMPLATES_DIR, 'index');
  const dest = indexDir(projectRoot);
  await fs.ensureDir(dest);
  await fs.copy(src, dest);
}

/**
 * Copies templates/commands/*.md into .claude/commands/, overwriting any
 * existing files. Returns the list of filenames written.
 */
export async function copyCommandTemplates(projectRoot) {
  const src = path.join(TEMPLATES_DIR, 'commands');
  const dest = commandsDir(projectRoot);
  await fs.ensureDir(dest);
  const files = (await fs.readdir(src)).filter((f) => f.endsWith('.md'));
  for (const file of files) {
    await fs.copy(path.join(src, file), path.join(dest, file));
  }
  return files;
}

/** Renders and writes .abzmyan/config.yml from config.yml.template. */
export async function writeConfig(projectRoot, { projectCode, mode, createdAt, deployMethod, credentialsFile, abzmyanVersion }) {
  const templatePath = path.join(TEMPLATES_DIR, 'config.yml.template');
  let template = await fs.readFile(templatePath, 'utf8');

  const deployBlock =
    deployMethod === 'ftp'
      ? `  method: ftp\n  credentials_file: ${credentialsFile}`
      : `  method: unconfigured`;

  template = template
    .replace('{{PROJECT_CODE}}', projectCode)
    .replace('{{MODE}}', mode)
    .replace('{{CREATED_AT}}', createdAt)
    .replace('{{DEPLOY_BLOCK}}', deployBlock)
    .replace('{{ABZMYAN_VERSION}}', abzmyanVersion);

  const dest = path.join(abzmyanDir(projectRoot), 'config.yml');
  await fs.writeFile(dest, template, 'utf8');
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
