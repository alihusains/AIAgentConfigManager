#!/usr/bin/env node
/**
 * AI Agent Config Manager CLI
 * Command-line interface for managing AI agent configurations
 */

import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { table } from 'table';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  AgentConfigManager,
  type ModelProvider,
  type ModelConfig,
  type MCPServerConfig,
  type PermissionConfig,
  getAgentCatalog,
  detectCatalogEntry,
  catalogEntryToDetected,
} from './core-shim.js';
import { DEFAULT_GUI_PORT } from './gui-server.js';

const manager = new AgentConfigManager();

program
  .name('agm')
  .description(
    'AgentControl - One registry, every agent, in sync. Manage models, providers, MCP servers, and permissions across AI coding agents'
  )
  .version('0.1.0');

// ============================================================================
// Helper Functions
// ============================================================================

async function selectTargetAgents(message = 'Select target agent(s):'): Promise<string[]> {
  const detected = await manager.detectAgents();
  if (detected.length === 0) {
    console.log(chalk.red('No agents available'));
    return [];
  }

  const sorted = [...detected].sort((a, b) => {
    if (a.detection.installed !== b.detection.installed) return a.detection.installed ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const { agentIds } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'agentIds',
      message,
      choices: sorted.map((a) => ({
        name: a.detection.installed ? `${a.name} (${a.id})` : `${a.name} (${a.id}) — not installed`,
        value: a.id,
        checked: a.detection.installed,
      })),
    },
  ]);

  return agentIds as string[];
}

async function confirmAction(message: string): Promise<boolean> {
  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message,
      default: false,
    },
  ]);
  return confirmed;
}

function printTable(headers: string[], rows: string[][]): void {
  console.log(
    table([headers, ...rows], {
      header: { content: headers.join(' | ') },
      columns: headers.map(() => ({ alignment: 'left' as const })),
    })
  );
}

function printSuccess(message: string): void {
  console.log(chalk.green('✓'), message);
}

function printError(message: string): void {
  console.log(chalk.red('✗'), message);
}

function printWarning(message: string): void {
  console.log(chalk.yellow('⚠'), message);
}

function printInfo(message: string): void {
  console.log(chalk.blue('ℹ'), message);
}

// ============================================================================
// Agent Commands
// ============================================================================

program
  .command('list-agents')
  .description('List all supported AI agents and whether they are installed')
  .action(async () => {
    const spinner = ora('Detecting installed agent CLIs...').start();
    const agents = await manager.detectAgents();
    spinner.stop();

    if (agents.length === 0) {
      printWarning('No agents configured');
      return;
    }

    const rows = agents.map((a) => [
      a.id,
      a.name,
      a.detection.installed ? chalk.green('✓ installed') : chalk.gray('not found'),
      a.detection.version || '',
      a.configFormat,
      a.supports.modelProviders ? '✓' : '✗',
      a.supports.mcpServers ? '✓' : '✗',
      a.detection.mcpPath || '—',
    ]);

    printTable(['ID', 'Name', 'Status', 'Version', 'Format', 'Models', 'MCP', 'MCP Path'], rows);
  });

program
  .command('detect')
  .alias('scan')
  .description('Detect installed agent CLIs and their config files')
  .action(async () => {
    const spinner = ora('Scanning for agent CLIs...').start();
    const agents = await manager.detectAgents();
    spinner.stop();

    console.log(chalk.bold('\nInstalled agent CLIs on this machine'));
    console.log(chalk.gray('─'.repeat(50)));

    for (const a of agents) {
      const status = a.detection.installed ? chalk.green('INSTALLED') : chalk.gray('not found');
      console.log(`\n${status}  ${chalk.bold(a.name)} (${a.id})`);
      if (a.detection.binaryPath) {
        const via = a.detection.detectedBy ? ` [via ${a.detection.detectedBy}]` : '';
        console.log(`  binary:   ${a.detection.binaryPath}${chalk.gray(via)}`);
      }
      if (a.detection.version) {
        console.log(`  version:  ${a.detection.version}`);
      }
      console.log(
        `  config:   ${a.detection.configExists ? chalk.green(manager.getConfigPath(a.id) || '') : chalk.gray('(no config file yet)')}`
      );
      // MCP config surface
      if (a.detection.mcpPath) {
        const count =
          a.detection.mcpServerCount !== undefined
            ? ` (${a.detection.mcpServerCount} server${a.detection.mcpServerCount === 1 ? '' : 's'})`
            : '';
        console.log(
          `  mcp:      ${a.detection.mcpConfigExists ? chalk.green(`${a.detection.mcpPath}${count}`) : chalk.gray(`${a.detection.mcpPath} (not created yet)`)}`
        );
      }
      // Model/provider config surface
      if (a.detection.modelConfigPath) {
        console.log(
          `  model:    ${a.detection.modelConfigExists ? chalk.green(a.detection.modelConfigPath) : chalk.gray(`${a.detection.modelConfigPath} (not created yet)`)}`
        );
      }
      // Separate credential store (e.g. reasonix's .env)
      if (a.detection.modelCredentialPath) {
        console.log(
          `  keys:     ${a.detection.modelCredentialExists ? chalk.green(a.detection.modelCredentialPath) : chalk.gray(`${a.detection.modelCredentialPath} (not created yet)`)}`
        );
      }
    }

    // Catalog-only agents (no core adapter) are probed separately so
    // installed CLIs like reasonix / little-coder show up here too.
    const adapterIds = new Set(agents.map((a) => a.id));
    const catalog = getAgentCatalog().filter((e) => !adapterIds.has(e.id));
    if (catalog.length > 0) {
      console.log(chalk.bold('\nCatalog agents (binary-only detection)'));
      console.log(chalk.gray('─'.repeat(50)));
      // Probes are independent — run them in parallel, print in catalog order.
      const probes = await Promise.all(catalog.map((entry) => detectCatalogEntry(entry)));
      for (let i = 0; i < catalog.length; i++) {
        const entry = catalog[i];
        const probe = probes[i];
        const _detected = catalogEntryToDetected(entry, probe);
        const status = probe.installed ? chalk.green('INSTALLED') : chalk.gray('not found');
        console.log(`\n${status}  ${chalk.bold(entry.name)} (${entry.id})`);
        if (probe.binaryPath) {
          const via = probe.detectedBy ? ` [via ${probe.detectedBy}]` : '';
          console.log(`  binary:   ${probe.binaryPath}${chalk.gray(via)}`);
        }
        if (probe.version) {
          console.log(`  version:  ${probe.version}`);
        }
        const cfg = probe.settingsPaths.find((p) => probe.settingsExist && p);
        console.log(
          `  config:   ${probe.settingsExist ? chalk.green(cfg || '') : chalk.gray('(no config file yet)')}`
        );
        if (probe.mcpPath) {
          const count =
            probe.mcpServerCount !== undefined
              ? ` (${probe.mcpServerCount} server${probe.mcpServerCount === 1 ? '' : 's'})`
              : '';
          console.log(
            `  mcp:      ${probe.mcpConfigExists ? chalk.green(`${probe.mcpPath}${count}`) : chalk.gray(`${probe.mcpPath} (not created yet)`)}`
          );
        }
        if (probe.modelCredentialPath) {
          console.log(
            `  keys:     ${probe.modelCredentialExists ? chalk.green(probe.modelCredentialPath) : chalk.gray(`${probe.modelCredentialPath} (not created yet)`)}`
          );
        }
      }
    }
  });

