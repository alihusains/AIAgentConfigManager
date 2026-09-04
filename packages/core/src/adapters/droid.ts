/**
 * Droid CLI Adapter (Factory AI)
 *
 * Droid (https://factory.ai) is Factory's terminal coding agent.
 *
 * MCP servers live in a dedicated global file:
 *   - macOS/Linux: ~/.factory/mcp.json
 *   - Windows:     %APPDATA%\factory\mcp.json
 * The file uses the keyed `mcpServers` map (string command + separate args,
 * or a url for remote servers).
 *
 * Model providers ARE file-configurable (docs.factory.ai/droid-cli/settings):
 * the canonical file is ~/.factory/settings.json (legacy ~/.factory/config.json
 * is merged but snake_case and env expansion is settings-only — we always
 * write the canonical form):
 *
 *   {
 *     "model": "my-model-id",            // default model
 *     "customModels": [
 *       {
 *         "model": "my-model-id",        // required
 *         "baseUrl": "https://api.example.com/v1",   // required
 *         "provider": "generic-chat-completion-api", // required — use this for
 *                                                    // OpenAI-compatible endpoints
 *                                                    // (anthropic | openai for
 *                                                    // the native protocols)
 *         "displayName": "My Model",
 *         "apiKey": "${MY_API_KEY}",     // $VAR interpolation happens in droid
 *         "maxOutputTokens": 16384,
 *         "extraHeaders": { "X-Custom": "v" }
 *       }
 *     ]
 *   }
 *
 * The unified ModelProvider list maps onto customModels entries
 * (droid keys models, not providers, so each registry provider contributes
 * one entry per model; entries are grouped back per baseUrl+type on read).
 *
 * Sources: https://docs.factory.ai/model-independence/byok
 *          https://docs.factory.ai/droid-cli/settings
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

const DROID_MCP_PATHS = {
  darwin: '~/.factory/mcp.json',
  win32: '%APPDATA%\\factory\\mcp.json',
  linux: '~/.factory/mcp.json',
} as const;

const DROID_SETTINGS_PATHS = {
  darwin: '~/.factory/settings.json',
  win32: '%USERPROFILE%\\.factory\\settings.json',
  linux: '~/.factory/settings.json',
} as const;

export class DroidAdapter implements AgentAdapter {
  readonly info: AgentInfo = {
    id: 'droid',
    name: 'Droid',
    description:
      "Droid — Factory AI's terminal coding agent (MCP via ~/.factory/mcp.json; custom models via ~/.factory/settings.json).",
    configFormat: 'json' as ConfigFormat,
    configPaths: { ...DROID_SETTINGS_PATHS },
    binaries: ['droid'],
    mcpConfigPaths: { ...DROID_MCP_PATHS },
    modelConfigPaths: {
      darwin: [DROID_SETTINGS_PATHS.darwin],
      win32: [DROID_SETTINGS_PATHS.win32],
      linux: [DROID_SETTINGS_PATHS.linux],
    },
    supports: {
      modelProviders: true,
      mcpServers: true,
      permissions: false,
      projectConfig: false,
    },
  };

  protected settingsCache: AgentConfig | null = null;
  protected mcpRawCache: Record<string, unknown> | null = null;
  protected settingsRawCache: Record<string, unknown> | null = null;

  private detectPlatform(): Platform {
    if (typeof process !== 'undefined' && process.platform) {
      const p = process.platform;
      if (p === 'darwin') return 'darwin';
      if (p === 'win32') return 'win32';
      return 'linux';
    }
    return 'darwin';
  }

  private mcpPathFor(platform?: Platform): string {
    const current = platform || this.detectPlatform();
    return resolveConfigPath(DROID_MCP_PATHS[current] || DROID_MCP_PATHS.darwin);
  }

  private settingsPathFor(platform?: Platform): string {
    const current = platform || this.detectPlatform();
    return resolveConfigPath(DROID_SETTINGS_PATHS[current] || DROID_SETTINGS_PATHS.darwin);
  }

  getConfigPath(platform?: Platform): string {
    return this.settingsPathFor(platform);
  }

  getMCPConfigPath(platform?: Platform): string | null {
    return this.mcpPathFor(platform);
  }

  // ============================================================================
  // Config File Operations
  // ============================================================================

  async readConfig(): Promise<AgentConfig> {
    // settings.json holds custom models; mcp.json holds MCP servers.
    let modelProviders: ModelProvider[] = [];
    let models: ModelConfig[] = [];
    const settingsContent = await readFileSafe(this.settingsPathFor());
    this.settingsRawCache = null;
    if (settingsContent) {
      try {
        const raw = parseConfig(settingsContent, 'json') as Record<string, unknown> | null;
        this.settingsRawCache = raw && typeof raw === 'object' ? raw : {};
        ({ modelProviders, models } = this.decodeCustomModels(this.settingsRawCache));
      } catch {
        this.settingsRawCache = {};
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

    const config: AgentConfig = {
      version: '1.0.0',
      lastModified: Date.now(),
      modelProviders,
      models,
      mcpServers,
      permissions: [] as PermissionConfig[],
      customSettings: {},
    };
    this.settingsCache = config;
    return config;
  }

  async writeConfig(config: AgentConfig): Promise<void> {
    const validation = validateAgentConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid config: ${validation.errors.join(', ')}`);
    }

    // 1) settings.json: preserve unknown keys, rewrite customModels.
    const settingsRaw: Record<string, unknown> = this.settingsRawCache
      ? JSON.parse(JSON.stringify(this.settingsRawCache))
      : {};
    this.encodeCustomModels(settingsRaw, config.modelProviders, config.models);
    await backupFile(this.settingsPathFor()).catch(() => undefined);
    await writeFileSafe(this.settingsPathFor(), stringifyConfig(settingsRaw, 'json'));
    this.settingsRawCache = settingsRaw;

    // 2) mcp.json.
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

    this.settingsCache = config;
  }

  validateConfig(config: unknown): { valid: boolean; errors: string[] } {
    return validateAgentConfig(config);
  }

  /**
   * Drift projection: customModels entries express baseUrl/apiKey/provider.
   * droidProvider bookkeeping is not drift.
   */
  expressibleProviderConfig = (config: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    if (config.baseUrl !== undefined) out.baseUrl = config.baseUrl;
    if (config.apiKey !== undefined) out.apiKey = config.apiKey;
    if (config.headers !== undefined) out.headers = config.headers;
    return out;
  };

  // ============================================================================
  // customModels conversion (unified <-> settings.json)
  // ============================================================================

  private isRecord(v: unknown): v is Record<string, unknown> {
    return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
  }

  private droidProviderType(p: ModelProvider): string {
    const cfg = (p.config || {}) as Record<string, unknown>;
    if (typeof cfg.droidProvider === 'string') return cfg.droidProvider;
    if (p.type === 'anthropic') return 'anthropic';
    if (cfg.wireApi === 'responses') return 'openai';
    return 'generic-chat-completion-api';
  }

  private decodeCustomModels(raw: Record<string, unknown>): {
    modelProviders: ModelProvider[];
    models: ModelConfig[];
  } {
    const list = Array.isArray(raw.customModels) ? raw.customModels : [];
    const modelProviders: ModelProvider[] = [];
    const models: ModelConfig[] = [];
    for (const entry of list) {
      if (!this.isRecord(entry)) continue;
      const modelId = typeof entry.model === 'string' ? entry.model : '';
      const baseUrl = typeof entry.baseUrl === 'string' ? entry.baseUrl : '';
      if (!modelId || !baseUrl) continue;
      const providerType =
        typeof entry.provider === 'string' ? entry.provider : 'generic-chat-completion-api';
      // droid keys by MODEL — group entries into one provider per baseUrl+type.
      const providerId = `droid-${providerType}-${baseUrl.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
      let provider = modelProviders.find((p) => p.id === providerId);
      if (!provider) {
        provider = {
          id: providerId,
          name:
            typeof entry.displayName === 'string' && entry.displayName
              ? entry.displayName
              : baseUrl,
          type: providerType === 'anthropic' ? 'anthropic' : 'openai-compatible',
          enabled: true,
          priority: 0,
          config: {
            baseUrl,
            ...(typeof entry.apiKey === 'string' ? { apiKey: entry.apiKey } : {}),
            ...(this.isRecord(entry.extraHeaders) ? { headers: entry.extraHeaders } : {}),
            ...(providerType !== 'generic-chat-completion-api' && providerType !== 'anthropic'
              ? { droidProvider: providerType }
              : {}),
            ...(providerType === 'openai' ? { wireApi: 'responses' } : {}),
          },
        } as ModelProvider;
        modelProviders.push(provider);
      }
      models.push({
        id: modelId,
        providerId,
        name: modelId,
        displayName:
          typeof entry.displayName === 'string' && entry.displayName
            ? entry.displayName
            : modelId,
        roles: ['chat', 'edit', 'apply', 'summarize'],
        capabilities: ['tool_use'],
        maxTokens: typeof entry.maxOutputTokens === 'number' ? entry.maxOutputTokens : undefined,
      } as ModelConfig);
    }
    return { modelProviders, models };
  }

  private encodeCustomModels(
    raw: Record<string, unknown>,
    providers: ModelProvider[],
    models: ModelConfig[]
  ): void {
    const priorList = Array.isArray(raw.customModels) ? raw.customModels : [];
    const priorByModel = new Map<string, Record<string, unknown>>();
    for (const entry of priorList) {
      if (this.isRecord(entry) && typeof entry.model === 'string') {
        priorByModel.set(entry.model, entry);
      }
    }
    const out: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    for (const p of providers) {
      const cfg = (p.config || {}) as Record<string, unknown>;
      const type = this.droidProviderType(p);
      for (const m of models) {
        if (m.providerId !== p.id || seen.has(m.id)) continue;
        seen.add(m.id);
        const prior = priorByModel.get(m.id) || {};
        out.push({
          ...prior,
          model: m.id,
          ...(cfg.baseUrl ? { baseUrl: cfg.baseUrl } : {}),
          provider: type,
          displayName: m.displayName || m.name || m.id,
          ...(cfg.apiKey ? { apiKey: cfg.apiKey } : {}),
          ...(m.maxTokens ? { maxOutputTokens: m.maxTokens } : {}),
          ...(cfg.headers && typeof cfg.headers === 'object'
            ? { extraHeaders: cfg.headers }
            : {}),
        });
      }
    }
    raw.customModels = out;
    // Heal the default-model key when it dangles (model list is non-empty).
    const currentDefault = typeof raw.model === 'string' ? raw.model : '';
    if (seen.size > 0 && (!currentDefault || !seen.has(currentDefault))) {
      raw.model = [...seen][0];
    }
  }

  // ============================================================================
  // MCP shape conversion (unified array <-> keyed `mcpServers` map)
  // ============================================================================

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
        command: typeof command === 'string' ? command : undefined,
        args: Array.isArray(entry.args) ? (entry.args as string[]) : undefined,
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
      }
    }
    return out;
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

  // ============================================================================
  // Model helpers (registry materialization uses readConfig/writeConfig)
  // ============================================================================

  listModelProviders(): ModelProvider[] {
    return this.settingsCache?.modelProviders ?? [];
  }

  async addModelProvider(provider: ModelProvider): Promise<void> {
    const config = this.settingsCache ?? (await this.readConfig());
    config.modelProviders = [
      ...config.modelProviders.filter((p) => p.id !== provider.id),
      provider,
    ];
    await this.writeConfig(config);
  }

  async removeModelProvider(providerId: string): Promise<void> {
    const config = this.settingsCache ?? (await this.readConfig());
    config.modelProviders = config.modelProviders.filter((p) => p.id !== providerId);
    config.models = config.models.filter((m) => m.providerId !== providerId);
    await this.writeConfig(config);
  }

  async updateModelProvider(providerId: string, updates: Partial<ModelProvider>): Promise<void> {
    const config = this.settingsCache ?? (await this.readConfig());
    config.modelProviders = config.modelProviders.map((p) =>
      p.id === providerId ? { ...p, ...updates } : p
    );
    await this.writeConfig(config);
  }

  listModels(): ModelConfig[] {
    return this.settingsCache?.models ?? [];
  }

  async addModel(model: ModelConfig): Promise<void> {
    const config = this.settingsCache ?? (await this.readConfig());
    config.models = [...config.models.filter((m) => m.id !== model.id), model];
    await this.writeConfig(config);
  }

  async removeModel(modelId: string): Promise<void> {
    const config = this.settingsCache ?? (await this.readConfig());
    config.models = config.models.filter((m) => m.id !== modelId);
    await this.writeConfig(config);
  }

  async updateModel(modelId: string, updates: Partial<ModelConfig>): Promise<void> {
    const config = this.settingsCache ?? (await this.readConfig());
    config.models = config.models.map((m) => (m.id === modelId ? { ...m, ...updates } : m));
    await this.writeConfig(config);
  }

  listMCPServers(): MCPServerConfig[] {
    return this.settingsCache?.mcpServers ?? [];
  }

  async addMCPServer(server: MCPServerConfig): Promise<void> {
    const config = this.settingsCache ?? (await this.readConfig());
    config.mcpServers = [...config.mcpServers.filter((s) => s.name !== server.name), server];
    await this.writeConfig(config);
  }

  async removeMCPServer(serverName: string): Promise<void> {
    const config = this.settingsCache ?? (await this.readConfig());
    config.mcpServers = config.mcpServers.filter((s) => s.name !== serverName);
    await this.writeConfig(config);
  }

  async updateMCPServer(serverName: string, updates: Partial<MCPServerConfig>): Promise<void> {
    const config = this.settingsCache ?? (await this.readConfig());
    config.mcpServers = config.mcpServers.map((s) =>
      s.name === serverName ? { ...s, ...updates } : s
    );
    await this.writeConfig(config);
  }

  listPermissions(): PermissionConfig[] {
    return [];
  }

  async addPermission(_permission: PermissionConfig): Promise<void> {
    throw new Error('Droid does not support file-based permission rules');
  }

  async removePermission(_permissionId: string): Promise<void> {
    throw new Error('Droid does not support file-based permission rules');
  }

  async updatePermission(_permissionId: string, _updates: Partial<PermissionConfig>): Promise<void> {
    throw new Error('Droid does not support file-based permission rules');
  }

  async backupConfig(): Promise<string> {
    return backupFile(this.settingsPathFor());
  }

  async restoreConfig(backupPath: string): Promise<void> {
    const content = await readFileSafe(backupPath);
    if (!content) throw new Error(`Backup file not found: ${backupPath}`);
    await writeFileSafe(this.settingsPathFor(), content);
    this.settingsCache = null;
    this.settingsRawCache = null;
    this.mcpRawCache = null;
  }
}

export function createDroidAdapter(): AgentAdapter {
  return new DroidAdapter();
}
