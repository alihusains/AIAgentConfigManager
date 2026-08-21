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
import { AgentConfigManager, ModelProvider, ModelConfig, MCPServerConfig, PermissionConfig } from '@ai-agent-config/core';

const manager = new AgentConfigManager();

program
  .name('ai-config')
  .description('AI Agent Configuration Manager - Manage models, providers, MCP servers, and permissions across AI coding agents')
  .version('0.1.0');

// ============================================================================
// Helper Functions
// ============================================================================

async function selectAgent(message: string = 'Select an agent:'): Promise<string | null> {
  const agents = manager.getAvailableAgents();
  if (agents.length === 0) {
    console.log(chalk.red('No agents available'));
    return null;
  }

  const { agentId } = await inquirer.prompt([{
    type: 'list',
    name: 'agentId',
    message,
    choices: agents.map(a => ({
      name: `${a.name} (${a.id})`,
      value: a.id,
    })),
  }]);

  return agentId;
}

/**
 * Multi-select for choosing target agents (used by "provider add").
 * Installed agents are listed first; uninstalled ones are still selectable
 * but clearly marked.
 */
async function selectTargetAgents(message: string = 'Select target agent(s):'): Promise<string[]> {
  const detected = await manager.detectAgents();
  if (detected.length === 0) {
    console.log(chalk.red('No agents available'));
    return [];
  }

  const sorted = [...detected].sort((a, b) => {
    if (a.detection.installed !== b.detection.installed) return a.detection.installed ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const { agentIds } = await inquirer.prompt([{
    type: 'checkbox',
    name: 'agentIds',
    message,
    choices: sorted.map(a => ({
      name: a.detection.installed
        ? `${a.name} (${a.id})`
        : `${a.name} (${a.id}) — not installed`,
      value: a.id,
      checked: a.detection.installed,
    })),
  }]);

  return agentIds as string[];
}

async function confirmAction(message: string): Promise<boolean> {
  const { confirmed } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirmed',
    message,
    default: false,
  }]);
  return confirmed;
}

function printTable(headers: string[], rows: string[][]): void {
  console.log(table([headers, ...rows], {
    header: { content: headers.join(' | ') },
    columns: headers.map(() => ({ alignment: 'left' as const })),
  }));
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

    const rows = agents.map(a => [
      a.id,
      a.name,
      a.detection.installed
        ? chalk.green('✓ installed')
        : chalk.gray('not found'),
      a.detection.version || '',
      a.configFormat,
      a.supports.modelProviders ? '✓' : '✗',
      a.supports.mcpServers ? '✓' : '✗',
    ]);

    printTable(['ID', 'Name', 'Status', 'Version', 'Format', 'Models', 'MCP'], rows);
  });

