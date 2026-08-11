#!/usr/bin/env node
import { initCommand } from '../src/commands/init.js';
import { updateCommand } from '../src/commands/update.js';

const [, , command] = process.argv;

async function main() {
  switch (command) {
    case 'init':
      await initCommand();
      break;
    case 'update':
      await updateCommand();
      break;
    case undefined:
    case '-h':
    case '--help':
      printHelp();
      break;
    default:
      console.error(`Unknown command: ${command}\n`);
      printHelp();
      process.exitCode = 1;
  }
}

function printHelp() {
  console.log(`abzmyan (Agent Built, Zero Missteps, Yours to Approve, Next.) — a lightweight, index-driven spec-driven-development workflow.

Usage:
  npx abzmyan init      Scaffold abzmyan into the current project
  npx abzmyan update    Refresh agent command templates (.claude/commands/*)

Docs: see README.md in the abzmyan package.`);
}

main().catch((err) => {
  console.error(err?.stack || err);
  process.exitCode = 1;
});
