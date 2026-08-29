/**
 * Claude Code Adapter
 * Manages configuration for Anthropic's Claude Code CLI
 * Config file: ~/.claude/settings.json (JSON format)
 */

import { z } from 'zod';
import {
  type AgentAdapter,
  type AgentInfo,
  type AgentConfig,
  AgentCapabilities,
  type ModelProvider,
  type ModelConfig,
  type MCPServerConfig,
  type PermissionConfig,
  type Platform,
  OperationResult,
  ConfigFormat,
} from '../types';
import {
  resolveConfigPath,
  readFileSafe,
  writeFileSafe,
  parseConfig,
  stringifyConfig,
  validateAgentConfig,
  backupFile,
  restoreBackup,
  deepMerge,
} from '../utils';

// ============================================================================
// Claude Code Specific Types
// ============================================================================

interface ClaudeCodeSettings {
  autoUpdatesChannel?: 'latest' | 'stable';
  minimumVersion?: string;
  env?: Record<string, string>;
  mcpServers?: Record<string, MCPServerConfig>;
  enabledMcpServers?: string[];
  disabledMcpServers?: string[];
  permissions?: {
    allow?: string[];
    deny?: string[];
    ask?: string[];
  };
  model?: string;
  apiKeyHelper?: string;
  [key: string]: unknown;
}

// ============================================================================
// Adapter Implementation
// ============================================================================

export class ClaudeCodeAdapter implements AgentAdapter {
  readonly info: AgentInfo = {
    id: 'claude-code',
    name: 'Claude Code',
    description: "Anthropic's official CLI for Claude",
    configFormat: 'json',
    configPaths: {
      darwin: '~/.claude/settings.json',
      win32: '%USERPROFILE%\\.claude\\settings.json',
      linux: '~/.claude/settings.json',
    },
    binaries: ['claude', 'claude-code'],
    mcpConfigPaths: {
      darwin: '~/.claude/mcp.json',
      win32: '%USERPROFILE%\\.claude\\mcp.json',
      linux: '~/.claude/mcp.json',
    },
    modelConfigPaths: {
      darwin: ['~/.claude/settings.json'],
      win32: ['%USERPROFILE%\\.claude\\settings.json'],
      linux: ['~/.claude/settings.json'],
    },
    supports: {
      modelProviders: true,
      mcpServers: true,
      permissions: true,
      projectConfig: false, // Claude Code uses global config only
    },
  };

  private rawSettingsCache: ClaudeCodeSettings | null = null;
  private configCache: AgentConfig | null = null;
  private configPath = '';

  constructor() {
    this.configPath = this.getConfigPath();
  }

  getConfigPath(platform?: Platform): string {
    const template = this.info.configPaths[platform || (process.platform as Platform)];
    return resolveConfigPath(template);
  }

  getMCPConfigPath(platform?: Platform): string | null {
    const current = platform || (process.platform as Platform);
    const template = this.info.mcpConfigPaths?.[current];
    if (!template) return null;
    return resolveConfigPath(template, current);
  }

  // ============================================================================
  // Config File Operations
  // ============================================================================

  async readConfig(): Promise<AgentConfig> {
    const content = await readFileSafe(this.configPath);

    if (!content) {
      // Return default config if file doesn't exist
      const config = this.getDefaultConfig();
      this.configCache = config;
      return config;
    }

    try {
      const rawSettings = parseConfig(content, 'json') as ClaudeCodeSettings;
      const config = await this.transformFromClaudeCode(rawSettings);
      this.configCache = config;
      this.rawSettingsCache = rawSettings;
      return config;
    } catch (error) {
      throw new Error(`Failed to parse Claude Code config: ${error}`);
    }
  }

