import fs from 'fs-extra';
import path from 'node:path';

const IGNORED_ENTRIES = new Set(['.git', 'node_modules', 'README.md', '.DS_Store']);
const SOURCE_FILE_THRESHOLD = 5;

/**
 * Best-guess default for the greenfield/brownfield prompt. Does not decide
 * on its own — the CLI still always asks the user, this only picks the
 * pre-selected default.
 */
export async function detectDefaultMode(cwd) {
  let entries;
  try {
    entries = await fs.readdir(cwd);
  } catch {
    return 'greenfield';
  }

  const relevant = entries.filter((entry) => !IGNORED_ENTRIES.has(entry));

  let count = 0;
  for (const entry of relevant) {
    const full = path.join(cwd, entry);
    const stat = await fs.stat(full).catch(() => null);
    if (!stat) continue;
    if (stat.isDirectory()) {
      count += await countFilesRecursive(full, 0);
    } else {
      count += 1;
    }
    if (count > SOURCE_FILE_THRESHOLD) break;
  }

  return count > SOURCE_FILE_THRESHOLD ? 'brownfield' : 'greenfield';
}

async function countFilesRecursive(dir, depth) {
  if (depth > 3) return 0;
  let entries;
  try {
    entries = await fs.readdir(dir);
  } catch {
    return 0;
  }
  let count = 0;
  for (const entry of entries) {
    if (IGNORED_ENTRIES.has(entry) || entry === '.git' || entry === 'node_modules') continue;
    const full = path.join(dir, entry);
    const stat = await fs.stat(full).catch(() => null);
    if (!stat) continue;
    if (stat.isDirectory()) {
      count += await countFilesRecursive(full, depth + 1);
    } else {
      count += 1;
    }
    if (count > SOURCE_FILE_THRESHOLD) return count;
  }
  return count;
}
