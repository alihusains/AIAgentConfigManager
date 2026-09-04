/**
 * OMP (Oh My Pi) Adapter
 *
 * OMP (https://github.com/can1357/oh-my-pi) is the Pi fork with a Rust core
 * + Bun runtime. It stores its config under ~/.omp/agent/ as three files:
 *
 *   - config.yml   app settings (main config) — never touched by this adapter
 *   - models.yml   provider/model store (YAML) — FULL read/write below
 *   - mcp.json     MCP servers (JSON) — partial view (omp imports servers
 *                  from other agents with complex precedence), so MCP stays
 *                  read-only here
 *
 * models.yml schema (docs/models.md — the canonical reference):
 *
 *   providers:
 *     my-gateway:
 *       baseUrl: https://gateway.example.com/v1
 *       apiKey: MY_GATEWAY_API_KEY   # env-var name OR literal OR "!cmd"
 *       api: openai-completions      # openai-completions | openai-responses |
 *                                    # anthropic-messages | google-* | bedrock-…
 *       auth: apiKey                 # apiKey | none | oauth
 *       models:
 *         - id: some-model-id
 *           name: Some Model
 *           contextWindow: 128000
 *           maxTokens: 16384
 *
 * Only the `providers` root key is valid in models.yml (unknown keys fail the
 * omp schema). The raw `api` protocol is stashed in config.ompApi so native
 * providers round-trip losslessly. Legacy models.json is never written — omp
 * auto-migrates it to models.yml and writing both would desync.
 *
 * Source: https://github.com/can1357/oh-my-pi/blob/main/docs/models.md
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
  restoreBackup,
  fileExists,
} from '../utils';

const OMP_CONFIG_PATHS: Record<Platform, string> = {
  darwin: '~/.omp/agent/config.yml',
  win32: '%USERPROFILE%\\.omp\\agent\\config.yml',
  linux: '~/.omp/agent/config.yml',
};

const OMP_MODELS_PATHS: Record<Platform, string> = {
  darwin: '~/.omp/agent/models.yml',
  win32: '%USERPROFILE%\\.omp\\agent\\models.yml',
  linux: '~/.omp/agent/models.yml',
};

const OMP_MCP_PATHS: Record<Platform, string> = {
  darwin: '~/.omp/agent/mcp.json',
  win32: '%USERPROFILE%\\.omp\\agent\\mcp.json',
  linux: '~/.omp/agent/mcp.json',
};

/** Unified wire type for an omp `api` protocol value. */
function ompApiToUnified(api: string | undefined): ModelProvider['type'] {
  switch (api) {
    case 'openai-completions':
    case 'openai-responses':
    case 'openai-codex-responses':
    case 'azure-openai-responses':
      return 'openai-compatible';
    case 'anthropic-messages':
      return 'anthropic';
    default:
      // google-generative-ai | google-gemini-cli | google-vertex |
      // bedrock-converse-stream (and unknown): agent-native protocol.
      return 'custom';
  }
}

class OMPAdapter implements AgentAdapter {
  readonly info: AgentInfo;
  private modelsRawCache: Record<string, unknown> | null = null;
  private configCache: AgentConfig | null = null;

  constructor() {
    this.info = {
      id: 'omp',
      name: 'OMP (Oh My Pi)',
      description:
        'Oh My Pi (omp) — Pi fork with a Rust core + Bun runtime. Full provider/model read+write of ~/.omp/agent/models.yml.',
      configFormat: 'yaml' as ConfigFormat,
      configPaths: OMP_CONFIG_PATHS,
      supports: {
        modelProviders: true,
        mcpServers: false,
        permissions: false,
        projectConfig: false,
      },
      binaries: ['omp'],
      mcpConfigPaths: OMP_MCP_PATHS,
      modelConfigPaths: {
        darwin: [`${OMP_MODELS_PATHS.darwin}`],
        win32: [OMP_MODELS_PATHS.win32],
        linux: [OMP_MODELS_PATHS.linux],
      },
      versionArgs: ['--version'],
    };
  }

  private detectPlatform(): Platform {
    if (typeof process !== 'undefined' && process.platform) {
      const p = process.platform;
      if (p === 'darwin') return 'darwin';
      if (p === 'win32') return 'win32';
      return 'linux';
    }
    return 'darwin';
  }

