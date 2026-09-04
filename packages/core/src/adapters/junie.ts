/**
 * JetBrains Junie CLI Adapter
 *
 * Junie (https://junie.jetbrains.com) stores user-scope config under ~/.junie/:
 *   - config.json    main CLI config — never touched by this adapter
 *   - mcp/mcp.json   user-scope MCP servers:
 *                    { mcpServers: { "<name>": { command, args, env } } }
 *   - models/*.json  custom model profiles — FULL read/write below
 *
 * Custom model profiles (docs: junie-cli-configuration, "custom models"):
 * ONE JSON FILE PER MODEL PROFILE — the profile id IS the filename:
 *
 *   ~/.junie/models/my-gateway.json
 *   {
 *     "id": "my-model-id",
 *     "baseUrl": "https://gw.example.com/v1/chat/completions",
 *     "displayName": "My Gateway Model",
 *     "providerName": "My Gateway",
 *     "apiType": "OpenAICompletion",   // OpenAICompletion | OpenAIResponses |
 *                                      // Google | Anthropic
 *     "apiKey": "${MY_GATEWAY_API_KEY}",   // env interpolation supported
 *     "extraHeaders": { "X-Custom-Auth": "..." },
 *     "maxContextLength": 262144
 *   }
 *
 * CRITICAL: `baseUrl` is the FULL endpoint URL — Junie appends nothing. The
 * unified config.baseUrl stores the root; `/v1/chat/completions` is appended
 * for OpenAICompletion and `/v1/responses` for OpenAIResponses on write.
 * Profile files are selected with `junie --model custom:<profile-id>`.
 *
 * Sources: https://junie.jetbrains.com/docs/junie-cli-configuration.html
 *          https://junie.jetbrains.com/docs/junie-cli-mcp-configuration.html
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
import * as fs from 'node:fs/promises';

const JUNIE_CONFIG_PATHS = {
  darwin: '~/.junie/config.json',
  win32: '%USERPROFILE%\\.junie\\config.json',
  linux: '~/.junie/config.json',
} as const;

const JUNIE_MCP_PATHS = {
  darwin: '~/.junie/mcp/mcp.json',
  win32: '%USERPROFILE%\\.junie\\mcp\\mcp.json',
  linux: '~/.junie/mcp/mcp.json',
} as const;

const JUNIE_MODELS_DIRS = {
  darwin: '~/.junie/models',
  win32: '%USERPROFILE%\\.junie\\models',
  linux: '~/.junie/models',
} as const;

export class JunieAdapter implements AgentAdapter {
  readonly info: AgentInfo = {
    id: 'junie',
    name: 'Junie',
    description:
      'JetBrains Junie CLI — coding agent from JetBrains (MCP via ~/.junie/mcp/mcp.json; custom model profiles via ~/.junie/models/*.json).',
    configFormat: 'json' as ConfigFormat,
    configPaths: { ...JUNIE_CONFIG_PATHS },
    binaries: ['junie'],
    mcpConfigPaths: { ...JUNIE_MCP_PATHS },
    modelConfigPaths: {
      darwin: [`${JUNIE_MODELS_DIRS.darwin}/*.json`],
      win32: [`${JUNIE_MODELS_DIRS.win32}\\*.json`],
      linux: [`${JUNIE_MODELS_DIRS.linux}/*.json`],
    },
    supports: {
      modelProviders: true,
      mcpServers: true,
      permissions: false,
      projectConfig: false,
    },
  };

  protected configCache: AgentConfig | null = null;
  protected mcpRawCache: Record<string, unknown> | null = null;
  /** Raw profile JSONs by file basename, cached on read for lossless writes. */
  protected profilesCache = new Map<string, Record<string, unknown>>();

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
    return resolveConfigPath(JUNIE_MCP_PATHS[current] || JUNIE_MCP_PATHS.darwin);
  }

  private modelsDirFor(platform?: Platform): string {
    const current = platform || this.detectPlatform();
    return resolveConfigPath(JUNIE_MODELS_DIRS[current] || JUNIE_MODELS_DIRS.darwin);
  }

  getConfigPath(platform?: Platform): string {
    const current = platform || this.detectPlatform();
    return resolveConfigPath(JUNIE_CONFIG_PATHS[current] || JUNIE_CONFIG_PATHS.darwin);
  }

  getMCPConfigPath(platform?: Platform): string | null {
    return this.mcpPathFor(platform);
  }

  // ============================================================================
  // Config File Operations
  // ============================================================================

  async readConfig(): Promise<AgentConfig> {
    // Scan ~/.junie/models/*.json — each file is one model profile.
    const dir = this.modelsDirFor();
    this.profilesCache = new Map();
    let modelProviders: ModelProvider[] = [];
    let models: ModelConfig[] = [];
    try {
      const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
      for (const file of files) {
        try {
          const content = await readFileSafe(`${dir}/${file}`);
          if (!content) continue;
          const raw = JSON.parse(content) as Record<string, unknown>;
          this.profilesCache.set(file, raw);
        } catch {
          // Malformed profile: skip.
        }
      }
    } catch {
      // models dir missing — no custom profiles yet.
    }
    ({ modelProviders, models } = this.decodeProfiles([...this.profilesCache.values()]));

    // MCP from the dedicated file.
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
    this.configCache = config;
    return config;
  }

  async writeConfig(config: AgentConfig): Promise<void> {
    const validation = validateAgentConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid config: ${validation.errors.join(', ')}`);
    }
    await this.encodeProfiles(config.modelProviders, config.models);

    // MCP from the dedicated file.
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
   * Drift projection: profile files express baseUrl/apiKey/apiType/headers.
   * junieApiType/junieExtraBody bookkeeping is not drift.
   */
  expressibleProviderConfig = (config: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    if (config.baseUrl !== undefined) out.baseUrl = config.baseUrl;
    if (config.apiKey !== undefined) out.apiKey = config.apiKey;
    if (config.headers !== undefined) out.headers = config.headers;
    return out;
  };

  // ============================================================================
  // Profile conversion (unified <-> ~/.junie/models/*.json)
  // ============================================================================

  private isRecord(v: unknown): v is Record<string, unknown> {
    return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
  }

  /** Full endpoint URL for a provider, per its Junie apiType. */
  private fullBaseUrl(p: ModelProvider): string {
    const cfg = (p.config || {}) as Record<string, unknown>;
    const root = String(cfg.baseUrl || '').replace(/\/+$/, '');
    const apiType = this.junieApiType(p);
    // `/v1` may already be part of the stored root — never double it.
    const suffix = /\/v1$/i.test(root) ? '' : '/v1';
    if (apiType === 'OpenAIResponses' && !/\/responses$/i.test(root)) {
      return `${root}${suffix}/responses`;
    }
    if (
      apiType === 'OpenAICompletion' &&
      !/\/(chat\/completions|responses)$/i.test(root)
    ) {
      return `${root}${suffix}/chat/completions`;
    }
    return root;
  }

  private junieApiType(p: ModelProvider): string {
    const cfg = (p.config || {}) as Record<string, unknown>;
    if (typeof cfg.junieApiType === 'string') return cfg.junieApiType;
    if (p.type === 'anthropic') return 'Anthropic';
    if (cfg.wireApi === 'responses') return 'OpenAIResponses';
    return 'OpenAICompletion';
  }

  private decodeProfiles(profiles: Record<string, unknown>[]): {
    modelProviders: ModelProvider[];
    models: ModelConfig[];
  } {
    const modelProviders: ModelProvider[] = [];
    const models: ModelConfig[] = [];
    for (const entry of profiles) {
      const modelId = typeof entry.id === 'string' ? entry.id : '';
      const baseUrl = typeof entry.baseUrl === 'string' ? entry.baseUrl : '';
      if (!modelId || !baseUrl) continue;
      const apiType =
        typeof entry.apiType === 'string' ? entry.apiType : 'OpenAICompletion';
      // Profiles are per-MODEL; group into one provider per baseUrl+apiType.
      const providerId = `junie-${apiType}-${baseUrl.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
      let provider = modelProviders.find((p) => p.id === providerId);
      if (!provider) {
        // Unify the full endpoint URL back to its root.
        let root = baseUrl.replace(/\/+$/, '');
        root = root
          .replace(/\/v1\/chat\/completions$/i, '')
          .replace(/\/chat\/completions$/i, '')
          .replace(/\/v1\/responses$/i, '');
        provider = {
          id: providerId,
          name:
            typeof entry.providerName === 'string' && entry.providerName
              ? entry.providerName
              : root,
          type:
            apiType === 'Anthropic' ? 'anthropic' : 'openai-compatible',
          enabled: true,
          priority: 0,
          config: {
            baseUrl: root,
            ...(typeof entry.apiKey === 'string' ? { apiKey: entry.apiKey } : {}),
            ...(apiType !== 'OpenAICompletion' && apiType !== 'Anthropic'
              ? { junieApiType: apiType }
              : {}),
            ...(this.isRecord(entry.extraHeaders)
              ? { headers: entry.extraHeaders }
              : {}),
            ...(this.isRecord(entry.extraBody) ? { junieExtraBody: entry.extraBody } : {}),
            ...(apiType === 'OpenAIResponses' ? { wireApi: 'responses' } : {}),
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
        contextLength:
          typeof entry.maxContextLength === 'number' ? entry.maxContextLength : undefined,
        temperature: typeof entry.temperature === 'number' ? entry.temperature : undefined,
      } as ModelConfig);
    }
    return { modelProviders, models };
  }

  private async encodeProfiles(
    providers: ModelProvider[],
    models: ModelConfig[]
  ): Promise<void> {
    const dir = this.modelsDirFor();
    const keep = new Set<string>();
    for (const p of providers) {
      const cfg = (p.config || {}) as Record<string, unknown>;
      const apiType = this.junieApiType(p);
      const baseUrl = this.fullBaseUrl(p);
      for (const m of models.filter((m) => m.providerId === p.id)) {
        // Profile id = filename. Prefer the model id as the profile name.
        const profileName = m.id.replace(/[^a-zA-Z0-9._-]/g, '-') || 'model';
        const fileName = `${profileName}.json`;
        keep.add(fileName);
        const prior = this.profilesCache.get(fileName) || {};
        const profile: Record<string, unknown> = {
          ...prior,
          id: m.name || m.id,
          baseUrl,
          displayName: m.displayName || m.name || m.id,
          providerName: p.name || p.id,
          apiType,
          ...(cfg.apiKey ? { apiKey: cfg.apiKey } : {}),
          ...(cfg.headers && typeof cfg.headers === 'object'
            ? { extraHeaders: cfg.headers }
            : {}),
          ...(cfg.junieExtraBody && typeof cfg.junieExtraBody === 'object'
            ? { extraBody: cfg.junieExtraBody }
            : {}),
          ...(m.temperature !== undefined ? { temperature: m.temperature } : {}),
          ...(m.contextLength ? { maxContextLength: m.contextLength } : {}),
        };
        await writeFileSafe(`${dir}/${fileName}`, `${JSON.stringify(profile, null, 2)}\n`).catch(
          () => undefined
        );
      }
    }
    // Remove managed profile files for models that were deleted.
    for (const file of this.profilesCache.keys()) {
      if (!keep.has(file)) {
        await fs.rm(`${dir}/${file}`, { force: true }).catch(() => undefined);
      }
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
    return this.configCache?.modelProviders ?? [];
  }

  async addModelProvider(provider: ModelProvider): Promise<void> {
    const config = this.configCache ?? (await this.readConfig());
    config.modelProviders = [
      ...config.modelProviders.filter((p) => p.id !== provider.id),
      provider,
    ];
    await this.writeConfig(config);
  }

  async removeModelProvider(providerId: string): Promise<void> {
    const config = this.configCache ?? (await this.readConfig());
    config.modelProviders = config.modelProviders.filter((p) => p.id !== providerId);
    config.models = config.models.filter((m) => m.providerId !== providerId);
    await this.writeConfig(config);
  }

  async updateModelProvider(providerId: string, updates: Partial<ModelProvider>): Promise<void> {
    const config = this.configCache ?? (await this.readConfig());
    config.modelProviders = config.modelProviders.map((p) =>
      p.id === providerId ? { ...p, ...updates } : p
    );
    await this.writeConfig(config);
  }

  listModels(): ModelConfig[] {
    return this.configCache?.models ?? [];
  }

  async addModel(model: ModelConfig): Promise<void> {
    const config = this.configCache ?? (await this.readConfig());
    config.models = [...config.models.filter((m) => m.id !== model.id), model];
    await this.writeConfig(config);
  }

  async removeModel(modelId: string): Promise<void> {
    const config = this.configCache ?? (await this.readConfig());
    config.models = config.models.filter((m) => m.id !== modelId);
    await this.writeConfig(config);
  }

  async updateModel(modelId: string, updates: Partial<ModelConfig>): Promise<void> {
    const config = this.configCache ?? (await this.readConfig());
    config.models = config.models.map((m) => (m.id === modelId ? { ...m, ...updates } : m));
    await this.writeConfig(config);
  }

  listMCPServers(): MCPServerConfig[] {
    return this.configCache?.mcpServers ?? [];
  }

  async addMCPServer(server: MCPServerConfig): Promise<void> {
    const config = this.configCache ?? (await this.readConfig());
    config.mcpServers = [...config.mcpServers.filter((s) => s.name !== server.name), server];
    await this.writeConfig(config);
  }

  async removeMCPServer(serverName: string): Promise<void> {
    const config = this.configCache ?? (await this.readConfig());
    config.mcpServers = config.mcpServers.filter((s) => s.name !== serverName);
    await this.writeConfig(config);
  }

  async updateMCPServer(serverName: string, updates: Partial<MCPServerConfig>): Promise<void> {
    const config = this.configCache ?? (await this.readConfig());
    config.mcpServers = config.mcpServers.map((s) =>
      s.name === serverName ? { ...s, ...updates } : s
    );
    await this.writeConfig(config);
  }

  listPermissions(): PermissionConfig[] {
    return [];
  }

  async addPermission(_permission: PermissionConfig): Promise<void> {
    throw new Error('Junie does not support file-based permission rules');
  }

  async removePermission(_permissionId: string): Promise<void> {
    throw new Error('Junie does not support file-based permission rules');
  }

  async updatePermission(_permissionId: string, _updates: Partial<PermissionConfig>): Promise<void> {
    throw new Error('Junie does not support file-based permission rules');
  }

  async backupConfig(): Promise<string> {
    return backupFile(this.mcpPathFor());
  }

  async restoreConfig(backupPath: string): Promise<void> {
    const content = await readFileSafe(backupPath);
    if (!content) throw new Error(`Backup file not found: ${backupPath}`);
    await writeFileSafe(this.mcpPathFor(), content);
    this.configCache = null;
    this.mcpRawCache = null;
    this.profilesCache = new Map();
  }
}

export function createJunieAdapter(): AgentAdapter {
  return new JunieAdapter();
}