program
  .command('show-config <agentId>')
  .description('Show configuration for an agent')
  .option('-f, --format <format>', 'Output format (json|table)', 'table')
  .action(async (agentId, options) => {
    const spinner = ora(`Loading config for ${agentId}...`).start();
    const result = await manager.loadConfig(agentId);
    spinner.stop();

    if (!result.success) {
      printError(result.error || 'Failed to load config');
      return;
    }

    const config = result.data!;

    if (options.format === 'json') {
      console.log(JSON.stringify(config, null, 2));
      return;
    }

    console.log(chalk.bold(`\nConfiguration for ${agentId}`));
    console.log(chalk.gray('─'.repeat(50)));

    console.log(`\n${chalk.bold('Model Providers:')}`);
    if (config.modelProviders.length === 0) {
      console.log('  (none)');
    } else {
      const rows = config.modelProviders.map((p) => [
        p.id,
        p.name,
        p.type,
        p.enabled ? '✓' : '✗',
        p.priority.toString(),
      ]);
      printTable(['ID', 'Name', 'Type', 'Enabled', 'Priority'], rows);
    }

    console.log(`\n${chalk.bold('Models:')}`);
    if (config.models.length === 0) {
      console.log('  (none)');
    } else {
      const rows = config.models.map((m) => [m.id, m.providerId, m.name, m.roles.join(', ')]);
      printTable(['ID', 'Provider', 'Name', 'Roles'], rows);
    }

    console.log(`\n${chalk.bold('MCP Servers:')}`);
    if (config.mcpServers.length === 0) {
      console.log('  (none)');
    } else {
      const rows = config.mcpServers.map((s) => [
        s.name,
        s.type,
        s.command || s.url || '',
        s.enabled ? '✓' : '✗',
      ]);
      printTable(['Name', 'Type', 'Command/URL', 'Enabled'], rows);
    }

    console.log(`\n${chalk.bold('Permissions:')}`);
    if (config.permissions.length === 0) {
      console.log('  (none)');
    } else {
      const rows = config.permissions.map((p) => [
        p.id,
        p.type,
        p.scope,
        p.allowed ? 'Allow' : 'Deny',
        p.pattern,
      ]);
      printTable(['ID', 'Type', 'Scope', 'Action', 'Pattern'], rows);
    }
  });

// ============================================================================
// Model Provider Commands
// ============================================================================

const providerCmd = program.command('provider').description('Manage model providers');

