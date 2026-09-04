/**
 * Continue.dev Adapter
 *
 * Continue (https://docs.continue.dev) keeps its agent config at:
 *   - macOS/Linux: ~/.continue/config.yaml   (YAML)
 *   - Windows:     %USERPROFILE%\.continue\config.yaml
 *
 * MCP servers live INSIDE config.yaml under the `mcpServers:` key as a LIST of
 * objects (name is a field, not a map key). Verified against the Zod schema in
 * @continuedev/config-yaml:
 *
 *   mcpServers:
 *     - name: SQLite MCP
 *       type: stdio
 *       command: npx
 *       args: ["-y", "mcp-sqlite", "/path/db.db"]
 *     - name: remote
 *       type: streamable-http        # or "sse"
 *       url: https://example.com/mcp
 *     - name: supabase
 *       command: npx
 *       args: ["-y", "@supabase/mcp-server-supabase@latest"]
 *       env: { SUPABASE_TOKEN: "..." }
 *
 * Field names are `command`/`args`/`env`/`url`/`type` (type: stdio | sse |
 * streamable-http). This adapter reads/writes config.yaml with js-yaml,
 * preserving unknown top-level keys.
 *
 * Model providers ARE file-configurable in the same config.yaml `models:`
 * list (docs.continue.dev/reference — config.json is deprecated). OpenAI-
 * compatible entries use `provider: openai` + `apiBase`:
 *
 *   models:
 *     - name: My Model
 *       provider: openai
 *       apiBase: https://gateway.example.com/v1
 *       model: my-model-id
 *       apiKey: <literal or ${{ secrets.ENV_VAR }}>
 *       roles: [chat, edit, apply, summarize]
 *       capabilities: [tool_use, image_input]
 *       defaultCompletionOptions:
 *         contextLength: 128000
 *         maxTokens: 8192
 *
 * Entries are grouped into providers per apiBase (provider id derived from
 * the base URL); unknown per-entry keys are preserved on write.
 *
 * Sources: https://docs.continue.dev/reference
 *          https://docs.continue.dev/customize/deep-dives/mcp
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

const CONTINUE_CONFIG_PATHS = {
  darwin: '~/.continue/config.yaml',
  win32: '%USERPROFILE%\\.continue\\config.yaml',
  linux: '~/.continue/config.yaml',
} as const;

/** A single Continue mcpServers list entry on disk. */
interface ContinueMCPServer {
  name?: string;
  serverName?: string;
  type?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  url?: string;
  apiKey?: string;
  requestOptions?: Record<string, unknown>;
  [key: string]: unknown;
}

