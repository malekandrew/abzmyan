import fs from 'fs-extra';
import prompts from 'prompts';
import { AGENTS } from '../agents.js';
import {
  abzmyanDir,
  copyCommandTemplates,
  removeCommandFiles,
  writeMemoryFiles,
  readAgentsFromConfig,
  writeAgentsToConfig,
  migrateDeployConfig,
  migrateTicketStatuses,
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

  const removedSummary = (await removeCommandFiles(projectRoot, currentAgentIds, 'shipper')).filter(
    (entry) => entry.removed
  );
  if (removedSummary.length > 0) {
    console.log('\nRetired command removed (Shipper was replaced by Deployer):');
    for (const { agentId, file } of removedSummary) {
      const label = AGENTS.find((a) => a.id === agentId)?.label ?? agentId;
      console.log(`  - ${label}: ${file}`);
    }
  }

  const memorySummary = await writeMemoryFiles(projectRoot, currentAgentIds);
  console.log('\nabzmyan project-context block refreshed in agent memory files:');
  printMemorySummary(memorySummary);

  const migratedTicketCount = await migrateTicketStatuses(projectRoot);
  if (migratedTicketCount > 0) {
    console.log(
      `\n${migratedTicketCount} ticket(s) migrated: documented/shipped -> archived.`
    );
  }

  const deployConfigMigrated = await migrateDeployConfig(projectRoot);
  if (deployConfigMigrated) {
    console.log('\n.abzmyan/config.yml deploy config migrated to the new multi-target shape.');
  }

  console.log('\n.abzmyan/index/* was left untouched.');

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
