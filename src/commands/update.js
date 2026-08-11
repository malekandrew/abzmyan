import fs from 'fs-extra';
import path from 'node:path';
import { abzmyanDir, commandsDir, TEMPLATES_DIR } from '../scaffold.js';

export async function updateCommand() {
  const projectRoot = process.cwd();

  if (!(await fs.pathExists(abzmyanDir(projectRoot)))) {
    console.error('No abzmyan project found here. Run `npx abzmyan init` first.');
    process.exitCode = 1;
    return;
  }

  const srcDir = path.join(TEMPLATES_DIR, 'commands');
  const destDir = commandsDir(projectRoot);
  await fs.ensureDir(destDir);

  const files = (await fs.readdir(srcDir)).filter((f) => f.endsWith('.md'));
  const summary = [];

  for (const file of files) {
    const srcPath = path.join(srcDir, file);
    const destPath = path.join(destDir, file);

    const existed = await fs.pathExists(destPath);
    const newContent = await fs.readFile(srcPath, 'utf8');
    const oldContent = existed ? await fs.readFile(destPath, 'utf8') : null;

    if (!existed) {
      summary.push({ file, change: 'added' });
    } else if (oldContent !== newContent) {
      summary.push({ file, change: 'updated' });
    } else {
      summary.push({ file, change: 'unchanged' });
    }

    await fs.copy(srcPath, destPath);
  }

  console.log('abzmyan command templates refreshed:\n');
  for (const { file, change } of summary) {
    const marker = change === 'added' ? '+' : change === 'updated' ? '~' : ' ';
    console.log(`  ${marker} ${file} (${change})`);
  }
  console.log('\n.abzmyan/config.yml, .abzmyan/index/*, and .abzmyan/tickets/* were left untouched.');
}
