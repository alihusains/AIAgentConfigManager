/**
 * Crush Adapter (Charm)
 *
 * Crush (https://github.com/charmbracelet/crush) keeps its config at:
 *   - macOS/Linux: ~/.config/crush/crush.json   (JSON)
 *   - Windows:     %APPDATA%\crush\crush.json
 *
 * MCP servers live INSIDE crush.json under the `mcp` key (singular, NOT
 * `mcpServers`) as a KEYED map — server name is the map key. Verified against
 * the Go source (internal/config/config.go: `type MCPs map[string]MCPConfig`):
 *
 *   {
 *     "mcp": {
 *       "github": {
 *         "command": "npx",
 *         "args": ["-y", "@modelcontextprotocol/server-github"],
 *         "env": { "GITHUB_TOKEN": "..." }
 *       },
 *       "remote": {
 *         "url": "https://example.com/mcp"
 *       }
 *     }
 *   }
 *
 * This adapter reads/writes crush.json, preserving all other keys (theme,
 * models, etc.). The MCP key is `mcp`, so it cannot use the generic
 * `mcpServers`-keyed adapter.
 *
 * Model providers ARE file-configurable (JSON schema: https://charm.land/crush.json):
 *
 *   {
 *     "$schema": "https://charm.land/crush.json",
 *     "providers": {
 *       "my-gateway": {
 *         "id": "my-gateway",
 *         "name": "My Gateway",
 *         "type": "openai-compat",       // openai-compat | openai | anthropic |
 *                                        // ollama | litellm | google-vertex …
 *         "base_url": "https://gateway.example.com/v1",
 *         "api_key": "$MY_GATEWAY_API_KEY",  // literal or $VAR / $(cmd) —
 *                                            // expanded by crush at load time
 *         "models": [
 *           { "id": "my-model", "name": "My Model",
 *             "context_window": 128000, "default_max_tokens": 8192 }
 *         ]
 *       }
 *     }
 *   }
 *
 * Note: crush.json is still read by current versions but the newer `crushrc`
 * bash-like format is preferred upstream; this adapter only ever writes the
 * JSON form (safe for both). A missing "$schema" key is added on write.
 *
 * Source: https://github.com/charmbracelet/crush
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

const CRUSH_CONFIG_PATHS = {
  darwin: '~/.config/crush/crush.json',
  win32: '%APPDATA%\\crush\\crush.json',
  linux: '~/.config/crush/crush.json',
} as const;

/** A single Crush MCP entry on disk (keyed under `mcp`). */
interface CrushMCP {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  type?: string;
  [key: string]: unknown;
}

export class CrushAdapter implements AgentAdapter {
  readonly info: AgentInfo = {
    id: 'crush',
    name: 'Crush',
    description: 'Crush — Charm’s terminal coding agent (MCP via mcp map in crush.json).',
    configFormat: 'json' as ConfigFormat,
    configPaths: { ...CRUSH_CONFIG_PATHS },
    binaries: ['crush'],
    // MCP servers live inside crush.json under the `mcp` key
    mcpConfigPaths: { ...CRUSH_CONFIG_PATHS },
    modelConfigPaths: {
      darwin: [CRUSH_CONFIG_PATHS.darwin],
      win32: [CRUSH_CONFIG_PATHS.win32],
      linux: [CRUSH_CONFIG_PATHS.linux],
    },
    supports: {
      modelProviders: true,
      mcpServers: true,
      permissions: false,
      projectConfig: false,
    },
  };

  protected configCache: AgentConfig | null = null;
  protected rawCache: Record<string, unknown> | null = null;

  private detectPlatform(): Platform {
    if (typeof process !== 'undefined' && process.platform) {
      const p = process.platform;
      if (p === 'darwin') return 'darwin';
      if (p === 'win32') return 'win32';
      return 'linux';
    }
    return 'darwin';
  }

  private configPathFor(platform?: Platform): string {
    const current = platform || this.detectPlatform();
    return resolveConfigPath(CRUSH_CONFIG_PATHS[current] || CRUSH_CONFIG_PATHS.darwin);
  }