export class ContinueAdapter implements AgentAdapter {
  readonly info: AgentInfo = {
    id: 'continue',
    name: 'Continue',
    description: 'Continue — open-source AI IDE/CLI (MCP via mcpServers list in config.yaml).',
    configFormat: 'yaml' as ConfigFormat,
    configPaths: { ...CONTINUE_CONFIG_PATHS },
    binaries: ['continue'],
    // MCP servers live inside config.yaml
    mcpConfigPaths: { ...CONTINUE_CONFIG_PATHS },
    modelConfigPaths: {
      darwin: [CONTINUE_CONFIG_PATHS.darwin],
      win32: [CONTINUE_CONFIG_PATHS.win32],
      linux: [CONTINUE_CONFIG_PATHS.linux],
    },
    modelCredentialPaths: {
      darwin: ['~/.continue/.env'],
      win32: ['%USERPROFILE%\\.continue\\.env'],
      linux: ['~/.continue/.env'],
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
    return resolveConfigPath(CONTINUE_CONFIG_PATHS[current] || CONTINUE_CONFIG_PATHS.darwin);
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
    if (content) {
      try {
        const raw = parseConfig(content, 'yaml') as Record<string, unknown> | null;
        this.rawCache = raw && typeof raw === 'object' ? raw : {};
        mcpServers = this.decodeMCPRaw(this.rawCache.mcpServers);
      } catch {
        this.rawCache = {};
      }
    }

    const { modelProviders, models } = this.rawCache
      ? this.decodeModelsRaw(this.rawCache)
      : { modelProviders: [] as ModelProvider[], models: [] as ModelConfig[] };

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
    raw.mcpServers = this.encodeMCP(config.mcpServers);
    this.encodeModelsRaw(raw, config.modelProviders, config.models);
    await backupFile(this.configPathFor()).catch(() => undefined);
    await writeFileSafe(this.configPathFor(), stringifyConfig(raw, 'yaml'));
    this.rawCache = raw;
    this.configCache = config;
  }

  /**
   * Drift projection: model entries express apiBase/apiKey/roles/capabilities
   * + completion options. Grouping-derived provider ids are not config.
   */
  expressibleProviderConfig = (config: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    if (config.baseUrl !== undefined) out.baseUrl = config.baseUrl;
    if (config.apiKey !== undefined) out.apiKey = config.apiKey;
    return out;
  };

  // ==========================================================================
  // models: list conversion (unified <-> config.yaml)
  // ==========================================================================

  private isRecordValue(v: unknown): v is Record<string, unknown> {
    return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
  }

  private continueProviderId(apiBase: string): string {
    let host = apiBase.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    host = host.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    return host || 'custom-endpoint';
  }

  private decodeModelsRaw(raw: Record<string, unknown>): {
    modelProviders: ModelProvider[];
    models: ModelConfig[];
  } {
    const list = Array.isArray(raw.models) ? raw.models : [];
    const modelProviders: ModelProvider[] = [];
    const models: ModelConfig[] = [];
    for (const entry of list) {
      if (!this.isRecordValue(entry)) continue;
      const provider = typeof entry.provider === 'string' ? entry.provider : '';
      const modelId = typeof entry.model === 'string' ? entry.model : '';
      // Only OpenAI-compatible custom endpoints are surfaced as registry
      // providers; built-in provider entries keep flowing through Continue.
      if (provider !== 'openai' || !modelId) continue;
      const apiBase = typeof entry.apiBase === 'string' ? entry.apiBase : '';
      if (!apiBase) continue;
      const providerId = `continue-${this.continueProviderId(apiBase)}`;
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
            ...(typeof entry.apiKey === 'string' ? { apiKey: entry.apiKey } : {}),
          },
        } as ModelProvider;
        modelProviders.push(p);
      }
      const dco = this.isRecordValue(entry.defaultCompletionOptions)
        ? entry.defaultCompletionOptions
        : {};
      const roles =
        Array.isArray(entry.roles) && entry.roles.length > 0
          ? (entry.roles.filter((r) => typeof r === 'string') as ModelConfig['roles'])
          : (['chat', 'edit', 'apply', 'summarize'] as ModelConfig['roles']);
      const capabilities = Array.isArray(entry.capabilities)
        ? (entry.capabilities.filter((c) => typeof c === 'string') as ModelConfig['capabilities'])
        : (['tool_use'] as ModelConfig['capabilities']);
      models.push({
        id: modelId,
        providerId,
        name: modelId,
        displayName: typeof entry.name === 'string' && entry.name ? entry.name : modelId,
        roles,
        capabilities,
        contextLength:
          typeof dco.contextLength === 'number' ? dco.contextLength : undefined,
        maxTokens: typeof dco.maxTokens === 'number' ? dco.maxTokens : undefined,
        temperature:
          typeof dco.temperature === 'number' ? dco.temperature : undefined,
        customOptions: entry,
      } as ModelConfig);
    }
    return { modelProviders, models };
  }

  private encodeModelsRaw(
    raw: Record<string, unknown>,
    providers: ModelProvider[],
    models: ModelConfig[]
  ): void {
    const priorList = Array.isArray(raw.models) ? raw.models : [];
    // Managed keys: derived from the grouping, so decode/encode are stable.
    const managedIds = new Set(
      providers.map((p) => p.id)
    );
    const out: unknown[] = [];
    // Keep every non-managed entry (built-ins + hand-written) verbatim.
    for (const entry of priorList) {
      if (!this.isRecordValue(entry)) continue;
      const provider = typeof entry.provider === 'string' ? entry.provider : '';
      const modelId = typeof entry.model === 'string' ? entry.model : '';
      const apiBase = typeof entry.apiBase === 'string' ? entry.apiBase : '';
      const isManaged =
        provider === 'openai' &&
        modelId &&
        apiBase &&
        managedIds.has(`continue-${this.continueProviderId(apiBase)}`);
      if (!isManaged) {
        out.push(entry);
        continue;
      }
      // Re-emit only entries whose model id still exists.
      const pid = `continue-${this.continueProviderId(apiBase)}`;
      const stillThere = models.some(
        (m) => m.providerId === pid && m.id === modelId
      );
      if (!stillThere) continue;
      // Falls through to the unified re-encode below (skip here).
    }
    // Re-encode managed providers from the unified lists.
    for (const p of providers) {
      const cfg = (p.config || {}) as Record<string, unknown>;
      const priorProviderModels = priorList.filter(
        (e: unknown) =>
          this.isRecordValue(e) &&
          e.provider === 'openai' &&
          typeof e.apiBase === 'string' &&
          `continue-${this.continueProviderId(e.apiBase)}` === p.id
      ) as Record<string, unknown>[];
      const priorByModel = new Map<string, Record<string, unknown>>();
      for (const e of priorProviderModels) {
        if (typeof e.model === 'string') priorByModel.set(e.model, e);
      }
      for (const m of models.filter((m) => m.providerId === p.id)) {
        const prior = this.isRecordValue(m.customOptions)
          ? (m.customOptions as Record<string, unknown>)
          : priorByModel.get(m.id) || {};
        out.push({
          ...prior,
          name: m.displayName || m.name || m.id,
          provider: 'openai',
          ...(cfg.baseUrl ? { apiBase: cfg.baseUrl } : {}),
          model: m.id,
          ...(cfg.apiKey ? { apiKey: cfg.apiKey } : {}),
          roles: m.roles?.length ? m.roles : ['chat', 'edit', 'apply', 'summarize'],
          ...(m.capabilities?.length ? { capabilities: m.capabilities } : {}),
          ...(m.contextLength || m.maxTokens || m.temperature !== undefined
            ? {
                defaultCompletionOptions: {
                  ...(m.contextLength ? { contextLength: m.contextLength } : {}),
                  ...(m.maxTokens ? { maxTokens: m.maxTokens } : {}),
                  ...(m.temperature !== undefined ? { temperature: m.temperature } : {}),
                },
              }
            : {}),
        });
      }
    }
    raw.models = out;
  }

  validateConfig(config: unknown): { valid: boolean; errors: string[] } {
    return validateAgentConfig(config);
  }

  // ============================================================================
  // MCP shape conversion (unified array <-> Continue YAML list)
  // ============================================================================

  private isRecord(v: unknown): v is Record<string, unknown> {
    return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
  }

  private mapType(type?: string, hasUrl?: boolean): MCPServerConfig['type'] {
    const t = (type || (hasUrl ? 'streamable-http' : 'stdio')).toLowerCase();
    if (t === 'sse') return 'sse';
    if (t === 'streamable-http' || t === 'http' || t === 'remote' || hasUrl) return 'http';
    return 'stdio';
  }

  private decodeMCPRaw(raw: unknown): MCPServerConfig[] {
    if (!Array.isArray(raw)) return [];
    const out: MCPServerConfig[] = [];
    for (const entry of raw) {
      if (!this.isRecord(entry)) continue;
      const name = typeof entry.name === 'string' ? entry.name : undefined;
      if (!name) continue;
      const hasUrl = typeof entry.url === 'string';
      out.push({
        name,
        type: this.mapType(entry.type as string | undefined, hasUrl),
        command: typeof entry.command === 'string' ? entry.command : undefined,
        args: Array.isArray(entry.args) ? entry.args : undefined,
        env: this.isRecord(entry.env) ? (entry.env as Record<string, string>) : undefined,
        cwd: typeof entry.cwd === 'string' ? entry.cwd : undefined,
        url: typeof entry.url === 'string' ? entry.url : undefined,
        apiKey: typeof entry.apiKey === 'string' ? entry.apiKey : undefined,
        requestOptions: this.isRecord(entry.requestOptions)
          ? (entry.requestOptions as Record<string, unknown>)
          : undefined,
        enabled: entry.enabled !== false,
      } as MCPServerConfig);
    }
    return out;
  }

  private encodeMCP(servers: MCPServerConfig[]): ContinueMCPServer[] {
    const existing = Array.isArray(this.rawCache?.mcpServers)
      ? (this.rawCache!.mcpServers as ContinueMCPServer[])
      : [];
    const out: ContinueMCPServer[] = [];
    for (const s of servers) {
      const prior = existing.find((e) => e.name === s.name) || {};
      if (s.type === 'stdio' && s.command) {
        out.push({
          ...prior,
          name: s.name,
          type: prior.type || 'stdio',
          command: s.command,
          ...(s.args?.length ? { args: s.args } : {}),
          ...(s.env ? { env: s.env } : {}),
          ...(s.cwd ? { cwd: s.cwd } : {}),
          ...(s.enabled === false ? { enabled: false } : {}),
        });
      } else if (s.url) {
        out.push({
          ...prior,
          name: s.name,
          type: prior.type || (s.type === 'sse' ? 'sse' : 'streamable-http'),
          url: s.url,
          ...(s.enabled === false ? { enabled: false } : {}),
        });
      } else if (Object.keys(prior).length > 0) {
        out.push(prior);
      }
    }
    return out;
  }

  // ============================================================================
  // Model / Provider Operations (not managed in Continue config)
  // ============================================================================

  listModelProviders(): ModelProvider[] {
    return [];
  }
  async addModelProvider(): Promise<void> {
    throw new Error(
      'Continue manages models via the models: list in config.yaml — not editable here'
    );
  }
  async removeModelProvider(): Promise<void> {
    throw new Error(
      'Continue manages models via the models: list in config.yaml — not editable here'
    );
  }
  async updateModelProvider(): Promise<void> {
    throw new Error(
      'Continue manages models via the models: list in config.yaml — not editable here'
    );
  }
  listModels(): ModelConfig[] {
    return [];
  }
  async addModel(): Promise<void> {
    throw new Error(
      'Continue manages models via the models: list in config.yaml — not editable here'
    );
  }
  async removeModel(): Promise<void> {
    throw new Error(
      'Continue manages models via the models: list in config.yaml — not editable here'
    );
  }
  async updateModel(): Promise<void> {
    throw new Error(
      'Continue manages models via the models: list in config.yaml — not editable here'
    );
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
    throw new Error('Continue does not support permission rules in its config file');
  }
  async removePermission(): Promise<void> {
    throw new Error('Continue does not support permission rules in its config file');
  }
  async updatePermission(): Promise<void> {
    throw new Error('Continue does not support permission rules in its config file');
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

export function createContinueAdapter(): ContinueAdapter {
  return new ContinueAdapter();
}
