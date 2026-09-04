/**
 * Kimi Code Adapter (Moonshot AI)
 *
 * Kimi Code (https://moonshotai.github.io/kimi-cli/) stores its global config
 * at:
 *   - macOS/Linux: ~/.kimi/config.toml   (TOML)
 *   - Windows:     %APPDATA%\kimi\config.toml
 *
 * MCP servers live in a SEPARATE JSON file:
 *   - ~/.kimi/mcp.json   ({ mcpServers: { "<name>": { command, args, env } } })
 *
 * Model providers ARE file-configurable (docs: configuration/providers):
 *
 *   default_model = "my-gateway-model"
 *
 *   [providers.my-gateway]
 *   type = "openai_legacy"      # openai_legacy | openai_responses | anthropic
 *                               # | gemini | vertexai | kimi
 *   base_url = "https://gateway.example.com/v1"
 *   api_key = "sk-..."
 *   custom_headers = { X-Custom = "value" }
 *
 *   [models.my-gateway-model]
 *   provider = "my-gateway"
 *   model = "my-model-id"       # the API-side model name
 *   max_context_size = 262144
 *   capabilities = ["thinking", "image_in"]
 *
 * The unified adapter maps `[providers.*]` onto ModelProvider[] and
 * `[models.*]` onto ModelConfig[] (id = TOML key, name = the API model name).
 * The raw kimi provider `type` is stashed in config.kimiType so native
 * providers (kimi/gemini/vertexai) round-trip losslessly. Caveat (docs): the
 * kimi CLI rewrites config.toml on `/login` — write config before launching.
 *
 * Source: https://moonshotai.github.io/kimi-cli/en/configuration/providers.html
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

const KIMI_CONFIG_PATHS = {
  darwin: '~/.kimi/config.toml',
  win32: '%APPDATA%\\kimi\\config.toml',
  linux: '~/.kimi/config.toml',
} as const;

const KIMI_MCP_PATHS = {
  darwin: '~/.kimi/mcp.json',
  win32: '%APPDATA%\\kimi\\mcp.json',
  linux: '~/.kimi/mcp.json',
} as const;

/**
 * Create a Kimi Code adapter.
 */
export class KimiAdapter implements AgentAdapter {
  readonly info: AgentInfo = {
    id: 'kimi',
    name: 'Kimi Code',
    description: "Kimi Code — Moonshot AI's terminal coding agent (TOML config + mcp.json).",
    configFormat: 'toml' as ConfigFormat,
    configPaths: { ...KIMI_CONFIG_PATHS },
    binaries: ['kimi'],
    mcpConfigPaths: { ...KIMI_MCP_PATHS },
    modelConfigPaths: {
      darwin: [KIMI_CONFIG_PATHS.darwin],
      win32: [KIMI_CONFIG_PATHS.win32],
      linux: [KIMI_CONFIG_PATHS.linux],
    },
    modelCredentialPaths: {
      darwin: ['~/.kimi/credentials'],
      win32: ['%APPDATA%\\kimi\\credentials'],
      linux: ['~/.kimi/credentials'],
    },
    supports: {
      modelProviders: true,
      mcpServers: true,
      permissions: false,
      projectConfig: false,
    },
  };

