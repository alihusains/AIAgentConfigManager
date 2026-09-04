/**
 * Aider Adapter
 *
 * Aider (https://aider.chat) is a Python terminal pair-programmer. Managed
 * surfaces (docs: aider.chat/docs/config/adv-model-settings.html +
 * /docs/llms/openai-compat.html):
 *
 *   - ~/.aider.model.settings.yml — per-model dash entries:
 *
 *       - name: openai/my-model-id
 *         extra_params:
 *           api_base: https://gw.example.com/v1   # litellm.completion kwarg
 *           api_key: <key>                        # litellm.completion kwarg
 *           extra_headers: {}
 *           max_tokens: 8192
 *
 *   - ~/.aider.model.metadata.json — context-window metadata per model:
 *       { "openai/my-model-id": { "max_input_tokens": 128000,
 *                                 "litellm_provider": "openai",
 *                                 "mode": "chat" } }
 *
 * Models registered with an api_base in extra_params use the litellm
 * `api_base`/`api_key` completion kwargs (the documented env-var route,
 * OPENAI_API_BASE/OPENAI_API_KEY, only supports ONE endpoint per prefix, so
 * per-model kwargs are the multi-provider-safe channel). Entries without an
 * api_base (env-based, user-managed) are preserved verbatim and never
 * decoded as registry providers.
 *
 * Aider has NO native MCP support — mcpServers stays unsupported. The main
 * ~/.aider.conf.yml is surfaced read-only via customSettings.
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

const AIDER_CONFIG_PATHS = {
  darwin: '~/.aider.conf.yml',
  win32: '%USERPROFILE%\\.aider.conf.yml',
  linux: '~/.aider.conf.yml',
} as const;

export class AiderAdapter implements AgentAdapter {
  readonly info: AgentInfo;

  /** Parsed .aider.model.settings.yml entries (all, incl. env-managed). */
  private settingsCache: Record<string, unknown>[] | null = null;

  /** Last read config, so successive add* calls accumulate before one write. */
  private configCache: AgentConfig | null = null;

  constructor() {
    this.info = {
      id: 'aider',
      name: 'Aider',
      description:
        'Aider — AI pair programming in your terminal (Python). Custom models via ~/.aider.model.settings.yml; no native MCP.',
      configFormat: 'yaml',
      configPaths: { ...AIDER_CONFIG_PATHS },
      modelConfigPaths: {
        darwin: ['~/.aider.model.settings.yml', '~/.aider.model.metadata.json'],
        win32: [
          '%USERPROFILE%\\.aider.model.settings.yml',
          '%USERPROFILE%\\.aider.model.metadata.json',
        ],
        linux: ['~/.aider.model.settings.yml', '~/.aider.model.metadata.json'],
      },
      supports: {
        modelProviders: true,
        mcpServers: false,
        permissions: false,
        projectConfig: false,
      },
      binaries: ['aider'],
    };
  }

  getConfigPath(platform: Platform = 'darwin'): string {
    return resolveConfigPath(AIDER_CONFIG_PATHS[platform] || AIDER_CONFIG_PATHS.darwin, platform);
  }

  getMCPConfigPath(): string | null {
    return null;
  }

  async readConfig(): Promise<AgentConfig> {
    const configPath = this.getConfigPath();
    const raw = await readFileSafe(configPath);
    const parsed = raw !== null ? parseConfig(raw, 'yaml') : null;

    const { modelProviders, models } = await this.decodeModelSettings();

    const config: AgentConfig = {
      version: '1.0.0',
      lastModified: Date.now(),
      modelProviders,
      models,
      mcpServers: [] as MCPServerConfig[],
      permissions: [] as PermissionConfig[],
      // Aider's main YAML is flat scalar options — read-only view.
      customSettings:
        parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {},
    };
    this.configCache = config;
    return config;
  }

  async writeConfig(config: AgentConfig): Promise<void> {
    const validation = validateAgentConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid config: ${validation.errors.join(', ')}`);
    }
    await this.encodeModelSettings(config.modelProviders, config.models);
    this.configCache = config;
  }

  validateConfig(config: unknown): { valid: boolean; errors: string[] } {
    return validateAgentConfig(config);
  }

  /**
   * Drift projection: model-settings entries express api_base/api_key/
   * extra_headers via extra_params. Metadata bookkeeping is not config.
   */
  expressibleProviderConfig(config: Record<string, unknown>) {
    const out: Record<string, unknown> = {};
    if (config.baseUrl !== undefined) out.baseUrl = config.baseUrl;
    if (config.apiKey !== undefined) out.apiKey = config.apiKey;
    return out;
  }

  // ==========================================================================
  // Model settings conversion (unified <-> .aider.model.settings.yml)
  // ==========================================================================

  private isRecord(v: unknown): v is Record<string, unknown> {
    return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
  }

  private settingsPath(): string {
    return resolveConfigPath('~/.aider.model.settings.yml');
  }

  private metadataPath(): string {
    return resolveConfigPath('~/.aider.model.metadata.json');
  }

  private async decodeModelSettings(): Promise<{
    modelProviders: ModelProvider[];
    models: ModelConfig[];
  }> {
    this.settingsCache = null;
    const content = await readFileSafe(this.settingsPath());
    if (!content) return { modelProviders: [], models: [] };
    let list: unknown;
    try {
      list = parseConfig(content, 'yaml');
    } catch {
      return { modelProviders: [], models: [] };
    }
    if (!Array.isArray(list)) return { modelProviders: [], models: [] };
    const entries = list.filter(
      (e): e is Record<string, unknown> =>
        Boolean(e) && typeof e === 'object' && !Array.isArray(e)
    );
    this.settingsCache = entries;
    const modelProviders: ModelProvider[] = [];
    const models: ModelConfig[] = [];
    for (const entry of entries) {
      const name = typeof entry.name === 'string' ? entry.name : '';
      if (!name) continue;
      const extra = this.isRecord(entry.extra_params) ? entry.extra_params : {};
      const apiBase = typeof extra.api_base === 'string' ? extra.api_base : '';
      // Entries WITHOUT api_base are user/env-managed — leave them alone.
      if (!apiBase) continue;
      const providerId = `aider-${apiBase.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
      let p = modelProviders.find((x) => x.id === providerId);
      if (!p) {
        p = {
          id: providerId,
          name: apiBase,
          type: 'openai-compatible',
          enabled: true,
          priority: 0,
          config: {
            baseUrl: apiBase,
            ...(typeof extra.api_key === 'string' ? { apiKey: extra.api_key } : {}),
          },
        } as ModelProvider;
        modelProviders.push(p);
      }
      // Strip the litellm prefix to get the bare model id.
      const modelId =
        name.replace(/^(?:openai|anthropic|azure)\//i, '').split('/').pop() || name;
      const meta = await this.readModelMetadata(name);
      models.push({
        id: modelId,
        providerId,
        name,
        displayName: modelId,
        roles: ['chat', 'edit', 'apply', 'summarize'],
        capabilities: ['tool_use'],
        contextLength: meta?.max_input_tokens,
        maxTokens: meta?.max_output_tokens,
        customOptions: entry,
      } as ModelConfig);
    }
    return { modelProviders, models };
  }

  private async encodeModelSettings(
    providers: ModelProvider[],
    models: ModelConfig[]
  ): Promise<void> {
    const path = this.settingsPath();
    const priorEntries = this.settingsCache ?? (await this.readAllSettingsEntries());
    const priorNoBase = priorEntries.filter((e) => {
      const extra = this.isRecord(e.extra_params) ? e.extra_params : {};
      return !extra.api_base; // env/user-managed entries are preserved
    });
    const out: Record<string, unknown>[] = [...priorNoBase];
    for (const p of providers) {
      const cfg = (p.config || {}) as Record<string, unknown>;
      for (const m of models.filter((m) => m.providerId === p.id)) {
        const prior = this.isRecord(m.customOptions)
          ? (m.customOptions as Record<string, unknown>)
          : {};
        const priorExtra = this.isRecord(prior.extra_params) ? prior.extra_params : {};
        const entry: Record<string, unknown> = {
          ...prior,
          name: m.name || m.id,
          extra_params: {
            ...priorExtra,
            ...(cfg.baseUrl ? { api_base: cfg.baseUrl } : {}),
            ...(cfg.apiKey ? { api_key: cfg.apiKey } : {}),
            ...(m.maxTokens ? { max_tokens: m.maxTokens } : {}),
          },
        };
        out.push(entry);
        await this.writeModelMetadata(m).catch(() => undefined);
      }
    }
    await backupFile(path).catch(() => undefined);
    await writeFileSafe(path, stringifyConfig(out, 'yaml'));
    this.settingsCache = out;
  }

  /** Read every settings entry without touching the caches. */
  private async readAllSettingsEntries(): Promise<Record<string, unknown>[]> {
    const content = await readFileSafe(this.settingsPath());
    if (!content) return [];
    try {
      const list = parseConfig(content, 'yaml');
      if (!Array.isArray(list)) return [];
      return list.filter(
        (e): e is Record<string, unknown> =>
          Boolean(e) && typeof e === 'object' && !Array.isArray(e)
      );
    } catch {
      return [];
    }
  }

  private async readModelMetadata(
    modelName: string
  ): Promise<{ max_input_tokens?: number; max_output_tokens?: number } | null> {
    const content = await readFileSafe(this.metadataPath());
    if (!content) return null;
    try {
      const raw = JSON.parse(content) as Record<string, unknown>;
      const meta = raw[modelName];
      if (!this.isRecord(meta)) return null;
      return {
        max_input_tokens:
          typeof meta.max_input_tokens === 'number' ? meta.max_input_tokens : undefined,
        max_output_tokens:
          typeof meta.max_output_tokens === 'number' ? meta.max_output_tokens : undefined,
      };
    } catch {
      return null;
    }
  }

  private async writeModelMetadata(m: ModelConfig): Promise<void> {
    if (!m.contextLength && !m.maxTokens) return;
    const path = this.metadataPath();
    let raw: Record<string, unknown> = {};
    const content = await readFileSafe(path);
    if (content) {
      try {
        raw = JSON.parse(content) as Record<string, unknown>;
      } catch {
        raw = {};
      }
    }
    const prior: Record<string, unknown> = this.isRecord(raw[m.name])
      ? (raw[m.name] as Record<string, unknown>)
      : {};
    raw[m.name] = {
      ...prior,
      ...(m.contextLength ? { max_input_tokens: m.contextLength } : {}),
      ...(m.maxTokens ? { max_output_tokens: m.maxTokens } : {}),
      litellm_provider: 'openai',
      mode: 'chat',
    };
    await writeFileSafe(path, `${JSON.stringify(raw, null, 2)}\n`);
  }

  // ==========================================================================
  // Model/provider helpers (registry materialization uses read/writeConfig)
  // ==========================================================================

  listModelProviders(): ModelProvider[] {
    return [];
  }

  async addModelProvider(provider: ModelProvider): Promise<void> {
    const current = this.configCache ?? (await this.readConfig());
    current.modelProviders = [
      ...current.modelProviders.filter((p) => p.id !== provider.id),
      provider,
    ];
    await this.writeConfig(current);
  }

  async removeModelProvider(providerId: string): Promise<void> {
    const current = this.configCache ?? (await this.readConfig());
    current.modelProviders = current.modelProviders.filter((p) => p.id !== providerId);
    current.models = current.models.filter((m) => m.providerId !== providerId);
    await this.writeConfig(current);
  }

  async updateModelProvider(providerId: string, updates: Partial<ModelProvider>): Promise<void> {
    const current = this.configCache ?? (await this.readConfig());
    current.modelProviders = current.modelProviders.map((p) =>
      p.id === providerId ? { ...p, ...updates } : p
    );
    await this.writeConfig(current);
  }

  listModels(): ModelConfig[] {
    return [];
  }

  async addModel(model: ModelConfig): Promise<void> {
    const current = this.configCache ?? (await this.readConfig());
    current.models = [...current.models.filter((m) => m.id !== model.id), model];
    await this.writeConfig(current);
  }

  async removeModel(modelId: string): Promise<void> {
    const current = this.configCache ?? (await this.readConfig());
    current.models = current.models.filter((m) => m.id !== modelId);
    await this.writeConfig(current);
  }

  async updateModel(modelId: string, updates: Partial<ModelConfig>): Promise<void> {
    const current = this.configCache ?? (await this.readConfig());
    current.models = current.models.map((m) => (m.id === modelId ? { ...m, ...updates } : m));
    await this.writeConfig(current);
  }

  listMCPServers(): MCPServerConfig[] {
    return [];
  }

  async addMCPServer(): Promise<void> {
    throw new Error('Aider has no native MCP support');
  }

  async removeMCPServer(): Promise<void> {
    throw new Error('Aider has no native MCP support');
  }

  async updateMCPServer(): Promise<void> {
    throw new Error('Aider has no native MCP support');
  }

  listPermissions(): PermissionConfig[] {
    return [];
  }

  async addPermission(): Promise<void> {
    throw new Error('Aider does not support permission rules');
  }

  async removePermission(): Promise<void> {
    throw new Error('Aider does not support permission rules');
  }

  async updatePermission(): Promise<void> {
    throw new Error('Aider does not support permission rules');
  }

  async backupConfig(): Promise<string> {
    return backupFile(this.settingsPath());
  }

  async restoreConfig(backupPath: string): Promise<void> {
    const content = await readFileSafe(backupPath);
    if (!content) throw new Error(`Backup file not found: ${backupPath}`);
    await writeFileSafe(this.settingsPath(), content);
    this.settingsCache = null;
    this.configCache = null;
  }
}

export function createAiderAdapter(): AgentAdapter {
  return new AiderAdapter();
}