providerCmd
  .command('add [agentId]')
  .description('Add a model provider (prompts for target agent(s) when agentId is omitted)')
  .option('-i, --id <id>', 'Provider ID')
  .option('-n, --name <name>', 'Provider name')
  .option('-t, --type <type>', 'Provider type (anthropic|bedrock|vertex|openai-compatible)')
  .option('-k, --api-key <key>', 'API key')
  .option('-u, --base-url <url>', 'Base URL')
  .option('-r, --region <region>', 'Region (for Bedrock/Vertex)')
  .option('-p, --project <project>', 'Project (for Vertex)')
  .option('-m, --models <models>', 'Model names to add with the provider (comma-separated)')
  .action(async (agentId, options) => {
    // Resolve target agent(s): explicit agentId, or interactive selection
    let targetAgents: string[] = [];
    if (agentId) {
      if (!manager.getAgent(agentId)) {
        printError(`Agent "${agentId}" not found`);
        return;
      }
      targetAgents = [agentId];
    } else {
      targetAgents = await selectTargetAgents('Select target agent(s) for this provider:');
      if (targetAgents.length === 0) {
        printWarning('No target agents selected - aborting');
        return;
      }
    }

    if (targetAgents.length === 1 && !agentId) {
      const adapter = manager.getAgent(targetAgents[0]);
      if (adapter && !adapter.info.supports.modelProviders) {
        printError(`Agent "${targetAgents[0]}" doesn't support model providers`);
        return;
      }
    }

    // Interactive prompts for missing options
    const providerId =
      options.id ||
      (
        await inquirer.prompt([
          {
            type: 'input',
            name: 'id',
            message: 'Provider ID:',
            validate: (v) => v.length > 0 || 'Required',
          },
        ])
      ).id;

    const name =
      options.name ||
      (
        await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Provider name:',
            validate: (v) => v.length > 0 || 'Required',
          },
        ])
      ).name;

    const type =
      options.type ||
      (
        await inquirer.prompt([
          {
            type: 'list',
            name: 'type',
            message: 'Provider type:',
            choices: ['anthropic', 'bedrock', 'vertex', 'openai-compatible'],
          },
        ])
      ).type;

    const config: Record<string, unknown> = {};

    if (type === 'anthropic' || type === 'openai-compatible') {
      config.apiKey =
        options.apiKey ||
        (
          await inquirer.prompt([
            {
              type: 'password',
              name: 'apiKey',
              message: 'API Key:',
              mask: '*',
            },
          ])
        ).apiKey;
      config.baseUrl =
        options.baseUrl ||
        (
          await inquirer.prompt([
            {
              type: 'input',
              name: 'baseUrl',
              message: 'Base URL (optional):',
            },
          ])
        ).baseUrl;
    } else if (type === 'bedrock') {
      config.region =
        options.region ||
        (
          await inquirer.prompt([
            {
              type: 'input',
              name: 'region',
              message: 'AWS Region:',
            },
          ])
        ).region;
      config.profile = (
        await inquirer.prompt([
          {
            type: 'input',
            name: 'profile',
            message: 'AWS Profile (optional):',
          },
        ])
      ).profile;
    } else if (type === 'vertex') {
      config.project =
        options.project ||
        (
          await inquirer.prompt([
            {
              type: 'input',
              name: 'project',
              message: 'Google Cloud Project:',
            },
          ])
        ).project;
      config.region =
        options.region ||
        (
          await inquirer.prompt([
            {
              type: 'input',
              name: 'region',
              message: 'Region (optional):',
            },
          ])
        ).region;
    }

    const provider: ModelProvider = {
      id: providerId,
      name,
      type: type as ModelProvider['type'],
      config,
      enabled: true,
      priority: 0,
    };

    // Optional: register model configurations with the provider
    const models: ModelConfig[] = [];
    if (options.models) {
      const modelIds = String(options.models)
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean);
      for (const modelId of modelIds) {
        models.push({
          id: modelId,
          providerId: providerId,
          name: modelId,
          displayName: modelId,
          roles: ['chat', 'edit', 'apply', 'summarize'],
          capabilities: ['tool_use'],
        });
      }
    }

    const spinner = ora(
      `Installing provider "${name}" into ${targetAgents.length} agent(s)...`
    ).start();
    const result = await manager.installProvider(provider, models, targetAgents);
    spinner.stop();

    if (result.success) {
      printSuccess(`Provider "${name}" installed into: ${targetAgents.join(', ')}`);
      if (models.length > 0) {
        printSuccess(`Models added: ${models.map((m) => m.name).join(', ')}`);
      }
    } else {
      printError(result.error || 'Failed to add provider');
      if (result.warnings) {
        for (const w of result.warnings) printWarning(w);
      }
    }
  });

providerCmd
  .command('remove <agentId> <providerId>')
  .description('Remove a model provider')
  .action(async (agentId, providerId) => {
    if (!(await confirmAction(`Remove provider "${providerId}"?`))) return;

    const spinner = ora('Removing provider...').start();
    const result = await manager.removeModelProvider(agentId, providerId);
    spinner.stop();

    if (result.success) {
      printSuccess(`Provider "${providerId}" removed`);
    } else {
      printError(result.error || 'Failed to remove provider');
    }
  });

providerCmd
  .command('list <agentId>')
  .description('List model providers for an agent')
  .action(async (agentId) => {
    const result = await manager.loadConfig(agentId);
    if (!result.success) {
      printError(result.error || 'Failed to load config');
      return;
    }

    const config = result.data!;
    if (config.modelProviders.length === 0) {
      printInfo('No providers configured');
      return;
    }

    const rows = config.modelProviders.map((p) => [
      p.id,
      p.name,
      p.type,
      p.enabled ? '✓' : '✗',
      p.priority.toString(),
    ]);
    printTable(['ID', 'Name', 'Type', 'Enabled', 'Priority'], rows);
  });

// ============================================================================
// Model Commands
// ============================================================================

const modelCmd = program.command('model').description('Manage models');