  protected configCache: AgentConfig | null = null;
  protected mainRawCache: Record<string, unknown> | null = null;
  protected mcpRawCache: Record<string, unknown> | null = null;

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
    return resolveConfigPath(KIMI_CONFIG_PATHS[current] || KIMI_CONFIG_PATHS.darwin);
  }

  private mcpPathFor(platform?: Platform): string {
    const current = platform || this.detectPlatform();
    return resolveConfigPath(KIMI_MCP_PATHS[current] || KIMI_MCP_PATHS.darwin);
  }

  getConfigPath(platform?: Platform): string {
    return this.configPathFor(platform);
  }

  getMCPConfigPath(platform?: Platform): string | null {
    return this.mcpPathFor(platform);
  }

  // ============================================================================
  // Config File Operations
  // ============================================================================

  async readConfig(): Promise<AgentConfig> {
    const mainContent = await readFileSafe(this.configPathFor());
    this.mainRawCache = null;
    if (mainContent) {
      try {
        this.mainRawCache = parseConfig(mainContent, 'toml') as Record<string, unknown>;
      } catch {
        this.mainRawCache = {};
      }
    }

    let mcpServers: MCPServerConfig[] = [];
    const mcpContent = await readFileSafe(this.mcpPathFor());
    this.mcpRawCache = null;
    if (mcpContent) {
      try {
        const raw = parseConfig(mcpContent, 'json') as Record<string, unknown>;
        this.mcpRawCache = raw;
        mcpServers = this.decodeMCPRaw(raw.mcpServers);
      } catch {
        this.mcpRawCache = null;
      }
    }

    // Decode [providers.*] / [models.*] from the main TOML config.
    const { modelProviders, models } = this.decodeProvidersRaw(this.mainRawCache);

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

    // 1) Main TOML config: preserve unknown keys, rewrite managed
    //    [providers.*] / [models.*] tables from the unified lists.
    const mainRaw: Record<string, unknown> = this.mainRawCache
      ? JSON.parse(JSON.stringify(this.mainRawCache))
      : {};
    const modelKeys = this.encodeProvidersRaw(mainRaw, config.modelProviders, config.models);
    // Keep `default_model` pointing at a model that exists. Only touch it
    // when it dangles (references a removed model) or is absent while we
    // manage models — never override an intentional built-in default.
    const currentDefault = typeof mainRaw.default_model === 'string' ? mainRaw.default_model : '';
    if (modelKeys.length > 0 && (!currentDefault || !modelKeys.includes(currentDefault))) {
      mainRaw.default_model = modelKeys[0];
    }
    await backupFile(this.configPathFor()).catch(() => undefined);
    await writeFileSafe(this.configPathFor(), stringifyConfig(mainRaw, 'toml'));
    this.mainRawCache = mainRaw;

    // 2) Separate MCP JSON file.
    const mcpRaw: Record<string, unknown> = this.mcpRawCache
      ? JSON.parse(JSON.stringify(this.mcpRawCache))
      : {};
    delete mcpRaw.mcpServers;
    const mcpFile: Record<string, unknown> = {
      ...mcpRaw,
      mcpServers: this.encodeMCP(config.mcpServers),
    };
    await backupFile(this.mcpPathFor()).catch(() => undefined);
    await writeFileSafe(this.mcpPathFor(), stringifyConfig(mcpFile, 'json'));
    this.mcpRawCache = mcpFile;

    this.configCache = config;
  }

  validateConfig(config: unknown): { valid: boolean; errors: string[] } {
    return validateAgentConfig(config);
  }

  /**
   * Drift projection: [providers.*] express base_url/api_key/custom_headers
   * and the encoded provider type. kimiType bookkeeping is not drift.
   */
  expressibleProviderConfig = (config: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    if (config.baseUrl !== undefined) out.baseUrl = config.baseUrl;
    if (config.apiKey !== undefined) out.apiKey = config.apiKey;
    if (config.headers !== undefined) out.headers = config.headers;
    if (config.wireApi !== undefined) out.wireApi = config.wireApi;
    return out;
  };

  // ============================================================================
  // Model provider shape conversion (unified <-> [providers.*] / [models.*])
  // ============================================================================

  /** Unified wire type for a kimi provider `type` value. */
  private kimiTypeToUnified(type: string | undefined): ModelProvider['type'] {
    switch (type) {
      case 'openai_legacy':
      case 'openai_responses':
        return 'openai-compatible';
      case 'anthropic':
        return 'anthropic';
      default:
        // kimi | gemini | vertexai (and anything unknown): agent-native protocol.
        return 'custom';
    }
  }

  private decodeProvidersRaw(raw: Record<string, unknown> | null): {
    modelProviders: ModelProvider[];
    models: ModelConfig[];
  } {
    const providersRaw = raw && this.isRecord(raw.providers) ? raw.providers : {};
    const modelsRaw = raw && this.isRecord(raw.models) ? raw.models : {};
    const modelProviders: ModelProvider[] = [];
    for (const [key, entry] of Object.entries(providersRaw)) {
      if (!this.isRecord(entry)) continue;
      const type = typeof entry.type === 'string' ? entry.type : undefined;
      const unifiedType = this.kimiTypeToUnified(type);
      modelProviders.push({
        id: key,
        name: typeof entry.name === 'string' ? entry.name : key,
        type: unifiedType,
        enabled: entry.enabled !== false,
        priority: 0,
        config: {
          ...(typeof entry.base_url === 'string' ? { baseUrl: entry.base_url } : {}),
          ...(typeof entry.api_key === 'string' ? { apiKey: entry.api_key } : {}),
          ...(this.isRecord(entry.custom_headers) ? { headers: entry.custom_headers } : {}),
          ...(type === 'openai_legacy' ? { wireApi: 'chat' } : {}),
          ...(type === 'openai_responses' ? { wireApi: 'responses' } : {}),
          // Lossless round-trip for native provider types.
          ...(type && unifiedType === 'custom' ? { kimiType: type } : {}),
        },
      } as ModelProvider);
    }
    const models: ModelConfig[] = [];
    for (const [key, entry] of Object.entries(modelsRaw)) {
      if (!this.isRecord(entry)) continue;
      const providerId = typeof entry.provider === 'string' ? entry.provider : '';
      // Only models that reference a known provider are surfaced — a model
      // entry without a provider cannot be materialized or edited.
      if (!providerId || !modelProviders.some((p) => p.id === providerId)) continue;
      models.push({
        id: key,
        providerId,
        name: typeof entry.model === 'string' ? entry.model : key,
        displayName: key,
        roles: ['chat', 'edit', 'apply', 'summarize'],
        capabilities: ['tool_use'],
        contextLength:
          typeof entry.max_context_size === 'number' ? entry.max_context_size : undefined,
      } as ModelConfig);
    }
    return { modelProviders, models };
  }

  /**
   * Rewrite [providers.*] / [models.*] from the unified lists, preserving
   * unknown per-entry keys. Returns the encoded model keys (for
   * default_model healing).
   */
  private encodeProvidersRaw(
    raw: Record<string, unknown>,
    providers: ModelProvider[],
    models: ModelConfig[]
  ): string[] {
    const priorProviders: Record<string, unknown> = this.isRecord(raw.providers)
      ? (raw.providers as Record<string, unknown>)
      : {};
    const priorModels = this.isRecord(raw.models) ? raw.models : {};
    const providersOut: Record<string, unknown> = {};
    for (const p of providers) {
      const prior: Record<string, unknown> = this.isRecord(priorProviders[p.id])
        ? (priorProviders[p.id] as Record<string, unknown>)
        : {};
      const cfg = (p.config || {}) as Record<string, unknown>;
      let kimiType: string;
      if (typeof cfg.kimiType === 'string') {
        kimiType = cfg.kimiType;
      } else if (p.type === 'anthropic') {
        kimiType = 'anthropic';
      } else if (cfg.wireApi === 'responses') {
        kimiType = 'openai_responses';
      } else {
        kimiType = 'openai_legacy';
      }
      providersOut[p.id] = {
        ...prior,
        type: kimiType,
        ...(cfg.baseUrl ? { base_url: cfg.baseUrl } : {}),
        ...(cfg.apiKey ? { api_key: cfg.apiKey } : {}),
        ...(cfg.headers && typeof cfg.headers === 'object'
          ? { custom_headers: cfg.headers }
          : {}),
        ...(p.enabled === false ? { enabled: false } : {}),
      };
    }
    const modelsOut: Record<string, unknown> = {};
    const modelKeys: string[] = [];
    for (const m of models) {
      if (!providersOut[m.providerId]) continue; // dangling model — drop
      const prior: Record<string, unknown> = this.isRecord(priorModels[m.id])
        ? (priorModels[m.id] as Record<string, unknown>)
        : {};
      modelsOut[m.id] = {
        ...prior,
        provider: m.providerId,
        model: m.name || m.id,
        ...(m.contextLength ? { max_context_size: m.contextLength } : {}),
      };
      modelKeys.push(m.id);
    }
    // Only assign when there is content — an empty table would delete the
    // user's hand-written entries if the write path is ever fed an empty list.
    if (Object.keys(providersOut).length > 0 || Object.keys(priorProviders).length > 0) {
      raw.providers = providersOut;
    }
    if (Object.keys(modelsOut).length > 0 || Object.keys(priorModels).length > 0) {
      raw.models = modelsOut;
    }
    return modelKeys;
  }

  // ============================================================================
  // MCP shape conversion (unified array <-> keyed map)
  // ============================================================================

  private isRecord(v: unknown): v is Record<string, unknown> {
    return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
  }

  private mapTransport(type?: string): MCPServerConfig['type'] {
    switch ((type || 'stdio').toLowerCase()) {
      case 'sse':
        return 'sse';
      case 'http':
      case 'stream-http':
      case 'streamable-http':
      case 'remote':
        return 'http';
      default:
        return 'stdio';
    }
  }

  private decodeMCPRaw(raw: unknown): MCPServerConfig[] {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    const out: MCPServerConfig[] = [];
    for (const [name, entry] of Object.entries(raw as Record<string, unknown>)) {
      if (!this.isRecord(entry)) continue;
      const command = entry.command;
      out.push({
        name,
        type:
          typeof entry.type === 'string'
            ? this.mapTransport(entry.type)
            : typeof entry.url === 'string'
              ? 'http'
              : 'stdio',
        command: Array.isArray(command)
          ? typeof command[0] === 'string'
            ? command[0]
            : undefined
          : typeof command === 'string'
            ? command
            : undefined,
        args: Array.isArray(command)
          ? (command.slice(1) as string[])
          : Array.isArray(entry.args)
            ? (entry.args as string[])
            : undefined,
        env: this.isRecord(entry.env) ? (entry.env as Record<string, string>) : undefined,
        url: typeof entry.url === 'string' ? entry.url : undefined,
        headers: this.isRecord(entry.headers)
          ? (entry.headers as Record<string, string>)
          : undefined,
        enabled: entry.enabled !== false,
      } as MCPServerConfig);
    }
    return out;
  }

  private encodeMCP(servers: MCPServerConfig[]): Record<string, unknown> {
    const existing = (this.mcpRawCache?.mcpServers || {}) as Record<
      string,
      Record<string, unknown>
    >;
    const out: Record<string, unknown> = {};
    for (const s of servers) {
      const prior = existing[s.name] || {};
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
  // Mutate helper + operations
  // ============================================================================

  private async mutate<T = void>(fn: (config: AgentConfig) => T): Promise<T> {
    const config = await this.readConfig();
    const result = fn(config);
    config.lastModified = Date.now();
    await this.writeConfig(config);
    return result;
  }

  listModelProviders(): ModelProvider[] {
    return [];
  }

  async addModelProvider(): Promise<void> {
    throw new Error('Kimi Code manages providers via its own credentials — not editable here');
  }

  async removeModelProvider(): Promise<void> {
    throw new Error('Kimi Code manages providers via its own credentials — not editable here');
  }

  async updateModelProvider(): Promise<void> {
    throw new Error('Kimi Code manages providers via its own credentials — not editable here');
  }

  listModels(): ModelConfig[] {
    return [];
  }

  async addModel(): Promise<void> {
    throw new Error('Kimi Code does not expose a model list in its config');
  }

  async removeModel(): Promise<void> {
    throw new Error('Kimi Code does not expose a model list in its config');
  }

  async updateModel(): Promise<void> {
    throw new Error('Kimi Code does not expose a model list in its config');
  }

  listMCPServers(): MCPServerConfig[] {
    if (!this.configCache) throw new Error('Config not loaded. Call readConfig() first.');
    return this.configCache.mcpServers;
  }

  addMCPServer(server: MCPServerConfig): Promise<void> {
    return this.mutate((config) => {
      if (config.mcpServers.some((s) => s.name === server.name)) {
        throw new Error(`MCP server with name "${server.name}" already exists`);
      }
      config.mcpServers.push(server);
    }).then(() => undefined);
  }

  removeMCPServer(serverName: string): Promise<void> {
    return this.mutate((config) => {
      config.mcpServers = config.mcpServers.filter((s) => s.name !== serverName);
    }).then(() => undefined);
  }

  updateMCPServer(serverName: string, updates: Partial<MCPServerConfig>): Promise<void> {
    return this.mutate((config) => {
      const index = config.mcpServers.findIndex((s) => s.name === serverName);
      if (index === -1) throw new Error(`MCP server with name "${serverName}" not found`);
      config.mcpServers[index] = { ...config.mcpServers[index], ...updates };
    }).then(() => undefined);
  }

  listPermissions(): PermissionConfig[] {
    return [];
  }

  async addPermission(): Promise<void> {
    throw new Error('Kimi Code does not support permission rules in its config');
  }

  async removePermission(): Promise<void> {
    throw new Error('Kimi Code does not support permission rules in its config');
  }

  async updatePermission(): Promise<void> {
    throw new Error('Kimi Code does not support permission rules in its config');
  }

  async backupConfig(): Promise<string> {
    return backupFile(this.configPathFor());
  }

  async restoreConfig(backupPath: string): Promise<void> {
    const content = await readFileSafe(backupPath);
    if (!content) throw new Error(`Backup file not found: ${backupPath}`);
    await writeFileSafe(this.configPathFor(), content);
    this.configCache = null;
    this.mainRawCache = null;
    this.mcpRawCache = null;
  }
}

export function createKimiAdapter(): KimiAdapter {
  return new KimiAdapter();
}
