import fs from 'fs-extra';
import path from 'node:path';
import prompts from 'prompts';
import { detectDefaultMode } from '../detect.js';
import {
  abzmyanDir,
  copyIndexTemplates,
  copyCommandTemplates,
  writeConfig,
  writeTicketsRegistry,
  appendHistoryLine,
} from '../scaffold.js';

const PACKAGE_VERSION = JSON.parse(
  await fs.readFile(new URL('../../package.json', import.meta.url), 'utf8')
).version;

const PROJECT_CODE_RE = /^[A-Z]{2,5}$/;

export async function initCommand() {
  const projectRoot = process.cwd();

  if (await fs.pathExists(abzmyanDir(projectRoot))) {
    console.error(
      'abzmyan is already initialized here. Use `npx abzmyan update` to refresh agent commands.'
    );
    process.exitCode = 1;
    return;
  }

  const defaultMode = await detectDefaultMode(projectRoot);

  const answers = await prompts(
    [
      {
        type: 'text',
        name: 'projectCode',
        message: 'Project code? (e.g. XTG — 2-5 uppercase letters)',
        validate: (value) =>
          PROJECT_CODE_RE.test(value.trim().toUpperCase())
            ? true
            : 'Must be 2-5 letters, no spaces.',
        format: (value) => value.trim().toUpperCase(),
      },
      {
        type: 'select',
        name: 'mode',
        message: 'Is this a greenfield or brownfield project?',
        choices: [
          { title: 'Greenfield', value: 'greenfield' },
          { title: 'Brownfield', value: 'brownfield' },
        ],
        initial: defaultMode === 'brownfield' ? 1 : 0,
      },
      {
        type: 'select',
        name: 'deployMethod',
        message: 'Deploy method?',
        choices: [
          { title: 'FTP', value: 'ftp' },
          { title: 'Not sure yet / configure later', value: 'unconfigured' },
        ],
        initial: 0,
      },
      {
        type: (prev) => (prev === 'ftp' ? 'text' : null),
        name: 'credentialsFile',
        message: 'Path to your FTP credentials env file (relative to project root)?',
        initial: '.env.deploy',
      },
      {
        type: 'confirm',
        name: 'confirmDir',
        message: `Initialize abzmyan in ${projectRoot}?`,
        initial: true,
      },
    ],
    {
      onCancel: () => {
        console.log('Aborted. Nothing was written.');
        process.exit(1);
      },
    }
  );

  if (!answers.confirmDir) {
    console.log('Aborted. Nothing was written.');
    return;
  }

  const createdAt = new Date().toISOString();

  await fs.ensureDir(abzmyanDir(projectRoot));
  await copyIndexTemplates(projectRoot);
  await writeTicketsRegistry(projectRoot);
  await writeConfig(projectRoot, {
    projectCode: answers.projectCode,
    mode: answers.mode,
    createdAt,
    deployMethod: answers.deployMethod,
    credentialsFile: answers.credentialsFile,
    abzmyanVersion: PACKAGE_VERSION,
  });
  await copyCommandTemplates(projectRoot);

  await appendHistoryLine(
    projectRoot,
    `[${createdAt}] abzmyan initialized. Mode: ${answers.mode}. Project code: ${answers.projectCode}.`
  );

  if (answers.mode === 'brownfield') {
    console.log(
      'Brownfield project detected. Open Claude Code and run `/abzmyan-bootstrap` now to draft your index docs from the existing codebase before creating your first ticket.'
    );
  } else {
    console.log(
      'abzmyan initialized. You\'re ready to create your first ticket with `/scribe "<describe what you want to build>"`.'
    );
  }
}