modelCmd
  .command('add <agentId>')
  .description('Add a model')
  .action(async (agentId) => {
    const adapter = manager.getAgent(agentId);
    if (!adapter) {
      printError(`Agent "${agentId}" not found`);
      return;
    }

    const config = (await manager.loadConfig(agentId)).data;
    if (!config || config.modelProviders.length === 0) {
      printError('No providers configured. Add a provider first.');
      return;
    }

    const { modelId } = await inquirer.prompt([
      {
        type: 'input',
        name: 'modelId',
        message: 'Model ID:',
        validate: (v) => v.length > 0 || 'Required',
      },
    ]);

    const { providerId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'providerId',
        message: 'Provider:',
        choices: config.modelProviders.map((p) => ({
          name: p.name,
          value: p.id,
        })),
      },
    ]);

    const { name } = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Model name (e.g., gpt-4, claude-3-opus):',
        validate: (v) => v.length > 0 || 'Required',
      },
    ]);

    const { displayName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'displayName',
        message: 'Display name:',
        default: name,
      },
    ]);

    const { roles } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'roles',
        message: 'Roles:',
        choices: ['chat', 'edit', 'apply', 'summarize', 'autocomplete', 'embed', 'rerank'].map(
          (r) => ({ name: r, value: r })
        ),
        default: ['chat', 'edit', 'apply', 'summarize'],
      },
    ]);

    const model: ModelConfig = {
      id: modelId,
      providerId,
      name,
      displayName,
      roles: roles as ModelConfig['roles'],
      capabilities: ['tool_use'],
    };

    const spinner = ora('Adding model...').start();
    const result = await manager.addModel(agentId, model);
    spinner.stop();

    if (result.success) {
      printSuccess(`Model "${name}" added successfully`);
    } else {
      printError(result.error || 'Failed to add model');
    }
  });

modelCmd
  .command('remove <agentId> <modelId>')
  .description('Remove a model')
  .action(async (agentId, modelId) => {
    if (!(await confirmAction(`Remove model "${modelId}"?`))) return;

    const spinner = ora('Removing model...').start();
    const result = await manager.removeModel(agentId, modelId);
    spinner.stop();

    if (result.success) {
      printSuccess(`Model "${modelId}" removed`);
    } else {
      printError(result.error || 'Failed to remove model');
    }
  });

modelCmd
  .command('list <agentId>')
  .description('List models for an agent')
  .action(async (agentId) => {
    const result = await manager.loadConfig(agentId);
    if (!result.success) {
      printError(result.error || 'Failed to load config');
      return;
    }

    const config = result.data!;
    if (config.models.length === 0) {
      printInfo('No models configured');
      return;
    }

    const rows = config.models.map((m) => [
      m.id,
      m.providerId,
      m.name,
      m.displayName,
      m.roles.join(', '),
    ]);
    printTable(['ID', 'Provider', 'Name', 'Display Name', 'Roles'], rows);
  });

// ============================================================================
// MCP Server Commands
// ============================================================================

const mcpCmd = program.command('mcp').description('Manage MCP servers');

mcpCmd
  .command('add <agentId>')
  .description('Add an MCP server')
  .action(async (agentId) => {
    const adapter = manager.getAgent(agentId);
    if (!adapter) {
      printError(`Agent "${agentId}" not found`);
      return;
    }

    if (!adapter.info.supports.mcpServers) {
      printError(`Agent "${agentId}" doesn't support MCP servers`);
      return;
    }

    const { name } = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Server name:',
        validate: (v) => v.length > 0 || 'Required',
      },
    ]);

    const { type } = await inquirer.prompt([
      {
        type: 'list',
        name: 'type',
        message: 'Server type:',
        choices: ['stdio', 'http', 'streamable-http'],
      },
    ]);

    const server: Partial<MCPServerConfig> = {
      name,
      type: type as MCPServerConfig['type'],
      enabled: true,
    };

    if (type === 'stdio') {
      const { command } = await inquirer.prompt([
        {
          type: 'input',
          name: 'command',
          message: 'Command:',
          validate: (v) => v.length > 0 || 'Required',
        },
      ]);
      const { args } = await inquirer.prompt([
        {
          type: 'input',
          name: 'args',
          message: 'Arguments (space-separated):',
          default: '',
        },
      ]);
      server.command = command;
      server.args = args.split(' ').filter(Boolean);
      const { env } = await inquirer.prompt([
        {
          type: 'input',
          name: 'env',
          message: 'Environment variables (KEY=VAL,KEY=VAL):',
        },
      ]);
      if (env) {
        server.env = {};
        for (const pair of env.split(',')) {
          const [k, v] = pair.split('=');
          if (k && v) server.env![k.trim()] = v.trim();
        }
      }
    } else {
      const { url } = await inquirer.prompt([
        {
          type: 'input',
          name: 'url',
          message: 'Server URL:',
          validate: (v) => v.length > 0 || 'Required',
        },
      ]);
      server.url = url;
      const { headers } = await inquirer.prompt([
        {
          type: 'input',
          name: 'headers',
          message: 'Headers (KEY=VAL,KEY=VAL):',
        },
      ]);
      if (headers) {
        server.headers = {};
        for (const pair of headers.split(',')) {
          const [k, v] = pair.split('=');
          if (k && v) server.headers![k.trim()] = v.trim();
        }
      }
    }

    const { approvalMode } = await inquirer.prompt([
      {
        type: 'list',
        name: 'approvalMode',
        message: 'Approval mode:',
        choices: ['prompt', 'auto', 'never'],
        default: 'prompt',
      },
    ]);
    server.approvalMode = approvalMode as MCPServerConfig['approvalMode'];

    const spinner = ora('Adding MCP server...').start();
    const result = await manager.addMCPServer(agentId, server as MCPServerConfig);
    spinner.stop();

    if (result.success) {
      printSuccess(`MCP server "${name}" added successfully`);
    } else {
      printError(result.error || 'Failed to add MCP server');
    }
  });

