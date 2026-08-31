/**
 * OpenCode-style Adapter
 * Manages configuration for OpenCode CLI ("code") and MIMO CLI (mimocode).
 *
 * Both agents share the exact same config schema (MIMO is an OpenCode fork):
 *   - OpenCode:  ~/.config/opencode/opencode.json
 *   - MIMO:      ~/.config/mimocode/mimocode.jsonc
 *
 * Schema (JSONC):
 * {
 *   "$schema": "...",
 *   "provider": {
 *     "<id>": {
 *       "name": "Provider Name",
 *       "env": ["API_KEY_ENV_VAR"],
 *       "npm": "@ai-sdk/openai-compatible",
 *       "options": { "baseURL": "https://...", "apiKey": "...", "headers": {} },
 *       "models": {
 *         "<modelId>": { "name": "Model Name", "limit": {...}, ... }
 *       }
 *     }
 *   },
 *   "model": "<default model id>",
 *   "small_model": "<small model id>",
 *   "disabled_providers": ["<id>"],
 *   "mcp": {
 *     "<name>": {
 *       "type": "local" | "remote" | "sse",
 *       "command": ["npx", "-y", "pkg"],
 *       "url": "https://...",
 *       "enabled": true,
 *       "environmentVariables": {},
 *       "headers": {}
 *     }
 *   }
 * }
 */

import type {
  AgentAdapter,
  AgentInfo,
  AgentConfig,
  ModelProvider,
  ModelConfig,
  MCPServerConfig,
  PermissionConfig,
  Platform,
  ConfigFormat,
  RegistryProvider,
} from '../types';
import {
  resolveConfigPath,
  readFileSafe,
  writeFileSafe,
  parseConfig,
  stringifyConfig,
  validateAgentConfig,
  backupFile,
} from '../utils';

// ============================================================================
// OpenCode/MIMO Specific Types
// ============================================================================

interface OpenCodeStyleOptions {
  baseURL?: string;
  apiKey?: string;
  headers?: Record<string, string>;
  [key: string]: unknown;
}

interface OpenCodeStyleModel {
  name?: string;
  attachment?: boolean;
  limit?: { context?: number; output?: number };
  modalities?: { input?: string[]; output?: string[] };
  reasoning?: Record<string, unknown>;
  [key: string]: unknown;
}

interface OpenCodeStyleProvider {
  name?: string;
  env?: string[];
  npm?: string;
  options?: OpenCodeStyleOptions;
  models?: Record<string, OpenCodeStyleModel>;
  [key: string]: unknown;
}

interface OpenCodeStyleMCPServer {
  type?: 'local' | 'remote' | 'http' | 'sse';
  command?: string[];
  url?: string;
  enabled?: boolean;
  environmentVariables?: Record<string, string>;
  headers?: Record<string, string>;
  tools?: string[];
  [key: string]: unknown;
}

interface OpenCodeStyleConfig {
  $schema?: string;
  provider?: Record<string, OpenCodeStyleProvider>;
  model?: string;
  small_model?: string;
  disabled_providers?: string[];
  mcp?: Record<string, OpenCodeStyleMCPServer>;
  [key: string]: unknown;
}

// ============================================================================
// Adapter Implementation (parameterized for OpenCode and MIMO)
// ============================================================================

export class OpenCodeStyleAdapter implements AgentAdapter {
  readonly info: AgentInfo;
  protected configPath: string;
  protected configCache: AgentConfig | null = null;
  protected rawCache: OpenCodeStyleConfig | null = null;
  private readonly isMimo: boolean;

  constructor(options: {
    id: string;
    name: string;
    description: string;
    binaries: string[];
    configPaths: Record<Platform, string>;
    isMimo?: boolean;
  }) {
    this.isMimo = Boolean(options.isMimo);
    this.info = {
      id: options.id,
      name: options.name,
      description: options.description,
      configFormat: 'jsonc' as ConfigFormat,
      configPaths: options.configPaths,
      // MCP servers live inside the main config (`mcp` key) for this family
      mcpConfigPaths: { ...options.configPaths },
      modelConfigPaths: {
        darwin: [options.configPaths.darwin],
        win32: [options.configPaths.win32],
        linux: [options.configPaths.linux],
      },
      binaries: options.binaries,
      supports: {
        modelProviders: true,
        mcpServers: true,
        permissions: false,
        projectConfig: false,
      },
    };
    this.configPath = this.getConfigPath();
  }