program
  .command('detect')
  .alias('scan')
  .description('Detect installed agent CLIs and their config files')
  .action(async () => {
    const spinner = ora('Scanning for agent CLIs...').start();
    const agents = await manager.detectAgents();
    spinner.stop();

    console.log(chalk.bold(`\nInstalled agent CLIs on this machine`));
    console.log(chalk.gray('─'.repeat(50)));

    for (const a of agents) {
      const status = a.detection.installed ? chalk.green('INSTALLED') : chalk.gray('not found');
      console.log(`\n${status}  ${chalk.bold(a.name)} (${a.id})`);
      if (a.detection.binaryPath) {
        console.log(`  binary:   ${a.detection.binaryPath}`);
      }
      if (a.detection.version) {
        console.log(`  version:  ${a.detection.version}`);
      }
      console.log(`  config:   ${a.detection.configExists ? chalk.green(manager.getConfigPath(a.id) || '') : chalk.gray('(no config file yet)')}`);
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
      const rows = config.modelProviders.map(p => [
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
      const rows = config.models.map(m => [
        m.id,
        m.providerId,
        m.name,
        m.roles.join(', '),
      ]);
      printTable(['ID', 'Provider', 'Name', 'Roles'], rows);
    }

    console.log(`\n${chalk.bold('MCP Servers:')}`);
    if (config.mcpServers.length === 0) {
      console.log('  (none)');
    } else {
      const rows = config.mcpServers.map(s => [
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
      const rows = config.permissions.map(p => [
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
    const providerId = options.id || (await inquirer.prompt([{
      type: 'input',
      name: 'id',
      message: 'Provider ID:',
      validate: v => v.length > 0 || 'Required',
    }])).id;

    const name = options.name || (await inquirer.prompt([{
      type: 'input',
      name: 'name',
      message: 'Provider name:',
      validate: v => v.length > 0 || 'Required',
    }])).name;

    const type = options.type || (await inquirer.prompt([{
      type: 'list',
      name: 'type',
      message: 'Provider type:',
      choices: ['anthropic', 'bedrock', 'vertex', 'openai-compatible'],
    }])).type;

    const config: Record<string, unknown> = {};
    
    if (type === 'anthropic' || type === 'openai-compatible') {
      config.apiKey = options.apiKey || (await inquirer.prompt([{
        type: 'password',
        name: 'apiKey',
        message: 'API Key:',
        mask: '*',
      }])).apiKey;
      config.baseUrl = options.baseUrl || (await inquirer.prompt([{
        type: 'input',
        name: 'baseUrl',
        message: 'Base URL (optional):',
      }])).baseUrl;
    } else if (type === 'bedrock') {
      config.region = options.region || (await inquirer.prompt([{
        type: 'input',
        name: 'region',
        message: 'AWS Region:',
      }])).region;
      config.profile = (await inquirer.prompt([{
        type: 'input',
        name: 'profile',
        message: 'AWS Profile (optional):',
      }])).profile;
    } else if (type === 'vertex') {
      config.project = options.project || (await inquirer.prompt([{
        type: 'input',
        name: 'project',
        message: 'Google Cloud Project:',
      }])).project;
      config.region = options.region || (await inquirer.prompt([{
        type: 'input',
        name: 'region',
        message: 'Region (optional):',
      }])).region;
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
      const modelIds = String(options.models).split(',').map(m => m.trim()).filter(Boolean);
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

    const spinner = ora(`Installing provider "${name}" into ${targetAgents.length} agent(s)...`).start();
    const result = await manager.installProvider(provider, models, targetAgents);
    spinner.stop();

    if (result.success) {
      printSuccess(`Provider "${name}" installed into: ${targetAgents.join(', ')}`);
      if (models.length > 0) {
        printSuccess(`Models added: ${models.map(m => m.name).join(', ')}`);
      }
    } else {
      printError(result.error || 'Failed to add provider');
      if (result.warnings) {
        result.warnings.forEach(w => printWarning(w));
      }
    }
  });

providerCmd
  .command('remove <agentId> <providerId>')
  .description('Remove a model provider')
  .action(async (agentId, providerId) => {
    if (!await confirmAction(`Remove provider "${providerId}"?`)) return;

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

    const rows = config.modelProviders.map(p => [
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

    const { modelId } = await inquirer.prompt([{
      type: 'input',
      name: 'modelId',
      message: 'Model ID:',
      validate: v => v.length > 0 || 'Required',
    }]);

    const { providerId } = await inquirer.prompt([{
      type: 'list',
      name: 'providerId',
      message: 'Provider:',
      choices: config.modelProviders.map(p => ({ name: p.name, value: p.id })),
    }]);

    const { name } = await inquirer.prompt([{
      type: 'input',
      name: 'name',
      message: 'Model name (e.g., gpt-4, claude-3-opus):',
      validate: v => v.length > 0 || 'Required',
    }]);

    const { displayName } = await inquirer.prompt([{
      type: 'input',
      name: 'displayName',
      message: 'Display name:',
      default: name,
    }]);

    const { roles } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'roles',
      message: 'Roles:',
      choices: ['chat', 'edit', 'apply', 'summarize', 'autocomplete', 'embed', 'rerank'].map(r => ({ name: r, value: r })),
      default: ['chat', 'edit', 'apply', 'summarize'],
    }]);

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
    if (!await confirmAction(`Remove model "${modelId}"?`)) return;

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

    const rows = config.models.map(m => [
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

    const { name } = await inquirer.prompt([{
      type: 'input',
      name: 'name',
      message: 'Server name:',
      validate: v => v.length > 0 || 'Required',
    }]);

    const { type } = await inquirer.prompt([{
      type: 'list',
      name: 'type',
      message: 'Server type:',
      choices: ['stdio', 'http', 'streamable-http'],
    }]);

    const server: Partial<MCPServerConfig> = {
      name,
      type: type as MCPServerConfig['type'],
      enabled: true,
    };

    if (type === 'stdio') {
      const { command } = await inquirer.prompt([{
        type: 'input',
        name: 'command',
        message: 'Command:',
        validate: v => v.length > 0 || 'Required',
      }]);
      const { args } = await inquirer.prompt([{
        type: 'input',
        name: 'args',
        message: 'Arguments (space-separated):',
        default: '',
      }]);
      server.command = command;
      server.args = args.split(' ').filter(Boolean);
      const { env } = await inquirer.prompt([{
        type: 'input',
        name: 'env',
        message: 'Environment variables (KEY=VAL,KEY=VAL):',
      }]);
      if (env) {
        server.env = {};
        for (const pair of env.split(',')) {
          const [k, v] = pair.split('=');
          if (k && v) server.env![k.trim()] = v.trim();
        }
      }
    } else {
      const { url } = await inquirer.prompt([{
        type: 'input',
        name: 'url',
        message: 'Server URL:',
        validate: v => v.length > 0 || 'Required',
      }]);
      server.url = url;
      const { headers } = await inquirer.prompt([{
        type: 'input',
        name: 'headers',
        message: 'Headers (KEY=VAL,KEY=VAL):',
      }]);
      if (headers) {
        server.headers = {};
        for (const pair of headers.split(',')) {
          const [k, v] = pair.split('=');
          if (k && v) server.headers![k.trim()] = v.trim();
        }
      }
    }

    const { approvalMode } = await inquirer.prompt([{
      type: 'list',
      name: 'approvalMode',
      message: 'Approval mode:',
      choices: ['prompt', 'auto', 'never'],
      default: 'prompt',
    }]);
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
    if (!await confirmAction(`Remove MCP server "${serverName}"?`)) return;

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

    const rows = config.mcpServers.map(s => [
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

    const { type } = await inquirer.prompt([{
      type: 'list',
      name: 'type',
      message: 'Permission type:',
      choices: ['tool', 'directory', 'url', 'command', 'mcp', 'custom'],
    }]);

    const { scope } = await inquirer.prompt([{
      type: 'list',
      name: 'scope',
      message: 'Scope:',
      choices: ['global', 'project'],
    }]);

    let projectPath: string | undefined;
    if (scope === 'project') {
      const { path } = await inquirer.prompt([{
        type: 'input',
        name: 'path',
        message: 'Project path:',
        validate: v => v.length > 0 || 'Required',
      }]);
      projectPath = path;
    }

    const { allowed } = await inquirer.prompt([{
      type: 'list',
      name: 'allowed',
      message: 'Action:',
      choices: [
        { name: 'Allow', value: true },
        { name: 'Deny', value: false },
      ],
    }]);

    const { pattern } = await inquirer.prompt([{
      type: 'input',
      name: 'pattern',
      message: 'Pattern (tool name, path, URL, command):',
      validate: v => v.length > 0 || 'Required',
    }]);

    const { description } = await inquirer.prompt([{
      type: 'input',
      name: 'description',
      message: 'Description (optional):',
    }]);

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
    if (!await confirmAction(`Remove permission "${permissionId}"?`)) return;

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

    const rows = config.permissions.map(p => [
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
      const { providerId } = await inquirer.prompt([{
        type: 'input',
        name: 'providerId',
        message: 'Provider ID:',
      }]);
      const { name } = await inquirer.prompt([{
        type: 'input',
        name: 'name',
        message: 'Provider name:',
      }]);
      const { type } = await inquirer.prompt([{
        type: 'list',
        name: 'type',
        message: 'Provider type:',
        choices: ['anthropic', 'bedrock', 'vertex', 'openai-compatible'],
      }]);

      const config: Record<string, unknown> = {};
      if (type === 'anthropic' || type === 'openai-compatible') {
        const { apiKey } = await inquirer.prompt([{
          type: 'password',
          name: 'apiKey',
          message: 'API Key:',
          mask: '*',
        }]);
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
          result.warnings.forEach(w => printWarning(w));
        }
      }
    }

    if (options.mcp) {
      // Add MCP to all
      const { name } = await inquirer.prompt([{
        type: 'input',
        name: 'name',
        message: 'Server name:',
      }]);
      const { type } = await inquirer.prompt([{
        type: 'list',
        name: 'type',
        message: 'Server type:',
        choices: ['stdio', 'http', 'streamable-http'],
      }]);

      const server: Partial<MCPServerConfig> = { name, type: type as MCPServerConfig['type'], enabled: true };
      
      if (type === 'stdio') {
        const { command } = await inquirer.prompt([{ type: 'input', name: 'command', message: 'Command:' }]);
        const { args } = await inquirer.prompt([{ type: 'input', name: 'args', message: 'Arguments:' }]);
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
          result.warnings.forEach(w => printWarning(w));
        }
      }
    }

    if (options.permission) {
      // Add permission to all
      const { type } = await inquirer.prompt([{
        type: 'list',
        name: 'type',
        message: 'Permission type:',
        choices: ['tool', 'directory', 'url', 'command', 'mcp', 'custom'],
      }]);
      const { allowed } = await inquirer.prompt([{
        type: 'list',
        name: 'allowed',
        message: 'Action:',
        choices: [{ name: 'Allow', value: true }, { name: 'Deny', value: false }],
      }]);
      const { pattern } = await inquirer.prompt([{
        type: 'input',
        name: 'pattern',
        message: 'Pattern:',
      }]);

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
          result.warnings.forEach(w => printWarning(w));
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
    if (!await confirmAction(`Restore config from "${backupPath}"?`)) return;

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
// GUI Dashboard
// ============================================================================

program
  .command('gui')
  .alias('dashboard')
  .description('Open the configuration dashboard in your browser (local server)')
  .option('-p, --port <port>', 'Preferred port (random conflict-free port used by default)')
  .option('--no-open', 'Do not open the browser automatically')
  .option('--dist <dir>', 'Path to the built GUI (dist) directory')
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
      console.log();
      printSuccess(`Dashboard running at ${chalk.underline(handle.url)}`);
      printInfo(`Registry: ${chalk.cyan(handle.url.split('/?t=')[0] + ' (see Settings)')}`);
      printInfo('Press Ctrl+C to stop the server.');
      console.log();

      let closing = false;
      const shutdown = async () => {
        if (closing) return;
        closing = true;
        await handle.close();
        process.exit(0);
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    } catch (error) {
      printError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// ============================================================================
// Parse and Run
// ============================================================================

program.parseAsync(process.argv).catch(console.error);