mcpCmd
  .command('remove <agentId> <serverName>')
  .description('Remove an MCP server')
  .action(async (agentId, serverName) => {
    if (!(await confirmAction(`Remove MCP server "${serverName}"?`))) return;

    const spinner = ora('Removing MCP server...').start();
    const result = await manager.removeMCPServer(agentId, serverName);
    spinner.stop();

    if (result.success) {
      printSuccess(`MCP server "${serverName}" removed`);
    } else {
      printError(result.error || 'Failed to remove MCP server');
    }
  });

mcpCmd
  .command('list <agentId>')
  .description('List MCP servers for an agent')
  .action(async (agentId) => {
    const result = await manager.loadConfig(agentId);
    if (!result.success) {
      printError(result.error || 'Failed to load config');
      return;
    }

    const config = result.data!;
    if (config.mcpServers.length === 0) {
      printInfo('No MCP servers configured');
      return;
    }

    const rows = config.mcpServers.map((s) => [
      s.name,
      s.type,
      s.command || s.url || '',
      s.enabled ? '✓' : '✗',
    ]);
    printTable(['Name', 'Type', 'Command/URL', 'Enabled'], rows);
  });

// ============================================================================
// Permission Commands
// ============================================================================

const permCmd = program.command('permission').description('Manage permissions');

permCmd
  .command('add <agentId>')
  .description('Add a permission')
  .action(async (agentId) => {
    const adapter = manager.getAgent(agentId);
    if (!adapter) {
      printError(`Agent "${agentId}" not found`);
      return;
    }

    if (!adapter.info.supports.permissions) {
      printError(`Agent "${agentId}" doesn't support permissions`);
      return;
    }

    const { type } = await inquirer.prompt([
      {
        type: 'list',
        name: 'type',
        message: 'Permission type:',
        choices: ['tool', 'directory', 'url', 'command', 'mcp', 'custom'],
      },
    ]);

    const { scope } = await inquirer.prompt([
      {
        type: 'list',
        name: 'scope',
        message: 'Scope:',
        choices: ['global', 'project'],
      },
    ]);

    let projectPath: string | undefined;
    if (scope === 'project') {
      const { path } = await inquirer.prompt([
        {
          type: 'input',
          name: 'path',
          message: 'Project path:',
          validate: (v) => v.length > 0 || 'Required',
        },
      ]);
      projectPath = path;
    }

    const { allowed } = await inquirer.prompt([
      {
        type: 'list',
        name: 'allowed',
        message: 'Action:',
        choices: [
          { name: 'Allow', value: true },
          { name: 'Deny', value: false },
        ],
      },
    ]);

    const { pattern } = await inquirer.prompt([
      {
        type: 'input',
        name: 'pattern',
        message: 'Pattern (tool name, path, URL, command):',
        validate: (v) => v.length > 0 || 'Required',
      },
    ]);

    const { description } = await inquirer.prompt([
      {
        type: 'input',
        name: 'description',
        message: 'Description (optional):',
      },
    ]);

    const permission: PermissionConfig = {
      id: `perm-${Date.now()}`,
      type: type as PermissionConfig['type'],
      scope: scope as PermissionConfig['scope'],
      projectPath,
      allowed,
      pattern,
      description,
    };

    const spinner = ora('Adding permission...').start();
    const result = await manager.addPermission(agentId, permission);
    spinner.stop();

    if (result.success) {
      printSuccess('Permission added successfully');
    } else {
      printError(result.error || 'Failed to add permission');
    }
  });

permCmd
  .command('remove <agentId> <permissionId>')
  .description('Remove a permission')
  .action(async (agentId, permissionId) => {
    if (!(await confirmAction(`Remove permission "${permissionId}"?`))) return;

    const spinner = ora('Removing permission...').start();
    const result = await manager.removePermission(agentId, permissionId);
    spinner.stop();

    if (result.success) {
      printSuccess(`Permission "${permissionId}" removed`);
    } else {
      printError(result.error || 'Failed to remove permission');
    }
  });

permCmd
  .command('list <agentId>')
  .description('List permissions for an agent')
  .action(async (agentId) => {
    const result = await manager.loadConfig(agentId);
    if (!result.success) {
      printError(result.error || 'Failed to load config');
      return;
    }

    const config = result.data!;
    if (config.permissions.length === 0) {
      printInfo('No permissions configured');
      return;
    }

    const rows = config.permissions.map((p) => [
      p.id,
      p.type,
      p.scope,
      p.allowed ? 'Allow' : 'Deny',
      p.pattern,
      p.description || '',
    ]);
    printTable(['ID', 'Type', 'Scope', 'Action', 'Pattern', 'Description'], rows);
  });

// ============================================================================
// Batch Operations (Select All)
// ============================================================================