  private modelsPathFor(platform?: Platform): string {
    const current = platform || this.detectPlatform();
    return resolveConfigPath(OMP_MODELS_PATHS[current] || OMP_MODELS_PATHS.darwin, current);
  }

  getConfigPath(platform?: Platform): string {
    const current = platform || this.detectPlatform();
    return resolveConfigPath(OMP_CONFIG_PATHS[current] || OMP_CONFIG_PATHS.darwin, current);
  }

  getMCPConfigPath(platform?: Platform): string | null {
    const current = platform || this.detectPlatform();
    return resolveConfigPath(OMP_MCP_PATHS[current] || OMP_MCP_PATHS.darwin, current);
  }

  async readConfig(): Promise<AgentConfig> {
    const content = await readFileSafe(this.modelsPathFor());
    let raw: Record<string, unknown> | null = null;
    if (content) {
      try {
        raw = parseConfig(content, 'yaml') as Record<string, unknown> | null;
      } catch {
        raw = null;
      }
    }
    this.modelsRawCache = raw && typeof raw === 'object' ? raw : {};

    const { modelProviders, models } = this.decodeProvidersRaw(this.modelsRawCache);
    const config: AgentConfig = {
      version: '1.0.0',
      lastModified: Date.now(),
      modelProviders,
      models,
      // MCP stays a partial view (omp merges servers from other agents) —
      // never surfaced into the unified config to avoid lossy round-trips.
      mcpServers: [],
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
    const raw: Record<string, unknown> = this.modelsRawCache
      ? JSON.parse(JSON.stringify(this.modelsRawCache))
      : {};
    this.encodeProvidersRaw(raw, config.modelProviders, config.models);
    await backupFile(this.modelsPathFor()).catch(() => undefined);
    await writeFileSafe(this.modelsPathFor(), stringifyConfig(raw, 'yaml'));
    this.modelsRawCache = raw;
    this.configCache = config;
  }

  validateConfig(config: unknown): { valid: boolean; errors: string[] } {
    return validateAgentConfig(config);
  }

  /**
   * Drift projection: models.yml providers express baseUrl/apiKey/api/auth.
   * ompApi/ompAuth/wireApi round-trip bookkeeping is not drift.
   */
  expressibleProviderConfig = (config: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    if (config.baseUrl !== undefined) out.baseUrl = config.baseUrl;
    if (config.apiKey !== undefined) out.apiKey = config.apiKey;
    return out;
  };

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

  async updateModelProvider(
    providerId: string,
    updates: Partial<ModelProvider>
  ): Promise<void> {
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
    return [];
  }

  async addMCPServer(_server: MCPServerConfig): Promise<void> {
    throw new Error(
      'OMP MCP support is read-only here: omp merges servers from other agent configs, so this adapter never rewrites mcp.json'
    );
  }

  async removeMCPServer(_serverName: string): Promise<void> {
    throw new Error('OMP MCP support is read-only here (merged partial view)');
  }

  async updateMCPServer(
    _serverName: string,
    _updates: Partial<MCPServerConfig>
  ): Promise<void> {
    throw new Error('OMP MCP support is read-only here (merged partial view)');
  }

  listPermissions(): PermissionConfig[] {
    return [];
  }

  async addPermission(_permission: PermissionConfig): Promise<void> {
    throw new Error('OMP permissions use tools.approval + bash.patterns; not supported here');
  }

  async removePermission(_permissionId: string): Promise<void> {
    throw new Error('OMP permissions use tools.approval + bash.patterns; not supported here');
  }

  async updatePermission(
    _permissionId: string,
    _updates: Partial<PermissionConfig>
  ): Promise<void> {
    throw new Error('OMP permissions use tools.approval + bash.patterns; not supported here');
  }

  async backupConfig(): Promise<string> {
    const modelsPath = this.modelsPathFor();
    if (!(await fileExists(modelsPath))) {
      throw new Error('No OMP models.yml found to back up');
    }
    return backupFile(modelsPath);
  }

  async restoreConfig(backupPath: string): Promise<void> {
    await restoreBackup(backupPath, this.modelsPathFor());
    this.modelsRawCache = null;
    this.configCache = null;
  }

  // ============================================================================
  // Provider shape conversion (unified <-> models.yml `providers`)
  // ============================================================================

  private isRecord(v: unknown): v is Record<string, unknown> {
    return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
  }

  private decodeProvidersRaw(raw: Record<string, unknown> | null): {
    modelProviders: ModelProvider[];
    models: ModelConfig[];
  } {
    const providersRaw = raw && this.isRecord(raw.providers) ? raw.providers : {};
    const modelProviders: ModelProvider[] = [];
    const models: ModelConfig[] = [];
    for (const [key, entry] of Object.entries(providersRaw)) {
      if (!this.isRecord(entry)) continue;
      const api = typeof entry.api === 'string' ? entry.api : undefined;
      const unifiedType = ompApiToUnified(api);
      modelProviders.push({
        id: key,
        name: key,
        type: unifiedType,
        enabled: true,
        priority: 0,
        config: {
          ...(typeof entry.baseUrl === 'string' ? { baseUrl: entry.baseUrl } : {}),
          // Raw string: env-var name, literal key, or "!cmd" secret command —
          // preserved verbatim so omp's own semantics are never broken.
          ...(typeof entry.apiKey === 'string' ? { apiKey: entry.apiKey } : {}),
          ...(api ? { ompApi: api } : {}),
          ...(typeof entry.auth === 'string' ? { ompAuth: entry.auth } : {}),
          ...(api === 'openai-completions' ? { wireApi: 'chat' } : {}),
          ...(api === 'openai-responses' ? { wireApi: 'responses' } : {}),
        },
      } as ModelProvider);
      if (Array.isArray(entry.models)) {
        for (const m of entry.models) {
          if (!this.isRecord(m)) continue;
          const id = typeof m.id === 'string' ? m.id : '';
          if (!id) continue;
          models.push({
            id,
            providerId: key,
            name: typeof m.name === 'string' ? m.name : id,
            displayName: typeof m.name === 'string' ? m.name : id,
            roles: ['chat', 'edit', 'apply', 'summarize'],
            capabilities: ['tool_use'],
            contextLength: typeof m.contextWindow === 'number' ? m.contextWindow : undefined,
            maxTokens: typeof m.maxTokens === 'number' ? m.maxTokens : undefined,
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
    const priorProviders: Record<string, unknown> = this.isRecord(raw.providers)
      ? (raw.providers as Record<string, unknown>)
      : {};
    const providersOut: Record<string, unknown> = {};
    for (const p of providers) {
      const prior: Record<string, unknown> = this.isRecord(priorProviders[p.id])
        ? (priorProviders[p.id] as Record<string, unknown>)
        : {};
      const priorModels = Array.isArray(prior.models) ? prior.models : [];
      const cfg = (p.config || {}) as Record<string, unknown>;
      const api =
        typeof cfg.ompApi === 'string'
          ? cfg.ompApi
          : p.type === 'anthropic'
            ? 'anthropic-messages'
            : cfg.wireApi === 'responses'
              ? 'openai-responses'
              : 'openai-completions';
      const encodedModels: Record<string, unknown>[] = [];
      const seen = new Set<string>();
      // Preserve omp-native fields on models that still exist.
      for (const priorModel of priorModels) {
        if (!this.isRecord(priorModel)) continue;
        const id = typeof priorModel.id === 'string' ? priorModel.id : '';
        const unified = models.find((m) => m.providerId === p.id && m.id === id);
        if (unified) {
          encodedModels.push({
            ...priorModel,
            id,
            name: unified.displayName || unified.name || id,
            ...(unified.contextLength ? { contextWindow: unified.contextLength } : {}),
            ...(unified.maxTokens ? { maxTokens: unified.maxTokens } : {}),
          });
          seen.add(id);
        }
      }
      // Append newly-registered models.
      for (const m of models) {
        if (m.providerId !== p.id || seen.has(m.id)) continue;
        encodedModels.push({
          id: m.id,
          name: m.displayName || m.name || m.id,
          ...(m.contextLength ? { contextWindow: m.contextLength } : {}),
          ...(m.maxTokens ? { maxTokens: m.maxTokens } : {}),
        });
      }
      providersOut[p.id] = {
        ...prior,
        ...(cfg.baseUrl ? { baseUrl: cfg.baseUrl } : {}),
        ...(cfg.apiKey ? { apiKey: cfg.apiKey } : {}),
        api,
        ...(typeof cfg.ompAuth === 'string' ? { auth: cfg.ompAuth } : {}),
        ...(encodedModels.length > 0 ? { models: encodedModels } : {}),
      };
    }
    raw.providers = providersOut;
  }
}

export function createOmpAdapter(): AgentAdapter {
  return new OMPAdapter();
}
