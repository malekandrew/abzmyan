import fs from 'fs-extra';
import prompts from 'prompts';
import { AGENTS } from '../agents.js';
import {
  abzmyanDir,
  copyCommandTemplates,
  writeMemoryFiles,
  readAgentsFromConfig,
  writeAgentsToConfig,
} from '../scaffold.js';

function printSummary(summary) {
  const byAgent = new Map();
  for (const entry of summary) {
    if (!byAgent.has(entry.agentId)) byAgent.set(entry.agentId, []);
    byAgent.get(entry.agentId).push(entry);
  }

  for (const [agentId, entries] of byAgent) {
    const label = AGENTS.find((a) => a.id === agentId)?.label ?? agentId;
    console.log(`\n${label}:`);
    for (const { name, file, change } of entries) {
      const marker = change === 'added' ? '+' : change === 'updated' ? '~' : ' ';
      const display = file.includes(name) ? file : `${name}/${file}`;
      console.log(`  ${marker} ${display} (${change})`);
    }
  }
}

function printMemorySummary(summary) {
  for (const { agentId, file, change } of summary) {
    const label = AGENTS.find((a) => a.id === agentId)?.label ?? agentId;
    const marker = change === 'added' ? '+' : change === 'updated' ? '~' : ' ';
    console.log(`  ${marker} ${label}: ${file} (${change})`);
  }
}

export async function updateCommand() {
  const projectRoot = process.cwd();

  if (!(await fs.pathExists(abzmyanDir(projectRoot)))) {
    console.error('No abzmyan project found here. Run `npx abzmyan init` first.');
    process.exitCode = 1;
    return;
  }

  const currentAgentIds = await readAgentsFromConfig(projectRoot);

  const summary = await copyCommandTemplates(projectRoot, currentAgentIds);
  console.log('abzmyan command templates refreshed:');
  printSummary(summary);

  const memorySummary = await writeMemoryFiles(projectRoot, currentAgentIds);
  console.log('\nabzmyan project-context block refreshed in agent memory files:');
  printMemorySummary(memorySummary);

  console.log('\n.abzmyan/config.yml, .abzmyan/index/*, and .abzmyan/tickets/* were left untouched.');

  const { agentIds: newAgentIds } = await prompts(
    {
      type: 'multiselect',
      name: 'agentIds',
      message: 'Add or change AI agents for this project?',
      choices: AGENTS.map((agent) => ({
        title: agent.label,
        value: agent.id,
        selected: currentAgentIds.includes(agent.id),
      })),
      min: 1,
      instructions: false,
    },
    {
      onCancel: () => {
        console.log('\nAgent selection unchanged.');
      },
    }
  );

  if (!newAgentIds) {
    return;
  }

  const sameSet =
    newAgentIds.length === currentAgentIds.length &&
    newAgentIds.every((id) => currentAgentIds.includes(id));

  if (sameSet) {
    console.log('\nAgent selection unchanged.');
    return;
  }

  const addedAgentIds = newAgentIds.filter((id) => !currentAgentIds.includes(id));

  if (addedAgentIds.length > 0) {
    const addedSummary = await copyCommandTemplates(projectRoot, addedAgentIds);
    console.log('\nNew agent command files written:');
    printSummary(addedSummary);

    const addedMemorySummary = await writeMemoryFiles(projectRoot, addedAgentIds);
    console.log('\nNew agent memory files written:');
    printMemorySummary(addedMemorySummary);
  }

  await writeAgentsToConfig(projectRoot, newAgentIds);
  console.log(`\n.abzmyan/config.yml updated. Configured agents: ${newAgentIds.join(', ')}.`);
}