program
  .command('apply-to-all')
  .description('Apply a configuration to all agents (Select All)')
  .option('--provider', 'Apply provider to all agents')
  .option('--mcp', 'Apply MCP server to all agents')
  .option('--permission', 'Apply permission to all agents')
  .action(async (options) => {
    const agents = manager.getAvailableAgents();
    if (agents.length === 0) {
      printWarning('No agents available');
      return;
    }

    if (options.provider) {
      // Add provider to all
      const { providerId } = await inquirer.prompt([
        {
          type: 'input',
          name: 'providerId',
          message: 'Provider ID:',
        },
      ]);
      const { name } = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Provider name:',
        },
      ]);
      const { type } = await inquirer.prompt([
        {
          type: 'list',
          name: 'type',
          message: 'Provider type:',
          choices: ['anthropic', 'bedrock', 'vertex', 'openai-compatible'],
        },
      ]);

      const config: Record<string, unknown> = {};
      if (type === 'anthropic' || type === 'openai-compatible') {
        const { apiKey } = await inquirer.prompt([
          {
            type: 'password',
            name: 'apiKey',
            message: 'API Key:',
            mask: '*',
          },
        ]);
        config.apiKey = apiKey;
      }

      const provider: ModelProvider = {
        id: providerId,
        name,
        type: type as ModelProvider['type'],
        config,
        enabled: true,
        priority: 0,
      };

      const spinner = ora('Applying provider to all agents...').start();
      const result = await manager.addModelProviderToAll(provider);
      spinner.stop();

      if (result.success) {
        printSuccess('Provider applied to all compatible agents');
      } else {
        printError(result.error || 'Failed to apply provider');
        if (result.warnings) {
          for (const w of result.warnings) printWarning(w);
        }
      }
    }

    if (options.mcp) {
      // Add MCP to all
      const { name } = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Server name:',
        },
      ]);
      const { type } = await inquirer.prompt([
        {
          type: 'list',
          name: 'type',
          message: 'Server type:',
          choices: ['stdio', 'http', 'streamable-http'],
        },
      ]);

      const server: Partial<MCPServerConfig> = {
        name,
        type: type as MCPServerConfig['type'],
        enabled: true,
      };

      if (type === 'stdio') {
        const { command } = await inquirer.prompt([
          { type: 'input', name: 'command', message: 'Command:' },
        ]);
        const { args } = await inquirer.prompt([
          { type: 'input', name: 'args', message: 'Arguments:' },
        ]);
        server.command = command;
        server.args = args.split(' ').filter(Boolean);
      } else {
        const { url } = await inquirer.prompt([{ type: 'input', name: 'url', message: 'URL:' }]);
        server.url = url;
      }

      const spinner = ora('Applying MCP server to all agents...').start();
      const result = await manager.addMCPServerToAll(server as MCPServerConfig);
      spinner.stop();

      if (result.success) {
        printSuccess('MCP server applied to all compatible agents');
      } else {
        printError(result.error || 'Failed to apply MCP server');
        if (result.warnings) {
          for (const w of result.warnings) printWarning(w);
        }
      }
    }

    if (options.permission) {
      // Add permission to all
      const { type } = await inquirer.prompt([
        {
          type: 'list',
          name: 'type',
          message: 'Permission type:',
          choices: ['tool', 'directory', 'url', 'command', 'mcp', 'custom'],
        },
      ]);
      const { allowed } = await inquirer.prompt([
        {
          type: 'list',
          name: 'allowed',
          message: 'Action:',
          choices: [
            { name: 'Allow', value: true },
            { name: 'Deny', value: false },
          ],
        },
      ]);
      const { pattern } = await inquirer.prompt([
        {
          type: 'input',
          name: 'pattern',
          message: 'Pattern:',
        },
      ]);

      const permission: PermissionConfig = {
        id: `perm-${Date.now()}`,
        type: type as PermissionConfig['type'],
        scope: 'global',
        allowed,
        pattern,
      };

      const spinner = ora('Applying permission to all agents...').start();
      const result = await manager.addPermissionToAll(permission);
      spinner.stop();

      if (result.success) {
        printSuccess('Permission applied to all compatible agents');
      } else {
        printError(result.error || 'Failed to apply permission');
        if (result.warnings) {
          for (const w of result.warnings) printWarning(w);
        }
      }
    }
  });

// ============================================================================
// Backup/Restore
// ============================================================================

program
  .command('backup <agentId>')
  .description('Backup agent configuration')
  .action(async (agentId) => {
    const spinner = ora('Creating backup...').start();
    const result = await manager.backupConfig(agentId);
    spinner.stop();

    if (result.success) {
      printSuccess(`Backup created: ${result.data}`);
    } else {
      printError(result.error || 'Failed to create backup');
    }
  });

program
  .command('restore <agentId> <backupPath>')
  .description('Restore agent configuration from backup')
  .action(async (agentId, backupPath) => {
    if (!(await confirmAction(`Restore config from "${backupPath}"?`))) return;

    const spinner = ora('Restoring config...').start();
    const result = await manager.restoreConfig(agentId, backupPath);
    spinner.stop();

    if (result.success) {
      printSuccess('Config restored successfully');
    } else {
      printError(result.error || 'Failed to restore config');
    }
  });

// ============================================================================
// Config Path
// ============================================================================

program
  .command('config-path <agentId>')
  .description('Show configuration file path for an agent')
  .option('-p, --platform <platform>', 'Platform (darwin|win32|linux)')
  .action((agentId, options) => {
    const path = manager.getConfigPath(agentId, options.platform as any);
    if (path) {
      console.log(path);
    } else {
      printError(`Agent "${agentId}" not found`);
    }
  });

// ============================================================================
// Live GitHub Stars Ranking
// ============================================================================