  async writeConfig(config: AgentConfig): Promise<void> {
    const validation = validateAgentConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid config: ${validation.errors.join(', ')}`);
    }

    // Safety net: keep a timestamped backup before touching the agent's file
    try {
      await backupFile(this.configPath);
    } catch {
      // Ignore backup failures (e.g. file doesn't exist yet)
    }

    const claudeSettings = this.transformToClaudeCode(config);
    const content = stringifyConfig(claudeSettings, 'json');
    await writeFileSafe(this.configPath, content);
    this.configCache = config;
    this.rawSettingsCache = claudeSettings;
  }

  validateConfig(config: unknown): { valid: boolean; errors: string[] } {
    return validateAgentConfig(config);
  }

  // ============================================================================
  // Transform Functions
  // ============================================================================

  private async transformFromClaudeCode(settings: ClaudeCodeSettings): Promise<AgentConfig> {
    const modelProviders: ModelProvider[] = [];
    const models: ModelConfig[] = [];
    const mcpServers: MCPServerConfig[] = [];
    const permissions: PermissionConfig[] = [];

    // Extract model providers from env
    if (settings.env) {
      // Anthropic (default)
      if (settings.env.ANTHROPIC_API_KEY || settings.env.ANTHROPIC_AUTH_TOKEN) {
        modelProviders.push({
          id: 'anthropic',
          name: 'Anthropic',
          type: 'anthropic',
          config: {
            apiKey: settings.env.ANTHROPIC_API_KEY || settings.env.ANTHROPIC_AUTH_TOKEN,
            baseUrl: settings.env.ANTHROPIC_BASE_URL,
          },
          enabled: true,
          priority: 0,
        });
      }

      // Bedrock
      if (settings.env.AWS_REGION || settings.env.AWS_PROFILE) {
        modelProviders.push({
          id: 'bedrock',
          name: 'AWS Bedrock',
          type: 'bedrock',
          config: {
            region: settings.env.AWS_REGION,
            profile: settings.env.AWS_PROFILE,
          },
          enabled: true,
          priority: 1,
        });
      }

      // Vertex AI
      if (settings.env.GOOGLE_CLOUD_PROJECT || settings.env.VERTEX_AI_PROJECT) {
        modelProviders.push({
          id: 'vertex',
          name: 'Google Vertex AI',
          type: 'vertex',
          config: {
            project: settings.env.GOOGLE_CLOUD_PROJECT || settings.env.VERTEX_AI_PROJECT,
            region: settings.env.VERTEX_AI_REGION,
          },
          enabled: true,
          priority: 2,
        });
      }

      // OpenAI-compatible
      if (settings.env.OPENAI_API_KEY && settings.env.OPENAI_API_BASE) {
        modelProviders.push({
          id: 'openai-compatible',
          name: 'OpenAI Compatible',
          type: 'openai-compatible',
          config: {
            apiKey: settings.env.OPENAI_API_KEY,
            baseUrl: settings.env.OPENAI_API_BASE,
          },
          enabled: true,
          priority: 3,
        });
      }
    }

    // Extract models from settings
    if (settings.model) {
      models.push({
        id: 'default',
        providerId: 'anthropic', // default assumption
        name: settings.model,
        displayName: settings.model,
        roles: ['chat', 'edit', 'apply', 'summarize'],
        capabilities: ['tool_use'],
      });
    }

    // Extract MCP servers
    if (settings.mcpServers) {
      for (const [name, server] of Object.entries(settings.mcpServers)) {
        mcpServers.push({
          ...server,
          name,
          enabled: !settings.disabledMcpServers?.includes(name),
        });
      }
    }

    // Merge MCP servers from ~/.claude/mcp.json (Claude Code also reads this file)
    const mcpConfigPath = this.configPath.replace(/settings\.json$/i, 'mcp.json');
    if (mcpConfigPath !== this.configPath) {
      const mcpContent = await readFileSafe(mcpConfigPath);
      if (mcpContent) {
        try {
          const rawMcp = parseConfig(mcpContent, 'json') as {
            mcpServers?: Record<string, MCPServerConfig>;
          };
          for (const [name, server] of Object.entries(rawMcp.mcpServers || {})) {
            if (!mcpServers.some((s) => s.name === name)) {
              mcpServers.push({ ...server, name, enabled: true });
            }
          }
        } catch {
          // Ignore malformed mcp.json - settings.json remains the source of truth
        }
      }
    }

    // Extract permissions
    if (settings.permissions) {
      let permId = 0;
      for (const pattern of settings.permissions.allow || []) {
        permissions.push({
          id: `allow-${permId++}`,
          type: 'tool',
          scope: 'global',
          allowed: true,
          pattern,
        });
      }
      for (const pattern of settings.permissions.deny || []) {
        permissions.push({
          id: `deny-${permId++}`,
          type: 'tool',
          scope: 'global',
          allowed: false,
          pattern,
        });
      }
    }

    return {
      version: '1.0.0',
      lastModified: Date.now(),
      modelProviders,
      models,
      mcpServers,
      permissions,
      customSettings: {
        autoUpdatesChannel: settings.autoUpdatesChannel,
        minimumVersion: settings.minimumVersion,
        apiKeyHelper: settings.apiKeyHelper,
      },
    };
  }

  private transformToClaudeCode(config: AgentConfig): ClaudeCodeSettings {
    // Start from the previously-read raw settings so unknown keys survive
    // (inputNeededNotifEnabled, agentPushNotifEnabled, etc.) and existing
    // env vars are preserved when providers don't map to them.
    const settings: ClaudeCodeSettings = this.rawSettingsCache
      ? (JSON.parse(JSON.stringify(this.rawSettingsCache)) as ClaudeCodeSettings)
      : { env: {} };

    // Build env from model providers (merge with existing, don't wipe)
    for (const provider of config.modelProviders) {
      if (!provider.enabled) continue;

      switch (provider.type) {
        case 'anthropic':
          if (provider.config.apiKey)
            settings.env!.ANTHROPIC_API_KEY = provider.config.apiKey as string;
          if (provider.config.baseUrl)
            settings.env!.ANTHROPIC_BASE_URL = provider.config.baseUrl as string;
          break;
        case 'bedrock':
          if (provider.config.region) settings.env!.AWS_REGION = provider.config.region as string;
          if (provider.config.profile)
            settings.env!.AWS_PROFILE = provider.config.profile as string;
          break;
        case 'vertex':
          if (provider.config.project)
            settings.env!.GOOGLE_CLOUD_PROJECT = provider.config.project as string;
          if (provider.config.region)
            settings.env!.VERTEX_AI_REGION = provider.config.region as string;
          break;
        case 'openai-compatible':
          if (provider.config.apiKey)
            settings.env!.OPENAI_API_KEY = provider.config.apiKey as string;
          if (provider.config.baseUrl)
            settings.env!.OPENAI_API_BASE = provider.config.baseUrl as string;
          break;
      }
    }

    // Build MCP servers (merge with existing, don't wipe unknown keys)
    const mcpServers: Record<string, unknown> = {
      ...(settings.mcpServers || {}),
    };
    for (const server of config.mcpServers) {
      const existing = mcpServers[server.name] as Record<string, unknown> | undefined;
      mcpServers[server.name] = {
        ...existing,
        ...server,
        name: server.name,
      };
    }
    settings.mcpServers = mcpServers as Record<string, MCPServerConfig>;

    // Preserve disabledMcpServers from the raw file (Claude Code's own list)
    // — don't rebuild it from the unified enabled state, which would clobber
    // servers the user disabled directly in Claude Code.
    if (!settings.disabledMcpServers) {
      settings.disabledMcpServers = [];
    }

    // Build permissions (merge with existing, don't wipe ask patterns)
    const existingPerms = settings.permissions || {
      allow: [],
      deny: [],
      ask: [],
    };
    const permissions = {
      allow: [...(existingPerms.allow || [])],
      deny: [...(existingPerms.deny || [])],
      ask: [...(existingPerms.ask || [])],
    };
    for (const perm of config.permissions) {
      if (perm.allowed) {
        if (!permissions.allow.includes(perm.pattern)) {
          permissions.allow.push(perm.pattern);
        }
      } else {
        if (!permissions.deny.includes(perm.pattern)) {
          permissions.deny.push(perm.pattern);
        }
      }
    }
    settings.permissions = permissions;

    // Set default model
    const defaultModel = config.models.find((m) => m.id === 'default') || config.models[0];
    if (defaultModel) {
      settings.model = defaultModel.name;
    }

    return settings;
  }

  private getDefaultConfig(): AgentConfig {
    return {
      version: '1.0.0',
      lastModified: Date.now(),
      modelProviders: [],
      models: [],
      mcpServers: [],
      permissions: [],
      customSettings: {
        autoUpdatesChannel: 'latest',
      },
    };
  }

  // ============================================================================
  // Model Provider Operations
  // ============================================================================

  listModelProviders(): ModelProvider[] {
    if (!this.configCache) {
      throw new Error('Config not loaded. Call readConfig() first.');
    }
    return this.configCache.modelProviders;
  }

  async addModelProvider(provider: ModelProvider): Promise<void> {
    const config = await this.readConfig();
    const existing = config.modelProviders.find((p) => p.id === provider.id);
    if (existing) {
      throw new Error(`Provider with id "${provider.id}" already exists`);
    }
    config.modelProviders.push(provider);
    config.lastModified = Date.now();
    await this.writeConfig(config);
  }

  async removeModelProvider(providerId: string): Promise<void> {
    const config = await this.readConfig();
    config.modelProviders = config.modelProviders.filter((p) => p.id !== providerId);
    // Also remove models using this provider
    config.models = config.models.filter((m) => m.providerId !== providerId);
    config.lastModified = Date.now();
    await this.writeConfig(config);
  }

  async updateModelProvider(providerId: string, updates: Partial<ModelProvider>): Promise<void> {
    const config = await this.readConfig();
    const index = config.modelProviders.findIndex((p) => p.id === providerId);
    if (index === -1) {
      throw new Error(`Provider with id "${providerId}" not found`);
    }
    config.modelProviders[index] = {
      ...config.modelProviders[index],
      ...updates,
    };
    config.lastModified = Date.now();
    await this.writeConfig(config);
  }

  // ============================================================================
  // Model Operations
  // ============================================================================

  listModels(): ModelConfig[] {
    if (!this.configCache) {
      throw new Error('Config not loaded. Call readConfig() first.');
    }
    return this.configCache.models;
  }

  async addModel(model: ModelConfig): Promise<void> {
    const config = await this.readConfig();
    const existing = config.models.find((m) => m.id === model.id);
    if (existing) {
      throw new Error(`Model with id "${model.id}" already exists`);
    }
    config.models.push(model);
    config.lastModified = Date.now();
    await this.writeConfig(config);
  }

  async removeModel(modelId: string): Promise<void> {
    const config = await this.readConfig();
    config.models = config.models.filter((m) => m.id !== modelId);
    config.lastModified = Date.now();
    await this.writeConfig(config);
  }

  async updateModel(modelId: string, updates: Partial<ModelConfig>): Promise<void> {
    const config = await this.readConfig();
    const index = config.models.findIndex((m) => m.id === modelId);
    if (index === -1) {
      throw new Error(`Model with id "${modelId}" not found`);
    }
    config.models[index] = { ...config.models[index], ...updates };
    config.lastModified = Date.now();
    await this.writeConfig(config);
  }

  // ============================================================================
  // MCP Server Operations
  // ============================================================================

  listMCPServers(): MCPServerConfig[] {
    if (!this.configCache) {
      throw new Error('Config not loaded. Call readConfig() first.');
    }
    return this.configCache.mcpServers;
  }

  async addMCPServer(server: MCPServerConfig): Promise<void> {
    const config = await this.readConfig();
    const existing = config.mcpServers.find((s) => s.name === server.name);
    if (existing) {
      throw new Error(`MCP server with name "${server.name}" already exists`);
    }
    config.mcpServers.push(server);
    config.lastModified = Date.now();
    await this.writeConfig(config);
  }

  async removeMCPServer(serverName: string): Promise<void> {
    const config = await this.readConfig();
    config.mcpServers = config.mcpServers.filter((s) => s.name !== serverName);
    config.lastModified = Date.now();
    await this.writeConfig(config);
  }

  async updateMCPServer(serverName: string, updates: Partial<MCPServerConfig>): Promise<void> {
    const config = await this.readConfig();
    const index = config.mcpServers.findIndex((s) => s.name === serverName);
    if (index === -1) {
      throw new Error(`MCP server with name "${serverName}" not found`);
    }
    config.mcpServers[index] = { ...config.mcpServers[index], ...updates };
    config.lastModified = Date.now();
    await this.writeConfig(config);
  }

  // ============================================================================
  // Permission Operations
  // ============================================================================

  listPermissions(): PermissionConfig[] {
    if (!this.configCache) {
      throw new Error('Config not loaded. Call readConfig() first.');
    }
    return this.configCache.permissions;
  }

  async addPermission(permission: PermissionConfig): Promise<void> {
    const config = await this.readConfig();
    const existing = config.permissions.find((p) => p.id === permission.id);
    if (existing) {
      throw new Error(`Permission with id "${permission.id}" already exists`);
    }
    config.permissions.push(permission);
    config.lastModified = Date.now();
    await this.writeConfig(config);
  }

  async removePermission(permissionId: string): Promise<void> {
    const config = await this.readConfig();
    config.permissions = config.permissions.filter((p) => p.id !== permissionId);
    config.lastModified = Date.now();
    await this.writeConfig(config);
  }

  async updatePermission(permissionId: string, updates: Partial<PermissionConfig>): Promise<void> {
    const config = await this.readConfig();
    const index = config.permissions.findIndex((p) => p.id === permissionId);
    if (index === -1) {
      throw new Error(`Permission with id "${permissionId}" not found`);
    }
    config.permissions[index] = { ...config.permissions[index], ...updates };
    config.lastModified = Date.now();
    await this.writeConfig(config);
  }

  // ============================================================================
  // Utility
  // ============================================================================

  async backupConfig(): Promise<string> {
    return backupFile(this.configPath);
  }

  async restoreConfig(backupPath: string): Promise<void> {
    await restoreBackup(backupPath, this.configPath);
    this.configCache = null; // Clear cache
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createClaudeCodeAdapter(): ClaudeCodeAdapter {
  return new ClaudeCodeAdapter();
}