  getConfigPath(platform?: Platform): string {
    const current = platform || this.detectPlatform();
    const template = this.info.configPaths[current] || this.info.configPaths.darwin;
    return resolveConfigPath(template);
  }

  /** MCP servers live inside the main config file for this family. */
  getMCPConfigPath(platform?: Platform): string | null {
    return this.getConfigPath(platform);
  }

  private detectPlatform(): Platform {
    if (typeof process !== 'undefined' && process.platform) {
      const p = process.platform;
      if (p === 'darwin') return 'darwin';
      if (p === 'win32') return 'win32';
      return 'linux';
    }
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent;
      if (/Mac/i.test(ua)) return 'darwin';
      if (/Windows/i.test(ua)) return 'win32';
      return 'linux';
    }
    return 'darwin';
  }

  // ============================================================================
  // Config File Operations
  // ============================================================================

  async readConfig(): Promise<AgentConfig> {
    const content = await readFileSafe(this.configPath);

    if (!content) {
      const config = this.getDefaultConfig();
      this.configCache = config;
      this.rawCache = null;
      return config;
    }

    try {
      const raw = parseConfig(content, 'jsonc') as OpenCodeStyleConfig;
      const config = this.transformFromRaw(raw);
      this.configCache = config;
      this.rawCache = raw;
      return config;
    } catch (error) {
      throw new Error(`Failed to parse ${this.info.name} config: ${error}`);
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

    const raw = this.transformToRaw(config);
    const content = stringifyConfig(raw, 'jsonc');
    await writeFileSafe(this.configPath, content);
    this.configCache = config;
    this.rawCache = raw;
  }

  validateConfig(config: unknown): { valid: boolean; errors: string[] } {
    return validateAgentConfig(config);
  }

  // ============================================================================
  // Transform Functions
  // ============================================================================

  private transformFromRaw(raw: OpenCodeStyleConfig): AgentConfig {
    const modelProviders: ModelProvider[] = [];
    const models: ModelConfig[] = [];
    const mcpServers: MCPServerConfig[] = [];
    const disabled = new Set(raw.disabled_providers || []);

    const providers = raw.provider || {};
    let priority = 0;
    for (const [id, entry] of Object.entries(providers)) {
      const options = entry.options || {};
      modelProviders.push({
        id,
        name: entry.name || id,
        type: 'openai-compatible',
        config: {
          baseUrl: options.baseURL,
          apiKey: options.apiKey,
          npm: entry.npm,
          env: entry.env,
          headers: options.headers,
          options: options,
        },
        enabled: !disabled.has(id),
        priority: priority++,
      });

      // Models declared under this provider
      for (const [modelId, modelEntry] of Object.entries(entry.models || {})) {
        const { name: displayName, ...rest } = modelEntry;
        models.push({
          id: modelId,
          providerId: id,
          name: modelId,
          displayName: displayName || modelId,
          roles: ['chat', 'edit', 'apply', 'summarize'],
          customOptions: {
            ...rest,
            ...(modelEntry.limit ? { limit: modelEntry.limit } : {}),
          },
        });
      }
    }

    for (const [name, server] of Object.entries(raw.mcp || {})) {
      if (server.command?.length) {
        const [command, ...args] = server.command;
        mcpServers.push({
          name,
          type: 'stdio',
          command,
          args,
          env: server.environmentVariables,
          enabled: server.enabled !== false,
          tools: server.tools,
        });
      } else if (server.url) {
        mcpServers.push({
          name,
          type: server.type === 'sse' ? 'sse' : 'http',
          url: server.url,
          headers: server.headers,
          env: server.environmentVariables,
          enabled: server.enabled !== false,
          tools: server.tools,
        });
      }
    }

    return {
      version: '1.0.0',
      lastModified: Date.now(),
      modelProviders,
      models,
      mcpServers,
      permissions: [] as PermissionConfig[],
      customSettings: {
        model: raw.model,
        smallModel: raw.small_model,
      },
    };
  }

  private transformToRaw(config: AgentConfig): OpenCodeStyleConfig {
    // Start from the previously-read raw config so unknown keys survive
    const raw: OpenCodeStyleConfig = this.rawCache ? JSON.parse(JSON.stringify(this.rawCache)) : {};

    const providers: Record<string, OpenCodeStyleProvider> = {};
    for (const provider of config.modelProviders) {
      const existing: OpenCodeStyleProvider | undefined = raw.provider?.[provider.id];
      const existingOptions = existing?.options || {};
      const baseURL = (provider.config.baseUrl as string) || existingOptions.baseURL;
      const apiKey = provider.config.apiKey as string | undefined;

      const entry: OpenCodeStyleProvider = {
        // The provider's own name always wins so a rename via
        // updateModelProvider persists. (An unchanged on-disk name is
        // preserved because transformFromRaw reads it back into provider.name.)
        name: provider.name,
        env: existing?.env || [this.deriveEnvVar(provider.name || provider.id)],
        npm:
          existing?.npm ||
          (provider.config.npm as string | undefined) ||
          '@ai-sdk/openai-compatible',
        options: {
          ...existingOptions,
          ...(baseURL ? { baseURL } : {}),
          ...(apiKey ? { apiKey: apiKey } : {}),
        },
      };

      // Models for this provider
      const modelMap: Record<string, OpenCodeStyleModel> = {};
      for (const model of config.models) {
        if (model.providerId !== provider.id) continue;
        const existingModel = existing?.models?.[model.id] || {};
        modelMap[model.id] = {
          name: existingModel.name || model.name || model.id,
          ...existingModel,
          ...(model.customOptions as Record<string, unknown>),
        };
      }
      if (Object.keys(modelMap).length > 0) {
        entry.models = modelMap;
      }
      providers[provider.id] = entry;
    }

    const mcp: Record<string, OpenCodeStyleMCPServer> = {};
    for (const server of config.mcpServers) {
      const existing = raw.mcp?.[server.name] || ({} as OpenCodeStyleMCPServer);
      if (server.type === 'stdio' && server.command) {
        mcp[server.name] = {
          ...existing,
          type: existing.type || 'local',
          command: [server.command, ...(server.args || [])],
          ...(server.env ? { environmentVariables: server.env } : {}),
          enabled: server.enabled,
          ...(server.tools ? { tools: server.tools } : {}),
        };
      } else if (server.url) {
        mcp[server.name] = {
          ...existing,
          type: server.type === 'sse' ? 'sse' : 'remote',
          url: server.url,
          ...(server.headers ? { headers: server.headers } : {}),
          ...(server.env ? { environmentVariables: server.env } : {}),
          enabled: server.enabled,
          ...(server.tools ? { tools: server.tools } : {}),
        };
      } else if (Object.keys(existing).length > 0) {
        // No expressible fields for this server but it exists on disk —
        // keep the entry untouched (e.g. a server the tool owns itself).
        mcp[server.name] = { ...existing };
      }
    }

    const next: OpenCodeStyleConfig = {
      ...raw,
      provider: providers,
      mcp,
      model: (config.customSettings.model as string) || raw.model,
      small_model: (config.customSettings.smallModel as string) || raw.small_model,
    };

    // Recompute disabled providers from unified state
    const disabled = config.modelProviders.filter((p) => !p.enabled).map((p) => p.id);
    if (disabled.length > 0) {
      next.disabled_providers = disabled;
    } else {
      delete next.disabled_providers;
    }

    return next;
  }

  private deriveEnvVar(name: string): string {
    const cleaned = name
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase();
    return `${cleaned || 'PROVIDER'}_API_KEY`;
  }

  /**
   * When live verification confirmed the Anthropic Messages API on this
   * gateway, also expose the provider through Anthropic's wire: a sibling
   * `<id>-anthropic` provider block backed by @ai-sdk/anthropic (the `npm`
   * key is exactly how OpenCode picks the adapter). Models are mirrored so
   * users can pick either protocol per model, e.g. "b.ai/deepseek-v4-flash"
   * and "b.ai-anthropic/deepseek-v4-flash".
   */
  deriveAlternateProviders(entry: RegistryProvider): {
    provider: ModelProvider;
    models: ModelConfig[];
  }[] {
    const caps = entry.apiCapabilities;
    if (!caps || !caps.supported.includes('anthropic')) return [];
    if (entry.provider.type !== 'openai-compatible') return [];
    if (entry.models.length === 0) return [];
    const id = `${entry.provider.id}-anthropic`;
    return [
      {
        provider: {
          ...entry.provider,
          id,
          name: `${entry.provider.name} · Anthropic`,
          config: { ...entry.provider.config, npm: '@ai-sdk/anthropic' },
        },
        models: entry.models.map((m) => ({ ...m, providerId: id })),
      },
    ];
  }

  private getDefaultConfig(): AgentConfig {
    return {
      version: '1.0.0',
      lastModified: Date.now(),
      modelProviders: [],
      models: [],
      mcpServers: [],
      permissions: [],
      customSettings: {},
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
    // A rename must not silently collide with another provider's name.
    if (updates.name && updates.name !== config.modelProviders[index].name) {
      const clash = config.modelProviders.find(
        (p) => p.id !== providerId && p.name === updates.name
      );
      if (clash) {
        throw new Error(`Provider with name "${updates.name}" already exists`);
      }
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
    const existing = config.models.find(
      (m) => m.id === model.id && m.providerId === model.providerId
    );
    if (existing) {
      throw new Error(`Model "${model.id}" already exists under provider "${model.providerId}"`);
    }
    config.models.push(model);
    config.lastModified = Date.now();
    await this.writeConfig(config);
  }

  async removeModel(modelId: string, providerId?: string): Promise<void> {
    const config = await this.readConfig();
    // Models are keyed by (id, providerId). When providerId is supplied, match
    // on both so a duplicate id under another provider is not removed.
    config.models = config.models.filter(
      (m) => !(m.id === modelId && (providerId === undefined || m.providerId === providerId)),
    );
    config.lastModified = Date.now();
    await this.writeConfig(config);
  }

  async updateModel(
    modelId: string,
    updates: Partial<ModelConfig>,
    providerId?: string,
  ): Promise<void> {
    const config = await this.readConfig();
    const index = config.models.findIndex(
      (m) => m.id === modelId && (providerId === undefined || m.providerId === providerId),
    );
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
  // Permission Operations (not supported by this config schema)
  // ============================================================================

  listPermissions(): PermissionConfig[] {
    return this.configCache?.permissions || [];
  }

  async addPermission(): Promise<void> {
    throw new Error(`${this.info.name} does not support permission rules in its config`);
  }

  async removePermission(): Promise<void> {
    throw new Error(`${this.info.name} does not support permission rules in its config`);
  }

  async updatePermission(): Promise<void> {
    throw new Error(`${this.info.name} does not support permission rules in its config`);
  }

  // ============================================================================
  // Utility
  // ============================================================================

  async backupConfig(): Promise<string> {
    return backupFile(this.configPath);
  }

  async restoreConfig(backupPath: string): Promise<void> {
    const content = await readFileSafe(backupPath);
    if (!content) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }
    await writeFileSafe(this.configPath, content);
    this.configCache = null;
    this.rawCache = null;
  }
}

// ============================================================================
// Factories
// ============================================================================

export function createOpenCodeAdapter(): OpenCodeStyleAdapter {
  return new OpenCodeStyleAdapter({
    id: 'opencode',
    name: 'Code (OpenCode)',
    description: 'OpenCode CLI - open-source AI coding agent ("code" command)',
    binaries: ['opencode', 'oc'],
    configPaths: {
      darwin: '~/.config/opencode/opencode.json',
      win32: '%APPDATA%\\opencode\\opencode.json',
      linux: '~/.config/opencode/opencode.json',
    },
  });
}

export function createMimoAdapter(): OpenCodeStyleAdapter {
  return new OpenCodeStyleAdapter({
    id: 'mimo',
    name: 'MIMO',
    description: 'MIMO CLI (mimocode) - AI coding agent with project-local config',
    binaries: ['mimo'],
    isMimo: true,
    configPaths: {
      darwin: '~/.config/mimocode/mimocode.jsonc',
      win32: '%APPDATA%\\mimocode\\mimocode.jsonc',
      linux: '~/.config/mimocode/mimocode.jsonc',
    },
  });
}