program
  .command('stars')
  .description('Show live GitHub star rankings of agents in the catalog')
  .option('--format <format>', 'Output format: json | table | csv', 'table')
  .option('--agent <agentId>', 'Show stars for a single agent (by id)')
  .option('--limit <n>', 'Limit output to top N agents', '20')
  .option('--ttl <ms>', 'Cache TTL in milliseconds (default: 1 hour)')
  .action(async (options) => {
    const { generateStarReport, parseGithubRepo, clearLiveStarsCache } = await import(
      '@ai-agent-config/core'
    );

    const spinner = ora('Fetching GitHub star data...').start();
    const start = Date.now();

    try {
      const catalog = getAgentCatalog();
      let agents = catalog
        .filter((e) => !options.agent || e.id === options.agent)
        .map((e) => ({
          id: e.id,
          name: e.name,
          source: e.source,
        }));

      if (!agents.length) {
        spinner.stop();
        if (options.agent) {
          printError(`Agent "${options.agent}" not found in catalog`);
        } else {
          printError('No agents in catalog');
        }
        return;
      }

      const opts: any = {};
      if (options.ttl) opts.ttlMs = Number(options.ttl);

      const report = await generateStarReport(agents, opts);
      spinner.stop();

      if (options.format === 'json') {
        console.log(JSON.stringify(report, null, 2));
        return;
      }

      if (options.format === 'csv') {
        console.log(
          'Rank,Name,Stars,GitHub URL,Stars/Day,Status,Last Commit,Open Issues,Trending'
        );
        for (const row of report.rankings) {
          console.log(
            [
              row.rank,
              `"${row.name}"`,
              row.stars,
              `"${row.github_url}"`,
              row.stars_per_day,
              row.maintenance_status,
              row.last_commit,
              row.issue_count,
              row.is_trending ? 'Yes' : 'No',
            ].join(',')
          );
        }
        return;
      }

      // Table format
      const limit = Math.max(1, Number(options.limit) || 20);
      const rows = report.rankings.slice(0, limit).map((r) => [
        r.rank.toString(),
        chalk.bold(r.name),
        r.stars.toLocaleString(),
        `${r.stars_per_day}`,
        r.maintenance_status === 'active' ? chalk.green('✓ active') : chalk.gray('stale'),
        r.is_trending ? chalk.yellow('🔥 trending') : '',
        r.issue_count.toString(),
      ]);

      printTable(['Rank', 'Agent', 'Stars', 'Stars/Day', 'Status', 'Trending', 'Issues'], rows);

      if (report.rankings.length > limit) {
        console.log(
          chalk.gray(`\n... and ${report.rankings.length - limit} more (use --limit to see more)`)
        );
      }

      console.log(
        chalk.gray(
          `\nGenerated at ${report.generated_at} | ${report.metadata.api_calls} API calls, ${report.metadata.cache_hits} cache hits | Fetched in ${report.metadata.fetch_time_ms}ms`
        )
      );
    } catch (error) {
      spinner.stop();
      const msg = error instanceof Error ? error.message : String(error);
      printError(`Failed to fetch star data: ${msg}`);
      process.exit(1);
    }
  });

// ============================================================================
// Dashboard lifecycle: agm start | agm stop | agm health
// ============================================================================

/** Where the dashboard records its process id while it is running. */
function pidFilePath(): string {
  const home =
    process.env.AI_CONFIG_HOME ||
    (process.platform === 'win32'
      ? path.join(process.env.APPDATA || '', 'ai-agent-config')
      : path.join(os.homedir(), '.ai-agent-config'));
  return path.join(home, 'acm-gui.pid');
}