  getConfigPath(platform?: Platform): string {
    return this.configPathFor(platform);
  }

  getMCPConfigPath(platform?: Platform): string | null {
    return this.configPathFor(platform);
  }

  // ============================================================================
  // Config File Operations
  // ============================================================================

  async readConfig(): Promise<AgentConfig> {
    const content = await readFileSafe(this.configPathFor());
    this.rawCache = null;

    let mcpServers: MCPServerConfig[] = [];
    let modelProviders: ModelProvider[] = [];
    let models: ModelConfig[] = [];
    if (content) {
      try {
        const raw = parseConfig(content, 'json') as Record<string, unknown> | null;
        this.rawCache = raw && typeof raw === 'object' ? raw : {};
        mcpServers = this.decodeMCPRaw(this.rawCache.mcp);
        ({ modelProviders, models } = this.decodeProvidersRaw(this.rawCache));
      } catch {
        this.rawCache = {};
      }
    }

    const config: AgentConfig = {
      version: '1.0.0',
      lastModified: Date.now(),
      modelProviders,
      models,
      mcpServers,
      permissions: [] as PermissionConfig[],
      customSettings: {},
    };
    this.configCache = config;
    return config;
  }

  async writeConfig(config: AgentConfig): Promise<void> {
    const validation = validateAgentConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid config: ${validation.errors.join(', ')}`);
    }

    const raw: Record<string, unknown> = this.rawCache
      ? JSON.parse(JSON.stringify(this.rawCache))
      : {};
    raw.mcp = this.encodeMCP(config.mcpServers);
    this.encodeProvidersRaw(raw, config.modelProviders, config.models);
    await backupFile(this.configPathFor()).catch(() => undefined);
    await writeFileSafe(this.configPathFor(), stringifyConfig(raw, 'json'));
    this.rawCache = raw;
    this.configCache = config;
  }

  validateConfig(config: unknown): { valid: boolean; errors: string[] } {
    return validateAgentConfig(config);
  }

  /**
   * Drift projection: crush.json providers express base_url/api_key/type.
   * crushType bookkeeping is not drift.
   */
  expressibleProviderConfig = (config: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    if (config.baseUrl !== undefined) out.baseUrl = config.baseUrl;
    if (config.apiKey !== undefined) out.apiKey = config.apiKey;
    if (config.wireApi !== undefined) out.wireApi = config.wireApi;
    return out;
  };

  // ============================================================================
  // Provider shape conversion (unified <-> `providers` keyed map)
  // ============================================================================

  private isRecordValue(v: unknown): v is Record<string, unknown> {
    return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
  }

  private decodeProvidersRaw(raw: Record<string, unknown>): {
    modelProviders: ModelProvider[];
    models: ModelConfig[];
  } {
    const providersRaw = this.isRecordValue(raw.providers) ? raw.providers : {};
    const modelProviders: ModelProvider[] = [];
    const models: ModelConfig[] = [];
    for (const [key, entry] of Object.entries(providersRaw)) {
      if (!this.isRecordValue(entry)) continue;
      const type = typeof entry.type === 'string' ? entry.type : 'openai-compat';
      const unifiedType = type === 'anthropic' ? 'anthropic' : 'openai-compatible';
      modelProviders.push({
        id: key,
        name: typeof entry.name === 'string' ? entry.name : key,
        type: unifiedType,
        enabled: true,
        priority: 0,
        config: {
          ...(typeof entry.base_url === 'string' ? { baseUrl: entry.base_url } : {}),
          // Raw value: literal, $VAR or $(cmd) — crush expands it at load.
          ...(typeof entry.api_key === 'string' ? { apiKey: entry.api_key } : {}),
          ...(type !== 'openai-compat' && type !== 'openai' && type !== 'anthropic'
            ? { crushType: type }
            : {}),
          ...(type === 'openai' ? { wireApi: 'responses' } : {}),
        },
      } as ModelProvider);
      if (Array.isArray(entry.models)) {
        for (const m of entry.models) {
          if (!this.isRecordValue(m)) continue;
          const id = typeof m.id === 'string' ? m.id : '';
          if (!id) continue;
          models.push({
            id,
            providerId: key,
            name: typeof m.name === 'string' ? m.name : id,
            displayName: typeof m.name === 'string' ? m.name : id,
            roles: ['chat', 'edit', 'apply', 'summarize'],
            capabilities: ['tool_use'],
            contextLength: typeof m.context_window === 'number' ? m.context_window : undefined,
            maxTokens: typeof m.default_max_tokens === 'number' ? m.default_max_tokens : undefined,
          } as ModelConfig);
        }
      }
    }
    return { modelProviders, models };
  }

  private encodeProvidersRaw(
    raw: Record<string, unknown>,
    providers: ModelProvider[],
    models: ModelConfig[]
  ): void {
    const priorProviders: Record<string, unknown> = this.isRecordValue(raw.providers)
      ? (raw.providers as Record<string, unknown>)
      : {};
    const providersOut: Record<string, unknown> = {};
    for (const p of providers) {
      const prior: Record<string, unknown> = this.isRecordValue(priorProviders[p.id])
        ? (priorProviders[p.id] as Record<string, unknown>)
        : {};
      const priorModels = Array.isArray(prior.models) ? prior.models : [];
      const cfg = (p.config || {}) as Record<string, unknown>;
      const type =
        typeof cfg.crushType === 'string'
          ? cfg.crushType
          : p.type === 'anthropic'
            ? 'anthropic'
            : cfg.wireApi === 'responses'
              ? 'openai'
              : 'openai-compat';
      const encodedModels: Record<string, unknown>[] = [];
      const seen = new Set<string>();
      for (const priorModel of priorModels) {
        if (!this.isRecordValue(priorModel)) continue;
        const id = typeof priorModel.id === 'string' ? priorModel.id : '';
        const unified = models.find((m) => m.providerId === p.id && m.id === id);
        if (unified) {
          encodedModels.push({
            ...priorModel,
            id,
            name: unified.displayName || unified.name || id,
            ...(unified.contextLength ? { context_window: unified.contextLength } : {}),
            ...(unified.maxTokens ? { default_max_tokens: unified.maxTokens } : {}),
          });
          seen.add(id);
        }
      }
      for (const m of models) {
        if (m.providerId !== p.id || seen.has(m.id)) continue;
        encodedModels.push({
          id: m.id,
          name: m.displayName || m.name || m.id,
          ...(m.contextLength ? { context_window: m.contextLength } : {}),
          ...(m.maxTokens ? { default_max_tokens: m.maxTokens } : {}),
        });
      }
      providersOut[p.id] = {
        ...prior,
        id: p.id,
        name: p.name || p.id,
        type,
        ...(cfg.baseUrl ? { base_url: cfg.baseUrl } : {}),
        ...(cfg.apiKey ? { api_key: cfg.apiKey } : {}),
        ...(encodedModels.length > 0 ? { models: encodedModels } : {}),
      };
    }
    if (Object.keys(providersOut).length > 0) {
      raw.providers = providersOut;
      // Newer crush validates against the published JSON schema.
      if (typeof raw.$schema !== 'string') {
        raw.$schema = 'https://charm.land/crush.json';
      }
    }
  }

  // ============================================================================
  // MCP shape conversion (unified array <-> keyed `mcp` map)
  // ============================================================================

  private isRecord(v: unknown): v is Record<string, unknown> {
    return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
  }

  private decodeMCPRaw(raw: unknown): MCPServerConfig[] {
    if (!this.isRecord(raw)) return [];
    const out: MCPServerConfig[] = [];
    for (const [name, entry] of Object.entries(raw)) {
      if (!this.isRecord(entry)) continue;
      const type = (entry.type || (typeof entry.url === 'string' ? 'http' : 'stdio')) as string;
      const isRemote =
        type === 'sse' || type === 'http' || type === 'streamable-http' || type === 'remote';
      out.push({
        name,
        type: isRemote ? (type === 'sse' ? 'sse' : 'http') : 'stdio',
        command: isRemote ? undefined : entry.command,
        args: Array.isArray(entry.args) ? entry.args : undefined,
        env: this.isRecord(entry.env) ? entry.env : undefined,
        url: isRemote ? (typeof entry.url === 'string' ? entry.url : undefined) : undefined,
        headers: this.isRecord(entry.headers) ? entry.headers : undefined,
        enabled: entry.enabled !== false,
      } as MCPServerConfig);
    }
    return out;
  }

  private encodeMCP(servers: MCPServerConfig[]): Record<string, CrushMCP> {
    const existing = (
      this.rawCache && this.isRecord(this.rawCache.mcp) ? this.rawCache.mcp : {}
    ) as Record<string, CrushMCP>;
    const out: Record<string, CrushMCP> = {};
    for (const s of servers) {
      const prior: CrushMCP = { ...existing[s.name] };
      if (s.type === 'stdio' && s.command) {
        out[s.name] = {
          ...prior,
          command: s.command,
          ...(s.args?.length ? { args: s.args } : {}),
          ...(s.env ? { env: s.env } : {}),
          ...(s.enabled === false ? { enabled: false } : {}),
        };
      } else if (s.url) {
        out[s.name] = {
          ...prior,
          url: s.url,
          ...(s.headers ? { headers: s.headers } : {}),
          ...(s.env ? { env: s.env } : {}),
          ...(s.type === 'sse' ? { type: 'sse' } : {}),
          ...(s.enabled === false ? { enabled: false } : {}),
        };
      } else if (Object.keys(prior).length > 0) {
        out[s.name] = prior;
      }
    }
    return out;
  }

  // ============================================================================
  // Model / Provider Operations (not managed in Crush config)
  // ============================================================================

  listModelProviders(): ModelProvider[] {
    return [];
  }
  async addModelProvider(): Promise<void> {
    throw new Error('Crush manages providers via its own config, not a provider list');
  }
  async removeModelProvider(): Promise<void> {
    throw new Error('Crush manages providers via its own config, not a provider list');
  }
  async updateModelProvider(): Promise<void> {
    throw new Error('Crush manages providers via its own config, not a provider list');
  }
  listModels(): ModelConfig[] {
    return [];
  }
  async addModel(): Promise<void> {
    throw new Error('Crush does not expose a model list in its config');
  }
  async removeModel(): Promise<void> {
    throw new Error('Crush does not expose a model list in its config');
  }
  async updateModel(): Promise<void> {
    throw new Error('Crush does not expose a model list in its config');
  }

  // ============================================================================
  // MCP Server Operations
  // ============================================================================

  listMCPServers(): MCPServerConfig[] {
    if (!this.configCache) throw new Error('Config not loaded. Call readConfig() first.');
    return this.configCache.mcpServers;
  }

  async addMCPServer(server: MCPServerConfig): Promise<void> {
    const config = await this.readConfig();
    if (config.mcpServers.some((s) => s.name === server.name)) {
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
    if (index === -1) throw new Error(`MCP server with name "${serverName}" not found`);
    config.mcpServers[index] = { ...config.mcpServers[index], ...updates };
    config.lastModified = Date.now();
    await this.writeConfig(config);
  }

  // ============================================================================
  // Permission Operations (not supported)
  // ============================================================================

  listPermissions(): PermissionConfig[] {
    return this.configCache?.permissions || [];
  }
  async addPermission(): Promise<void> {
    throw new Error('Crush does not support permission rules in its config file');
  }
  async removePermission(): Promise<void> {
    throw new Error('Crush does not support permission rules in its config file');
  }
  async updatePermission(): Promise<void> {
    throw new Error('Crush does not support permission rules in its config file');
  }

  // ============================================================================
  // Utility
  // ============================================================================

  async backupConfig(): Promise<string> {
    return backupFile(this.configPathFor());
  }

  async restoreConfig(backupPath: string): Promise<void> {
    const content = await readFileSafe(backupPath);
    if (!content) throw new Error(`Backup file not found: ${backupPath}`);
    await writeFileSafe(this.configPathFor(), content);
    this.configCache = null;
    this.rawCache = null;
  }
}

export function createCrushAdapter(): CrushAdapter {
  return new CrushAdapter();
}