function readPid(): number | null {
  try {
    const raw = fs.readFileSync(pidFilePath(), 'utf8').trim();
    const pid = Number(raw);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function healthCheck(
  timeoutMs = 2000
): Promise<{ ok: boolean; pid?: number; uptimeSec?: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`http://127.0.0.1:${DEFAULT_GUI_PORT}/api/health`, {
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false };
    const json = (await res.json()) as {
      ok?: boolean;
      data?: { pid?: number; uptimeSec?: number };
    };
    return {
      ok: Boolean(json.ok),
      pid: json.data?.pid,
      uptimeSec: json.data?.uptimeSec,
    };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

const formatUptime = (sec?: number) => {
  if (!sec && sec !== 0) return '';
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : m > 0 ? `${m}m ${sec % 60}s` : `${sec}s`;
};

program
  .command('gui')
  .alias('dashboard')
  .description('Run the configuration dashboard in the foreground (see also: agm start)')
  .option('-p, --port <port>', `Port to bind (default: ${DEFAULT_GUI_PORT})`)
  .option('--no-open', 'Do not open the browser automatically')
  .option('--dist <dir>', 'Path to the built GUI (dist) directory')
  .option('--pid-file <path>', 'Override where the dashboard records its pid')
  .option('--daemon', 'Internal: launched by `agm start`; output goes to the log file', false)
  .action(async (options) => {
    const { startGuiServer } = await import('./gui-server.js');
    const port = options.port ? Number(options.port) : undefined;
    if (port !== undefined && (Number.isNaN(port) || port <= 0 || port > 65535)) {
      printError(`Invalid port: ${options.port}`);
      process.exit(1);
    }

    printInfo('Starting configuration dashboard...');
    try {
      const handle = await startGuiServer(manager, {
        port,
        distDir: options.dist,
        openBrowser: options.open,
      });
      // Record our pid so `agm stop` can find us regardless of how we were launched.
      try {
        fs.mkdirSync(path.dirname(options.pidFile || pidFilePath()), {
          recursive: true,
        });
        fs.writeFileSync(options.pidFile || pidFilePath(), String(process.pid));
      } catch {
        /* non-fatal */
      }
      console.log();
      printSuccess(`Dashboard running at ${chalk.underline(handle.url)}`);
      printInfo(`Registry: ${chalk.cyan(`http://127.0.0.1:${handle.port} (see Settings)`)}`);
      printInfo('Press Ctrl+C to stop the server.');
      console.log();

      let closing = false;
      const shutdown = async () => {
        if (closing) return;
        closing = true;
        await handle.close();
        try {
          fs.rmSync(options.pidFile || pidFilePath());
        } catch {
          /* ignore */
        }
        process.exit(0);
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
      process.on('exit', () => {
        try {
          fs.rmSync(options.pidFile || pidFilePath());
        } catch {
          /* ignore */
        }
      });
    } catch (error) {
      printError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('start')
  .description('Start the configuration dashboard in the background on http://127.0.0.1:4321')
  .option('-p, --port <port>', `Port to bind (default: ${DEFAULT_GUI_PORT})`)
  .option('--dist <dir>', 'Path to the built GUI (dist) directory')
  .option('-f, --foreground', 'Run attached to this terminal instead of the background')
  .action(async (options) => {
    // Already up?
    const health = await healthCheck();
    if (health.ok) {
      printSuccess(
        `Dashboard already running at ${chalk.underline(`http://127.0.0.1:${DEFAULT_GUI_PORT}`)} (pid ${health.pid})`
      );
      return;
    }
    const stalePid = readPid();
    if (stalePid && !isAlive(stalePid)) {
      try {
        fs.rmSync(pidFilePath());
      } catch {
        /* ignore */
      }
    }

    const passthrough = [
      ...(options.port ? ['--port', String(options.port)] : []),
      ...(options.dist ? ['--dist', options.dist] : []),
      '--no-open',
    ];
    const binEntry = fileURLToPath(new URL('./bundle-entry.js', import.meta.url));

    if (options.foreground) {
      // Run `agm gui` attached to this terminal, without the browser pop-up.
      // Always relaunch through the bin entry so standalone installs (no
      // workspace symlink) get the vendored-core loader hooks.
      const child = spawn(process.execPath, [binEntry, 'gui', ...passthrough], {
        stdio: 'inherit',
      });
      child.on('exit', (code) => process.exit(code ?? 1));
      return;
    }

    // Detach: relaunch ourselves as `agm gui --daemon`, logs to a file.
    const logPath = path.join(path.dirname(pidFilePath()), 'acm-gui.log');
    const logFd = fs.openSync(logPath, 'a');
    const child = spawn(process.execPath, [binEntry, 'gui', '--daemon', ...passthrough], {
      detached: true,
      stdio: ['ignore', logFd, logFd],
    });
    child.unref();
    fs.closeSync(logFd);

    // Wait for the health probe so we only report success when it is real.
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 250));
      if ((await healthCheck(1000)).ok) {
        printSuccess(
          `Dashboard started at ${chalk.underline(`http://127.0.0.1:${DEFAULT_GUI_PORT}`)}`
        );
        printInfo(`Logs: ${chalk.cyan(logPath)} · stop it with ${chalk.cyan('agm stop')}`);
        return;
      }
      if (child.exitCode !== null || child.signalCode !== null) break;
    }
    printError(`Dashboard did not become healthy — check ${logPath}`);
    process.exit(1);
  });

program
  .command('stop')
  .description('Stop a backgrounded configuration dashboard')
  .action(async () => {
    const health = await healthCheck(1500);
    if (!health.ok) {
      const pid = readPid();
      if (pid && isAlive(pid)) {
        process.kill(pid, 'SIGTERM');
        printInfo(`Sent SIGTERM to pid ${pid} (it had not opened its health endpoint yet).`);
      } else {
        printInfo('Dashboard is not running.');
      }
      try {
        fs.rmSync(pidFilePath());
      } catch {
        /* ignore */
      }
      return;
    }

    const pid = health.pid ?? readPid();
    if (!pid || !isAlive(pid)) {
      printInfo('Dashboard is not running.');
      return;
    }
    process.kill(pid, 'SIGTERM');
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 250));
      if (!(await healthCheck(800)).ok) {
        printSuccess(`Dashboard stopped (pid ${pid}).`);
        return;
      }
    }
    printWarning(`Dashboard pid ${pid} did not stop within 5s — kill it manually.`);
    process.exit(1);
  });

program
  .command('health')
  .description(`Check whether the configuration dashboard is up on port ${DEFAULT_GUI_PORT}`)
  .action(async () => {
    const health = await healthCheck();
    if (health.ok) {
      const uptime = formatUptime(health.uptimeSec);
      printSuccess(
        `Healthy — http://127.0.0.1:${DEFAULT_GUI_PORT} (pid ${health.pid}${uptime ? `, up ${uptime}` : ''})`
      );
      return;
    }
    printError(
      `Not running — nothing answered on http://127.0.0.1:${DEFAULT_GUI_PORT}/api/health.`
    );
    printInfo(`Start it with ${chalk.cyan('agm start')}.`);
    process.exit(1);
  });

// ============================================================================
// Parse and Run
// ============================================================================

program.parseAsync(process.argv).catch(console.error);
